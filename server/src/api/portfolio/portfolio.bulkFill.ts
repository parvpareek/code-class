import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_TEXT_MODEL } from '../../lib/geminiModel';

const RESUME_CLIP = 14_000;
const CTX_CLIP = 8_000;

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n… [truncated]`;
}

async function generateJsonObject(apiKey: string, prompt: string): Promise<Record<string, unknown>> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });
  const tryParse = async (useJsonMime: boolean) => {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: useJsonMime
        ? { maxOutputTokens: 8192, responseMimeType: 'application/json' }
        : { maxOutputTokens: 8192 },
    });
    const raw = result.response.text().trim();
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      const cleaned = raw.replace(/^```json\n?|```$/g, '').trim();
      return JSON.parse(cleaned) as Record<string, unknown>;
    }
  };
  try {
    return await tryParse(true);
  } catch {
    return tryParse(false);
  }
}

export type ProjectSkeletonIn = {
  title: string;
  githubUrl: string;
  techStack: string[];
};

export type PortfolioBulkAiFillResult = {
  hero: Record<string, unknown>;
  howIBuild: Record<string, unknown> | null;
  skills: unknown[];
  experience: unknown[];
  education: unknown[];
  projects: unknown[];
  recentActivity: string[];
};

/** Two Gemini calls: (1) profile + skills + experience + education + howIBuild, (2) project marketing fields only (no story.*). */
export async function bulkFillPortfolioTwoPasses(params: {
  apiKey: string;
  resumeText: string;
  portfolioContext: string;
  projectSkeletons: ProjectSkeletonIn[];
}): Promise<PortfolioBulkAiFillResult> {
  const source = [
    '=== RESUME / CV (plain text; primary source of truth for dates, employers, schools) ===',
    clip(params.resumeText, RESUME_CLIP) || '(no resume text — infer only from structured context below)',
    '',
    '=== STRUCTURED CONTEXT (GitHub, existing portfolio JSON summary) ===',
    clip(params.portfolioContext, CTX_CLIP),
  ].join('\n');

  const profilePrompt = `You are filling a developer portfolio profile from the source material below.
Do NOT invent employers, degrees, or dates that contradict the resume. If the resume is silent on a field, write a short honest placeholder or leave arrays empty.
Use YYYY-MM for startDate and endDate when you can infer months; use YYYY when only a year is known (still as YYYY-01 if you must pick a month).
For current roles or ongoing education, set current: true and omit endDate.

Return ONE JSON object only (no markdown) with exactly these keys:
{
  "hero": {
    "roleTitle": string,
    "tagline": string,
    "bio": string,
    "location": string,
    "currentFocus": string,
    "statusLine": string,
    "strongestSkill": string,
    "availabilityText": string,
    "openToWork": boolean
  },
  "howIBuild": { "bullets": string[], "interests": string[] } | null,
  "skills": [ { "category": string, "items": string[] } ],
  "experience": [
    { "title": string, "org": string, "startDate": string, "endDate": string, "current": boolean, "bullets": string[], "stack": string[] }
  ],
  "education": [
    { "school": string, "degree": string, "startDate": string, "endDate": string, "current": boolean, "details": string }
  ],
  "recentActivity": string[]
}

Constraints:
- hero.bio: max 1100 characters, concrete and specific.
- hero.tagline: max 190 characters.
- hero.roleTitle, statusLine, strongestSkill, availabilityText: respect short portfolio limits (roleTitle ~120 chars, statusLine ~120, strongestSkill ~80, availabilityText ~80).
- skills: 2–5 categories; each items 4–14 short tokens (languages, frameworks, tools).
- experience: 1–6 roles; bullets 2–6 per role when resume supports it.
- education: 1–4 entries; details can hold honors / coursework as plain lines.
- recentActivity: 0–6 very short lines (e.g. "Shipped payments refactor — Q2") if inferable; else [].
- Omit hero.links and hero.avatarUrl entirely (do not include those keys).
- Do NOT include projects in this response.`;

  const profileJson = await generateJsonObject(params.apiKey, `${source}\n\n${profilePrompt}`);

  const skeletonJson = JSON.stringify(
    params.projectSkeletons.map((p) => ({
      title: p.title,
      githubUrl: p.githubUrl,
      techStack: p.techStack,
    })),
    null,
    0
  );

  const projectsPrompt = `Same developer as before. Source material is repeated below.

${source}

PROJECTS (fixed order and titles — do not add or remove projects; do not rename titles):
${skeletonJson}

Return ONE JSON object: { "projects": [ ... ] }
The "projects" array MUST have the SAME LENGTH and SAME ORDER as the input list. Each entry matches one input project by index.

For EACH project object include ONLY these keys (omit story / motivation / architecture / challenges / lessons / futurePlans entirely):
{
  "title": string (must exactly match input title at same index),
  "shortDescription": string (max 270 chars, hook for recruiters),
  "whyBuilt": string (max 380 chars, intent / problem),
  "longDescription": string (max 2400 chars, what it does, stack, impact — factual),
  "techStack": string[] (max 16 items, each max 38 chars),
  "engineeringHighlights": string[] (max 6 bullets, each max 190 chars),
  "signalCues": string[] (max 8 short phrases for recruiter skimming),
  "metrics": object with string keys and short string values e.g. { "Latency": "-40%", "Users": "10k" } — only if inferable from context, else {}
}

Rules:
- Stay truthful to resume + structured context; use [TBD] only when a metric is unknown.
- No markdown inside strings.
- techStack should extend (not ignore) the provided techStack hints when present.`;

  const projectsJson = await generateJsonObject(params.apiKey, projectsPrompt);

  const recentActivity = Array.isArray(profileJson.recentActivity)
    ? (profileJson.recentActivity as unknown[])
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim().slice(0, 160))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return {
    hero: (profileJson.hero as Record<string, unknown>) ?? {},
    howIBuild: (profileJson.howIBuild as Record<string, unknown> | null) ?? null,
    skills: Array.isArray(profileJson.skills) ? profileJson.skills : [],
    experience: Array.isArray(profileJson.experience) ? profileJson.experience : [],
    education: Array.isArray(profileJson.education) ? profileJson.education : [],
    projects: Array.isArray(projectsJson.projects) ? projectsJson.projects : [],
    recentActivity,
  };
}
