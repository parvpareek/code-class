import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_TEXT_MODEL } from '../../lib/geminiModel';

const RESUME_CLIP = 14_000;
const CTX_CLIP = 8_000;

/** Per Gemini round-trip (single generateContent), including JSON retry. */
const GEMINI_CALL_MS = Math.min(
  Math.max(Number(process.env.GEMINI_CALL_TIMEOUT_MS) || 120_000, 45_000),
  240_000
);

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n… [truncated]`;
}

async function generateJsonObject(
  apiKey: string,
  prompt: string,
  callLabel: string
): Promise<Record<string, unknown>> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });
  const tryParse = async (useJsonMime: boolean) => {
    const result = await withTimeout(
      model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: useJsonMime
          ? { maxOutputTokens: 8192, responseMimeType: 'application/json' }
          : { maxOutputTokens: 8192 },
      }),
      GEMINI_CALL_MS,
      `${callLabel} (${useJsonMime ? 'json' : 'text'} mode)`
    );
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

/** Two Gemini calls in parallel: profile + projects (no story.*). */
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
    "bio": string,
    "location": string,
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

TONE: sharp, humble, student-friendly. Problem-solver energy. NOT a resume dump — no GPA, ranks, long employer lists, or metric paragraphs in hero text.

Hero slots must NOT repeat the same story — fewer lines is better than more.

Constraints (STRICT — the UI is dense; long text breaks layout):
- hero.roleTitle: REQUIRED format ONLY (max 72 chars, no prose):
  (1) If degree-seeking student and university is known: "Student @ {University}".
  (2) Else if job or internship and organization is known: "{ConciseRole} @ {Org}" — e.g. "AI Engineer Intern @ OneClarity AI".
  NEVER write "Currently interning at…", "Interning at…", "Working at…", or other sentence-style employment lines — always "Role @ Org" or "Student @ School".
- hero.statusLine: always use empty string "" (do not fill — roleTitle carries employment/education headline).
- hero.strongestSkill: prefer "". ONLY if 2-4 words name ONE concrete strength not already implied by bio or roleTitle (e.g. a tool: "PyTorch + CUDA"). If bio already covers that strength, use "".
- hero.bio: HARD max 220 characters. At most 2 short sentences. Traits + what you enjoy (e.g. curious, ships side projects, likes ML systems). Zero bullet-style lists. Do not restate every internship or award.
- If openToWork is true: hero.availabilityText MUST be exactly the string "Open to opportunities" (nothing longer). If false: availabilityText "" or max 24 characters.
- skills: 2–5 categories; each items 4–10 short tokens (languages, frameworks, tools).
- experience: 1–6 roles; bullets 2–4 per role when resume supports it; each bullet max 120 characters.
- education: 1–4 entries; details max 400 characters total per entry.
- recentActivity: 0–4 lines, each max 72 characters; else [].
- Omit hero.links and hero.avatarUrl entirely (do not include those keys).
- Do NOT include projects in this response.`;

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
Keep everything compact, precise and sharp. 
For EACH project object include ONLY these keys (omit story / motivation / architecture / challenges / lessons / futurePlans entirely):
{
  "title": string (must exactly match input title at same index),
  "shortDescription": string (max 100 chars — one line hook),
  "whyBuilt": string (max 110 chars — ONE short sentence: problem or intent only),
  "techStack": string[] (max 8 items, each max 32 chars),
  "engineeringHighlights": string[] (1–2 bullets only, each max 88 chars),
  "signalCues": string[] (EXACTLY 1 to 3 items, each max 24 chars, 2–4 words; no duplicate ideas),
  "metrics": object with string keys and short string values e.g. { "Latency": "-40%", "Users": "10k" } — only if inferable from context, else {}
}

Rules:
- Stay truthful to resume + structured context; use [TBD] only when a metric is unknown.
- No markdown inside strings. No duplicate sentences across shortDescription / whyBuilt.
- techStack should extend (not ignore) the provided techStack hints when present.
- Prefer fewer, sharper strings over completeness — cards must stay visually short.`;

  const [profileJson, projectsJson] = await Promise.all([
    generateJsonObject(params.apiKey, `${source}\n\n${profilePrompt}`, 'portfolio profile fill'),
    generateJsonObject(params.apiKey, projectsPrompt, 'portfolio projects fill'),
  ]);

  const recentActivity = Array.isArray(profileJson.recentActivity)
    ? (profileJson.recentActivity as unknown[])
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim().slice(0, 72))
        .filter(Boolean)
        .slice(0, 4)
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
