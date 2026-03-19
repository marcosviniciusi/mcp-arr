/**
 * HTTP client for the OMDb API (https://www.omdbapi.com/).
 * Auth: API key via `?apikey=KEY` query parameter.
 */
export class OmdbClient {
  constructor(private apiKey: string) {}

  async request<T = unknown>(params: Record<string, string>): Promise<T> {
    const url = new URL("https://www.omdbapi.com/");
    url.searchParams.set("apikey", this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OMDb request failed (${res.status}): ${text}`);
    }
    return (await res.json()) as T;
  }
}
