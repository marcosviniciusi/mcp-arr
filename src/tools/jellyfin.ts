import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JellyfinClient } from "../clients/jellyfin-client.js";

export function registerJellyfinTools(server: McpServer, client: JellyfinClient, prefix = "jellyfin") {
  const p = prefix;

  server.tool(
    `${p}_get_system_info`,
    `Get ${p} server system info`,
    {},
    async () => {
      const data = await client.get("/System/Info");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_libraries`,
    `List all ${p} media libraries`,
    {},
    async () => {
      const data = await client.get("/Library/VirtualFolders");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_search`,
    `Search for media in ${p}`,
    {
      query: z.string().describe("Search term"),
      mediaTypes: z.string().optional().describe("Media types (Movie, Series, Episode, Audio)"),
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
    `${p}_get_item`,
    `Get details of a specific ${p} item`,
    { itemId: z.string().describe("Item ID") },
    async ({ itemId }) => {
      const data = await client.get(`/Items/${itemId}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_latest_media`,
    `Get latest added media in ${p}`,
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
    `${p}_get_movies`,
    `List movies in ${p}`,
    {
      parentId: z.string().optional().describe("Library ID"),
      sortBy: z.string().optional().default("SortName"),
      sortOrder: z.enum(["Ascending", "Descending"]).optional().default("Ascending"),
      limit: z.number().optional().default(50),
      startIndex: z.number().optional().default(0),
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
    `${p}_get_series`,
    `List TV series in ${p}`,
    {
      parentId: z.string().optional().describe("Library ID"),
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
    `${p}_get_episodes`,
    `Get episodes for a series in ${p}`,
    {
      seriesId: z.string().describe("Series item ID"),
      seasonId: z.string().optional().describe("Season ID"),
    },
    async ({ seriesId, seasonId }) => {
      const params: Record<string, string> = {
        SeriesId: seriesId,
        IncludeItemTypes: "Episode",
        Recursive: "true",
      };
      if (seasonId) params.SeasonId = seasonId;
      const data = await client.get("/Items", params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_sessions`,
    `Get active ${p} sessions (who is watching)`,
    {},
    async () => {
      const data = await client.get("/Sessions");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_activity_log`,
    `Get ${p} activity log`,
    {
      limit: z.number().optional().default(25),
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
    `${p}_get_scheduled_tasks`,
    `Get ${p} scheduled tasks`,
    {},
    async () => {
      const data = await client.get("/ScheduledTasks");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_run_scheduled_task`,
    `Run a ${p} scheduled task`,
    { taskId: z.string().describe("Task ID") },
    async ({ taskId }) => {
      await client.post(`/ScheduledTasks/Running/${taskId}`);
      return { content: [{ type: "text", text: `Task ${taskId} started.` }] };
    },
  );

  server.tool(
    `${p}_refresh_library`,
    `Trigger a full ${p} library refresh`,
    {},
    async () => {
      await client.post("/Library/Refresh");
      return { content: [{ type: "text", text: "Library refresh started." }] };
    },
  );

  server.tool(
    `${p}_get_users`,
    `List all ${p} users`,
    {},
    async () => {
      const data = await client.get("/Users");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
