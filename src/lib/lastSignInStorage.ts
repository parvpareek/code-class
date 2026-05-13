/** Values for local "last used" hint on sign-in / sign-up (client-only). */
export type ClientSignInMethod = 'GOOGLE' | 'GITHUB' | 'EMAIL_PASSWORD';

export const LAST_SIGN_IN_STORAGE_KEY = 'code-class-last-sign-in-method';

export function lastSignInMethodLabel(method: ClientSignInMethod): string {
  switch (method) {
    case 'GOOGLE':
      return 'Google';
    case 'GITHUB':
      return 'GitHub';
    case 'EMAIL_PASSWORD':
      return 'Email & password';
    default:
      return '';
  }
}

export function readLastSignInMethod(): ClientSignInMethod | null {
  try {
    const v =
      localStorage.getItem(LAST_SIGN_IN_STORAGE_KEY) ??
      sessionStorage.getItem(LAST_SIGN_IN_STORAGE_KEY);
    if (v === 'GOOGLE' || v === 'GITHUB' || v === 'EMAIL_PASSWORD') return v;
  } catch {
    try {
      const v = sessionStorage.getItem(LAST_SIGN_IN_STORAGE_KEY);
      if (v === 'GOOGLE' || v === 'GITHUB' || v === 'EMAIL_PASSWORD') return v;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function writeLastSignInMethod(method: ClientSignInMethod | null | undefined): void {
  if (!method) return;
  try {
    localStorage.setItem(LAST_SIGN_IN_STORAGE_KEY, method);
    try {
      sessionStorage.removeItem(LAST_SIGN_IN_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return;
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(LAST_SIGN_IN_STORAGE_KEY, method);
  } catch {
    /* ignore */
  }
}
