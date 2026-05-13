import type { PortfolioContent } from './portfolio.schema';
import { githubProfilePngUrl, upsampleGithubAvatarUrl } from '../../lib/githubAvatar';

const GH_USER_AGENT = 'CodeClass-Portfolio/1';

export type GithubPreviewRepo = {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  url: string;
  updatedAt: string;
  fork: boolean;
};

export type GithubPreviewResult = {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  publicRepos: number;
  topRepos: GithubPreviewRepo[];
};

export function githubApiHeaders(): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': GH_USER_AGENT,
  };
  const token = process.env.GITHUB_PUBLIC_TOKEN?.trim();
  if (token) {
    h.Authorization = `Bearer ${token}`;
  }
  return h;
}

function githubHeaders(): HeadersInit {
  return githubApiHeaders();
}

const LOGIN_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38}[a-zA-Z0-9])?$/;

export async function fetchGithubPreview(login: string): Promise<
  | { ok: true; data: GithubPreviewResult }
  | { ok: false; status: number; message: string }
> {
  const trimmed = login.trim();
  if (!trimmed || !LOGIN_RE.test(trimmed)) {
    return { ok: false, status: 400, message: 'Invalid GitHub username' };
  }

  const headers = githubHeaders();
  const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(trimmed)}`, {
    headers,
  });

  if (userRes.status === 404) {
    return { ok: false, status: 404, message: 'GitHub user not found' };
  }
  if (userRes.status === 403 || userRes.status === 429) {
    return {
      ok: false,
      status: 429,
      message: 'GitHub rate limited — try again later or configure GITHUB_PUBLIC_TOKEN on the server',
    };
  }
  if (!userRes.ok) {
    return { ok: false, status: userRes.status, message: 'GitHub request failed' };
  }

  const u = (await userRes.json()) as Record<string, unknown>;
  const reposRes = await fetch(
    `https://api.github.com/users/${encodeURIComponent(trimmed)}/repos?sort=updated&per_page=30&type=owner`,
    { headers }
  );

  let rawRepos: Record<string, unknown>[] = [];
  if (reposRes.ok) {
    rawRepos = (await reposRes.json()) as Record<string, unknown>[];
  }

  const repos: GithubPreviewRepo[] = rawRepos
    .filter((r) => r && r.fork !== true)
    .map((r) => ({
      name: String(r.name ?? ''),
      description: r.description != null ? String(r.description) : null,
      language: r.language != null ? String(r.language) : null,
      stars: typeof r.stargazers_count === 'number' ? r.stargazers_count : 0,
      url: String(r.html_url ?? ''),
      updatedAt: String(r.updated_at ?? ''),
      fork: r.fork === true,
    }))
    .filter((r) => r.name.length > 0);

  repos.sort((a, b) => b.stars - a.stars || b.updatedAt.localeCompare(a.updatedAt));

  const topRepos = repos.slice(0, 8);

  const loginStr = String(u.login ?? trimmed);
  const rawAvatar = String(u.avatar_url ?? '').trim();
  const avatarUrl = rawAvatar
    ? upsampleGithubAvatarUrl(rawAvatar)
    : githubProfilePngUrl(loginStr);

  return {
    ok: true,
    data: {
      login: loginStr,
      name: u.name != null ? String(u.name) : null,
      avatarUrl,
      htmlUrl: String(u.html_url ?? `https://github.com/${trimmed}`),
      publicRepos: typeof u.public_repos === 'number' ? u.public_repos : repos.length,
      topRepos,
    },
  };
}

export function githubPreviewToPortfolioDraft(
  gh: GithubPreviewResult,
  displayName: string
): Partial<PortfolioContent> {
  const langs = new Map<string, number>();
  for (const r of gh.topRepos) {
    if (r.language) {
      langs.set(r.language, (langs.get(r.language) ?? 0) + 1);
    }
  }
  const topLangs = [...langs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
  const tagline =
    topLangs.length > 0
      ? `Building with ${topLangs.join(', ')}`
      : 'Open source & software';

  const picks = gh.topRepos.slice(0, 4);
  const projects: PortfolioContent['projects'] = picks.map((r) => ({
    id: `gh-${r.name}`,
    title: r.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    shortDescription: (r.description ?? `Repository ${r.name}`).slice(0, 280),
    longDescription: '',
    techStack: r.language ? [r.language] : [],
    githubUrl: r.url,
    featured: true,
  }));

  return {
    hero: {
      roleTitle: '',
      tagline,
      bio: gh.name
        ? `${gh.name} — projects on GitHub.`
        : `${displayName} — projects on GitHub.`,
      avatarUrl:
        (gh.avatarUrl ?? '').trim().length > 0
          ? upsampleGithubAvatarUrl(gh.avatarUrl)
          : githubProfilePngUrl(gh.login),
      links: {
        github: gh.htmlUrl,
        linkedin: '',
        x: '',
        website: '',
        resumeUrl: '',
      },
    },
    projects,
    studio: { wizardVersion: 1, githubLogin: gh.login },
  };
}

/** owner/repo from a GitHub repository URL (https or host/path). */
export function parseGithubRepoUrl(raw: string): { owner: string; repo: string } | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const url = t.startsWith('http') ? new URL(t) : new URL(`https://${t}`);
    if (!/github\.com$/i.test(url.hostname.replace(/^www\./i, ''))) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repoRaw] = parts;
    const repo = repoRaw.replace(/\.git$/i, '');
    if (!owner || !repo) return null;
    if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/i.test(owner)) return null;
    if (!/^[a-z0-9._-]{1,200}$/i.test(repo)) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

