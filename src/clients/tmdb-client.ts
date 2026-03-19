/**
 * HTTP client for The Movie Database (TMDB) REST API v3.
 * Auth: Bearer token (v4 read access token) via Authorization header.
 */
export class TmdbClient {
  private baseUrl: string;

  constructor(
    baseUrl: string = "https://api.themoviedb.org/3",
    private apiKey: string,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`TMDB ${method} ${path} failed (${res.status}): ${text}`);
    }

    return (await res.json()) as T;
  }

  get<T = unknown>(path: string, params?: Record<string, string>) {
    return this.request<T>("GET", path, undefined, params);
  }

  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body);
  }

  delete<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }
}
