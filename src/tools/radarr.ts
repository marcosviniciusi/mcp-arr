import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArrClient } from "../clients/arr-client.js";

export function registerRadarrTools(server: McpServer, client: ArrClient, prefix = "radarr") {
  const p = prefix;

  const ok = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  });

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  server.tool(
    `${p}_get_movies`,
    `List all movies in ${p} library`,
    {},
    async () => ok(await client.get("/api/v3/movie")),
  );

  server.tool(
    `${p}_get_movie_by_id`,
    `Get details for a specific movie in ${p}`,
    { movieId: z.number().describe("Movie ID") },
    async ({ movieId }) => ok(await client.get(`/api/v3/movie/${movieId}`)),
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
      sortKey: z.string().optional().default("timeleft").describe("Sort key"),
      sortDirection: z.enum(["ascending", "descending"]).optional().default("ascending").describe("Sort direction"),
      includeUnknownMovieItems: z.boolean().optional().default(false).describe("Include unknown movie items"),
    },
    async ({ page, pageSize, sortKey, sortDirection, includeUnknownMovieItems }) => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
        sortKey,
        sortDirection,
        includeUnknownMovieItems: String(includeUnknownMovieItems),
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
      return ok(await client.get("/api/v3/history", params));
    },
  );

  server.tool(
    `${p}_get_blocklist`,
    `Get blocklist in ${p}`,
    {},
    async () => ok(await client.get("/api/v3/blocklist")),
  );

  server.tool(
    `${p}_get_wanted_missing`,
    `Get wanted/cutoff unmet movies in ${p}`,
    {
      page: z.number().optional().default(1).describe("Page number"),
      pageSize: z.number().optional().default(20).describe("Page size"),
      sortKey: z.string().optional().default("title").describe("Sort key"),
      sortDirection: z.enum(["ascending", "descending"]).optional().default("ascending").describe("Sort direction"),
      monitored: z.boolean().optional().default(true).describe("Filter by monitored status"),
    },
    async ({ page, pageSize, sortKey, sortDirection, monitored }) => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
        sortKey,
        sortDirection,
        monitored: String(monitored),
      };
      return ok(await client.get("/api/v3/wanted/missing", params));
    },
  );

  server.tool(
    `${p}_get_disk_space`,
    `Get disk space information in ${p}`,
    {},
    async () => ok(await client.get("/api/v3/diskspace")),
  );

  server.tool(
    `${p}_get_health`,
    `Get system health checks in ${p}`,
    {},
    async () => ok(await client.get("/api/v3/health")),
  );

  server.tool(
    `${p}_get_backup_list`,
    `List backups in ${p}`,
    {},
    async () => ok(await client.get("/api/v3/system/backup")),
  );

  server.tool(
    `${p}_get_commands`,
    `List running/queued commands in ${p}`,
    {},
    async () => ok(await client.get("/api/v3/command")),
  );

  server.tool(
    `${p}_get_rename_list`,
    `Preview rename for a movie in ${p}`,
    { movieId: z.number().describe("Movie ID to preview rename for") },
    async ({ movieId }) =>
      ok(await client.get("/api/v3/rename", { movieId: String(movieId) })),
  );

  server.tool(
    `${p}_get_logs`,
    `Get log entries in ${p}`,
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

  server.tool(
    `${p}_get_credits`,
    `Get credits/cast for a movie in ${p}`,
    { movieId: z.number().describe("Movie ID") },
    async ({ movieId }) =>
      ok(await client.get("/api/v3/credit", { movieId: String(movieId) })),
  );

  server.tool(
    `${p}_get_extra_files`,
    `Get extra files for a movie in ${p}`,
    { movieId: z.number().describe("Movie ID") },
    async ({ movieId }) =>
      ok(await client.get("/api/v3/extrafile", { movieId: String(movieId) })),
  );

  server.tool(
    `${p}_get_import_lists`,
    `List import lists in ${p}`,
    {},
    async () => ok(await client.get("/api/v3/importlist")),
  );

  server.tool(
    `${p}_get_exclusions`,
    `List excluded movies in ${p}`,
    {},
    async () => ok(await client.get("/api/v3/exclusions")),
  );

  // ---------------------------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------------------------

  server.tool(
    `${p}_search_movies`,
    `Search for a movie to add to ${p} (lookup)`,
    { term: z.string().describe("Search term (movie name)") },
    async ({ term }) => ok(await client.get("/api/v3/movie/lookup", { term })),
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
    `Add a new movie to ${p}`,
    {
      tmdbId: z.number().describe("TMDB ID of the movie"),
      title: z.string().describe("Movie title"),
      qualityProfileId: z.number().describe("Quality profile ID"),
      rootFolderPath: z.string().describe("Root folder path (e.g. /movies)"),
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
      const body = {
        tmdbId,
        title,
        qualityProfileId,
        rootFolderPath,
        monitored,
        minimumAvailability,
        tags,
        addOptions: { searchForMovie },
      };
      return ok(await client.post("/api/v3/movie", body));
    },
  );

  server.tool(
    `${p}_delete_movie`,
    `Delete a movie from ${p}`,
    {
      movieId: z.number().describe("Movie ID to delete"),
      deleteFiles: z.boolean().optional().default(false).describe("Also delete files on disk"),
      addImportExclusion: z.boolean().optional().default(false).describe("Add import exclusion to prevent re-adding"),
    },
    async ({ movieId, deleteFiles, addImportExclusion }) => {
      const params: string[] = [];
      if (deleteFiles) params.push("deleteFiles=true");
      if (addImportExclusion) params.push("addImportExclusion=true");
      const qs = params.length > 0 ? `?${params.join("&")}` : "";
      await client.delete(`/api/v3/movie/${movieId}${qs}`);
      return ok({ message: `Movie ${movieId} deleted.` });
    },
  );

  server.tool(
    `${p}_update_movie`,
    `Edit/update a movie in ${p} (full PUT). Pass the complete movie object.`,
    {
      body: z.record(z.string(), z.unknown()).describe("Full movie object to PUT (must include id)"),
      moveFiles: z.boolean().optional().default(false).describe("Move files if path changed"),
    },
    async ({ body, moveFiles }) => {
      const params: Record<string, string> = {};
      if (moveFiles) params.moveFiles = "true";
      return ok(await client.put("/api/v3/movie", body));
    },
  );

  server.tool(
    `${p}_delete_movie_file`,
    `Delete a specific movie file in ${p}`,
    { movieFileId: z.number().describe("Movie file ID to delete") },
    async ({ movieFileId }) => {
      await client.delete(`/api/v3/moviefile/${movieFileId}`);
      return ok({ message: `Movie file ${movieFileId} deleted.` });
    },
  );

  server.tool(
    `${p}_refresh_movie`,
    `Refresh movie metadata in ${p}`,
    { movieIds: z.array(z.number()).optional().describe("Movie IDs to refresh (omit for all)") },
    async ({ movieIds }) => {
      const body: Record<string, unknown> = { name: "RefreshMovie" };
      if (movieIds && movieIds.length > 0) body.movieIds = movieIds;
      return ok(await client.post("/api/v3/command", body));
    },
  );

  server.tool(
    `${p}_rescan_movie`,
    `Rescan movie files on disk in ${p}`,
    { movieId: z.number().optional().describe("Movie ID to rescan (omit for all)") },
    async ({ movieId }) => {
      const body: Record<string, unknown> = { name: "RescanMovie" };
      if (movieId !== undefined) body.movieId = movieId;
      return ok(await client.post("/api/v3/command", body));
    },
  );

  server.tool(
    `${p}_rename_movie`,
    `Rename movie files on disk in ${p}`,
    { movieIds: z.array(z.number()).describe("Movie IDs to rename") },
    async ({ movieIds }) =>
      ok(await client.post("/api/v3/command", { name: "RenameMovie", movieIds })),
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
      queueId: z.number().describe("Queue item ID"),
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
    `Remove a blocklist entry in ${p}`,
    { blocklistId: z.number().describe("Blocklist entry ID to remove") },
    async ({ blocklistId }) => {
      await client.delete(`/api/v3/blocklist/${blocklistId}`);
      return ok({ message: `Blocklist entry ${blocklistId} removed.` });
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

  server.tool(
    `${p}_delete_exclusion`,
    `Remove a movie from the exclusion list in ${p}`,
    { exclusionId: z.number().describe("Exclusion ID to remove") },
    async ({ exclusionId }) => {
      await client.delete(`/api/v3/exclusions/${exclusionId}`);
      return ok({ message: `Exclusion ${exclusionId} removed.` });
    },
  );

  server.tool(
    `${p}_create_backup`,
    `Create a backup in ${p}`,
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
