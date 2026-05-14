import type {
  PortfolioContent,
  PortfolioEducation,
  PortfolioExperience,
  PortfolioHero,
  PortfolioProject,
} from '@/types/portfolio';
import { githubProfilePngUrl, upsampleGithubAvatarUrl } from '@/lib/githubAvatar';

/** Featured project card: one-line hook only (full story opens in the dialog). */
export function projectCardHookLine(p: Pick<PortfolioProject, 'shortDescription'>): string {
  return (p.shortDescription ?? '').trim();
}

/** Empty portfolio JSON for re-running the studio wizard (matches server `defaultPortfolioContent`). */
export function freshOnboardingPortfolioContent(): PortfolioContent {
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

export type GithubPreviewDto = {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  publicRepos: number;
  topRepos: {
    name: string;
    description: string | null;
    language: string | null;
    stars: number;
    url: string;
    updatedAt: string;
    fork: boolean;
  }[];
};

/** Merge partial portfolio draft into base (deep merge hero.links, studio). */
export function mergePortfolioDraft(base: PortfolioContent, partial: Partial<PortfolioContent>): PortfolioContent {
  const next = structuredClone(base);
  if (partial.hero) {
    next.hero = {
      ...next.hero,
      ...partial.hero,
      links: { ...next.hero.links, ...partial.hero.links },
    };
  }
  if (partial.projects !== undefined) {
    next.projects = partial.projects;
  }
  if (partial.howIBuild !== undefined) {
    next.howIBuild = partial.howIBuild;
  }
  if (partial.skills !== undefined) {
    next.skills = partial.skills;
  }
  if (partial.experience !== undefined) {
    next.experience = [...next.experience, ...partial.experience];
  }
  if (partial.education !== undefined) {
    next.education = [...next.education, ...partial.education];
  }
  if (partial.sections) {
    next.sections = { ...next.sections, ...partial.sections };
  }
  if (partial.featuredSignal) {
    next.featuredSignal = partial.featuredSignal;
  }
  if (partial.studio) {
    next.studio = { ...next.studio, ...partial.studio, wizardVersion: 1 };
  }
  if (partial.featuredLayout !== undefined) {
    next.featuredLayout = partial.featuredLayout;
  }
  if (partial.displayDensity) {
    next.displayDensity = partial.displayDensity;
  }
  if (partial.heatmap !== undefined) {
    next.heatmap = { ...next.heatmap, ...partial.heatmap };
  }
  if (partial.recentActivity !== undefined) {
    next.recentActivity = partial.recentActivity;
  }
  return next;
}

export function githubPreviewToClientDraft(
  gh: GithubPreviewDto,
  displayName: string,
  selectedRepos?: GithubPreviewDto['topRepos']
): Partial<PortfolioContent> {
  const repoSource =
    selectedRepos && selectedRepos.length > 0 ? selectedRepos : gh.topRepos.slice(0, 4);
  const picks = repoSource.slice(0, 5);
  const langs = new Map<string, number>();
  for (const r of picks) {
    if (r.language) langs.set(r.language, (langs.get(r.language) ?? 0) + 1);
  }
  const topLangs = [...langs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
  const langSuffix = topLangs.length > 0 ? ` (${topLangs.join(', ')})` : '';
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
      bio: gh.name ? `${gh.name} — projects on GitHub${langSuffix}.` : `${displayName} — projects on GitHub${langSuffix}.`,
      avatarUrl:
        (gh.avatarUrl ?? '').trim().length > 0
          ? upsampleGithubAvatarUrl(gh.avatarUrl)
          : githubProfilePngUrl(gh.login),
      links: { github: gh.htmlUrl, linkedin: '', x: '', website: '', resumeUrl: '' },
    },
    projects,
    studio: { wizardVersion: 1, githubLogin: gh.login },
  };
}

export function normalizePortfolioContent(c: PortfolioContent): PortfolioContent {
  return {
    ...c,
    studio: {
      wizardVersion: 1,
      onboardingComplete: c.studio?.onboardingComplete ?? false,
      githubLogin: c.studio?.githubLogin,
    },
    displayDensity: c.displayDensity ?? 'compact',
    featuredLayout: c.featuredLayout ?? 'editorial',
    heatmap: c.heatmap
      ? {
          showGithub: c.heatmap.showGithub,
          showDsa: c.heatmap.showDsa,
          combined: c.heatmap.combined,
        }
      : undefined,
    sections: {
      ...c.sections,
      hidden: (c.sections.hidden ?? []).filter((id) => id !== 'hero'),
    },
  };
}

export function applyResumeDraft(
  base: PortfolioContent,
  draft: Partial<PortfolioContent>,
  pick: Record<string, boolean>
): PortfolioContent {
  const next = structuredClone(base);
  if (pick.hero && draft.hero) {
    next.hero = {
      ...next.hero,
      ...draft.hero,
      links: { ...next.hero.links, ...draft.hero.links },
    };
  }
  if (pick.skills && draft.skills?.length) {
    next.skills = [...next.skills, ...draft.skills];
  }
  if (pick.experience && draft.experience?.length) {
    next.experience = [...next.experience, ...draft.experience];
  }
  if (pick.education && draft.education?.length) {
    next.education = [...next.education, ...draft.education];
  }
  return next;
}

function aiStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2)
  );
}

/** Share of smaller set's tokens that appear in the other string (0–1). */
function tokenOverlapRatio(a: string, b: string): number {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let n = 0;
  for (const t of A) if (B.has(t)) n++;
  return n / Math.min(A.size, B.size);
}

/** Turn prose internship lines into "Intern @ Org" when possible. */
function normalizeRoleTitleAtFormat(roleTitle: string): string {
  let t = roleTitle.trim();
  if (!t) return t;
  let m = t.match(/^currently\s+intern(?:ing)?\s+at\s+(.+)$/i);
  if (!m) m = t.match(/^interning\s+at\s+(.+)$/i);
  if (!m) m = t.match(/^currently\s+working\s+at\s+(.+)$/i);
  if (!m) m = t.match(/^currently\s+employed\s+at\s+(.+)$/i);
  if (m) {
    const org = m[1].trim().replace(/\.$/, '');
    return aiStr(`Intern @ ${org}`, 72);
  }
  if (/^intern\s+at\s+/i.test(t) && !t.includes('@')) {
    m = t.match(/^intern\s+at\s+(.+)$/i);
    if (m) return aiStr(`Intern @ ${m[1].trim().replace(/\.$/, '')}`, 72);
  }
  return aiStr(t, 72);
}

/** After bulk AI merge: normalize role headline; drop redundant micro-lines. */
function coalesceBulkHeroFields(hero: PortfolioHero): PortfolioHero {
  const h = { ...hero };
  h.roleTitle = normalizeRoleTitleAtFormat((h.roleTitle ?? '').trim()) || h.roleTitle;
  const role = (h.roleTitle ?? '').trim();
  const bio = (h.bio ?? '').trim();
  let strong = (h.strongestSkill ?? '').trim();

  h.statusLine = '';

  if (strong && bio && tokenOverlapRatio(strong, bio) >= 0.42) strong = '';
  if (strong && role && tokenOverlapRatio(strong, role) >= 0.35) strong = '';
  if (strong && /llm|agent|ml|ai|deep|graph|neo4j/i.test(bio) && /llm|agent|ml|ai|deep|graph|neo4j/i.test(strong)) {
    if (tokenOverlapRatio(strong, bio) >= 0.22) strong = '';
  }
  h.strongestSkill = strong ? aiStr(strong, 48) : '';

  return h;
}

export type PortfolioBulkAiFillPayload = {
  hero?: Record<string, unknown>;
  howIBuild?: Record<string, unknown> | null;
  skills?: unknown[];
  experience?: unknown[];
  education?: unknown[];
  projects?: unknown[];
  recentActivity?: string[];
};

function mapAiExperience(e: unknown): PortfolioExperience | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  const title = aiStr(o.title, 120);
  const org = aiStr(o.org, 120);
  if (!title || !org) return null;
  const bullets = Array.isArray(o.bullets)
    ? o.bullets
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 4)
    : undefined;
  const stack = Array.isArray(o.stack)
    ? o.stack
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 20)
    : undefined;
  return {
    title,
    org,
    startDate: aiStr(o.startDate, 40),
    endDate: o.endDate ? aiStr(o.endDate, 40) : undefined,
    current: o.current === true,
    bullets: bullets?.length ? bullets : undefined,
    stack: stack?.length ? stack : undefined,
  };
}

function mapAiEducation(e: unknown): PortfolioEducation | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  const school = aiStr(o.school, 120);
  if (!school) return null;
  return {
    school,
    degree: aiStr(o.degree, 120),
    startDate: o.startDate ? aiStr(o.startDate, 40) : undefined,
    endDate: o.endDate ? aiStr(o.endDate, 40) : undefined,
    current: o.current === true,
    details: o.details ? aiStr(o.details, 400) : undefined,
  };
}