export type GithubRepoInsightDto = {
  stars: number;
  forks: number;
  contributors: number;
  /** Sum of bytes from GitHub's languages API (not identical to physical lines). */
  codeBytes: number;
  /** Rough lines estimate from language bytes (÷38). */
  linesEstimate: number;
  repoCreatedAt: string;
  lastPushAt: string;
  fetchedAt: string;
};

export async function fetchGithubRepoInsight(
  owner: string,
  repo: string
): Promise<{ ok: true; data: GithubRepoInsightDto } | { ok: false; status: number; message: string }> {
  const o = owner.trim();
  const r = repo.trim();
  if (!o || !r) {
    return { ok: false, status: 400, message: 'owner and repo required' };
  }
  const headers = githubApiHeaders();
  const base = `https://api.github.com/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}`;

  const [metaRes, langRes, contribRes] = await Promise.all([
    fetch(base, { headers }),
    fetch(`${base}/languages`, { headers }),
    fetch(`${base}/contributors?per_page=100`, { headers }),
  ]);

  if (metaRes.status === 404) {
    return { ok: false, status: 404, message: 'Repository not found or private' };
  }
  if (metaRes.status === 403 || metaRes.status === 429) {
    return {
      ok: false,
      status: 429,
      message: 'GitHub rate limited — try again later or set GITHUB_PUBLIC_TOKEN on the server',
    };
  }
  if (!metaRes.ok) {
    return { ok: false, status: metaRes.status, message: 'GitHub repo request failed' };
  }

  const meta = (await metaRes.json()) as Record<string, unknown>;
  const stars = typeof meta.stargazers_count === 'number' ? meta.stargazers_count : 0;
  const forks = typeof meta.forks_count === 'number' ? meta.forks_count : 0;
  const repoCreatedAt = typeof meta.created_at === 'string' ? meta.created_at : new Date(0).toISOString();
  const lastPushAt = typeof meta.pushed_at === 'string' ? meta.pushed_at : repoCreatedAt;

  let codeBytes = 0;
  if (langRes.ok) {
    const langs = (await langRes.json()) as Record<string, number>;
    for (const v of Object.values(langs)) {
      if (typeof v === 'number' && v > 0) codeBytes += v;
    }
  }

  let contributors = 0;
  if (contribRes.ok) {
    const arr = (await contribRes.json()) as unknown[];
    contributors = Array.isArray(arr) ? arr.length : 0;
    if (contributors >= 100) contributors = 100;
  }

  const linesEstimate = codeBytes > 0 ? Math.max(1, Math.round(codeBytes / 38)) : 0;

  return {
    ok: true,
    data: {
      stars,
      forks,
      contributors,
      codeBytes,
      linesEstimate,
      repoCreatedAt,
      lastPushAt,
      fetchedAt: new Date().toISOString(),
    },
  };
}

export async function fetchGithubReadme(
  owner: string,
  repo: string
): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string }> {
  const o = owner.trim();
  const r = repo.trim();
  if (!o || !r) {
    return { ok: false, status: 400, message: 'owner and repo required' };
  }
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/readme`,
    { headers: githubHeaders() }
  );
  if (res.status === 404) {
    return { ok: false, status: 404, message: 'No README' };
  }
  if (res.status === 403 || res.status === 429) {
    return {
      ok: false,
      status: 429,
      message: 'GitHub rate limited — try again later or configure GITHUB_PUBLIC_TOKEN',
    };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, message: 'README fetch failed' };
  }
  const j = (await res.json()) as { content?: string };
  if (typeof j.content !== 'string') {
    return { ok: false, status: 500, message: 'Invalid README response' };
  }
  const raw = Buffer.from(j.content.replace(/\s/g, ''), 'base64').toString('utf8');
  return { ok: true, text: raw };
}

export function extractGithubLoginFromPortfolioContent(content: PortfolioContent): string | null {
  const studio = content.studio?.githubLogin?.trim();
  if (studio) return studio;
  const gh = content.hero.links?.github?.trim();
  if (!gh) return null;
  try {
    const url = gh.startsWith('http') ? gh : `https://${gh}`;
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0]) return parts[0];
  } catch {
    const m = gh.match(/github\.com\/([^/?#]+)/i);
    return m?.[1]?.trim() ?? null;
  }
  return null;
}

/**
 * Public contribution counts by UTC date (yyyy-mm-dd), ~last GitHub year.
 * Uses https://github.com/grubersjoe/github-contributions-api (scraped profile; cached upstream ~1h).
 * Optional override: `GITHUB_CONTRIBUTIONS_API_BASE` (no trailing slash), e.g. https://github-contributions-api.jogruber.de/v4
 */
export async function fetchGithubContributionsByDay(login: string): Promise<Record<string, number> | null> {
  const trimmed = login.trim();
  if (!trimmed || !LOGIN_RE.test(trimmed)) return null;

  const base = (
    process.env.GITHUB_CONTRIBUTIONS_API_BASE?.trim() || 'https://github-contributions-api.jogruber.de/v4'
  ).replace(/\/$/, '');
  const url = `${base}/${encodeURIComponent(trimmed)}?y=last`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': GH_USER_AGENT,
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      contributions?: { date: string; count: number }[];
      error?: string;
    };
    if (body.error || !Array.isArray(body.contributions)) return null;
    const map: Record<string, number> = {};
    for (const c of body.contributions) {
      if (c.date) map[c.date] = typeof c.count === 'number' ? c.count : 0;
    }
    return Object.keys(map).length ? map : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
