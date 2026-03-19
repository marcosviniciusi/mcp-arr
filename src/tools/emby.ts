import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { EmbyClient } from "../clients/emby-client.js";

const slim = (obj: any, keys: string[]) => keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

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
      const data: any = await client.get("/Items", params);
      const items = (data.Items ?? []).map((i: any) => {
        const s = slim(i, ["Name", "Id", "Type", "ProductionYear", "Overview"]);
        if (s.Overview) s.Overview = s.Overview.slice(0, 150);
        return s;
      });
      return { content: [{ type: "text", text: JSON.stringify({ TotalRecordCount: data.TotalRecordCount, Items: items }, null, 2) }] };
    },
  );

  server.tool(
    "emby_get_item",
    "Get details of a specific Emby item",
    { itemId: z.string().describe("Item ID") },
    async ({ itemId }) => {
      const data: any = await client.get(`/Items/${itemId}`);
      const s = slim(data, ["Name", "Id", "Type", "ProductionYear", "Overview", "CommunityRating", "OfficialRating", "Genres", "Studios", "People"]);
      if (s.Overview) s.Overview = s.Overview.slice(0, 300);
      if (Array.isArray(s.People)) s.People = s.People.map((p: any) => slim(p, ["Name", "Role", "Type"]));
      return { content: [{ type: "text", text: JSON.stringify(s, null, 2) }] };
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
      // Emby requires userId for latest items; get first user
      const users = await client.get<Array<{ Id: string }>>("/emby/Users");
      const userId = users?.[0]?.Id ?? "";
      const data: any = await client.get(`/emby/Users/${userId}/Items/Latest`, params);
      const items = (Array.isArray(data) ? data : []).map((i: any) => slim(i, ["Name", "Id", "Type", "ProductionYear", "DateCreated"]));
      return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
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
      const data: any = await client.get("/Items", params);
      const items = (data.Items ?? []).map((i: any) => slim(i, ["Name", "Id", "ProductionYear", "CommunityRating", "OfficialRating", "HasSubtitles"]));
      return { content: [{ type: "text", text: JSON.stringify({ TotalRecordCount: data.TotalRecordCount, Items: items }, null, 2) }] };
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
      const data: any = await client.get("/Items", params);
      const items = (data.Items ?? []).map((i: any) => slim(i, ["Name", "Id", "ProductionYear", "Status", "CommunityRating"]));
      return { content: [{ type: "text", text: JSON.stringify({ TotalRecordCount: data.TotalRecordCount, Items: items }, null, 2) }] };
    },
  );

  server.tool(
    "emby_get_episodes",
    "Get episodes grouped by season for a TV series in Emby. Shows episode number and if file exists.",
    {
      seriesId: z.string().describe("Series item ID"),
      seasonId: z.string().optional().describe("Season ID to filter"),
    },
    async ({ seriesId, seasonId }) => {
      const params: Record<string, string> = {
        SeriesId: seriesId,
        Recursive: "true",
        Fields: "Path",
      };
      if (seasonId) params.SeasonId = seasonId;
      const data: any = await client.get("/Items", { ...params, IncludeItemTypes: "Episode" });
      const episodes = data.Items ?? [];
      const seasons: Record<string, { episodes: { ep: number; hasFile: boolean }[]; total: number; downloaded: number }> = {};
      for (const ep of episodes) {
        const key = `S${String(ep.ParentIndexNumber ?? 0).padStart(2, "0")}`;
        if (!seasons[key]) seasons[key] = { episodes: [], total: 0, downloaded: 0 };
        const hasFile = !!(ep.Path || ep.MediaSources?.length);
        seasons[key].episodes.push({ ep: ep.IndexNumber ?? 0, hasFile });
        seasons[key].total++;
        if (hasFile) seasons[key].downloaded++;
      }
      const totalEpisodes = episodes.length;
      const totalDownloaded = Object.values(seasons).reduce((s, v) => s + v.downloaded, 0);
      return { content: [{ type: "text", text: JSON.stringify({ totalEpisodes, totalDownloaded, seasons }, null, 2) }] };
    },
  );

  server.tool(
    "emby_get_sessions",
    "Get active Emby sessions (who is watching/playing)",
    {},
    async () => {
      const data: any = await client.get("/Sessions");
      const items = (Array.isArray(data) ? data : []).map((s: any) => {
        const r = slim(s, ["Id", "UserName", "Client", "DeviceName", "NowPlayingItem"]);
        if (r.NowPlayingItem) r.NowPlayingItem = slim(r.NowPlayingItem, ["Name", "Type"]);
        return r;
      });
      return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
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
      const data: any = await client.get("/System/ActivityLog/Entries", {
        Limit: String(limit),
        StartIndex: String(startIndex),
      });
      const items = (data.Items ?? []).map((i: any) => slim(i, ["Id", "Name", "Type", "Date", "Severity"]));
      return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
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
