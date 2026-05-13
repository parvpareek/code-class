import type { PortfolioContent } from './portfolio.schema';

/** Heuristic resume text → draft content for import review (not auto-saved). */
export function resumeTextToDraft(text: string): Partial<PortfolioContent> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const draft: Partial<PortfolioContent> = {};

  const hero: PortfolioContent['hero'] = {
    roleTitle: '',
    tagline: '',
    bio: '',
    location: '',
    avatarUrl: null,
    openToWork: false,
    availabilityText: '',
    links: { github: '', linkedin: '', x: '', website: '', resumeUrl: '' },
  };

  if (lines.length > 0 && lines[0].length < 80 && !lines[0].includes('@')) {
    hero.roleTitle = lines[0].slice(0, 120);
  }
  const summaryLines: string[] = [];
  for (let i = 1; i < Math.min(lines.length, 6); i++) {
    if (/^(experience|education|skills|projects)/i.test(lines[i])) break;
    if (lines[i].length > 10 && lines[i].length < 400) summaryLines.push(lines[i]);
  }
  if (summaryLines.length) {
    hero.bio = summaryLines.join(' ').slice(0, 1200);
  }

  const email = extractPrimaryEmail(text);
  if (email && !(hero.bio ?? '').includes(email)) {
    hero.bio = (hero.bio ? `${hero.bio}\n\n` : '') + email;
    hero.bio = hero.bio.slice(0, 1200);
  }

  hero.links = extractHeroLinksFromText(text, hero.links);
  draft.hero = hero;

  const skills: PortfolioContent['skills'] = [];
  const skillBody = findSectionBody(text, ['skills', 'technical skills']);
  if (skillBody) {
    const parts = skillBody
      .split(/[,•|·\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 40);
    if (parts.length) {
      skills.push({ category: 'From resume', items: [...new Set(parts)].slice(0, 20) });
    }
  }
  if (skills.length) draft.skills = skills;

  const eduBody = findSectionBody(text, ['education', 'academic background']);
  if (eduBody) {
    const edu = parseEducationBlocks(eduBody);
    if (edu.length) draft.education = edu;
  }

  const expBody = findSectionBody(text, ['experience', 'work experience', 'employment history']);
  if (expBody) {
    const exp = parseExperienceBlocks(expBody);
    if (exp.length) draft.experience = exp;
  }

  return draft;
}

function stripTrailingPunct(s: string): string {
  return s.replace(/[.,;:)\]]+$/g, '');
}

function normalizeHttpUrl(u: string): string {
  const t = u.trim();
  if (/^https?:\/\//i.test(t)) return stripTrailingPunct(t);
  return `https://${stripTrailingPunct(t.replace(/^\/+/, ''))}`;
}

/** Pull http(s) URLs from resume text (PDF extraction often splits lines oddly). */
function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const u = stripTrailingPunct(m[0]);
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

function extractLinkedInLoose(text: string): string | null {
  const re = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/gi;
  const m = re.exec(text);
  return m ? normalizeHttpUrl(m[0]) : null;
}

/** First plausible GitHub profile login from `github.com/login` or `github.com/login/...`. */
function extractGithubProfileLoose(text: string): string | null {
  const re =
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38}[a-zA-Z0-9]))(?:\/[^\s"'<>)]+)?/gi;
  const skip = /^(topics|features|marketplace|orgs|explore|account|settings|sponsors|login|signup|collections)$/i;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const login = m[1];
    if (skip.test(login)) continue;
    return `https://github.com/${login}`;
  }
  return null;
}

function extractPrimaryEmail(body: string): string | null {
  const re = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.(?:[a-zA-Z]{2,}))\b/g;
  const badHost = /(example\.com|test\.com|localhost|domain\.com|yourname\.com|email\.com)$/i;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const e = m[1];
    if (badHost.test(e)) continue;
    return e;
  }
  return null;
}

