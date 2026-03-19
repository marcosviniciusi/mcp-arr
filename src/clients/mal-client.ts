/**
 * HTTP client for MyAnimeList API v2.
 * Auth:
 *   - X-MAL-CLIENT-ID header for public endpoints (search, details, rankings)
 *   - Authorization: Bearer for user-specific endpoints (user lists, user info)
 */
export class MalClient {
  private baseUrl = "https://api.myanimelist.net/v2";

  constructor(
    private clientId: string,
    private accessToken?: string,
  ) {}

  private getHeaders(requireAuth: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (requireAuth && this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    } else {
      headers["X-MAL-CLIENT-ID"] = this.clientId;
    }

    return headers;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    params?: Record<string, string>,
    body?: unknown,
    requireAuth: boolean = false,
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
        ...this.getHeaders(requireAuth),
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: body
        ? new URLSearchParams(body as Record<string, string>).toString()
        : undefined,
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`MAL ${method} ${path} failed (${res.status}): ${text}`);
    }

    return (await res.json()) as T;
  }

  get<T = unknown>(path: string, params?: Record<string, string>, requireAuth = false) {
    return this.request<T>("GET", path, params, undefined, requireAuth);
  }

  patch<T = unknown>(path: string, body: Record<string, string>, requireAuth = true) {
    return this.request<T>("PATCH", path, undefined, body, requireAuth);
  }

  delete<T = unknown>(path: string, requireAuth = true) {
    return this.request<T>("DELETE", path, undefined, undefined, requireAuth);
  }

  get hasUserAuth(): boolean {
    return !!this.accessToken;
  }
}
