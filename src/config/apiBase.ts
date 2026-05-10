/** Base URL for API routes under /api/v1 (no trailing slash). */
export function getApiV1BaseUrl(): string {
  const envURL = import.meta.env.VITE_API_URL;

  if (envURL) {
    if (envURL.endsWith('/api/v1')) {
      return envURL;
    }
    if (envURL.endsWith('/')) {
      return envURL + 'api/v1';
    }
    return envURL + '/api/v1';
  }

  return 'https://codeclass.up.railway.app/api/v1';
}
