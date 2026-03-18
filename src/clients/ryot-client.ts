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
