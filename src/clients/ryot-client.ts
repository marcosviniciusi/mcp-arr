/**
 * GraphQL client for Ryot — self-hosted media tracking.
 * Auth: Authorization: Bearer {api_token}
 * Endpoint: {url}/backend/graphql
 */
export class RyotClient {
  private graphqlUrl: string;

  constructor(
    baseUrl: string,
    private apiToken: string,
  ) {
    this.graphqlUrl = `${baseUrl.replace(/\/+$/, "")}/backend/graphql`;
  }

  async query<T = unknown>(
    gql: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(this.graphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiToken}`,
        Accept: "application/json",
      },
      body: JSON.stringify({ query: gql, variables }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ryot GraphQL request failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };

    if (json.errors && json.errors.length > 0) {
      throw new Error(`Ryot GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
    }

    return json.data as T;
  }

  async mutation<T = unknown>(
    gql: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    return this.query<T>(gql, variables);
  }
}

/**
 * Factory: create Ryot clients for each auth level (user).
 */
export interface RyotConfig {
  url: string;
  api_token?: string;
  users?: Record<string, { api_token: string }>;
}

export function createRyotClients(config: RyotConfig): Map<string, RyotClient> {
  const clients = new Map<string, RyotClient>();

  // Admin client
  if (config.api_token) {
    clients.set("admin", new RyotClient(config.url, config.api_token));
  }

  // User-level clients
  if (config.users) {
    for (const [level, creds] of Object.entries(config.users)) {
      clients.set(level, new RyotClient(config.url, creds.api_token));
    }
  }

  return clients;
}
