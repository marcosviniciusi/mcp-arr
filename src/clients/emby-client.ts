/**
 * HTTP client for Emby REST API.
 * Uses API key auth via query param or header.
 */
export class EmbyClient {
  private baseUrl: string;

  constructor(
    baseUrl: string,
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
    url.searchParams.set("api_key", this.apiKey);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Emby ${method} ${path} failed (${res.status}): ${text}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
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

  /** Resolve a display name to an Emby userId (cached). */
  private userIdCache: Map<string, string> | null = null;

  async resolveUserId(displayName: string): Promise<string> {
    if (!this.userIdCache) {
      const users = await this.get<Array<{ Id: string; Name: string }>>("/emby/Users");
      this.userIdCache = new Map(users.map((u) => [u.Name, u.Id]));
    }
    const id = this.userIdCache.get(displayName);
    if (!id) throw new Error(`Emby user "${displayName}" not found`);
    return id;
  }
}

/**
 * Emby config with optional user mapping for auth_level support.
 */
export interface EmbyConfig {
  url: string;
  api_key: string;
  default_user?: string;
  users?: Record<string, string>; // auth_level -> display name
}
