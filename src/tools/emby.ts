import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { EmbyClient } from "../clients/emby-client.js";

export function registerEmbyTools(server: McpServer, client: EmbyClient) {
  server.tool(
    "emby_get_system_info",
    "Get Emby server system info",
    {},
    async () => {
      const data = await client.get("/System/Info");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "emby_get_libraries",
    "List all Emby media libraries",
    {},
    async () => {
      const data = await client.get("/Library/VirtualFolders");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "emby_search",
    "Search for media in Emby",
    {
      query: z.string().describe("Search term"),
      mediaTypes: z
        .string()
        .optional()
        .describe("Media types to filter (e.g. Movie, Series, Episode, Audio)"),
      limit: z.number().optional().default(20).describe("Max results"),
    },
    async ({ query, mediaTypes, limit }) => {
      const params: Record<string, string> = {
        SearchTerm: query,
        Limit: String(limit),
        Recursive: "true",
      };
      if (mediaTypes) params.IncludeItemTypes = mediaTypes;
      const data = await client.get("/Items", params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "emby_get_item",
    "Get details of a specific Emby item",
    { itemId: z.string().describe("Item ID") },
    async ({ itemId }) => {
      const data = await client.get(`/Items/${itemId}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "emby_get_latest_media",
    "Get latest added media in Emby",
    {
      parentId: z.string().optional().describe("Library ID to filter"),
      limit: z.number().optional().default(20).describe("Max results"),
    },
    async ({ parentId, limit }) => {
      const params: Record<string, string> = {
        Limit: String(limit),
        SortBy: "DateCreated",
        SortOrder: "Descending",
        Recursive: "true",
      };
      if (parentId) params.ParentId = parentId;
      const data = await client.get("/Items/Latest", params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "emby_get_movies",
    "List movies in Emby",
    {
      parentId: z.string().optional().describe("Library ID to filter"),
      sortBy: z
        .string()
        .optional()
        .default("SortName")
        .describe("Sort field (SortName, DateCreated, PremiereDate, CommunityRating)"),
      sortOrder: z.enum(["Ascending", "Descending"]).optional().default("Ascending"),
      limit: z.number().optional().default(50).describe("Max results"),
      startIndex: z.number().optional().default(0).describe("Start index for pagination"),
    },
    async ({ parentId, sortBy, sortOrder, limit, startIndex }) => {
      const params: Record<string, string> = {
        IncludeItemTypes: "Movie",
        Recursive: "true",
        SortBy: sortBy,
        SortOrder: sortOrder,
        Limit: String(limit),
        StartIndex: String(startIndex),
      };
      if (parentId) params.ParentId = parentId;
      const data = await client.get("/Items", params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "emby_get_series",
    "List TV series in Emby",
    {
      parentId: z.string().optional().describe("Library ID to filter"),
      sortBy: z.string().optional().default("SortName"),
      sortOrder: z.enum(["Ascending", "Descending"]).optional().default("Ascending"),
      limit: z.number().optional().default(50),
      startIndex: z.number().optional().default(0),
    },
    async ({ parentId, sortBy, sortOrder, limit, startIndex }) => {
      const params: Record<string, string> = {
        IncludeItemTypes: "Series",
        Recursive: "true",
        SortBy: sortBy,
        SortOrder: sortOrder,
        Limit: String(limit),
        StartIndex: String(startIndex),
      };
      if (parentId) params.ParentId = parentId;
      const data = await client.get("/Items", params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "emby_get_episodes",
    "Get episodes for a TV series in Emby",
    {
      seriesId: z.string().describe("Series item ID"),
      seasonId: z.string().optional().describe("Season ID to filter"),
    },
    async ({ seriesId, seasonId }) => {
      const params: Record<string, string> = {
        SeriesId: seriesId,
        Recursive: "true",
      };
      if (seasonId) params.SeasonId = seasonId;
      const data = await client.get("/Items", { ...params, IncludeItemTypes: "Episode" });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "emby_get_sessions",
    "Get active Emby sessions (who is watching/playing)",
    {},
    async () => {
      const data = await client.get("/Sessions");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "emby_get_activity_log",
    "Get Emby activity log",
    {
      limit: z.number().optional().default(25).describe("Max entries"),
      startIndex: z.number().optional().default(0),
    },
    async ({ limit, startIndex }) => {
      const data = await client.get("/System/ActivityLog/Entries", {
        Limit: String(limit),
        StartIndex: String(startIndex),
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "emby_get_scheduled_tasks",
    "Get Emby scheduled tasks",
    {},
    async () => {
      const data = await client.get("/ScheduledTasks");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "emby_run_scheduled_task",
    "Run an Emby scheduled task (e.g. library scan)",
    { taskId: z.string().describe("Task ID") },
    async ({ taskId }) => {
      await client.post(`/ScheduledTasks/Running/${taskId}`);
      return { content: [{ type: "text", text: `Task ${taskId} started.` }] };
    },
  );

  server.tool(
    "emby_refresh_library",
    "Trigger a full Emby library refresh/scan",
    {},
    async () => {
      await client.post("/Library/Refresh");
      return { content: [{ type: "text", text: "Library refresh started." }] };
    },
  );

  server.tool(
    "emby_get_users",
    "List all Emby users",
    {},
    async () => {
      const data = await client.get("/Users");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
