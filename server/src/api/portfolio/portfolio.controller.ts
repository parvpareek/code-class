import type { Request, Response } from 'express';
import { PDFParse } from 'pdf-parse';
import type { PortfolioTheme } from '@prisma/client';
import prisma from '../../lib/prisma';
import {
  parsePortfolioContent,
  safeParsePortfolioContent,
  SlugSchema,
  PortfolioThemeSchema,
} from './portfolio.schema';
import { defaultPortfolioContent, generatePortfolioSlug } from './portfolio.defaults';
import { loadPortfolioPlatformSolved } from './portfolio.platformStats';
import { loadPortfolioActivity } from './portfolio.activity';
import { computeCompleteness } from './portfolio.completeness';
import { resumeTextToDraft } from './portfolio.resume';
import { suggestHeroCopy, suggestBioAndRoleStructured, suggestProjectScaffold } from './portfolio.suggest';
import { bulkFillPortfolioTwoPasses } from './portfolio.bulkFill';
import { canonicalPortfolioTheme } from './portfolio.theme';
import { fetchGithubPreview, fetchGithubReadme } from './portfolio.github';
import { enrichPortfolioContentRepoInsights } from './portfolio.repoInsight';

async function ensurePortfolio(userId: string) {
  let p = await prisma.portfolioProfile.findUnique({ where: { userId } });
  if (p) return p;

  let slug = `u${generatePortfolioSlug()}`;
  for (let i = 0; i < 8; i++) {
    const clash = await prisma.portfolioProfile.findUnique({ where: { slug } });
    if (!clash) break;
    slug = `u${generatePortfolioSlug()}`;
  }

  const content = defaultPortfolioContent();
  p = await prisma.portfolioProfile.create({
    data: {
      userId,
      slug,
      content: content as object,
      theme: 'VOID',
    },
  });
  return p;
}

async function enrichPortfolioPayload(
  userId: string,
  user: import('@prisma/client').User,
  content: ReturnType<typeof parsePortfolioContent>
) {
  const activity = await loadPortfolioActivity(userId, content);
  const platformSolved = await loadPortfolioPlatformSolved(userId, user);
  return { activity, platformSolved };
}

export const getMyPortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const p = await ensurePortfolio(userId);
    const content = parsePortfolioContent(p.content);
    const { activity, platformSolved } = await enrichPortfolioPayload(userId, user, content);
    const completeness = computeCompleteness(user, content);
    res.json({
      id: p.id,
      slug: p.slug,
      published: p.published,
      publishedAt: p.publishedAt,
      theme: canonicalPortfolioTheme(p.theme),
      content,
      platformSolved,
      activity,
      displayName: user.name,
      completeness,
    });
  } catch (e) {
    console.error('getMyPortfolio', e);
    res.status(500).json({ message: 'Failed to load portfolio' });
  }
};

export const updateMyPortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const p = await ensurePortfolio(userId);
    const body = req.body as Record<string, unknown>;

    let slug = p.slug;
    if (body.slug !== undefined) {
      const parsed = SlugSchema.safeParse(body.slug);
      if (!parsed.success) {
        res.status(400).json({ message: 'Invalid slug', errors: parsed.error.flatten() });
        return;
      }
      const taken = await prisma.portfolioProfile.findFirst({
        where: { slug: parsed.data, NOT: { userId } },
      });
      if (taken) {
        res.status(409).json({ message: 'Slug already taken' });
        return;
      }
      slug = parsed.data;
    }

    let theme: PortfolioTheme = canonicalPortfolioTheme(p.theme);
    if (body.theme !== undefined) {
      const t = PortfolioThemeSchema.safeParse(body.theme);
      if (!t.success) {
        console.warn('[updateMyPortfolio] Invalid theme', {
          received: body.theme,
          issues: t.error.flatten(),
        });
        res.status(400).json({
          message: 'Invalid theme',
          received: body.theme,
          allowed: PortfolioThemeSchema.options,
        });
        return;
      }
      theme = canonicalPortfolioTheme(t.data as PortfolioTheme);
    }

    let content = parsePortfolioContent(p.content);
    if (body.content !== undefined) {
      const parsed = safeParsePortfolioContent(body.content);
      if (!parsed.success) {
        res.status(400).json({ message: 'Invalid content', errors: parsed.error.flatten() });
        return;
      }
      content = parsed.data;
    }

    const { content: enriched } = await enrichPortfolioContentRepoInsights(content);
    content = enriched;

    let published = p.published;
    let publishedAt = p.publishedAt;
    if (typeof body.published === 'boolean') {
      if (body.published && !p.published) {
        publishedAt = new Date();
      }
      published = body.published;
    }

    const updated = await prisma.portfolioProfile.update({
      where: { userId },
      data: {
        slug,
        theme,
        content: content as object,
        published,
        publishedAt,
      },
    });

    const { activity, platformSolved } = await enrichPortfolioPayload(userId, user, content);
    const completeness = computeCompleteness(user, content);
    res.json({
      id: updated.id,
      slug: updated.slug,
      published: updated.published,
      publishedAt: updated.publishedAt,
      theme: canonicalPortfolioTheme(updated.theme),
      content,
      platformSolved,
      activity,
      displayName: user.name,
      completeness,
    });
  } catch (e) {
    console.error('updateMyPortfolio', e);
    res.status(500).json({ message: 'Failed to update portfolio' });
  }
};

