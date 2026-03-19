/**
 * HTTP client for Seerr/Overseerr REST API.
 *
 * Supports two auth modes (same pattern as Jellyseerr):
 *   - API key (X-Api-Key header) → for admin
 *   - Cookie-based session (via /api/v1/auth/local) → for non-admin users
 */
export class SeerrClient {
  private baseUrl: string;
  private cookie: string | null = null;

  constructor(
    baseUrl: string,
    private authMode: "apikey" | "cookie",
    private apiKey?: string,
    private email?: string,
    private password?: string,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async login(): Promise<void> {
    if (this.authMode !== "cookie" || !this.email || !this.password) {
      throw new Error("Seerr cookie auth requires email and password");
    }

    const res = await fetch(`${this.baseUrl}/api/v1/auth/local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.email, password: this.password }),
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Seerr login failed (${res.status}): ${text}`);
    }

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.authMode === "apikey" && this.apiKey) {
      // Overseerr expects the API key base64-encoded
      const key = Buffer.from(this.apiKey).toString("base64") === this.apiKey
        ? this.apiKey  // already base64
        : Buffer.from(this.apiKey).toString("base64");
      headers["X-Api-Key"] = key;
    } else if (this.cookie) {
      headers["Cookie"] = this.cookie;
    }

    return headers;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<T> {
    if (this.authMode === "cookie" && !this.cookie) {
      await this.login();
    }

    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const doFetch = async () =>
      fetch(url.toString(), {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(60_000),
      });

    let res = await doFetch();

    // Re-login on 401 for cookie auth
    if (res.status === 401 && this.authMode === "cookie") {
      this.cookie = null;
      await this.login();
      res = await doFetch();
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Seerr ${method} ${path} failed (${res.status}): ${text}`);
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

  put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, body);
  }

  delete<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }
}

/**
 * Factory: create Seerr clients for each auth level.
 */
export interface SeerrConfig {
  url: string;
  api_key?: string;
  users?: Record<string, { email: string; password: string }>;
}

export function createSeerrClients(
  config: SeerrConfig,
): Map<string, SeerrClient> {
  const clients = new Map<string, SeerrClient>();

  // Admin client (API key)
  if (config.api_key) {
    clients.set("admin", new SeerrClient(config.url, "apikey", config.api_key));
  }

  // User-level clients (cookie auth)
  if (config.users) {
    for (const [level, creds] of Object.entries(config.users)) {
      clients.set(
        level,
        new SeerrClient(config.url, "cookie", undefined, creds.email, creds.password),
      );
    }
  }

  return clients;
}
