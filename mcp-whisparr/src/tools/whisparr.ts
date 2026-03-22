import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArrClient } from "../clients/arr-client.js";

export interface WhisparrDefaults {
  qualityProfileId?: number;
  rootFolderPath?: string;
}

export function registerWhisparrTools(server: McpServer, client: ArrClient, prefix = "whisparr", defaults?: WhisparrDefaults) {
  const p = prefix;

  const ok = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  });

  const slim = (obj: any, keys: string[]) => keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

  server.tool(
    `${p}_get_movies`,
    `List movies in ${p} (top 25). Use search_movies to find a specific one by name.`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v3/movie");
      const items = data.slice(0, 25).map((m: any) => slim(m, ["id", "title", "year", "tmdbId", "status", "monitored", "hasFile"]));
      return ok({ total: data.length, items });
    },
  );

  server.tool(
    `${p}_get_movie_by_id`,
    `Get details for a specific movie in ${p}`,
    { movieId: z.number().describe("Movie ID") },
    async ({ movieId }) => {
      const data = await client.get(`/api/v3/movie/${movieId}`);
      return ok(slim(data, ["id", "title", "year", "tmdbId", "status", "monitored", "hasFile", "overview", "path"]));
    },
  );

  server.tool(
    `${p}_search_movies`,
    `Search for a movie to add to ${p}`,
    { term: z.string().describe("Search term") },
    async ({ term }) => {
      const data: any[] = await client.get("/api/v3/movie/lookup", { term });
      const results = data.slice(0, 10).map((m: any) => slim(m, ["title", "year", "tmdbId", "status"]));
      return ok({ total: data.length, results });
    },
  );

  server.tool(
    `${p}_add_movie`,
    `Add a new movie to ${p}`,
    {
      tmdbId: z.number().describe("TMDB ID"),
      title: z.string().describe("Title"),
      qualityProfileId: z.number().optional().describe("Quality profile ID"),
      rootFolderPath: z.string().optional().describe("Root folder path"),
      monitored: z.boolean().optional().default(true).describe("Monitor"),
      searchForMovie: z.boolean().optional().default(true).describe("Search on add"),
      minimumAvailability: z.enum(["announced", "inCinemas", "released"]).optional().default("released"),
    },
    async ({ tmdbId, title, qualityProfileId, rootFolderPath, monitored, searchForMovie, minimumAvailability }) => {
      const qp = qualityProfileId ?? defaults?.qualityProfileId;
      const rf = rootFolderPath ?? defaults?.rootFolderPath;
      if (!qp) throw new Error("qualityProfileId is required (no default configured)");
      if (!rf) throw new Error("rootFolderPath is required (no default configured)");
      const body = {
        tmdbId, title, qualityProfileId: qp, rootFolderPath: rf, monitored, minimumAvailability,
        addOptions: { searchForMovie },
      };
      const result: any = await client.post("/api/v3/movie", body);
      return ok(slim(result, ["id", "title", "year", "tmdbId", "imdbId", "status", "monitored", "hasFile", "path", "added"]));
    },
  );

  server.tool(
    `${p}_delete_movie`,
    `Delete a movie from ${p}`,
    {
      movieId: z.number().describe("Movie ID"),
      deleteFiles: z.boolean().optional().default(false).describe("Also delete files"),
    },
    async ({ movieId, deleteFiles }) => {
      const path = deleteFiles ? `/api/v3/movie/${movieId}?deleteFiles=true` : `/api/v3/movie/${movieId}`;
      await client.delete(path);
      return ok({ message: `Movie ${movieId} deleted.` });
    },
  );

  server.tool(
    `${p}_search_movie_download`,
    `Trigger a search/download for movies in ${p}`,
    { movieIds: z.array(z.number()).describe("Movie IDs to search") },
    async ({ movieIds }) =>
      ok(await client.post("/api/v3/command", { name: "MoviesSearch", movieIds })),
  );

  server.tool(
    `${p}_get_queue`,
    `Get download queue in ${p}`,
    {},
    async () => {
      const data = await client.get("/api/v3/queue");
      if (Array.isArray(data)) {
        return ok(data.map((q: any) => slim(q, ["id", "title", "status", "size", "sizeleft", "timeleft"])));
      }
      const d = data as any;
      const records = (d.records ?? []).map((q: any) => slim(q, ["id", "title", "status", "size", "sizeleft", "timeleft"]));
      return ok({ total: d.totalRecords ?? records.length, records });
    },
  );

  server.tool(
    `${p}_get_quality_profiles`,
    `List quality profiles in ${p}`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v3/qualityprofile");
      return ok(data.map((p: any) => slim(p, ["id", "name"])));
    },
  );

  server.tool(
    `${p}_get_root_folders`,
    `List root folders in ${p}`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v3/rootfolder");
      return ok(data.map((f: any) => slim(f, ["id", "path", "freeSpace"])));
    },
  );
}