export const getPublicPortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    const slugParam = req.params.slug;
    const parsed = SlugSchema.safeParse(slugParam);
    if (!parsed.success) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const p = await prisma.portfolioProfile.findUnique({
      where: { slug: parsed.data },
      include: { user: true },
    });
    if (!p || !p.published) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const content = parsePortfolioContent(p.content);
    const { activity, platformSolved } = await enrichPortfolioPayload(p.userId, p.user, content);
    res.json({
      slug: p.slug,
      theme: canonicalPortfolioTheme(p.theme),
      content,
      platformSolved,
      displayName: p.user.name,
      activity,
    });
  } catch (e) {
    console.error('getPublicPortfolio', e);
    res.status(500).json({ message: 'Failed to load portfolio' });
  }
};

export const getGithubPreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const login = req.query.login;
    if (typeof login !== 'string' || !login.trim()) {
      res.status(400).json({ message: 'Query parameter login is required' });
      return;
    }
    const result = await fetchGithubPreview(login);
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json(result.data);
  } catch (e) {
    console.error('getGithubPreview', e);
    res.status(500).json({ message: 'GitHub preview failed' });
  }
};

export const getGithubReadmeText = async (req: Request, res: Response): Promise<void> => {
  try {
    const owner = req.query.owner;
    const repo = req.query.repo;
    if (typeof owner !== 'string' || typeof repo !== 'string' || !owner.trim() || !repo.trim()) {
      res.status(400).json({ message: 'Query parameters owner and repo are required' });
      return;
    }
    const result = await fetchGithubReadme(owner.trim(), repo.trim());
    if (!result.ok) {
      if (result.status === 404) {
        res.json({ text: '' });
        return;
      }
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ text: result.text.slice(0, 12000) });
  } catch (e) {
    console.error('getGithubReadmeText', e);
    res.status(500).json({ message: 'README fetch failed' });
  }
};

export const parseResumeHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file?.buffer) {
      res.status(400).json({ message: 'PDF file required (field name: resume)' });
      return;
    }
    const parser = new PDFParse({ data: file.buffer });
    let text = '';
    try {
      const pdfData = await parser.getText();
      text = typeof pdfData.text === 'string' ? pdfData.text : '';
    } finally {
      await parser.destroy();
    }
    if (text.trim().length < 20) {
      res.status(400).json({ message: 'Could not extract enough text from PDF' });
      return;
    }
    const draft = resumeTextToDraft(text);
    res.json({ draft, excerpt: text.slice(0, 500), resumeText: text.slice(0, 14_000) });
  } catch (e) {
    console.error('parseResumeHandler', e);
    res.status(400).json({ message: 'Failed to parse PDF' });
  }
};

