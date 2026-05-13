import type { PortfolioContent, PortfolioProjectRepoInsight } from './portfolio.schema';
import { fetchGithubRepoInsight, parseGithubRepoUrl } from './portfolio.github';

const STALE_MS = 6 * 60 * 60 * 1000;

function insightFresh(repoFullName: string, insight: PortfolioProjectRepoInsight): boolean {
  if (insight.error) return false;
  if (insight.repoFullName !== repoFullName) return false;
  if (!insight.fetchedAt) return false;
  return Date.now() - new Date(insight.fetchedAt).getTime() < STALE_MS;
}

export async function enrichPortfolioContentRepoInsights(
  content: PortfolioContent
): Promise<{ content: PortfolioContent; changed: boolean }> {
  let changed = false;
  const nextProjects: PortfolioContent['projects'] = [];

  for (const proj of content.projects) {
    const url = proj.githubUrl?.trim();
    if (!url) {
      if (proj.repoInsight) changed = true;
      const rest = { ...proj };
      delete rest.repoInsight;
      nextProjects.push(rest);
      continue;
    }

    const parsed = parseGithubRepoUrl(url);
    if (!parsed) {
      if (proj.repoInsight) changed = true;
      const rest = { ...proj };
      delete rest.repoInsight;
      nextProjects.push(rest);
      continue;
    }

    const fullName = `${parsed.owner}/${parsed.repo}`;
    const existing = proj.repoInsight;
    if (existing && insightFresh(fullName, existing)) {
      nextProjects.push(proj);
      continue;
    }

    const res = await fetchGithubRepoInsight(parsed.owner, parsed.repo);
    changed = true;
    if (!res.ok) {
      nextProjects.push({
        ...proj,
        repoInsight: {
          repoFullName: fullName,
          fetchedAt: new Date().toISOString(),
          error: res.message,
        },
      });
    } else {
      nextProjects.push({
        ...proj,
        repoInsight: {
          repoFullName: fullName,
          stars: res.data.stars,
          forks: res.data.forks,
          contributors: res.data.contributors,
          codeBytes: res.data.codeBytes,
          linesEstimate: res.data.linesEstimate,
          repoCreatedAt: res.data.repoCreatedAt,
          lastPushAt: res.data.lastPushAt,
          fetchedAt: res.data.fetchedAt,
        },
      });
    }

    await new Promise((r) => setTimeout(r, 120));
  }

  return {
    content: { ...content, projects: nextProjects },
    changed,
  };
}
