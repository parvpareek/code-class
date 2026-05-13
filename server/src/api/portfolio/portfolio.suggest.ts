import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_TEXT_MODEL } from '../../lib/geminiModel';

function getServerApiKey(): string | undefined {
  return process.env.PORTFOLIO_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
}

const CONTEXT_MAX = 14000;

function clipContext(ctx: string): string {
  const t = ctx.trim();
  if (t.length <= CONTEXT_MAX) return t;
  return `${t.slice(0, CONTEXT_MAX)}\n… [truncated]`;
}

export async function suggestHeroCopy(params: {
  field: 'tagline' | 'bio' | 'roleTitle';
  text: string;
  tone?: string;
  portfolioContext?: string;
  apiKey?: string | null;
}): Promise<string[]> {
  const key =
    (params.apiKey && params.apiKey.trim().length >= 20 ? params.apiKey.trim() : null) ??
    getServerApiKey();
  if (!key) {
    return [];
  }
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });

  const ctxBlock = params.portfolioContext?.trim()
    ? `\nPortfolio context (projects, education, experience — use only facts stated here):\n${clipContext(params.portfolioContext)}\n`
    : '';

  const prompt = `You write recruiter-facing developer portfolio copy. No clichés, no buzzword soup. Concrete facts > adjectives.

Field to generate ${params.field === 'roleTitle' ? 'lines for' : 'alternatives for'}: ${params.field}.
Current draft (may be empty): ${params.text.slice(0, 1200)}
Tone: ${params.tone || 'professional, concise, credible'}.
${ctxBlock}
Return exactly 3 alternatives as a JSON array of strings only.
Constraints:
${
  params.field === 'bio'
    ? `- bio: max 220 characters each, at most 2 short sentences. Voice: curious problem-solver / student-friendly. No GPA, ranks, or employer laundry lists.`
    : params.field === 'tagline'
      ? `- tagline: max 90 characters each, one clause.`
      : `- roleTitle: each line MUST be "Role @ Organization" or "Student @ University" (max 72 chars). Never "Currently interning at…" — use "Intern @ Company" instead.`
}
No markdown fences, no numbering — JSON array only.`;

  const result = await model.generateContent(prompt);
  const out = result.response.text().trim();
  try {
    const parsed = JSON.parse(out.replace(/^```json\n?|```$/g, '').trim()) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((x) => typeof x === 'string').map((s) => s.trim()).slice(0, 3);
    }
  } catch {
    /* fallthrough */
  }
  const lines = out
    .split('\n')
    .map((l) => l.replace(/^[-*]\s*/, '').replace(/^"\s*|\s*"$/g, '').trim())
    .filter((l) => l.length > 0);
  return lines.slice(0, 3);
}

export async function suggestBioAndRoleStructured(params: {
  apiKey: string;
  currentBio: string;
  portfolioContext?: string;
  tone?: string;
}): Promise<{ bios: string[]; roleTitles: string[] }> {
  const genAI = new GoogleGenerativeAI(params.apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });

  const ctxBlock = params.portfolioContext?.trim()
    ? `\nFacts about this person (resume, projects, links — stay truthful, expand only from here):\n${clipContext(params.portfolioContext)}\n`
    : '';

  const prompt = `You are helping a developer fill out their portfolio. Infer concrete details ONLY from the context below (projects built, stack, education, jobs). If something is unknown, omit it — never invent employers or degrees.

Current bio draft (may be empty): ${params.currentBio.slice(0, 2000)}
Tone: ${params.tone || 'professional, warm, specific — avoid generic filler'}.
${ctxBlock}

Return a single JSON object with exactly these keys (no markdown):
{
  "bios": [ string, string, string ],
  "roleTitles": [ string, string, string ]
}

Rules:
- bios: three alternative bios. Each HARD max 220 characters, max 2 short sentences. Humble, sharp, problem-solver tone — traits and what you like building. Do NOT paste resume achievements, metrics, or internship paragraphs.
- roleTitles: three headline lines ONLY as "Role @ Organization" or "Student @ University" (max 72 chars each). Examples: "AI Engineer Intern @ OneClarity AI", "Computer Science Student @ MIT". NEVER use prose like "Currently interning at…" or "Interning at…" — always Title @ Org.
If context is thin, keep bios shorter but still specific to what you know.`;

  const result = await model.generateContent(prompt);
  const out = result.response.text().trim();
  try {
    const cleaned = out.replace(/^```json\n?|```$/g, '').trim();
    const parsed = JSON.parse(cleaned) as { bios?: unknown; roleTitles?: unknown };
    const bios = Array.isArray(parsed.bios)
      ? parsed.bios.filter((x) => typeof x === 'string').map((s) => s.trim()).slice(0, 3)
      : [];
    const roleTitles = Array.isArray(parsed.roleTitles)
      ? parsed.roleTitles.filter((x) => typeof x === 'string').map((s) => s.trim()).slice(0, 3)
      : [];
    return { bios, roleTitles };
  } catch {
    return { bios: [], roleTitles: [] };
  }
}

