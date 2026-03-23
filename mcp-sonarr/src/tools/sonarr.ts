import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArrClient } from "../clients/arr-client.js";

export interface SonarrDefaults {
  qualityProfileId?: number;
  rootFolderPath?: string;
}

export function registerSonarrTools(server: McpServer, client: ArrClient, prefix = "sonarr", defaults?: SonarrDefaults) {
  const p = prefix;
  const isAnime = p.includes("anime");
  const label = isAnime ? `${p} (ANIME ONLY — use this for anime series, not regular TV shows)` : `${p} (regular TV series — NOT anime, use sonarr_animes for anime)`;
  const defQuality = defaults?.qualityProfileId;
  const defRoot = defaults?.rootFolderPath;

  const ok = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  });

  const slim = (obj: any, keys: string[]) => keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

  // ─── READ ───────────────────────────────────────────────────────────

  server.tool(
    `${p}_get_series`,
    `List series in ${label} (top 25). Use search_series to find a specific one by name.`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v3/series");
      const items = data.slice(0, 25).map((s: any) => slim(s, ["id", "title", "year", "tvdbId", "imdbId", "status", "network", "seriesType", "monitored", "seasonCount", "episodeCount", "episodeFileCount"]));
      return ok({ total: data.length, items });
    },
  );

  server.tool(
    `${p}_get_library_stats`,
    `Get library statistics for ${p}: total series, episodes downloaded, and missing counts`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v3/series");
      const totalSeries = data.length;
      let totalEpisodes = 0, downloadedEpisodes = 0, missingEpisodes = 0;
      for (const s of data) {
        const st = s.statistics;
        if (!st) continue;
        totalEpisodes += st.episodeCount ?? 0;
        downloadedEpisodes += st.episodeFileCount ?? 0;
        missingEpisodes += (st.episodeCount ?? 0) - (st.episodeFileCount ?? 0);
      }
      return ok({ totalSeries, totalEpisodes, downloadedEpisodes, missingEpisodes });
    },
  );

  server.tool(
    `${p}_get_series_by_id`,
    `Get details for a specific series in ${p}`,
    { seriesId: z.number().describe("Series ID") },
    async ({ seriesId }) => {
      const data = await client.get(`/api/v3/series/${seriesId}`);
      return ok(slim(data, ["id", "title", "year", "tvdbId", "imdbId", "status", "network", "seriesType", "monitored", "overview", "seasonCount", "statistics", "path"]));
    },
  );

  server.tool(
    `${p}_get_episodes`,
    `Get episodes grouped by season for a series in ${p}. Shows episode number and download status.`,
    { seriesId: z.number().describe("Series ID") },
    async ({ seriesId }) => {
      const data: any[] = await client.get("/api/v3/episode", { seriesId: String(seriesId) });
      const seasons: Record<string, { episodes: { ep: number; hasFile: boolean; monitored: boolean }[]; total: number; downloaded: number; missing: number }> = {};
      for (const ep of data) {
        const key = `S${String(ep.seasonNumber ?? 0).padStart(2, "0")}`;
        if (!seasons[key]) seasons[key] = { episodes: [], total: 0, downloaded: 0, missing: 0 };
        seasons[key].episodes.push({ ep: ep.episodeNumber, hasFile: !!ep.hasFile, monitored: !!ep.monitored });
        seasons[key].total++;
        if (ep.hasFile) seasons[key].downloaded++;
        if (ep.monitored && !ep.hasFile && ep.airDateUtc && new Date(ep.airDateUtc) < new Date()) seasons[key].missing++;
      }
      const totalEpisodes = data.length;
      const totalDownloaded = data.filter((e: any) => e.hasFile).length;
      const totalMissing = data.filter((e: any) => e.monitored && !e.hasFile && e.airDateUtc && new Date(e.airDateUtc) < new Date()).length;
      return ok({ totalEpisodes, totalDownloaded, totalMissing, seasons });
    },
  );

  server.tool(
    `${p}_get_episode_by_id`,
    `Get details for a specific episode in ${p}`,
    { episodeId: z.number().describe("Episode ID") },
    async ({ episodeId }) => {
      const data = await client.get(`/api/v3/episode/${episodeId}`);
      return ok(slim(data, ["id", "episodeNumber", "seasonNumber", "title", "airDate", "monitored", "hasFile", "overview"]));
    },
  );

  server.tool(
    `${p}_get_episode_files`,
    `Get episode files for a series in ${p}`,
    { seriesId: z.number().describe("Series ID") },
    async ({ seriesId }) => {
      const data: any[] = await client.get("/api/v3/episodefile", { seriesId: String(seriesId) });
      const items = data.map((f: any) => slim(f, ["id", "seriesId", "seasonNumber", "relativePath", "size", "quality"]));
      return ok({ total: data.length, items });
    },
  );

  server.tool(
    `${p}_get_calendar`,
    `Get upcoming episodes from ${p} calendar`,
    {
      start: z.string().optional().describe("Start date (ISO 8601)"),
      end: z.string().optional().describe("End date (ISO 8601)"),
      unmonitored: z.boolean().optional().describe("Include unmonitored episodes"),
    },
    async ({ start, end, unmonitored }) => {
      const params: Record<string, string> = {};
      if (start) params.start = start;
      if (end) params.end = end;
      if (unmonitored !== undefined) params.unmonitored = String(unmonitored);
      const data: any[] = await client.get("/api/v3/calendar", params);
      const items = data.map((e: any) => {
        const item = slim(e, ["id", "seriesId", "episodeNumber", "seasonNumber", "title", "airDate", "airDateUtc", "hasFile"]);
        if (e.series) item.series = slim(e.series, ["id", "title"]);
        return item;
      });
      return ok(items);
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
    `${p}_get_language_profiles`,
    `List language profiles in ${p}`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v3/languageprofile");
      return ok(data.map((p: any) => slim(p, ["id", "name"])));
    },
  );

  // ─── SEARCH ─────────────────────────────────────────────────────────

  server.tool(
    `${p}_search_series`,
    `Search for a series to add to ${label}. Returns search results + qualityProfiles + rootFolders so you can call add_series directly without extra lookups.`,
    { term: z.string().describe("Search term (series name)") },
    async ({ term }) => {
      const [data, profiles, folders] = await Promise.all([
        client.get("/api/v3/series/lookup", { term }) as Promise<any[]>,
        client.get("/api/v3/qualityprofile") as Promise<any[]>,
        client.get("/api/v3/rootfolder") as Promise<any[]>,
      ]);
      const results = data.slice(0, 10).map((s: any) => slim(s, ["title", "year", "tvdbId", "imdbId", "status", "network", "seriesType"]));
      return ok({
        total: data.length,
        results,
        qualityProfiles: profiles.map((p: any) => ({ id: p.id, name: p.name })),
        rootFolders: folders.map((f: any) => ({ path: f.path, freeSpace: f.freeSpace })),
      });
    },
  );

  server.tool(
    `${p}_search_episodes`,
    `Trigger a search/download for specific episodes in ${p}`,
    { episodeIds: z.array(z.number()).describe("List of episode IDs to search for") },
    async ({ episodeIds }) =>
      ok(
        await client.post("/api/v3/command", {
          name: "EpisodeSearch",
          episodeIds,
        }),
      ),
  );

  server.tool(
    `${p}_search_series_download`,
    `Trigger a full series search/download in ${p}`,
    { seriesId: z.number().describe("Series ID to search for downloads") },
    async ({ seriesId }) =>
      ok(
        await client.post("/api/v3/command", {
          name: "SeriesSearch",
          seriesId,
        }),
      ),
  );

  // ─── MANAGE ─────────────────────────────────────────────────────────

  server.tool(
    `${p}_add_series`,
    `Add a new series to ${label}. Use tvdb_id from TMDB search/discover results directly — no need to call ${p}_search_series first. qualityProfileId and rootFolderPath have pre-configured defaults if omitted.`,
    {
      tvdbId: z.number().describe("TVDB ID of the series (use tvdb_id from TMDB results)"),
      title: z.string().describe("Series title"),
      qualityProfileId: defQuality ? z.number().optional().default(defQuality).describe(`Quality profile ID (default: ${defQuality})`) : z.number().optional().describe("Quality profile ID (auto-resolved if omitted)"),
      rootFolderPath: defRoot ? z.string().optional().default(defRoot).describe(`Root folder path (default: ${defRoot})`) : z.string().optional().describe("Root folder path (auto-resolved if omitted)"),
      languageProfileId: z.number().optional().describe("Language profile ID"),
      monitored: z.boolean().optional().default(true).describe("Monitor the series"),
      seasonFolder: z.boolean().optional().default(true).describe("Use season folders"),
      seriesType: z.enum(["standard", "daily", "anime"]).optional().default("standard").describe("Series type"),
      tags: z.array(z.number()).optional().default([]).describe("Tag IDs to apply"),
      searchForMissingEpisodes: z.boolean().optional().default(true).describe("Search for missing episodes on add"),
      searchForCutoffUnmetEpisodes: z.boolean().optional().default(false).describe("Search for cutoff unmet episodes on add"),
    },
    async ({ tvdbId, title, qualityProfileId, rootFolderPath, languageProfileId, monitored, seasonFolder, seriesType, tags, searchForMissingEpisodes, searchForCutoffUnmetEpisodes }) => {
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

      const body: Record<string, unknown> = {
        tvdbId,
        title,
        qualityProfileId: resolvedQuality,
        rootFolderPath: resolvedRoot,
        monitored,
        seasonFolder,
        seriesType,
        tags,
        addOptions: { searchForMissingEpisodes, searchForCutoffUnmetEpisodes },
      };
      if (languageProfileId !== undefined) body.languageProfileId = languageProfileId;
      const result: any = await client.post("/api/v3/series", body);
      return ok(slim(result, ["id", "title", "year", "tvdbId", "imdbId", "status", "monitored", "seriesType", "path", "seasonCount", "added"]));
    },
  );

  server.tool(
    `${p}_monitor_episodes`,
    `Monitor or unmonitor episodes in ${p}`,
    {
      episodeIds: z.array(z.number()).describe("List of episode IDs"),
      monitored: z.boolean().describe("Whether to monitor (true) or unmonitor (false)"),
    },
    async ({ episodeIds, monitored }) =>
      ok(
        await client.put("/api/v3/episode/monitor", {
          episodeIds,
          monitored,
        }),
      ),
  );
}