function mergeProjectWithAiPatch(base: PortfolioProject, patch: unknown): PortfolioProject {
  if (!patch || typeof patch !== 'object') return base;
  const o = patch as Record<string, unknown>;
  const techStack = Array.isArray(o.techStack)
    ? o.techStack
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim().slice(0, 32))
        .filter(Boolean)
        .slice(0, 8)
    : base.techStack;
  const engineeringHighlights = Array.isArray(o.engineeringHighlights)
    ? o.engineeringHighlights
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim().slice(0, 88))
        .filter(Boolean)
        .slice(0, 2)
    : base.engineeringHighlights;
  const signalCues = Array.isArray(o.signalCues)
    ? o.signalCues
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim().slice(0, 24))
        .filter(Boolean)
        .slice(0, 3)
    : base.signalCues;
  let metrics: Record<string, string> | undefined;
  if (o.metrics && typeof o.metrics === 'object' && !Array.isArray(o.metrics)) {
    const m: Record<string, string> = {};
    for (const [k, v] of Object.entries(o.metrics as Record<string, unknown>)) {
      const key = k.trim().slice(0, 24);
      const val = typeof v === 'string' ? v.trim().slice(0, 48) : String(v ?? '').slice(0, 48);
      if (key && val) m[key] = val;
    }
    if (Object.keys(m).length) metrics = m;
  }
  const shortDescription = aiStr(o.shortDescription, 100) || base.shortDescription;
  const whyBuilt = o.whyBuilt !== undefined ? aiStr(o.whyBuilt, 110) || undefined : base.whyBuilt;
  return {
    ...base,
    shortDescription: shortDescription.length ? shortDescription : base.shortDescription,
    whyBuilt,
    techStack: techStack?.length ? techStack : base.techStack,
    engineeringHighlights: engineeringHighlights?.length ? engineeringHighlights : base.engineeringHighlights,
    signalCues: signalCues?.length ? signalCues : base.signalCues,
    metrics: metrics ?? base.metrics,
    story: base.story,
  };
}

/** Merge Gemini bulk-fill (two-pass) into content; preserves hero.links, hero.avatarUrl, project story blocks. */
export function mergeBulkAiPortfolioFill(base: PortfolioContent, fill: PortfolioBulkAiFillPayload): PortfolioContent {
  const next = structuredClone(base);
  if (fill.hero && typeof fill.hero === 'object') {
    const h = fill.hero;
    const openToWork =
      typeof h.openToWork === 'boolean' ? h.openToWork : (next.hero.openToWork ?? false);
    next.hero = coalesceBulkHeroFields({
      ...next.hero,
      roleTitle: h.roleTitle !== undefined ? aiStr(h.roleTitle, 72) || next.hero.roleTitle : next.hero.roleTitle,
      bio: h.bio !== undefined ? aiStr(h.bio, 220) : next.hero.bio,
      location: h.location !== undefined ? aiStr(h.location, 120) : next.hero.location,
      statusLine: '',
      strongestSkill: h.strongestSkill !== undefined ? aiStr(h.strongestSkill, 48) : next.hero.strongestSkill,
      availabilityText: openToWork
        ? 'Open to opportunities'
        : h.availabilityText !== undefined
          ? aiStr(h.availabilityText, 28) || next.hero.availabilityText
          : next.hero.availabilityText,
      openToWork,
      links: next.hero.links,
      avatarUrl: next.hero.avatarUrl,
    });
  }

  const hb = fill.howIBuild;
  if (hb && typeof hb === 'object') {
    const bullets = Array.isArray(hb.bullets)
      ? hb.bullets
          .filter((x): x is string => typeof x === 'string')
          .map((s) => s.trim().slice(0, 200))
          .filter(Boolean)
          .slice(0, 5)
      : [];
    const interests = Array.isArray(hb.interests)
      ? hb.interests
          .filter((x): x is string => typeof x === 'string')
          .map((s) => s.trim().slice(0, 60))
          .filter(Boolean)
          .slice(0, 8)
      : [];
    if (bullets.length || interests.length) {
      next.howIBuild = { bullets, interests };
    }
  }

  if (fill.skills?.length) {
    const rows = fill.skills
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const o = row as Record<string, unknown>;
        const category = aiStr(o.category, 60);
        const items = Array.isArray(o.items)
          ? o.items
              .filter((x): x is string => typeof x === 'string')
              .map((s) => s.trim().slice(0, 40))
              .filter(Boolean)
              .slice(0, 30)
          : [];
        if (!category || !items.length) return null;
        return { category, items };
      })
      .filter(Boolean) as PortfolioContent['skills'];
    if (rows.length) next.skills = rows;
  }

  if (fill.experience?.length) {
    const ex = fill.experience.map(mapAiExperience).filter(Boolean) as PortfolioExperience[];
    if (ex.length) next.experience = ex;
  }

  if (fill.education?.length) {
    const ed = fill.education.map(mapAiEducation).filter(Boolean) as PortfolioEducation[];
    if (ed.length) next.education = ed;
  }

  if (fill.projects?.length && next.projects.length) {
    next.projects = next.projects.map((proj, i) => mergeProjectWithAiPatch(proj, fill.projects![i]));
  }

  if (fill.recentActivity?.length) {
    next.recentActivity = fill.recentActivity.map((s) => s.trim().slice(0, 72)).filter(Boolean).slice(0, 4);
  }

  return next;
}

export function shouldSkipPortfolioWizard(c: PortfolioContent): boolean {
  const n = normalizePortfolioContent(c);
  return (
    n.studio?.onboardingComplete === true ||
    (n.projects?.length ?? 0) > 0 ||
    (n.hero?.bio?.length ?? 0) > 40
  );
}