export type ProjectScaffoldResult = {
  whyBuiltStubs: string[];
  highlights: string[];
  storyPrompts: {
    motivation: string;
    architecture: string;
    challenges: string;
    lessons: string;
    futurePlans: string;
  };
};

/** Outlines and stub bullets — not polished final marketing copy. */
export async function suggestProjectScaffold(params: {
  projectTitle: string;
  notes: string;
  stack: string;
  portfolioContext?: string;
  apiKey?: string | null;
}): Promise<ProjectScaffoldResult | null> {
  const key =
    (params.apiKey && params.apiKey.trim().length >= 20 ? params.apiKey.trim() : null) ??
    getServerApiKey();
  if (!key) return null;

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });

  const ctxBlock = params.portfolioContext?.trim()
    ? `\nKnown facts (do not invent employers, metrics, or users not listed here):\n${clipContext(params.portfolioContext)}\n`
    : '';

  const prompt = `You help engineers draft portfolio project narratives. Output is SCAFFOLDING ONLY — not final copy.

Project title: ${params.projectTitle.slice(0, 200)}
Stack (may be empty): ${params.stack.slice(0, 400)}
Author notes / facts (may be empty): ${params.notes.slice(0, 3000)}
${ctxBlock}

Return ONE JSON object only (no markdown fences) with exactly this shape:
{
  "whyBuiltStubs": [ string, string, string ],
  "highlights": [ string, string, string, string ],
  "storyPrompts": {
    "motivation": string,
    "architecture": string,
    "challenges": string,
    "lessons": string,
    "futurePlans": string
  }
}

Rules:
- whyBuiltStubs: three SHORT first-person stub lines the author can refine. Mention a concrete pain or situation when possible; use [BRACKET] placeholders for unknown numbers/names.
- highlights: four bullet STUBS starting with a verb; include placeholders like "[N] users" or "[X]% faster" where metrics are unknown — author must replace.
- storyPrompts: each value is ONE sentence instructing the author what to write in that section (e.g. "Describe the data flow between X and Y using your actual service names"), not the section text itself.
- No buzzwords: avoid "leverage", "cutting-edge", "robust scalable platform", "synergy".
- If facts are thin, keep stubs shorter and more question-like.`;

  const result = await model.generateContent(prompt);
  const out = result.response.text().trim();
  try {
    const cleaned = out.replace(/^```json\n?|```$/g, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const whyBuiltStubs = Array.isArray(parsed.whyBuiltStubs)
      ? parsed.whyBuiltStubs.filter((x) => typeof x === 'string').map((s) => s.trim()).slice(0, 3)
      : [];
    const highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights.filter((x) => typeof x === 'string').map((s) => s.trim()).slice(0, 6)
      : [];
    const sp = parsed.storyPrompts as Record<string, unknown> | undefined;
    const storyPrompts = {
      motivation: typeof sp?.motivation === 'string' ? sp.motivation.trim() : '',
      architecture: typeof sp?.architecture === 'string' ? sp.architecture.trim() : '',
      challenges: typeof sp?.challenges === 'string' ? sp.challenges.trim() : '',
      lessons: typeof sp?.lessons === 'string' ? sp.lessons.trim() : '',
      futurePlans: typeof sp?.futurePlans === 'string' ? sp.futurePlans.trim() : '',
    };
    if (
      whyBuiltStubs.length === 0 &&
      highlights.length === 0 &&
      !Object.values(storyPrompts).some((s) => s.length > 0)
    ) {
      return null;
    }
    return { whyBuiltStubs, highlights, storyPrompts };
  } catch {
    return null;
  }
}
