import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BazarrClient } from "../clients/bazarr-client.js";

export function registerBazarrTools(server: McpServer, client: BazarrClient, prefix = "bazarr") {
  const p = prefix;

  const ok = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  });

  const slim = (obj: any, keys: string[]) =>
    keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

  server.tool(
    `${p}_get_series`,
    `List all series with subtitle status in ${p}`,
    {},
    async () => {
      const raw: any = await client.get("/api/series");
      const data: any[] = Array.isArray(raw) ? raw : (raw.data ?? []);
      return ok({
        total: data.length,
        items: data.slice(0, 25).map((s: any) =>
          slim(s, ["sonarrSeriesId", "title", "profileId", "audio_language", "seriesType", "monitored"]),
        ),
      });
    },
  );

  server.tool(
    `${p}_get_series_by_id`,
    `Get subtitle details for a specific series in ${p}`,
    { seriesid: z.number().describe("Sonarr series ID") },
    async ({ seriesid }) => {
      const data: any = await client.get("/api/series", { seriesid: String(seriesid) });
      // Keep more fields but remove large embedded arrays
      if (data && typeof data === "object") {
        const { subtitles, ...rest } = Array.isArray(data) ? (data[0] ?? {}) : data;
        return ok(rest);
      }
      return ok(data);
    },
  );

  server.tool(
    `${p}_get_episodes`,
    `Get episodes grouped by season with subtitle status in ${p}. Shows ep number and missing subtitle languages.`,
    { seriesid: z.number().describe("Sonarr series ID") },
    async ({ seriesid }) => {
      const raw: any = await client.get("/api/episodes", { seriesid: String(seriesid) });
      const data: any[] = Array.isArray(raw) ? raw : (raw.data ?? []);
      const seasons: Record<string, { episodes: { ep: number; hasSub: boolean; missing: string[] }[]; total: number; withSub: number; missingSub: number }> = {};
      for (const ep of data) {
        const key = `S${String(ep.season ?? 0).padStart(2, "0")}`;
        if (!seasons[key]) seasons[key] = { episodes: [], total: 0, withSub: 0, missingSub: 0 };
        const missing = Array.isArray(ep.missing_subtitles)
          ? ep.missing_subtitles.map((s: any) => typeof s === "object" ? s.name ?? s.code2 : s)
          : [];
        seasons[key].episodes.push({ ep: ep.episode, hasSub: missing.length === 0, missing });
        seasons[key].total++;
        if (missing.length === 0) seasons[key].withSub++;
        else seasons[key].missingSub++;
      }
      const totalEpisodes = data.length;
      const totalWithSub = Object.values(seasons).reduce((s, v) => s + v.withSub, 0);
      const totalMissingSub = Object.values(seasons).reduce((s, v) => s + v.missingSub, 0);
      return ok({ totalEpisodes, totalWithSub, totalMissingSub, seasons });
    },
  );

  server.tool(
    `${p}_get_movies`,
    `List all movies with subtitle status in ${p}`,
    {},
    async () => {
      const raw: any = await client.get("/api/movies");
      const data: any[] = Array.isArray(raw) ? raw : (raw.data ?? []);
      return ok({
        total: data.length,
        items: data.slice(0, 25).map((m: any) =>
          slim(m, ["radarrId", "title", "profileId", "audio_language", "monitored", "missing_subtitles"]),
        ),
      });
    },
  );

  server.tool(
    `${p}_get_movie_by_id`,
    `Get subtitle details for a specific movie in ${p}`,
    { radarrid: z.number().describe("Radarr movie ID") },
    async ({ radarrid }) => {
      const data: any = await client.get("/api/movies", { radarrid: String(radarrid) });
      // Keep more fields but remove large embedded arrays
      if (data && typeof data === "object") {
        const { subtitles, ...rest } = Array.isArray(data) ? (data[0] ?? {}) : data;
        return ok(rest);
      }
      return ok(data);
    },
  );

  server.tool(
    `${p}_get_wanted_episodes`,
    `Get episodes with missing subtitles in ${p}`,
    {},
    async () => {
      const raw: any = await client.get("/api/episodes/wanted");
      const data: any[] = Array.isArray(raw) ? raw : (raw.data ?? []);
      return ok({
        total: data.length,
        items: data.slice(0, 25).map((ep: any) =>
          slim(ep, ["sonarrSeriesId", "sonarrEpisodeId", "title", "season", "episode", "missing_subtitles"]),
        ),
      });
    },
  );

  server.tool(
    `${p}_get_wanted_movies`,
    `Get movies with missing subtitles in ${p}`,
    {},
    async () => {
      const raw: any = await client.get("/api/movies/wanted");
      const data: any[] = Array.isArray(raw) ? raw : (raw.data ?? []);
      return ok({
        total: data.length,
        items: data.slice(0, 25).map((m: any) =>
          slim(m, ["radarrId", "title", "missing_subtitles"]),
        ),
      });
    },
  );

  server.tool(
    `${p}_search_episode_subtitles`,
    `Search and download subtitles for an episode in ${p}`,
    {
      sonarrEpisodeId: z.number().describe("Sonarr episode ID"),
      language: z.string().describe("Language code (e.g. 'pt', 'en', 'ja')"),
      forced: z.boolean().optional().default(false).describe("Search for forced subtitles only"),
      hi: z.boolean().optional().default(false).describe("Search for hearing impaired subtitles"),
    },
    async ({ sonarrEpisodeId, language, forced, hi }) => {
      const data = await client.post("/api/episodes/subtitles", {
        sonarrEpisodeId,
        language,
        forced,
        hi,
      });
      return ok(data);
    },
  );

  server.tool(
    `${p}_search_movie_subtitles`,
    `Search and download subtitles for a movie in ${p}`,
    {
      radarrId: z.number().describe("Radarr movie ID"),
      language: z.string().describe("Language code (e.g. 'pt', 'en', 'ja')"),
      forced: z.boolean().optional().default(false).describe("Search for forced subtitles only"),
      hi: z.boolean().optional().default(false).describe("Search for hearing impaired subtitles"),
    },
    async ({ radarrId, language, forced, hi }) => {
      const data = await client.post("/api/movies/subtitles", {
        radarrId,
        language,
        forced,
        hi,
      });
      return ok(data);
    },
  );

  server.tool(
    `${p}_delete_episode_subtitles`,
    `Delete subtitles for an episode in ${p}`,
    {
      sonarrEpisodeId: z.number().describe("Sonarr episode ID"),
      language: z.string().describe("Language code"),
      path: z.string().describe("Subtitle file path"),
    },
    async ({ sonarrEpisodeId, language, path: subPath }) => {
      await client.delete("/api/episodes/subtitles", {
        sonarrEpisodeId,
        language,
        path: subPath,
      });
      return { content: [{ type: "text" as const, text: `Subtitle deleted for episode ${sonarrEpisodeId}.` }] };
    },
  );

  server.tool(
    `${p}_delete_movie_subtitles`,
    `Delete subtitles for a movie in ${p}`,
    {
      radarrId: z.number().describe("Radarr movie ID"),
      language: z.string().describe("Language code"),
      path: z.string().describe("Subtitle file path"),
    },
    async ({ radarrId, language, path: subPath }) => {
      await client.delete("/api/movies/subtitles", {
        radarrId,
        language,
        path: subPath,
      });
      return { content: [{ type: "text" as const, text: `Subtitle deleted for movie ${radarrId}.` }] };
    },
  );

  server.tool(
    `${p}_get_episode_history`,
    `Get subtitle download history for episodes in ${p}`,
    {},
    async () => {
      const raw: any = await client.get("/api/episodes/history");
      const data: any[] = Array.isArray(raw) ? raw : (raw.data ?? []);
      return ok(data.map((h: any) => slim(h, ["id", "action", "language", "provider", "timestamp", "score"])));
    },
  );

  server.tool(
    `${p}_get_movie_history`,
    `Get subtitle download history for movies in ${p}`,
    {},
    async () => {
      const raw: any = await client.get("/api/movies/history");
      const data: any[] = Array.isArray(raw) ? raw : (raw.data ?? []);
      return ok(data.map((h: any) => slim(h, ["id", "action", "language", "provider", "timestamp", "score"])));
    },
  );

  server.tool(
    `${p}_get_providers`,
    `List configured subtitle providers in ${p}`,
    {},
    async () => {
      const raw: any = await client.get("/api/providers");
      const data: any[] = Array.isArray(raw) ? raw : (raw.data ?? []);
      return ok(data.map((p: any) => slim(p, ["name", "status"])));
    },
  );

  server.tool(
    `${p}_get_languages`,
    `List available subtitle languages in ${p}`,
    {},
    async () => ok(await client.get("/api/system/languages")),
  );

  server.tool(
    `${p}_get_system_status`,
    `Get ${p} system status`,
    {},
    async () => ok(await client.get("/api/system/status")),
  );

  server.tool(
    `${p}_get_tasks`,
    `List scheduled tasks in ${p}`,
    {},
    async () => ok(await client.get("/api/system/tasks")),
  );

  server.tool(
    `${p}_run_task`,
    `Run a scheduled task in ${p}`,
    { taskName: z.string().describe("Task name to run") },
    async ({ taskName }) => {
      const data = await client.post("/api/system/tasks", { taskName });
      return ok(data);
    },
  );
}
