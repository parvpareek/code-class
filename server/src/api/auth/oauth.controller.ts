import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Prisma, Role } from '@prisma/client';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';

function getFrontendBase(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '');
}

function oauthErrorRedirect(res: Response, message: string): void {
  const base = getFrontendBase();
  res.redirect(`${base}/oauth/callback#error=${encodeURIComponent(message)}`);
}

function oauthSuccessRedirect(res: Response, token: string): void {
  const base = getFrontendBase();
  res.redirect(`${base}/oauth/callback#token=${encodeURIComponent(token)}`);
}

function parseRoleFromQuery(query: unknown): Role {
  const s = String(query ?? '').toUpperCase();
  return s === 'TEACHER' ? Role.TEACHER : Role.STUDENT;
}

/** role is stored in signed state so clients cannot forge teacher sign-up. */
function createSignedState(provider: 'google' | 'github', signupRole: Role): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  const payload = JSON.stringify({
    provider,
    signupRole,
    ts: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  });
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ p: payload, s: sig })).toString('base64url');
}

/** Returns signup role for new users; existing users ignore this. */
function parseAndVerifyOAuthState(
  stateParam: string,
  provider: 'google' | 'github'
): { ok: true; signupRole: Role } | { ok: false } {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return { ok: false };
    const raw = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8')) as { p: string; s: string };
    const expected = crypto.createHmac('sha256', secret).update(raw.p).digest('hex');
    if (raw.s !== expected) return { ok: false };
    const data = JSON.parse(raw.p) as {
      provider: string;
      ts: number;
      signupRole?: string;
    };
    if (data.provider !== provider) return { ok: false };
    if (Date.now() - data.ts > 15 * 60 * 1000) return { ok: false };
    let signupRole: Role = Role.STUDENT;
    if (data.signupRole === 'TEACHER' || data.signupRole === Role.TEACHER) {
      signupRole = Role.TEACHER;
    }
    return { ok: true, signupRole };
  } catch {
    return { ok: false };
  }
}

function issueUserJwt(userId: string, role: Role): string {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET!, { expiresIn: '1d' });
}

async function googleExchangeCode(code: string): Promise<{
  sub: string;
  email: string;
  name: string;
  emailVerified: boolean;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth is not configured');
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${txt}`);
  }

  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) {
    throw new Error('Google token response missing access_token');
  }

  const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userinfoRes.ok) {
    throw new Error('Failed to load Google profile');
  }

  const u = (await userinfoRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };

  return {
    sub: String(u.sub || ''),
    email: String(u.email || '').trim().toLowerCase(),
    name: String(u.name || u.email || 'User'),
    emailVerified: !!u.email_verified,
  };
}

async function githubExchangeCode(code: string): Promise<{
  id: string;
  login: string;
  name: string;
  email: string;
}> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('GitHub OAuth is not configured');
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const tokenJson = (await tokenRes.json()) as { access_token?: string; error_description?: string };

  if (!tokenJson.access_token) {
    throw new Error(tokenJson.error_description || 'GitHub token exchange failed');
  }

  const accessToken = tokenJson.access_token;

  const profileRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!profileRes.ok) {
    throw new Error('Failed to load GitHub profile');
  }

  const profile = (await profileRes.json()) as { id: number; login?: string; name?: string | null };

  const emailsRes = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!emailsRes.ok) {
    throw new Error('Failed to load GitHub emails');
  }

  const emails = (await emailsRes.json()) as { email: string; primary?: boolean; verified?: boolean }[];
  const primaryVerified = emails.find((e) => e.primary && e.verified);
  const anyVerified = primaryVerified || emails.find((e) => e.verified);

  if (!anyVerified?.email) {
    throw new Error('No verified email on GitHub account');
  }

  return {
    id: String(profile.id),
    login: profile.login || '',
    name: profile.name || profile.login || 'User',
    email: String(anyVerified.email).trim().toLowerCase(),
  };
}

async function finalizeOAuthUser(opts: {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name: string;
  newUserRole: Role;
}) {
  const { provider, providerId, email, name, newUserRole } = opts;
  const googleId = provider === 'google' ? providerId : undefined;
  const githubId = provider === 'github' ? providerId : undefined;

  const byGoogle = googleId ? await prisma.user.findUnique({ where: { googleId } }) : null;
  const byGithub = githubId ? await prisma.user.findUnique({ where: { githubId } }) : null;
  let user = byGoogle || byGithub;

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
  }

  if (user) {
    const update: {
      googleId?: string;
      githubId?: string;
      name?: string;
    } = {};
    if (googleId && user.googleId !== googleId) {
      update.googleId = googleId;
    }
    if (githubId && user.githubId !== githubId) {
      update.githubId = githubId;
    }
    if (name && user.name !== name) {
      update.name = name;
    }
    if (Object.keys(update).length > 0) {
      user = await prisma.user.update({ where: { id: user.id }, data: update });
    }
    return user;
  }

  return prisma.user.create({
    data: {
      email,
      name,
      googleId,
      githubId,
      password: null,
      role: newUserRole,
    },
  });
}

export const oauthGoogleStart = async (req: Request, res: Response): Promise<void> => {
  try {
    const cid = process.env.GOOGLE_CLIENT_ID;
    const redir = process.env.GOOGLE_REDIRECT_URI;
    if (!cid || !redir) {
      logger.warn('Google OAuth: GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI missing on server');
      res.status(503).send(
        'Google OAuth is not configured on the server. In Railway (or your host), set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI to match Google Cloud Console (OAuth client credentials and Authorized redirect URIs).'
      );
      return;
    }
    const role = parseRoleFromQuery(req.query.role);
    const state = createSignedState('google', role);
    const qs = new URLSearchParams({
      client_id: cid,
      redirect_uri: redir,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${qs.toString()}`);
  } catch {
    logger.error('oauthGoogleStart failed');
    res.status(500).send('OAuth error');
  }
};

