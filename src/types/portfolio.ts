export type PortfolioTheme =
  | 'MINIMAL'
  | 'MONOCHROME'
  | 'TERMINAL'
  | 'GLASS'
  | 'HACKER'
  | 'VOID'
  | 'PAPER'
  | 'EMBER'
  | 'FROST'
  | 'GLACIER'
  | 'PAAN'
  | 'FORMULA_ONE'
  | 'MARLBORO';

export type FeaturedSignal =
  | 'PROJECTS'
  | 'OPEN_SOURCE'
  | 'DSA'
  | 'BACKEND'
  | 'AI'
  | 'SYSTEMS';

export type PortfolioSectionId =
  | 'hero'
  | 'proof'
  | 'featured'
  | 'howIBuild'
  | 'skills'
  | 'experience';

export interface PortfolioHeroLinks {
  github?: string;
  linkedin?: string;
  /** X / Twitter profile URL */
  x?: string;
  website?: string;
  resumeUrl?: string;
}

export interface PortfolioHero {
  roleTitle?: string;
  tagline?: string;
  bio?: string;
  location?: string;
  avatarUrl?: string | null;
  openToWork?: boolean;
  availabilityText?: string;
  currentFocus?: string;
  statusLine?: string;
  strongestSkill?: string;
  links?: PortfolioHeroLinks;
}

export interface PortfolioProjectStory {
  motivation?: string;
  architecture?: string;
  challenges?: string;
  lessons?: string;
  futurePlans?: string;
}

export type PortfolioStoryImageAfter =
  | 'motivation'
  | 'architecture'
  | 'challenges'
  | 'lessons'
  | 'futurePlans';

export interface PortfolioProjectStoryImage {
  url: string;
  caption?: string;
  after: PortfolioStoryImageAfter;
}

export interface PortfolioProjectRepoInsight {
  repoFullName: string;
  stars?: number;
  forks?: number;
  contributors?: number;
  codeBytes?: number;
  linesEstimate?: number;
  repoCreatedAt?: string;
  lastPushAt?: string;
  fetchedAt: string;
  error?: string;
}

export interface PortfolioProject {
  id?: string;
  title: string;
  shortDescription: string;
  /** Why this exists — problem / intent */
  whyBuilt?: string;
  longDescription?: string;
  techStack: string[];
  githubUrl?: string;
  liveUrl?: string;
  featured?: boolean;
  imageUrl?: string;
  metrics?: Record<string, string>;
  /** Filled by the server from the GitHub API when you save (public repos). */
  repoInsight?: PortfolioProjectRepoInsight;
  engineeringHighlights?: string[];
  signalCues?: string[];
  story?: PortfolioProjectStory;
  storyImages?: PortfolioProjectStoryImage[];
}

export interface HowIBuild {
  bullets?: string[];
  interests?: string[];
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface PortfolioExperience {
  title: string;
  org: string;
  startDate: string;
  endDate?: string;
  /** Ongoing role — show as …–Present and hide end date in the editor. */
  current?: boolean;
  bullets?: string[];
  stack?: string[];
}

export interface PortfolioEducation {
  school: string;
  degree: string;
  startDate?: string;
  endDate?: string;
  /** Still enrolled — show as …–Present. */
  current?: boolean;
  details?: string;
}

export interface PortfolioSectionsConfig {
  order: PortfolioSectionId[];
  hidden: PortfolioSectionId[];
}

export interface PortfolioStudioMeta {
  wizardVersion?: 1;
  onboardingComplete?: boolean;
  githubLogin?: string;
}

export type PortfolioDisplayDensity = 'default' | 'compact';

export type PortfolioFeaturedLayout = 'editorial' | 'grid';

export type PortfolioHeatmapMode = 'practice' | 'github' | 'combined';

/** Legacy persisted fields only; heatmap view mode is chosen by each visitor in the UI. */
export interface PortfolioHeatmapPrefs {
  showGithub?: boolean;
  showDsa?: boolean;
  combined?: boolean;
}

export interface PortfolioContent {
  contentVersion: 1;
  featuredSignal: FeaturedSignal;
  hero: PortfolioHero;
  projects: PortfolioProject[];
  howIBuild: HowIBuild | null;
  skills: SkillCategory[];
  experience: PortfolioExperience[];
  education: PortfolioEducation[];
  sections: PortfolioSectionsConfig;
  studio?: PortfolioStudioMeta;
  displayDensity?: PortfolioDisplayDensity;
  /** Featured projects presentation */
  featuredLayout?: PortfolioFeaturedLayout;
  heatmap?: PortfolioHeatmapPrefs;
  recentActivity?: string[];
}

export interface PortfolioActivityPayload {
  githubByDate: Record<string, number>;
  /** LeetCode / HackerRank / GeeksforGeeks assignment completions per UTC day. */
  dsaByDate: Record<string, number>;
  /** Same counts as dsaByDate (heatmap “platforms” view). */
  practiceByDate: Record<string, number>;
}

export interface PortfolioPlatformSolved {
  leetcode?: number | null;
  hackerrank?: number;
  geeksforgeeks?: number;
}

export interface PortfolioCompleteness {
  percent: number;
  suggestions: string[];
}

export interface MyPortfolioDto {
  id: string;
  slug: string;
  published: boolean;
  publishedAt: string | null;
  theme: PortfolioTheme;
  content: PortfolioContent;
  platformSolved: PortfolioPlatformSolved;
  completeness: PortfolioCompleteness;
  displayName: string;
  activity: PortfolioActivityPayload;
}

export interface PublicPortfolioDto {
  slug: string;
  theme: PortfolioTheme;
  content: PortfolioContent;
  platformSolved: PortfolioPlatformSolved;
  displayName: string;
  activity: PortfolioActivityPayload;
}
