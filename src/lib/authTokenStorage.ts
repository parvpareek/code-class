/** JWT stored under this key in localStorage, with sessionStorage fallback when localStorage is blocked. */
const KEY = 'token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
  } catch {
    try {
      return sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(KEY, token);
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return;
  } catch {
    /* localStorage blocked (privacy mode / partitioned context) */
  }
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
