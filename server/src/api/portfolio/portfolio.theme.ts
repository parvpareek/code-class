import type { PortfolioTheme } from '@prisma/client';

/** Map retired picker themes to current identities (persist on save). */
const LEGACY_TO_CANONICAL: Partial<Record<PortfolioTheme, PortfolioTheme>> = {
  MINIMAL: 'VOID',
  MONOCHROME: 'VOID',
  TERMINAL: 'FROST',
  GLASS: 'FROST',
  HACKER: 'GLACIER',
};

export function canonicalPortfolioTheme(theme: PortfolioTheme): PortfolioTheme {
  return LEGACY_TO_CANONICAL[theme] ?? theme;
}
