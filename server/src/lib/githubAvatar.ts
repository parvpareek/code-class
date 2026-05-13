/** Request a larger GitHub avatar (default API URLs are often ~130px). */
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

/** GitHub redirects this to the user’s public avatar (fallback when `avatar_url` is empty). */
export function githubProfilePngUrl(login: string): string {
  return `https://github.com/${encodeURIComponent(login.trim())}.png`;
}
