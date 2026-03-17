/**
 * HTTP client for Jellyseerr/Overseerr REST API.
 *
 * Supports two auth modes:
 *   - API key (X-Api-Key header) → for admin
 *   - Cookie-based session (via /api/v1/auth/local) → for non-admin users
 */
export class JellyseerrClient {
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
      throw new Error("Jellyseerr cookie auth requires email and password");
    }

    const res = await fetch(`${this.baseUrl}/api/v1/auth/local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.email, password: this.password }),
      redirect: "manual",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Jellyseerr login failed (${res.status}): ${text}`);
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
      headers["X-Api-Key"] = this.apiKey;
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
      throw new Error(`Jellyseerr ${method} ${path} failed (${res.status}): ${text}`);
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
 * Factory: create Jellyseerr clients for each auth level.
 */
export interface JellyseerrConfig {
  url: string;
  api_key?: string;
  users?: Record<string, { email: string; password: string }>;
}

export function createJellyseerrClients(
  config: JellyseerrConfig,
): Map<string, JellyseerrClient> {
  const clients = new Map<string, JellyseerrClient>();

  // Admin client (API key)
  if (config.api_key) {
    clients.set("admin", new JellyseerrClient(config.url, "apikey", config.api_key));
  }

  // User-level clients (cookie auth)
  if (config.users) {
    for (const [level, creds] of Object.entries(config.users)) {
      clients.set(
        level,
        new JellyseerrClient(config.url, "cookie", undefined, creds.email, creds.password),
      );
    }
  }

  return clients;
}
