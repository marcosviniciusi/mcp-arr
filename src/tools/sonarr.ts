import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArrClient } from "../clients/arr-client.js";

export function registerSonarrTools(server: McpServer, client: ArrClient) {
  server.tool(
    "sonarr_get_series",
    "List all series in Sonarr library",
    {},
    async () => {
      const data = await client.get("/api/v3/series");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "sonarr_get_series_by_id",
    "Get details for a specific series",
    { seriesId: z.number().describe("Series ID") },
    async ({ seriesId }) => {
      const data = await client.get(`/api/v3/series/${seriesId}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "sonarr_search_series",
    "Search for a series to add to Sonarr",
    { term: z.string().describe("Search term (series name)") },
    async ({ term }) => {
      const data = await client.get("/api/v3/series/lookup", { term });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "sonarr_add_series",
    "Add a new series to Sonarr",
    {
      tvdbId: z.number().describe("TVDB ID of the series"),
      title: z.string().describe("Series title"),
      qualityProfileId: z.number().describe("Quality profile ID"),
      rootFolderPath: z.string().describe("Root folder path (e.g. /tv)"),
      monitored: z.boolean().optional().default(true).describe("Monitor the series"),
      seasonFolder: z.boolean().optional().default(true).describe("Use season folders"),
      searchForMissingEpisodes: z.boolean().optional().default(true).describe("Search for missing episodes on add"),
    },
    async ({ tvdbId, title, qualityProfileId, rootFolderPath, monitored, seasonFolder, searchForMissingEpisodes }) => {
      const body = {
        tvdbId,
        title,
        qualityProfileId,
        rootFolderPath,
        monitored,
        seasonFolder,
        addOptions: { searchForMissingEpisodes },
      };
      const data = await client.post("/api/v3/series", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "sonarr_delete_series",
    "Delete a series from Sonarr",
    {
      seriesId: z.number().describe("Series ID to delete"),
      deleteFiles: z.boolean().optional().default(false).describe("Also delete files on disk"),
    },
    async ({ seriesId, deleteFiles }) => {
      const path = deleteFiles ? `/api/v3/series/${seriesId}?deleteFiles=true` : `/api/v3/series/${seriesId}`;
      await client.delete(path);
      return { content: [{ type: "text", text: `Series ${seriesId} deleted.` }] };
    },
  );

  server.tool(
    "sonarr_get_episodes",
    "Get episodes for a series",
    { seriesId: z.number().describe("Series ID") },
    async ({ seriesId }) => {
      const data = await client.get("/api/v3/episode", { seriesId: String(seriesId) });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "sonarr_search_episodes",
    "Trigger a search for specific episodes",
    { episodeIds: z.array(z.number()).describe("List of episode IDs to search for") },
    async ({ episodeIds }) => {
      const data = await client.post("/api/v3/command", {
        name: "EpisodeSearch",
        episodeIds,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "sonarr_get_calendar",
    "Get upcoming episodes from Sonarr calendar",
    {
      start: z.string().optional().describe("Start date (ISO 8601)"),
      end: z.string().optional().describe("End date (ISO 8601)"),
    },
    async ({ start, end }) => {
      const params: Record<string, string> = {};
      if (start) params.start = start;
      if (end) params.end = end;
      const data = await client.get("/api/v3/calendar", params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "sonarr_get_queue",
    "Get current download queue in Sonarr",
    {},
    async () => {
      const data = await client.get("/api/v3/queue");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "sonarr_get_quality_profiles",
    "List available quality profiles",
    {},
    async () => {
      const data = await client.get("/api/v3/qualityprofile");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "sonarr_get_root_folders",
    "List configured root folders",
    {},
    async () => {
      const data = await client.get("/api/v3/rootfolder");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "sonarr_get_system_status",
    "Get Sonarr system status",
    {},
    async () => {
      const data = await client.get("/api/v3/system/status");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
