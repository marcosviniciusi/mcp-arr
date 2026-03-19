/**
 * HTTP client for TheTVDB API v4 (https://api4.thetvdb.com/v4).
 * Auth: POST /login with apikey → Bearer token (cached ~1 month).
 */
export class TvdbClient {
  private baseUrl = "https://api4.thetvdb.com/v4";
  private token: string | null = null;

  constructor(private apiKey: string) {}

  private async login(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: this.apiKey }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`TVDB login failed (${res.status})`);
    const json: any = await res.json();
    this.token = json.data?.token;
    if (!this.token) throw new Error("TVDB login: no token in response");
  }

  async get<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
    if (!this.token) await this.login();

    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }

    let res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(60_000),
    });

    // Re-login on 401
    if (res.status === 401) {
      await this.login();
      res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: AbortSignal.timeout(60_000),
      });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`TVDB GET ${path} failed (${res.status}): ${text}`);
    }

    const json: any = await res.json();
    return json.data as T;
  }
}
