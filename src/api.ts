export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch('/api' + path, {
    method,
    headers: {
      'X-FootballCoP': 'studio',
      ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!response.ok) {
    const report = await response.json().catch(() => null);
    throw new Error(report?.error ?? (response.status === 401 ? 'Please sign in.' : response.status === 404 ? 'Exercise unavailable.' : 'Request failed. Try again.'));
  }
  return response.status === 204 ? undefined as T : response.json();
}
