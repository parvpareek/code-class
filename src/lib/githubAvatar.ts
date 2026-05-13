import type { PortfolioContent } from '@/types/portfolio';

/** Match server: larger GitHub profile images for hero avatar. */
export function upsampleGithubAvatarUrl(url: string): string {
  const u = url.trim();
  if (!u.includes('avatars.githubusercontent.com')) return u;
  try {
    const parsed = new URL(u);
    parsed.searchParams.set('s', '512');
    return parsed.toString();
  } catch {
    return u.includes('?') ? `${u}&s=512` : `${u}?s=512`;
  }
}

/** GitHub serves a redirecting profile image at this URL (works when API `avatar_url` is missing). */
export function githubProfilePngUrl(login: string): string {
  return `https://github.com/${encodeURIComponent(login.trim())}.png`;
}

/** Extract GitHub username from a profile or repo URL. */
export function githubLoginFromProfileUrl(url: string): string | null {
  const t = url.trim();
  if (!t) return null;
  try {
    const u = t.startsWith('http') ? new URL(t) : new URL(`https://${t}`);
    if (!/github\.com$/i.test(u.hostname.replace(/^www\./i, ''))) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const login = parts[0];
    if (!login) return null;
    if (/^(orgs|topics|settings|login|features|marketplace)$/i.test(login)) return null;
    return login;
  } catch {
    const m = t.match(/github\.com\/([^/?#]+)/i);
    const login = m?.[1];
    if (!login || /^(orgs|topics)$/i.test(login)) return null;
    return login;
  }
}

/** Hero image: explicit URL, else GitHub login from studio or profile link, else null (initials). */
export function resolvePortfolioHeroAvatarUrl(content: PortfolioContent): string | null {
  const direct = (content.hero.avatarUrl ?? '').trim();
  if (direct) return upsampleGithubAvatarUrl(direct);
  const login =
    (content.studio?.githubLogin ?? '').trim() ||
    githubLoginFromProfileUrl(content.hero.links?.github ?? '') ||
    '';
  if (login) return githubProfilePngUrl(login);
  return null;
}
