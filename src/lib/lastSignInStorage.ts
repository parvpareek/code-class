/** Values for local "last used" hint on sign-in / sign-up (client-only). */
export type ClientSignInMethod = 'GOOGLE' | 'GITHUB' | 'EMAIL_PASSWORD';

export const LAST_SIGN_IN_STORAGE_KEY = 'code-class-last-sign-in-method';

export function readLastSignInMethod(): ClientSignInMethod | null {
  try {
    const v = localStorage.getItem(LAST_SIGN_IN_STORAGE_KEY);
    if (v === 'GOOGLE' || v === 'GITHUB' || v === 'EMAIL_PASSWORD') return v;
  } catch {
    /* private mode, etc. */
  }
  return null;
}

export function writeLastSignInMethod(method: ClientSignInMethod | null | undefined): void {
  if (!method) return;
  try {
    localStorage.setItem(LAST_SIGN_IN_STORAGE_KEY, method);
  } catch {
    /* ignore */
  }
}
