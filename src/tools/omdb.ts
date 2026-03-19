import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { OmdbClient } from "../clients/omdb-client.js";

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const slim = (obj: any, keys: string[]) => keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

const DETAIL_KEYS = [
  "Title", "Year", "Rated", "Runtime", "Genre",
  "imdbRating", "imdbVotes", "Metascore", "Ratings", "Type", "totalSeasons",
];

export function registerOmdbTools(server: McpServer, client: OmdbClient) {
  // ── Search ────────────────────────────────────────────────────

  server.tool(
    "omdb_search",
    "Search by title on OMDb",
    {
      query: z.string().describe("Search term (title)"),
      type: z.enum(["movie", "series", "episode"]).optional().describe("Filter by type"),
      year: z.number().optional().describe("Filter by year"),
      page: z.number().optional().default(1).describe("Page number"),
    },
    async ({ query, type, year, page }) => {
      const params: Record<string, string> = { s: query, page: String(page) };
      if (type) params.type = type;
      if (year) params.y = String(year);
      const data: any = await client.request(params);
      if (data.Response === "False") {
        return ok({ total: 0, results: [] });
      }
      const results = (data.Search ?? []).slice(0, 10).map((item: any) =>
        slim(item, ["Title", "Year", "imdbID", "Type"]),
      );
      return ok({ total: Number(data.totalResults) || 0, results });
    },
  );

  // ── Get by IMDb ID ────────────────────────────────────────────

  server.tool(
    "omdb_get_by_id",
    "Get ratings by IMDb ID (includes Rotten Tomatoes, Metacritic scores)",
    {
      imdbId: z.string().describe("IMDb ID (e.g. \"tt1234567\")"),
    },
    async ({ imdbId }) => {
      const data: any = await client.request({ i: imdbId });
      if (data.Response === "False") {
        throw new Error(data.Error || "Not found");
      }
      return ok(slim(data, DETAIL_KEYS));
    },
  );

  // ── Get by exact title ────────────────────────────────────────

  server.tool(
    "omdb_get_by_title",
    "Get ratings by exact title (includes Rotten Tomatoes, Metacritic scores)",
    {
      title: z.string().describe("Exact title"),
      type: z.enum(["movie", "series", "episode"]).optional().describe("Filter by type"),
      year: z.number().optional().describe("Filter by year"),
    },
    async ({ title, type, year }) => {
      const params: Record<string, string> = { t: title };
      if (type) params.type = type;
      if (year) params.y = String(year);
      const data: any = await client.request(params);
      if (data.Response === "False") {
        throw new Error(data.Error || "Not found");
      }
      return ok(slim(data, DETAIL_KEYS));
    },
  );
}
