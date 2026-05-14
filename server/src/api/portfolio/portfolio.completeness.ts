import type { User } from '@prisma/client';
import type { PortfolioContent } from './portfolio.schema';

export type CompletenessResult = {
  percent: number;
  suggestions: string[];
};

/** Weights sum to 100. */
const W = {
  heroBio: 15,
  heroRole: 10,
  heroLinks: 10,
  projects: 20,
  projectStory: 15,
  skills: 10,
  experienceEdu: 10,
  platformSignal: 10,
} as const;

/** Deterministic checklist for editor (not shown on public page). */
export function computeCompleteness(user: User, content: PortfolioContent): CompletenessResult {
  let score = 0;
  const suggestions: string[] = [];

  const bio = (content.hero.bio ?? '').trim();
  if (bio.length >= 40) {
    score += W.heroBio;
  } else {
    suggestions.push('Add a short bio (40+ characters)');
  }

  const role = (content.hero.roleTitle ?? '').trim();
  if (role.length >= 2) {
    score += W.heroRole;
  } else {
    suggestions.push('Add your role or title');
  }

  const links = content.hero.links ?? {};
  const linkCount = [links.github, links.linkedin, links.x, links.website].filter(
    (u) => typeof u === 'string' && u.trim().length > 0
  ).length;
  if (linkCount >= 1) {
    score += W.heroLinks;
  } else {
    suggestions.push('Link GitHub, LinkedIn, or your site');
  }

  const projects = content.projects;
  if (projects.length >= 1) {
    score += W.projects;
    const hasStructuredStory = projects.some((p) => {
      const s = p.story;
      if (!s) return false;
      return [s.motivation, s.architecture, s.challenges, s.lessons, s.futurePlans].some(
        (x) => (x ?? '').trim().length >= 40
      );
    });
    const withStory =
      hasStructuredStory ||
      projects.some((p) => (p.whyBuilt ?? '').trim().length >= 40);
    if (withStory) {
      score += W.projectStory;
    } else {
      suggestions.push('Add a project story (why it exists, motivation, architecture, or other story sections)');
    }
    const withScreenshot = projects.some((p) => (p.imageUrl ?? '').trim().length > 0);
    if (!withScreenshot) {
      suggestions.push('Add a project screenshot or banner URL');
    }
  } else {
    suggestions.push('Add at least one featured project');
  }

  if (content.skills.some((s) => s.items.length > 0)) {
    score += W.skills;
  } else {
    suggestions.push('Add grouped skills');
  }

  if (content.experience.length > 0 || content.education.length > 0) {
    score += W.experienceEdu;
  } else {
    suggestions.push('Add experience or education');
  }

  const hasPlatform =
    (user.leetcodeTotalSolved ?? 0) > 0 ||
    !!(user.leetcodeUsername && user.leetcodeUsername.length > 0);
  if (hasPlatform) {
    score += W.platformSignal;
  } else {
    suggestions.push('Connect LeetCode on your profile for stronger proof');
  }

  const percent = Math.min(100, Math.round(score));
  return { percent, suggestions: suggestions.slice(0, 6) };
}
