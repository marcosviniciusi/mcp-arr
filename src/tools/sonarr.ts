import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArrClient } from "../clients/arr-client.js";

export function registerSonarrTools(server: McpServer, client: ArrClient, prefix = "sonarr") {
  const p = prefix;

  const ok = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  });

  // ─── READ ───────────────────────────────────────────────────────────

  server.tool(
    `${p}_get_series`,
    `List all series in ${p} library`,
    {},
    async () => ok(await client.get("/api/v3/series")),
  );

  server.tool(
    `${p}_get_series_by_id`,
    `Get details for a specific series in ${p}`,
    { seriesId: z.number().describe("Series ID") },
    async ({ seriesId }) => ok(await client.get(`/api/v3/series/${seriesId}`)),
  );

  server.tool(
    `${p}_get_episodes`,
    `Get episodes for a series in ${p}`,
    { seriesId: z.number().describe("Series ID") },
    async ({ seriesId }) =>
      ok(await client.get("/api/v3/episode", { seriesId: String(seriesId) })),
  );

  server.tool(
    `${p}_get_episode_by_id`,
    `Get details for a specific episode in ${p}`,
    { episodeId: z.number().describe("Episode ID") },
    async ({ episodeId }) => ok(await client.get(`/api/v3/episode/${episodeId}`)),
  );

  server.tool(
    `${p}_get_episode_files`,
    `Get episode files for a series in ${p}`,
    { seriesId: z.number().describe("Series ID") },
    async ({ seriesId }) =>
      ok(await client.get("/api/v3/episodefile", { seriesId: String(seriesId) })),
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
      return ok(await client.get("/api/v3/calendar", params));
    },
  );

  server.tool(
    `${p}_get_queue`,
    `Get current download queue in ${p}`,
    {},
    async () => ok(await client.get("/api/v3/queue")),
  );

  server.tool(
    `${p}_get_queue_details`,
    `Get download queue with pagination in ${p}`,
    {
      page: z.number().optional().default(1).describe("Page number"),
      pageSize: z.number().optional().default(20).describe("Page size"),
      includeUnknownSeriesItems: z.boolean().optional().default(false).describe("Include unknown series items"),
      includeSeries: z.boolean().optional().default(false).describe("Include series object"),
      includeEpisode: z.boolean().optional().default(false).describe("Include episode object"),
    },
    async ({ page, pageSize, includeUnknownSeriesItems, includeSeries, includeEpisode }) => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
        includeUnknownSeriesItems: String(includeUnknownSeriesItems),
        includeSeries: String(includeSeries),
        includeEpisode: String(includeEpisode),
      };
      return ok(await client.get("/api/v3/queue", params));
    },
  );

  server.tool(
    `${p}_get_quality_profiles`,
    `List available quality profiles in ${p}`,
    {},
    async () => ok(await client.get("/api/v3/qualityprofile")),
  );

  server.tool(
    `${p}_get_root_folders`,
    `List configured root folders in ${p}`,
    {},
    async () => ok(await client.get("/api/v3/rootfolder")),
  );

  server.tool(
    `${p}_get_system_status`,
    `Get ${p} system status`,
    {},
    async () => ok(await client.get("/api/v3/system/status")),
  );

  server.tool(
    `${p}_get_tags`,
    `List all tags in ${p}`,
    {},
    async () => ok(await client.get("/api/v3/tag")),
  );

  server.tool(
    `${p}_get_history`,
    `Get history with pagination in ${p}`,
    {
      page: z.number().optional().default(1).describe("Page number"),
      pageSize: z.number().optional().default(20).describe("Page size"),
      sortKey: z.string().optional().default("date").describe("Sort key (e.g. date)"),
      sortDirection: z.enum(["ascending", "descending"]).optional().default("descending").describe("Sort direction"),
      episodeId: z.number().optional().describe("Filter by episode ID"),
    },
    async ({ page, pageSize, sortKey, sortDirection, episodeId }) => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
        sortKey,
        sortDirection,
      };
      if (episodeId !== undefined) params.episodeId = String(episodeId);
      return ok(await client.get("/api/v3/history", params));
    },
  );

  server.tool(
    `${p}_get_blocklist`,
    `Get blocklist in ${p}`,
    {
      page: z.number().optional().default(1).describe("Page number"),
      pageSize: z.number().optional().default(20).describe("Page size"),
    },
    async ({ page, pageSize }) =>
      ok(
        await client.get("/api/v3/blocklist", {
          page: String(page),
          pageSize: String(pageSize),
        }),
      ),
  );

  server.tool(
    `${p}_get_wanted_missing`,
    `Get wanted/missing episodes in ${p}`,
    {
      page: z.number().optional().default(1).describe("Page number"),
      pageSize: z.number().optional().default(20).describe("Page size"),
      sortKey: z.string().optional().default("airDateUtc").describe("Sort key"),
      sortDirection: z.enum(["ascending", "descending"]).optional().default("descending").describe("Sort direction"),
      monitored: z.boolean().optional().describe("Filter by monitored status"),
    },
    async ({ page, pageSize, sortKey, sortDirection, monitored }) => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
        sortKey,
        sortDirection,
      };
      if (monitored !== undefined) params.monitored = String(monitored);
      return ok(await client.get("/api/v3/wanted/missing", params));
    },
  );

  server.tool(
    `${p}_get_disk_space`,
    `Get disk space info from ${p}`,
    {},
    async () => ok(await client.get("/api/v3/diskspace")),
  );

  server.tool(
    `${p}_get_health`,
    `Get system health checks from ${p}`,
    {},
    async () => ok(await client.get("/api/v3/health")),
  );

  server.tool(
    `${p}_get_backup_list`,
    `List available backups in ${p}`,
    {},
    async () => ok(await client.get("/api/v3/system/backup")),
  );

  server.tool(
    `${p}_get_language_profiles`,
    `List language profiles in ${p}`,
    {},
    async () => ok(await client.get("/api/v3/languageprofile")),
  );

  server.tool(
    `${p}_get_commands`,
    `List running/queued commands in ${p}`,
    {},
    async () => ok(await client.get("/api/v3/command")),
  );

  server.tool(
    `${p}_get_rename_list`,
    `Preview file rename for a series in ${p}`,
    { seriesId: z.number().describe("Series ID") },
    async ({ seriesId }) =>
      ok(await client.get("/api/v3/rename", { seriesId: String(seriesId) })),
  );

  server.tool(
    `${p}_get_logs`,
    `Get log entries from ${p}`,
    {
      page: z.number().optional().default(1).describe("Page number"),
      pageSize: z.number().optional().default(25).describe("Page size"),
      sortKey: z.string().optional().default("time").describe("Sort key"),
      sortDirection: z.enum(["ascending", "descending"]).optional().default("descending").describe("Sort direction"),
      level: z.enum(["info", "debug", "warn", "error", "trace"]).optional().describe("Minimum log level"),
    },
    async ({ page, pageSize, sortKey, sortDirection, level }) => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
        sortKey,
        sortDirection,
      };
      if (level) params.level = level;
      return ok(await client.get("/api/v3/log", params));
    },
  );

  // ─── SEARCH ─────────────────────────────────────────────────────────

  server.tool(
    `${p}_search_series`,
    `Search for a series to add to ${p}`,
    { term: z.string().describe("Search term (series name)") },
    async ({ term }) =>
      ok(await client.get("/api/v3/series/lookup", { term })),
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
    `Add a new series to ${p}`,
    {
      tvdbId: z.number().describe("TVDB ID of the series"),
      title: z.string().describe("Series title"),
      qualityProfileId: z.number().describe("Quality profile ID"),
      rootFolderPath: z.string().describe("Root folder path (e.g. /tv)"),
      languageProfileId: z.number().optional().describe("Language profile ID"),
      monitored: z.boolean().optional().default(true).describe("Monitor the series"),
      seasonFolder: z.boolean().optional().default(true).describe("Use season folders"),
      seriesType: z.enum(["standard", "daily", "anime"]).optional().default("standard").describe("Series type"),
      tags: z.array(z.number()).optional().default([]).describe("Tag IDs to apply"),
      searchForMissingEpisodes: z.boolean().optional().default(true).describe("Search for missing episodes on add"),
      searchForCutoffUnmetEpisodes: z.boolean().optional().default(false).describe("Search for cutoff unmet episodes on add"),
    },
    async ({ tvdbId, title, qualityProfileId, rootFolderPath, languageProfileId, monitored, seasonFolder, seriesType, tags, searchForMissingEpisodes, searchForCutoffUnmetEpisodes }) => {
      const body: Record<string, unknown> = {
        tvdbId,
        title,
        qualityProfileId,
        rootFolderPath,
        monitored,
        seasonFolder,
        seriesType,
        tags,
        addOptions: { searchForMissingEpisodes, searchForCutoffUnmetEpisodes },
      };
      if (languageProfileId !== undefined) body.languageProfileId = languageProfileId;
      return ok(await client.post("/api/v3/series", body));
    },
  );

  server.tool(
    `${p}_delete_series`,
    `Delete a series from ${p}`,
    {
      seriesId: z.number().describe("Series ID to delete"),
      deleteFiles: z.boolean().optional().default(false).describe("Also delete files on disk"),
      addImportListExclusion: z.boolean().optional().default(false).describe("Add import list exclusion"),
    },
    async ({ seriesId, deleteFiles, addImportListExclusion }) => {
      const params: string[] = [];
      if (deleteFiles) params.push("deleteFiles=true");
      if (addImportListExclusion) params.push("addImportListExclusion=true");
      const qs = params.length ? `?${params.join("&")}` : "";
      await client.delete(`/api/v3/series/${seriesId}${qs}`);
      return ok({ message: `Series ${seriesId} deleted.` });
    },
  );

  server.tool(
    `${p}_update_series`,
    `Update/edit a series in ${p} (full PUT)`,
    {
      body: z
        .record(z.string(), z.unknown())
        .describe("Full series object with changes (must include id). Obtain via get_series_by_id, modify fields, and pass back."),
    },
    async ({ body }) => ok(await client.put(`/api/v3/series/${body.id}`, body)),
  );

  server.tool(
    `${p}_update_episode`,
    `Update an episode in ${p} (e.g. monitor/unmonitor)`,
    {
      body: z
        .record(z.string(), z.unknown())
        .describe("Full episode object with changes (must include id). Obtain via get_episode_by_id, modify fields, and pass back."),
    },
    async ({ body }) => ok(await client.put(`/api/v3/episode/${body.id}`, body)),
  );

  server.tool(
    `${p}_delete_episode_file`,
    `Delete a specific episode file in ${p}`,
    { episodeFileId: z.number().describe("Episode file ID to delete") },
    async ({ episodeFileId }) => {
      await client.delete(`/api/v3/episodefile/${episodeFileId}`);
      return ok({ message: `Episode file ${episodeFileId} deleted.` });
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

  server.tool(
    `${p}_refresh_series`,
    `Refresh series metadata in ${p}`,
    { seriesId: z.number().optional().describe("Series ID (omit to refresh all)") },
    async ({ seriesId }) => {
      const body: Record<string, unknown> = { name: "RefreshSeries" };
      if (seriesId !== undefined) body.seriesId = seriesId;
      return ok(await client.post("/api/v3/command", body));
    },
  );

  server.tool(
    `${p}_rescan_series`,
    `Rescan series files on disk in ${p}`,
    { seriesId: z.number().optional().describe("Series ID (omit to rescan all)") },
    async ({ seriesId }) => {
      const body: Record<string, unknown> = { name: "RescanSeries" };
      if (seriesId !== undefined) body.seriesId = seriesId;
      return ok(await client.post("/api/v3/command", body));
    },
  );

  server.tool(
    `${p}_rename_series`,
    `Rename files for a series in ${p}`,
    { seriesId: z.number().describe("Series ID to rename files for") },
    async ({ seriesId }) =>
      ok(
        await client.post("/api/v3/command", {
          name: "RenameSeries",
          seriesIds: [seriesId],
        }),
      ),
  );

  server.tool(
    `${p}_add_tag`,
    `Create a new tag in ${p}`,
    { label: z.string().describe("Tag label") },
    async ({ label }) => ok(await client.post("/api/v3/tag", { label })),
  );

  server.tool(
    `${p}_delete_queue_item`,
    `Remove an item from the download queue in ${p}`,
    {
      queueId: z.number().describe("Queue item ID to remove"),
      removeFromClient: z.boolean().optional().default(true).describe("Remove from download client"),
      blocklist: z.boolean().optional().default(false).describe("Add release to blocklist"),
    },
    async ({ queueId, removeFromClient, blocklist }) => {
      const qs = `?removeFromClient=${removeFromClient}&blocklist=${blocklist}`;
      await client.delete(`/api/v3/queue/${queueId}${qs}`);
      return ok({ message: `Queue item ${queueId} removed.` });
    },
  );

  server.tool(
    `${p}_clear_blocklist`,
    `Remove an entry from the blocklist in ${p}`,
    { blocklistId: z.number().describe("Blocklist entry ID to remove") },
    async ({ blocklistId }) => {
      await client.delete(`/api/v3/blocklist/${blocklistId}`);
      return ok({ message: `Blocklist entry ${blocklistId} removed.` });
    },
  );

  server.tool(
    `${p}_create_backup`,
    `Create a backup of ${p}`,
    {},
    async () => ok(await client.post("/api/v3/command", { name: "Backup" })),
  );

  server.tool(
    `${p}_restart_app`,
    `Restart ${p} application`,
    {},
    async () => ok(await client.post("/api/v3/system/restart")),
  );
}
