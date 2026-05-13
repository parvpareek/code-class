import type { PortfolioTheme } from '@/types/portfolio';
import { isSignaturePortfolioTheme } from '@/lib/portfolioThemes/registry';

const KEY_PREFIX = 'pf-sig-intro-v1-';

function introKey(slug: string, theme: PortfolioTheme): string {
  return `${KEY_PREFIX}${slug}:${theme}`;
}

/**
 * Signature intros: play once per tab session for non-reload navigations; full reload clears the
 * flag so the cinematic can replay (see plan).
 */
export function shouldPlaySignatureIntro(slug: string, theme: PortfolioTheme): boolean {
  if (!isSignaturePortfolioTheme(theme)) return false;
  const key = introKey(slug, theme);
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === 'reload') {
      sessionStorage.removeItem(key);
      return true;
    }
    return !sessionStorage.getItem(key);
  } catch {
    return true;
  }
}

export function markSignatureIntroPlayed(slug: string, theme: PortfolioTheme): void {
  if (!isSignaturePortfolioTheme(theme)) return;
  try {
    sessionStorage.setItem(introKey(slug, theme), '1');
  } catch {
    /* private mode / quota */
  }
}

/** Clears played flag so the intro can show again next mount (studio “Replay”). */
export function clearSignatureIntroPlayed(slug: string, theme: PortfolioTheme): void {
  if (!isSignaturePortfolioTheme(theme)) return;
  try {
    sessionStorage.removeItem(introKey(slug, theme));
  } catch {
    /* private mode */
  }
}
