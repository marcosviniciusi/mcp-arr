/**
 * HTTP client for qBittorrent Web API.
 * Handles cookie-based auth (SID).
 */
export class QBittorrentClient {
  private baseUrl: string;
  private cookie: string | null = null;

  constructor(
    baseUrl: string,
    private username: string,
    private password: string,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async login(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`,
      redirect: "manual",
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const match = setCookie.match(/SID=([^;]+)/);
      if (match) {
        this.cookie = `SID=${match[1]}`;
        return;
      }
    }

    const text = await res.text();
    if (text === "Ok.") {
      const sc = res.headers.get("set-cookie");
      if (!sc) throw new Error("qBittorrent login succeeded but no cookie returned");
      this.cookie = sc.split(";")[0];
      return;
    }

    throw new Error(`qBittorrent login failed: ${text}`);
  }

  async request(
    method: string,
    path: string,
    body?: URLSearchParams | FormData,
  ): Promise<string> {
    if (!this.cookie) await this.login();

    const doRequest = async () => {
      const headers: Record<string, string> = {};
      if (this.cookie) headers["Cookie"] = this.cookie;

      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body,
      });

      if (res.status === 403) {
        this.cookie = null;
        await this.login();
        headers["Cookie"] = this.cookie!;
        return fetch(`${this.baseUrl}${path}`, { method, headers, body });
      }

      return res;
    };

    const res = await doRequest();
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${method} ${path} failed (${res.status}): ${text}`);
    }

    return res.text();
  }

  async getJson<T = unknown>(path: string): Promise<T> {
    const text = await this.request("GET", path);
    return JSON.parse(text) as T;
  }

  async post(path: string, params?: Record<string, string>): Promise<string> {
    const body = params ? new URLSearchParams(params) : undefined;
    return this.request("POST", path, body);
  }
}
