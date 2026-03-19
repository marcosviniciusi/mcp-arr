/**
 * HTTP client for the OMDb API (https://www.omdbapi.com/).
 * Auth: API key via `?apikey=KEY` query parameter.
 */
export class OmdbClient {
  private baseUrl = "https://www.omdbapi.com";

  constructor(private apiKey: string) {}

  async get<T = unknown>(params: Record<string, string>): Promise<T> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("apikey", this.apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`OMDb request failed (${res.status})`);
    const json: any = await res.json();
    if (json.Response === "False") throw new Error(`OMDb: ${json.Error}`);
    return json as T;
  }
}
