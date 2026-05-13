const KEY = 'code-class-portfolio-studio-gemini';

export function getStudioGeminiKey(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.length >= 20 ? v : null;
  } catch {
    return null;
  }
}

export function setStudioGeminiKey(key: string): void {
  try {
    localStorage.setItem(KEY, key.trim());
  } catch {
    /* ignore */
  }
}

export function clearStudioGeminiKey(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