function extractHeroLinksFromText(
  text: string,
  base?: PortfolioContent['hero']['links']
): NonNullable<PortfolioContent['hero']['links']> {
  const links: NonNullable<PortfolioContent['hero']['links']> = {
    github: '',
    linkedin: '',
    x: '',
    website: '',
    resumeUrl: '',
    ...base,
  };
  const urls = extractUrls(text);

  for (const raw of urls) {
    const low = raw.toLowerCase();
    if (low.includes('github.com')) {
      if (!links.github?.trim()) links.github = raw;
      continue;
    }
    if (low.includes('linkedin.com')) {
      if (!links.linkedin?.trim()) links.linkedin = raw;
      continue;
    }
    if (low.includes('twitter.com') || low.includes('x.com')) {
      if (!links.x?.trim()) links.x = raw;
      continue;
    }
    if (!links.website?.trim()) {
      links.website = raw;
    }
  }

  if (!links.linkedin?.trim()) {
    const li = extractLinkedInLoose(text);
    if (li) links.linkedin = li;
  }
  if (!links.github?.trim()) {
    const gh = extractGithubProfileLoose(text);
    if (gh) links.github = gh;
  }

  return links;
}

const SECTION_STOP_LINE =
  /^(experience|education|skills|projects|certifications|awards|publications|references|summary|objective|coursework|volunteer|work experience|employment history|employment|academic background|technical skills)\s*:?$/i;

function findSectionBody(text: string, titleVariants: string[]): string | null {
  const rawLines = text.replace(/\r\n/g, '\n').split('\n');
  const lowerLines = rawLines.map((l) => l.trim().toLowerCase());
  let start = -1;
  for (let i = 0; i < rawLines.length; i++) {
    const L = lowerLines[i];
    for (const h of titleVariants) {
      const hl = h.toLowerCase();
      if (L === hl || L === `${hl}:` || L.startsWith(`${hl} `) || L.startsWith(`${hl}:`)) {
        start = i + 1;
        break;
      }
    }
    if (start !== -1) break;
  }
  if (start === -1) return null;
  const bodyLines: string[] = [];
  for (let i = start; i < rawLines.length; i++) {
    const trim = rawLines[i].trim();
    if (trim && SECTION_STOP_LINE.test(trim)) break;
    bodyLines.push(rawLines[i]);
  }
  return bodyLines.join('\n').trim();
}

function parseEducationBlocks(body: string): PortfolioContent['education'] {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: PortfolioContent['education'] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const school = lines[0].replace(/^[-•*]\s*/, '').slice(0, 120);
    const degreeBits: string[] = [];
    const detailLines: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i].replace(/^[-•*\d.)]+\s*/, '');
      if (
        /^(B\.?S\.|M\.?S\.|Ph\.?D|MBA|B\.?A\.|M\.?A\.|B\.?(ENG|S\.?)|M\.?(ENG|S\.?)|Associate|Certificate|Diploma|High School)/i.test(
          raw
        ) &&
        raw.length < 160
      ) {
        degreeBits.push(raw);
        continue;
      }
      detailLines.push(raw);
    }
    const degree = degreeBits.join(' ').slice(0, 120);
    const details = detailLines.join('\n').trim().slice(0, 2000);
    out.push({
      school,
      degree,
      startDate: '',
      current: false,
      details: details || undefined,
    });
  }
  return out;
}

function parseExperienceBlocks(body: string): PortfolioContent['experience'] {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: PortfolioContent['experience'] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    let title = lines[0].replace(/^[-•*]\s*/, '');
    let org = '';
    let idx = 1;
    if (
      lines.length > 1 &&
      !/^[-•*\d.)]/.test(lines[1]) &&
      lines[1].length < 160 &&
      !/\b(?:built|led|developed|improved|implemented|managed|designed|created)\b/i.test(lines[1])
    ) {
      org = lines[1];
      idx = 2;
    }
    const pipe = title.split(/\s+[|–—]\s+/);
    if (pipe.length === 2 && !org) {
      title = pipe[0].trim();
      org = pipe[1].trim();
    } else if (!org) {
      org = 'Organization';
    }
    const bullets: string[] = [];
    for (; idx < lines.length; idx++) {
      const line = lines[idx].replace(/^[-•*\d.)]+\s*/, '').trim();
      if (line.length > 1) bullets.push(line.slice(0, 800));
    }
    out.push({
      title: title.slice(0, 120),
      org: org.slice(0, 120),
      startDate: '',
      current: false,
      bullets: bullets.length ? bullets.slice(0, 20) : undefined,
    });
  }
  return out;
}
