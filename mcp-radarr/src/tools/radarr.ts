import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArrClient } from "../clients/arr-client.js";

export interface RadarrDefaults {
  qualityProfileId?: number;
  rootFolderPath?: string;
}

export function registerRadarrTools(server: McpServer, client: ArrClient, prefix = "radarr", defaults?: RadarrDefaults) {
  const p = prefix;
  const isAnime = p.includes("anime");
  const label = isAnime ? `${p} (ANIME MOVIES ONLY — use this for anime films, not regular movies)` : `${p} (regular movies — NOT anime, use radarr_animes for anime movies)`;
  const defQuality = defaults?.qualityProfileId;
  const defRoot = defaults?.rootFolderPath;

  const ok = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  });

  const slim = (obj: any, keys: string[]) => keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  server.tool(
    `${p}_get_movies`,
    `List movies in ${label} (top 25). Use search_movies to find a specific one by name.`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v3/movie");
      const items = data.slice(0, 25).map((m: any) => slim(m, ["id", "title", "year", "tmdbId", "imdbId", "status", "studio", "monitored", "hasFile", "sizeOnDisk", "runtime"]));
      return ok({ total: data.length, items });
    },
  );

  server.tool(
    `${p}_get_library_stats`,
    `Get library statistics for ${p}: total movies, downloaded, and missing counts`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v3/movie");
      const total = data.length;
      const downloaded = data.filter((m: any) => m.hasFile).length;
      const missing = data.filter((m: any) => m.monitored && !m.hasFile).length;
      return ok({ total, downloaded, missing });
    },
  );

  server.tool(
    `${p}_get_movie_by_id`,
    `Get details for a specific movie in ${p}`,
    { movieId: z.number().describe("Movie ID") },
    async ({ movieId }) => {
      const data = await client.get(`/api/v3/movie/${movieId}`);
      return ok(slim(data, ["id", "title", "year", "tmdbId", "imdbId", "status", "studio", "monitored", "hasFile", "sizeOnDisk", "runtime", "overview", "path", "quality"]));
    },
  );

  server.tool(
    `${p}_get_calendar`,
    `Get upcoming movies from ${p} calendar`,
    {
      start: z.string().optional().describe("Start date (ISO 8601)"),
      end: z.string().optional().describe("End date (ISO 8601)"),
    },
    async ({ start, end }) => {
      const params: Record<string, string> = {};
      if (start) params.start = start;
      if (end) params.end = end;
      const data: any[] = await client.get("/api/v3/calendar", params);
      return ok(data.map((m: any) => slim(m, ["id", "title", "year", "tmdbId", "inCinemas", "digitalRelease", "physicalRelease", "hasFile", "monitored"])));
    },
  );

  server.tool(
    `${p}_get_quality_profiles`,
    `List available quality profiles in ${p}`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v3/qualityprofile");
      return ok(data.map((p: any) => slim(p, ["id", "name"])));
    },
  );

  server.tool(
    `${p}_get_root_folders`,
    `List configured root folders in ${p}`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v3/rootfolder");
      return ok(data.map((f: any) => slim(f, ["id", "path", "freeSpace"])));
    },
  );

  server.tool(
    `${p}_get_history`,
    `Get history with pagination in ${p}`,
    {
      page: z.number().optional().default(1).describe("Page number"),
      pageSize: z.number().optional().default(20).describe("Page size"),
      sortKey: z.string().optional().default("date").describe("Sort key"),
      sortDirection: z.enum(["ascending", "descending"]).optional().default("descending").describe("Sort direction"),
      eventType: z.number().optional().describe("Filter by event type"),
    },
    async ({ page, pageSize, sortKey, sortDirection, eventType }) => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
        sortKey,
        sortDirection,
      };
      if (eventType !== undefined) params.eventType = String(eventType);
      const data = await client.get("/api/v3/history", params);
      const d = data as any;
      if (d.records) {
        d.records = d.records.map((r: any) => slim(r, ["id", "movieId", "sourceTitle", "date", "eventType", "quality"]));
      }
      return ok(d);
    },
  );

  server.tool(
    `${p}_get_credits`,
    `Get credits/cast for a movie in ${p}`,
    { movieId: z.number().describe("Movie ID") },
    async ({ movieId }) => {
      const data: any[] = await client.get("/api/v3/credit", { movieId: String(movieId) });
      return ok(data.map((c: any) => slim(c, ["personName", "character", "type", "order"])));
    },
  );

  server.tool(
    `${p}_get_extra_files`,
    `Get extra files for a movie in ${p}`,
    { movieId: z.number().describe("Movie ID") },
    async ({ movieId }) => {
      const data: any[] = await client.get("/api/v3/extrafile", { movieId: String(movieId) });
      return ok(data.map((f: any) => slim(f, ["id", "movieId", "relativePath", "type"])));
    },
  );

  // ---------------------------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------------------------

  server.tool(
    `${p}_search_movies`,
    `Search for a movie to add to ${label}. Returns search results + qualityProfiles + rootFolders so you can call add_movie directly without extra lookups.`,
    { term: z.string().describe("Search term (movie name)") },
    async ({ term }) => {
      const [data, profiles, folders] = await Promise.all([
        client.get("/api/v3/movie/lookup", { term }) as Promise<any[]>,
        client.get("/api/v3/qualityprofile") as Promise<any[]>,
        client.get("/api/v3/rootfolder") as Promise<any[]>,
      ]);
      const results = data.slice(0, 10).map((m: any) => slim(m, ["title", "year", "tmdbId", "imdbId", "status", "studio", "runtime"]));
      return ok({
        total: data.length,
        results,
        qualityProfiles: profiles.map((p: any) => ({ id: p.id, name: p.name })),
        rootFolders: folders.map((f: any) => ({ path: f.path, freeSpace: f.freeSpace })),
      });
    },
  );

  server.tool(
    `${p}_search_movie_download`,
    `Trigger a search/download for movies in ${p}`,
    { movieIds: z.array(z.number()).describe("List of movie IDs to search for") },
    async ({ movieIds }) =>
      ok(await client.post("/api/v3/command", { name: "MoviesSearch", movieIds })),
  );

  // ---------------------------------------------------------------------------
  // MANAGE
  // ---------------------------------------------------------------------------

  server.tool(
    `${p}_add_movie`,
    `Add a new movie to ${label}. Use tmdb_id from TMDB search/discover results directly — no need to call ${p}_search_movies first. qualityProfileId and rootFolderPath have pre-configured defaults if omitted.`,
    {
      tmdbId: z.number().describe("TMDB ID of the movie (use tmdb_id from TMDB results)"),
      title: z.string().describe("Movie title"),
      qualityProfileId: defQuality ? z.number().optional().default(defQuality).describe(`Quality profile ID (default: ${defQuality})`) : z.number().optional().describe("Quality profile ID (auto-resolved if omitted)"),
      rootFolderPath: defRoot ? z.string().optional().default(defRoot).describe(`Root folder path (default: ${defRoot})`) : z.string().optional().describe("Root folder path (auto-resolved if omitted)"),
      monitored: z.boolean().optional().default(true).describe("Monitor the movie"),
      searchForMovie: z.boolean().optional().default(true).describe("Search for movie on add"),
      minimumAvailability: z
        .enum(["announced", "inCinemas", "released"])
        .optional()
        .default("released")
        .describe("Minimum availability"),
      tags: z.array(z.number()).optional().default([]).describe("Tag IDs to apply"),
    },
    async ({ tmdbId, title, qualityProfileId, rootFolderPath, monitored, searchForMovie, minimumAvailability, tags }) => {
      // Auto-resolve qualityProfileId and rootFolderPath if not provided
      let resolvedQuality = qualityProfileId;
      let resolvedRoot = rootFolderPath;

      if (resolvedQuality === undefined || resolvedRoot === undefined) {
        const [profiles, folders] = await Promise.all([
          resolvedQuality === undefined ? client.get("/api/v3/qualityprofile") as Promise<any[]> : Promise.resolve([]),
          resolvedRoot === undefined ? client.get("/api/v3/rootfolder") as Promise<any[]> : Promise.resolve([]),
        ]);
        if (resolvedQuality === undefined) {
          if (!profiles.length) return ok({ error: "No quality profiles found. Please specify qualityProfileId." });
          const best = profiles.filter((p: any) => !p.name?.match(/disabled/i)).sort((a: any, b: any) => b.id - a.id)[0] ?? profiles[0];
          resolvedQuality = best.id;
        }
        if (resolvedRoot === undefined) {
          if (!folders.length) return ok({ error: "No root folders found. Please specify rootFolderPath." });
          resolvedRoot = folders[0].path;
        }
      }

      const body = {
        tmdbId,
        title,
        qualityProfileId: resolvedQuality,
        rootFolderPath: resolvedRoot,
        monitored,
        minimumAvailability,
        tags,
        addOptions: { searchForMovie },
      };
      const result: any = await client.post("/api/v3/movie", body);
      return ok(slim(result, ["id", "title", "year", "tmdbId", "imdbId", "status", "monitored", "hasFile", "path", "added"]));
    },
  );

  server.tool(
    `${p}_add_exclusion`,
    `Add a movie to the exclusion list in ${p}`,
    {
      tmdbId: z.number().describe("TMDB ID of the movie to exclude"),
      movieTitle: z.string().describe("Title of the movie"),
      movieYear: z.number().describe("Release year of the movie"),
    },
    async ({ tmdbId, movieTitle, movieYear }) =>
      ok(await client.post("/api/v3/exclusions", { tmdbId, movieTitle, movieYear })),
  );
}
