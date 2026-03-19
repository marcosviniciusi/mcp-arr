import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TvdbClient } from "../clients/tvdb-client.js";

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const slim = (obj: any, keys: string[]) => keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

export function registerTvdbTools(server: McpServer, client: TvdbClient) {

  server.tool(
    "tvdb_search",
    "Search series and movies on TheTVDB by name",
    {
      query: z.string().describe("Search query"),
      type: z.enum(["series", "movie"]).optional().describe("Filter by type"),
      limit: z.number().optional().default(10),
    },
    async ({ query, type, limit }) => {
      const params: Record<string, string> = { query };
      if (type) params.type = type;
      const data: any[] = await client.get("/search", params);
      const items = (data ?? []).slice(0, limit).map((item: any) => slim(item, ["tvdb_id", "name", "type", "year", "status", "network", "primary_language"]));
      return ok({ total: (data ?? []).length, results: items });
    },
  );

  server.tool(
    "tvdb_get_series",
    "Get series details from TheTVDB by ID",
    { seriesId: z.number().describe("TVDB series ID") },
    async ({ seriesId }) => {
      const data: any = await client.get(`/series/${seriesId}`);
      return ok(slim(data, ["id", "name", "year", "status", "averageRuntime", "firstAired", "lastAired", "nextAired", "originalLanguage", "defaultSeasonType"]));
    },
  );

  server.tool(
    "tvdb_get_series_extended",
    "Get extended series info with season/episode counts from TheTVDB",
    { seriesId: z.number().describe("TVDB series ID") },
    async ({ seriesId }) => {
      const data: any = await client.get(`/series/${seriesId}/extended`);
      const s = slim(data, ["id", "name", "year", "status", "firstAired", "lastAired", "nextAired", "originalLanguage"]);
      // Summarize seasons
      if (Array.isArray(data.seasons)) {
        s.seasons = data.seasons.map((season: any) => slim(season, ["id", "number", "type", "name"]));
        s.seasonCount = data.seasons.filter((season: any) => season.type?.type === "official" || season.number > 0).length;
      }
      return ok(s);
    },
  );

  server.tool(
    "tvdb_get_series_episodes",
    "Get episodes for a series from TheTVDB grouped by season",
    {
      seriesId: z.number().describe("TVDB series ID"),
      page: z.number().optional().default(0).describe("Page number (0-indexed)"),
    },
    async ({ seriesId, page }) => {
      const data: any = await client.get(`/series/${seriesId}/episodes/default`, { page: String(page) });
      const episodes: any[] = data?.episodes ?? [];
      const seasons: Record<string, { episodes: { ep: number; name: string; aired: string }[]; total: number }> = {};
      for (const ep of episodes) {
        const key = `S${String(ep.seasonNumber ?? 0).padStart(2, "0")}`;
        if (!seasons[key]) seasons[key] = { episodes: [], total: 0 };
        seasons[key].episodes.push({ ep: ep.number, name: ep.name, aired: ep.aired });
        seasons[key].total++;
      }
      return ok({ seriesId, totalEpisodes: episodes.length, seasons });
    },
  );

  server.tool(
    "tvdb_get_movie",
    "Get movie details from TheTVDB by ID",
    { movieId: z.number().describe("TVDB movie ID") },
    async ({ movieId }) => {
      const data: any = await client.get(`/movies/${movieId}`);
      return ok(slim(data, ["id", "name", "year", "status", "runtime", "lastUpdated", "originalLanguage"]));
    },
  );

  server.tool(
    "tvdb_get_description",
    "Get the overview/description of a series or movie from TheTVDB. Use when you need to know what a title is about.",
    {
      type: z.enum(["series", "movies"]).describe("Type (series or movies)"),
      id: z.number().describe("TVDB ID"),
    },
    async ({ type, id }) => {
      const data: any = await client.get(`/${type}/${id}`);
      return ok({ id: data.id, name: data.name, overview: data.overview ?? "" });
    },
  );
}
