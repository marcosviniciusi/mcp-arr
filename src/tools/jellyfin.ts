import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JellyfinClient } from "../clients/jellyfin-client.js";

const slim = (obj: any, keys: string[]) => keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

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
    `${p}_get_item`,
    `Get details of a specific ${p} item`,
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
      const data: any = await client.get("/Items/Latest", params);
      const items = (Array.isArray(data) ? data : []).map((i: any) => slim(i, ["Name", "Id", "Type", "ProductionYear", "DateCreated"]));
      return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
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
      const data: any = await client.get("/Items", params);
      const items = (data.Items ?? []).map((i: any) => slim(i, ["Name", "Id", "ProductionYear", "CommunityRating", "OfficialRating", "HasSubtitles"]));
      return { content: [{ type: "text", text: JSON.stringify({ TotalRecordCount: data.TotalRecordCount, Items: items }, null, 2) }] };
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
      const data: any = await client.get("/Items", params);
      const items = (data.Items ?? []).map((i: any) => slim(i, ["Name", "Id", "ProductionYear", "Status", "CommunityRating"]));
      return { content: [{ type: "text", text: JSON.stringify({ TotalRecordCount: data.TotalRecordCount, Items: items }, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_episodes`,
    `Get episodes grouped by season for a series in ${p}. Shows episode number and if file exists.`,
    {
      seriesId: z.string().describe("Series item ID"),
      seasonId: z.string().optional().describe("Season ID"),
    },
    async ({ seriesId, seasonId }) => {
      const params: Record<string, string> = {
        SeriesId: seriesId,
        IncludeItemTypes: "Episode",
        Recursive: "true",
        Fields: "Path",
      };
      if (seasonId) params.SeasonId = seasonId;
      const data: any = await client.get("/Items", params);
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
    `${p}_get_sessions`,
    `Get active ${p} sessions (who is watching)`,
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
    `${p}_get_activity_log`,
    `Get ${p} activity log`,
    {
      limit: z.number().optional().default(25),
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
