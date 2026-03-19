import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SeerrClient } from "../clients/seerr-client.js";

const slim = (obj: any, keys: string[]) => keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

export function registerSeerrTools(server: McpServer, getClient: () => SeerrClient) {
  // ── Read ───────────────────────────────────────────────────────

  server.tool(
    "seerr_search",
    "Search for movies and TV shows in Seerr/Overseerr",
    {
      query: z.string().describe("Search term"),
      page: z.number().optional().default(1).describe("Page number"),
    },
    async ({ query, page }) => {
      const data: any = await getClient().get("/search", { query, page: String(page) });
      const results = (data.results ?? []).map((i: any) => {
        const s = slim(i, ["id", "mediaType", "title", "name", "releaseDate", "firstAirDate", "overview", "posterPath"]);
        if (s.overview) s.overview = s.overview.slice(0, 150);
        return s;
      });
      return { content: [{ type: "text", text: JSON.stringify({ page: data.page, totalPages: data.totalPages, totalResults: data.totalResults, results }, null, 2) }] };
    },
  );

  server.tool(
    "seerr_get_media",
    "List all media in Seerr with optional filters",
    {
      take: z.number().optional().default(20).describe("Number of results"),
      skip: z.number().optional().default(0).describe("Offset"),
      filter: z.enum(["all", "available", "partial", "processing", "pending"]).optional().default("all"),
    },
    async ({ take, skip, filter }) => {
      const data: any = await getClient().get("/media", {
        take: String(take),
        skip: String(skip),
        filter,
      });
      const results = (data.results ?? []).map((i: any) => slim(i, ["id", "tmdbId", "tvdbId", "mediaType", "status", "createdAt"]));
      return { content: [{ type: "text", text: JSON.stringify({ pageInfo: data.pageInfo, results }, null, 2) }] };
    },
  );

  server.tool(
    "seerr_get_media_by_id",
    "Get details of a specific media item",
    { mediaId: z.number().describe("Media ID") },
    async ({ mediaId }) => {
      const data: any = await getClient().get(`/media/${mediaId}`);
      const s = slim(data, ["id", "tmdbId", "tvdbId", "mediaType", "status", "createdAt", "requests"]);
      return { content: [{ type: "text", text: JSON.stringify(s, null, 2) }] };
    },
  );

  server.tool(
    "seerr_get_requests",
    "List media requests with optional filters",
    {
      take: z.number().optional().default(20),
      skip: z.number().optional().default(0),
      filter: z.enum(["all", "approved", "available", "pending", "processing", "unavailable"]).optional().default("all"),
      sort: z.enum(["added", "modified"]).optional().default("added"),
    },
    async ({ take, skip, filter, sort }) => {
      const data: any = await getClient().get("/request", {
        take: String(take),
        skip: String(skip),
        filter,
        sort,
      });
      const results = (data.results ?? []).map((i: any) => {
        const s = slim(i, ["id", "type", "status", "media", "createdAt", "updatedAt", "requestedBy"]);
        if (s.media) s.media = slim(s.media, ["tmdbId", "tvdbId", "status"]);
        if (s.requestedBy) s.requestedBy = slim(s.requestedBy, ["id", "displayName"]);
        return s;
      });
      return { content: [{ type: "text", text: JSON.stringify({ pageInfo: data.pageInfo, results }, null, 2) }] };
    },
  );

  server.tool(
    "seerr_get_request_by_id",
    "Get details of a specific request",
    { requestId: z.number().describe("Request ID") },
    async ({ requestId }) => {
      const data: any = await getClient().get(`/request/${requestId}`);
      const s = { ...data };
      if (s.media) s.media = slim(s.media, ["id", "tmdbId", "tvdbId", "mediaType", "status"]);
      if (s.requestedBy) s.requestedBy = slim(s.requestedBy, ["id", "displayName", "email"]);
      if (s.modifiedBy) s.modifiedBy = slim(s.modifiedBy, ["id", "displayName"]);
      return { content: [{ type: "text", text: JSON.stringify(s, null, 2) }] };
    },
  );

  server.tool(
    "seerr_get_status",
    "Get Seerr server status",
    {},
    async () => {
      const data = await getClient().get("/status");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  // ── Request ───────────────────────────────────────────────────

  server.tool(
    "seerr_request_movie",
    "Request a movie in Seerr",
    {
      mediaId: z.number().describe("TMDB movie ID"),
    },
    async ({ mediaId }) => {
      const data = await getClient().post("/request", {
        mediaType: "movie",
        mediaId,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "seerr_request_tv",
    "Request a TV show in Seerr",
    {
      mediaId: z.number().describe("TMDB TV show ID"),
      seasons: z.array(z.number()).optional().describe("Season numbers to request (omit for all)"),
    },
    async ({ mediaId, seasons }) => {
      const body: Record<string, unknown> = { mediaType: "tv", mediaId };
      if (seasons) {
        body.seasons = seasons.map((s) => ({ seasonNumber: s }));
      }
      const data = await getClient().post("/request", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  // ── Manage ────────────────────────────────────────────────────

  server.tool(
    "seerr_approve_request",
    "Approve a media request",
    { requestId: z.number().describe("Request ID") },
    async ({ requestId }) => {
      const data = await getClient().post(`/request/${requestId}/approve`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "seerr_deny_request",
    "Deny a media request",
    { requestId: z.number().describe("Request ID") },
    async ({ requestId }) => {
      const data = await getClient().post(`/request/${requestId}/decline`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "seerr_delete_request",
    "Delete a media request",
    { requestId: z.number().describe("Request ID") },
    async ({ requestId }) => {
      await getClient().delete(`/request/${requestId}`);
      return { content: [{ type: "text", text: `Request ${requestId} deleted.` }] };
    },
  );

  // ── Admin ─────────────────────────────────────────────────────

  server.tool(
    "seerr_get_users",
    "List all Seerr users",
    {
      take: z.number().optional().default(20),
      skip: z.number().optional().default(0),
    },
    async ({ take, skip }) => {
      const data: any = await getClient().get("/user", {
        take: String(take),
        skip: String(skip),
      });
      const results = (data.results ?? (Array.isArray(data) ? data : [])).map((i: any) =>
        slim(i, ["id", "displayName", "email", "requestCount", "movieQuotaLimit", "movieQuotaDays"]),
      );
      return { content: [{ type: "text", text: JSON.stringify({ pageInfo: data.pageInfo, results }, null, 2) }] };
    },
  );

  server.tool(
    "seerr_get_user_by_id",
    "Get details of a specific user",
    { userId: z.number().describe("User ID") },
    async ({ userId }) => {
      const data = await getClient().get(`/user/${userId}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "seerr_get_settings",
    "Get Seerr server settings",
    {},
    async () => {
      const data = await getClient().get("/settings/main");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