export const suggestPortfolioCopy = async (req: Request, res: Response): Promise<void> => {
  try {
    const field = req.body?.field as string | undefined;
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const tone = typeof req.body?.tone === 'string' ? req.body.tone : undefined;
    const portfolioContext =
      typeof req.body?.portfolioContext === 'string' ? req.body.portfolioContext : '';
    const keyRaw = req.body?.geminiApiKey;
    const userKey =
      typeof keyRaw === 'string' && keyRaw.trim().length >= 20 ? keyRaw.trim() : undefined;
    const serverConfigured = !!(
      process.env.PORTFOLIO_GEMINI_API_KEY || process.env.GEMINI_API_KEY
    );

    if (field === 'projectScaffold') {
      const projectTitle = typeof req.body?.projectTitle === 'string' ? req.body.projectTitle : '';
      const notes = typeof req.body?.notes === 'string' ? req.body.notes : '';
      const stack = typeof req.body?.stack === 'string' ? req.body.stack : '';
      if (!projectTitle.trim()) {
        res.status(400).json({ message: 'projectTitle is required for projectScaffold' });
        return;
      }
      const scaffold = await suggestProjectScaffold({
        projectTitle,
        notes,
        stack,
        portfolioContext,
        apiKey: userKey,
      });
      const aiEnabled = scaffold != null;
      res.json({
        suggestions: [],
        roleTitleSuggestions: [],
        projectScaffold: scaffold,
        aiEnabled,
        usedUserKey: !!(userKey && aiEnabled),
        serverConfigured,
      });
      return;
    }

    if (field !== 'bio' && field !== 'roleTitle') {
      res.status(400).json({ message: 'field must be bio, roleTitle, or projectScaffold' });
      return;
    }

    if (field === 'bio') {
      const apiKey =
        userKey ?? process.env.PORTFOLIO_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
      if (!apiKey?.trim()) {
        res.json({
          suggestions: [],
          roleTitleSuggestions: [],
          aiEnabled: false,
          usedUserKey: false,
          serverConfigured,
        });
        return;
      }
      const bioPack = await suggestBioAndRoleStructured({
        apiKey: apiKey.trim(),
        currentBio: text,
        portfolioContext,
        tone,
      });
      const aiEnabled = bioPack.bios.length > 0;
      res.json({
        suggestions: bioPack.bios,
        roleTitleSuggestions: bioPack.roleTitles,
        aiEnabled,
        usedUserKey: !!(userKey && aiEnabled),
        serverConfigured,
      });
      return;
    }

    const suggestions = await suggestHeroCopy({
      field,
      text,
      tone,
      portfolioContext,
      apiKey: userKey,
    });
    const aiEnabled = suggestions.length > 0;
    res.json({
      suggestions,
      aiEnabled,
      usedUserKey: !!(userKey && aiEnabled),
      serverConfigured,
    });
  } catch (e) {
    console.error('suggestPortfolioCopy', e);
    res.status(500).json({
      message: 'Suggestion failed',
      suggestions: [],
      roleTitleSuggestions: [],
    });
  }
};

export const fillPortfolioWithAi = async (req: Request, res: Response): Promise<void> => {
  try {
    const keyRaw = req.body?.geminiApiKey;
    const key = typeof keyRaw === 'string' ? keyRaw.trim() : '';
    if (key.length < 20) {
      res.status(400).json({ message: 'geminiApiKey is required (min 20 characters)' });
      return;
    }
    const resumeText = typeof req.body?.resumeText === 'string' ? req.body.resumeText : '';
    const portfolioContext =
      typeof req.body?.portfolioContext === 'string' ? req.body.portfolioContext : '';
    const rawSkeleton = req.body?.projectSkeletons;
    const skeletonArr = Array.isArray(rawSkeleton) ? rawSkeleton : [];
    const projectSkeletons = skeletonArr.slice(0, 8).map((s: unknown) => {
      const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
      const title = String(o.title ?? '').slice(0, 120);
      const githubUrl = String(o.githubUrl ?? '').slice(0, 2048);
      const techStack = Array.isArray(o.techStack)
        ? o.techStack
            .filter((x): x is string => typeof x === 'string')
            .map((x: string) => x.trim().slice(0, 40))
            .slice(0, 20)
        : [];
      return { title, githubUrl, techStack };
    });

    const fill = await bulkFillPortfolioTwoPasses({
      apiKey: key,
      resumeText,
      portfolioContext,
      projectSkeletons,
    });
    res.json(fill);
  } catch (e) {
    console.error('fillPortfolioWithAi', e);
    const timedOut = e instanceof Error && /timed out/i.test(e.message);
    res.status(500).json({
      message: timedOut
        ? 'AI request timed out. Try again, or ask your host to allow longer HTTP timeouts for /api/v1/portfolio/me/fill-with-ai.'
        : 'AI portfolio fill failed',
    });
  }
};
