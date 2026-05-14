import { customAlphabet } from 'nanoid';
import type { PortfolioContent } from './portfolio.schema';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
export const generatePortfolioSlug = customAlphabet(alphabet, 12);

export function defaultPortfolioContent(): PortfolioContent {
  return {
    contentVersion: 1,
    featuredSignal: 'PROJECTS',
    hero: {
      roleTitle: '',
      bio: '',
      location: '',
      avatarUrl: null,
      openToWork: false,
      availabilityText: '',
      links: {
        github: '',
        linkedin: '',
        x: '',
        website: '',
        resumeUrl: '',
      },
    },
    projects: [],
    howIBuild: null,
    skills: [],
    experience: [],
    education: [],
    sections: {
      order: ['hero', 'experience', 'featured', 'howIBuild', 'skills', 'proof'],
      hidden: [],
    },
    studio: { wizardVersion: 1, onboardingComplete: false },
    displayDensity: 'compact',
    heatmap: {},
  };
}
