import type { PortfolioContent } from '@/types/portfolio';

/** Rich context for Gemini — resume excerpt should be appended by caller when available. */
export function buildPortfolioSuggestContext(content: PortfolioContent, resumeExcerpt?: string): string {
  const parts: string[] = [];

  const edu = content.education?.slice(0, 3).map((e) => `${e.degree} @ ${e.school}${e.endDate ? ` (${e.endDate})` : ''}`);
  if (edu?.length) parts.push(`Education:\n${edu.join('\n')}`);

  const exp = content.experience?.slice(0, 4).map((x) => `${x.title} @ ${x.org}${x.startDate ? ` (${x.startDate}${x.endDate ? `–${x.endDate}` : ''})` : ''}`);
  if (exp?.length) parts.push(`Experience:\n${exp.join('\n')}`);

  const projects = content.projects
    .slice(0, 6)
    .map((p) => {
      const bits = [
        `${p.title}: ${p.shortDescription}`,
        p.whyBuilt ? `why: ${p.whyBuilt}` : '',
        (p.engineeringHighlights?.length ?? 0) > 0
          ? `highlights: ${(p.engineeringHighlights ?? []).join('; ')}`
          : '',
        p.story?.motivation ? `motivation: ${p.story.motivation.slice(0, 120)}` : '',
      ].filter(Boolean);
      return `${bits.join(' — ')} — stack: ${(p.techStack ?? []).join(', ') || 'n/a'}`;
    });
  if (projects.length) parts.push(`Projects:\n${projects.join('\n')}`);

  const skills = content.skills
    .flatMap((s) => s.items.slice(0, 12).map((i) => `${s.category}: ${i}`))
    .slice(0, 24);
  if (skills.length) parts.push(`Skills:\n${skills.join(', ')}`);

  const hb = content.howIBuild;
  if (hb?.bullets?.length) parts.push(`How I build:\n${hb.bullets.slice(0, 5).join('; ')}`);

  const links = content.hero.links;
  if (links) {
    const linkBits = [
      links.github && `GitHub: ${links.github}`,
      links.linkedin && `LinkedIn: ${links.linkedin}`,
      links.x && `X: ${links.x}`,
      links.website && `Site: ${links.website}`,
    ].filter(Boolean);
    if (linkBits.length) parts.push(`Links:\n${linkBits.join('\n')}`);
  }

  if ((content.hero.tagline ?? '').trim()) parts.push(`Current tagline: ${content.hero.tagline}`);
  if ((content.hero.location ?? '').trim()) parts.push(`Location: ${content.hero.location}`);

  if (resumeExcerpt?.trim()) {
    parts.push(`Resume / CV excerpt:\n${resumeExcerpt.trim().slice(0, 12000)}`);
  }

  let out = parts.join('\n\n');
  if (out.length > 14000) out = `${out.slice(0, 14000)}\n… [truncated]`;
  return out;
}
