import { z } from 'zod';

export const FEATURED_SIGNALS = [
  'PROJECTS',
  'OPEN_SOURCE',
  'DSA',
  'BACKEND',
  'AI',
  'SYSTEMS',
] as const;
export type FeaturedSignal = (typeof FEATURED_SIGNALS)[number];

export const FeaturedSignalSchema = z.enum([
  'PROJECTS',
  'OPEN_SOURCE',
  'DSA',
  'BACKEND',
  'AI',
  'SYSTEMS',
]);

const optionalUrl = z
  .string()
  .max(2048)
  .refine((s) => s === '' || /^https?:\/\//i.test(s), 'Must be http(s) URL or empty')
  .optional();

export const HeroLinksSchema = z
  .object({
    github: optionalUrl,
    linkedin: optionalUrl,
    x: optionalUrl,
    website: optionalUrl,
    resumeUrl: optionalUrl,
  })
  .optional();

export const HeroSchema = z.object({
  roleTitle: z.string().max(120).optional(),
  bio: z.string().max(1200).optional(),
  location: z.string().max(120).optional(),
  avatarUrl: z.union([z.string().max(2048), z.literal('')]).nullable().optional(),
  openToWork: z.boolean().optional(),
  availabilityText: z.string().max(80).optional(),
  /** Tiny pulse line under the hero (e.g. availability nuance) */
  statusLine: z.string().max(120).optional(),
  strongestSkill: z.string().max(80).optional(),
  links: HeroLinksSchema,
});

export const ProjectStorySchema = z
  .object({
    motivation: z.string().max(4000).optional(),
    architecture: z.string().max(4000).optional(),
    challenges: z.string().max(4000).optional(),
    lessons: z.string().max(3000).optional(),
    futurePlans: z.string().max(2000).optional(),
  })
  .optional();

const storyImageUrl = z
  .string()
  .max(2048)
  .refine((s) => /^https?:\/\//i.test(s), 'Must be http(s) URL');

export const ProjectStoryImageSchema = z.object({
  url: storyImageUrl,
  caption: z.string().max(200).optional(),
  after: z.enum(['motivation', 'architecture', 'challenges', 'lessons', 'futurePlans']),
});

export const ProjectRepoInsightSchema = z.object({
  repoFullName: z.string().max(160),
  stars: z.number().int().min(0).max(50_000_000).optional(),
  forks: z.number().int().min(0).max(50_000_000).optional(),
  contributors: z.number().int().min(0).max(100).optional(),
  codeBytes: z.number().int().min(0).optional(),
  linesEstimate: z.number().int().min(0).optional(),
  repoCreatedAt: z.string().max(40).optional(),
  lastPushAt: z.string().max(40).optional(),
  fetchedAt: z.string().max(40),
  error: z.string().max(300).optional(),
});

export type PortfolioProjectRepoInsight = z.infer<typeof ProjectRepoInsightSchema>;

export const ProjectSchema = z.object({
  id: z.string().max(40).optional(),
  title: z.string().min(1).max(120),
  shortDescription: z.string().min(1).max(280),
  /** Why the project exists — intent, distinct from the hook line */
  whyBuilt: z.string().max(400).optional(),
  longDescription: z.string().max(8000).optional(),
  techStack: z.array(z.string().max(40)).max(20).default([]),
  githubUrl: optionalUrl,
  liveUrl: optionalUrl,
  featured: z.boolean().default(true),
  imageUrl: optionalUrl,
  metrics: z.record(z.string().max(40), z.string().max(80)).optional(),
  /** Auto-filled from GitHub when a valid repo URL is saved (server). */
  repoInsight: ProjectRepoInsightSchema.optional(),
  engineeringHighlights: z.array(z.string().max(200)).max(8).optional(),
  signalCues: z.array(z.string().max(40)).max(10).optional(),
  story: ProjectStorySchema,
  storyImages: z
    .array(ProjectStoryImageSchema)
    .max(6)
    .optional()
    .transform((arr) => {
      if (!arr?.length) return undefined;
      const kept = arr.filter((x) => /^https:\/\/.+\./i.test(x.url.trim()));
      return kept.length ? kept : undefined;
    }),
});

export const HowIBuildSchema = z
  .object({
    bullets: z.array(z.string().max(200)).max(5).optional(),
    interests: z.array(z.string().max(60)).max(8).optional(),
  })
  .optional()
  .nullable();

export const SkillCategorySchema = z.object({
  category: z.string().max(60),
  items: z.array(z.string().max(40)).max(30),
});

export const ExperienceSchema = z.object({
  title: z.string().max(120),
  org: z.string().max(120),
  startDate: z.string().max(40),
  endDate: z.string().max(40).optional(),
  /** When true, treat as ongoing; end date is hidden in the editor. */
  current: z.boolean().optional(),
  bullets: z.array(z.string().max(800)).max(20).optional(),
  stack: z.array(z.string().max(40)).optional(),
});

export const EducationSchema = z.object({
  school: z.string().max(120),
  degree: z.string().max(120),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
  current: z.boolean().optional(),
  details: z.string().max(2000).optional(),
});

export const SectionIdSchema = z.enum([
  'hero',
  'proof',
  'featured',
  'howIBuild',
  'skills',
  'experience',
]);

export const SectionsConfigSchema = z.object({
  order: z.array(SectionIdSchema),
  /** Identity (hero) must stay visible — strip if present from legacy saves. */
  hidden: z
    .array(SectionIdSchema)
    .transform((hidden) => hidden.filter((id) => id !== 'hero')),
});

export const StudioMetaSchema = z
  .object({
    wizardVersion: z.literal(1).optional(),
    onboardingComplete: z.boolean().optional(),
    githubLogin: z.string().max(39).optional(),
  })
  .optional();

export const DisplayDensitySchema = z.enum(['default', 'compact']).optional();

export const FeaturedLayoutSchema = z.enum(['editorial', 'grid']).optional();

export const HeatmapPrefsSchema = z
  .object({
    showGithub: z.boolean().optional(),
    showDsa: z.boolean().optional(),
    combined: z.boolean().optional(),
  })
  .optional();

export const PortfolioContentSchema = z.object({
  contentVersion: z.literal(1),
  featuredSignal: FeaturedSignalSchema,
  hero: HeroSchema,
  projects: z.array(ProjectSchema).max(30),
  howIBuild: HowIBuildSchema,
  skills: z.array(SkillCategorySchema).max(20),
  experience: z.array(ExperienceSchema).max(20),
  education: z.array(EducationSchema).max(10),
  sections: SectionsConfigSchema,
  studio: StudioMetaSchema,
  displayDensity: DisplayDensitySchema,
  featuredLayout: FeaturedLayoutSchema,
  heatmap: HeatmapPrefsSchema,
  recentActivity: z.array(z.string().max(160)).max(8).optional(),
});

export type PortfolioContent = z.infer<typeof PortfolioContentSchema>;

/** Must stay in sync with `PortfolioTheme` in `server/prisma/schema.prisma` (not `z.nativeEnum` — stale `prisma generate` would reject new values like `FORMULA_ONE`). */
export const PORTFOLIO_THEME_IDS = [
  'MINIMAL',
  'MONOCHROME',
  'TERMINAL',
  'GLASS',
  'HACKER',
  'VOID',
  'PAPER',
  'EMBER',
  'FROST',
  'GLACIER',
  'PAAN',
  'FORMULA_ONE',
  'MARLBORO',
] as const;

export const PortfolioThemeSchema = z.enum(PORTFOLIO_THEME_IDS);

const slugRegex = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

export const SlugSchema = z
  .string()
  .regex(slugRegex, 'Slug: 3–32 chars, lowercase letters, numbers, hyphens; no leading/trailing hyphen');

export function parsePortfolioContent(data: unknown): PortfolioContent {
  return PortfolioContentSchema.parse(data);
}

export function safeParsePortfolioContent(data: unknown) {
  return PortfolioContentSchema.safeParse(data);
}