export const oauthGoogleCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    oauthErrorRedirect(res, String(error_description || error));
    return;
  }

  if (typeof code !== 'string' || typeof state !== 'string') {
    oauthErrorRedirect(res, 'Missing authorization code');
    return;
  }

  const parsed = parseAndVerifyOAuthState(state, 'google');
  if (!parsed.ok) {
    oauthErrorRedirect(res, 'Invalid or expired sign-in attempt. Try again.');
    return;
  }

  try {
    const g = await googleExchangeCode(code);

    if (!g.sub) {
      oauthErrorRedirect(res, 'Google did not return a user id');
      return;
    }

    if (!g.emailVerified || !g.email) {
      oauthErrorRedirect(res, 'Google account must have a verified email');
      return;
    }

    const user = await finalizeOAuthUser({
      provider: 'google',
      providerId: g.sub,
      email: g.email,
      name: g.name,
      newUserRole: parsed.signupRole,
    });

    const token = issueUserJwt(user.id, user.role);
    oauthSuccessRedirect(res, token);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Google sign-in failed';
    logger.error('oauthGoogleCallback failed');
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      oauthErrorRedirect(res, 'Could not link this account (identity conflict).');
      return;
    }
    oauthErrorRedirect(res, msg);
  }
};

export const oauthGithubStart = async (req: Request, res: Response): Promise<void> => {
  try {
    const cid = process.env.GITHUB_CLIENT_ID;
    const redir = process.env.GITHUB_REDIRECT_URI;
    if (!cid || !redir) {
      logger.warn('GitHub OAuth: GITHUB_CLIENT_ID or GITHUB_REDIRECT_URI missing on server');
      res.status(503).send(
        'GitHub OAuth is not configured on the server. Add GITHUB_CLIENT_ID and GITHUB_REDIRECT_URI to your host environment.'
      );
      return;
    }
    const role = parseRoleFromQuery(req.query.role);
    const state = createSignedState('github', role);
    const qs = new URLSearchParams({
      client_id: cid,
      redirect_uri: redir,
      scope: 'read:user user:email',
      state,
    });
    res.redirect(`https://github.com/login/oauth/authorize?${qs.toString()}`);
  } catch {
    logger.error('oauthGithubStart failed');
    res.status(500).send('OAuth error');
  }
};

export const oauthGithubCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    oauthErrorRedirect(res, String(error_description || error));
    return;
  }

  if (typeof code !== 'string' || typeof state !== 'string') {
    oauthErrorRedirect(res, 'Missing authorization code');
    return;
  }

  const parsed = parseAndVerifyOAuthState(state, 'github');
  if (!parsed.ok) {
    oauthErrorRedirect(res, 'Invalid or expired sign-in attempt. Try again.');
    return;
  }

  try {
    const gh = await githubExchangeCode(code);

    const user = await finalizeOAuthUser({
      provider: 'github',
      providerId: gh.id,
      email: gh.email,
      name: gh.name,
      newUserRole: parsed.signupRole,
    });

    const token = issueUserJwt(user.id, user.role);
    oauthSuccessRedirect(res, token);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'GitHub sign-in failed';
    logger.error('oauthGithubCallback failed');
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      oauthErrorRedirect(res, 'Could not link this account (identity conflict).');
      return;
    }
    oauthErrorRedirect(res, msg);
  }
};
