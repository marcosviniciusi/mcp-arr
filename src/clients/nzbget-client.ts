/**
 * HTTP client for NZBGet JSON-RPC API.
 * NZBGet uses HTTP basic auth + JSON-RPC.
 */
export class NZBGetClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(
    baseUrl: string,
    username: string,
    password: string,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.authHeader = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
  }

  async call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const res = await fetch(`${this.baseUrl}/jsonrpc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader,
      },
      body: JSON.stringify({ method, params, id: 1 }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`NZBGet ${method} failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as { result: T; error?: string };
    if (json.error) {
      throw new Error(`NZBGet ${method} error: ${json.error}`);
    }

    return json.result;
  }
}
