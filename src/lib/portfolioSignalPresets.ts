import type { FeaturedSignal, PortfolioSectionId } from '@/types/portfolio';

/** Default section flow — shipped work first */
const DEFAULT_ORDER: PortfolioSectionId[] = [
  'hero',
  'proof',
  'featured',
  'howIBuild',
  'skills',
  'experience',
];

/**
 * When the user picks a recruiter signal in onboarding, bias section order
 * without touching `hidden` flags.
 */
export function sectionOrderForSignal(signal: FeaturedSignal): PortfolioSectionId[] {
  switch (signal) {
    case 'DSA':
      return ['hero', 'proof', 'skills', 'featured', 'experience', 'howIBuild'];
    case 'OPEN_SOURCE':
      return ['hero', 'featured', 'howIBuild', 'proof', 'skills', 'experience'];
    case 'BACKEND':
      return ['hero', 'featured', 'skills', 'experience', 'proof', 'howIBuild'];
    case 'AI':
      return ['hero', 'featured', 'skills', 'howIBuild', 'experience', 'proof'];
    case 'SYSTEMS':
      return ['hero', 'proof', 'featured', 'experience', 'skills', 'howIBuild'];
    case 'PROJECTS':
    default:
      return [...DEFAULT_ORDER];
  }
}
