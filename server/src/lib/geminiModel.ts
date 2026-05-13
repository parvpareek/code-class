/** Model id for generateContent (Google AI). Override with GEMINI_MODEL. */
export const GEMINI_TEXT_MODEL =
  process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
