import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArrClient } from "../clients/arr-client.js";

export function registerProwlarrTools(server: McpServer, client: ArrClient, prefix = "prowlarr") {
  const p = prefix;

  const ok = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  });

  const slim = (obj: any, keys: string[]) =>
    keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

  // ── Read tools ──────────────────────────────────────────────────────

  server.tool(
    `${p}_get_indexers`,
    `List all configured indexers in ${p}`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v1/indexer");
      return ok({
        total: data.length,
        items: data.map((i: any) => slim(i, ["id", "name", "protocol", "enable", "priority", "appProfileId"])),
      });
    },
  );

  server.tool(
    `${p}_get_indexer_by_id`,
    `Get details for a specific indexer in ${p}`,
    { indexerId: z.number().describe("Indexer ID") },
    async ({ indexerId }) => {
      const data = await client.get(`/api/v1/indexer/${indexerId}`);
      return ok(slim(data, ["id", "name", "protocol", "enable", "priority", "appProfileId", "fields"]));
    },
  );

  server.tool(
    `${p}_get_indexer_stats`,
    `Get indexer statistics from ${p}`,
    {},
    async () => ok(await client.get("/api/v1/indexerstats")),
  );

  server.tool(
    `${p}_get_system_status`,
    `Get ${p} system status`,
    {},
    async () => ok(await client.get("/api/v1/system/status")),
  );

  server.tool(
    `${p}_get_tags`,
    `List all tags in ${p}`,
    {},
    async () => ok(await client.get("/api/v1/tag")),
  );

  server.tool(
    `${p}_get_health`,
    `Get health check results from ${p}`,
    {},
    async () => ok(await client.get("/api/v1/health")),
  );

  server.tool(
    `${p}_get_app_profiles`,
    `Get application sync profiles from ${p}`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v1/appprofile");
      return ok(data.map((p: any) => slim(p, ["id", "name"])));
    },
  );

  server.tool(
    `${p}_get_applications`,
    `List connected applications (Sonarr/Radarr/etc.) in ${p}`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v1/applications");
      return ok(data.map((a: any) => slim(a, ["id", "name", "syncLevel", "implementation"])));
    },
  );

  server.tool(
    `${p}_get_download_clients`,
    `List download clients configured in ${p}`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v1/downloadclient");
      return ok(data.map((d: any) => slim(d, ["id", "name", "enable", "protocol", "implementation"])));
    },
  );

  server.tool(
    `${p}_get_history`,
    `Get search history from ${p} with pagination`,
    {
      page: z.number().optional().default(1).describe("Page number"),
      pageSize: z.number().optional().default(20).describe("Number of records per page"),
      sortKey: z.string().optional().default("date").describe("Sort field (e.g. date, indexerId)"),
      sortDirection: z.enum(["ascending", "descending"]).optional().default("descending").describe("Sort direction"),
    },
    async ({ page, pageSize, sortKey, sortDirection }) => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
        sortKey,
        sortDirection,
      };
      const data: any = await client.get("/api/v1/history", params);
      const records = Array.isArray(data) ? data : (data.records ?? []);
      return ok({
        page: data.page,
        pageSize: data.pageSize,
        totalRecords: data.totalRecords,
        records: records.map((h: any) => slim(h, ["id", "indexerId", "sourceTitle", "date", "eventType", "successful"])),
      });
    },
  );

  server.tool(
    `${p}_get_logs`,
    `Get log entries from ${p}`,
    {
      page: z.number().optional().default(1).describe("Page number"),
      pageSize: z.number().optional().default(20).describe("Number of log entries per page"),
      sortKey: z.string().optional().default("time").describe("Sort field"),
      sortDirection: z.enum(["ascending", "descending"]).optional().default("descending").describe("Sort direction"),
      level: z.enum(["info", "debug", "warn", "error", "trace", "all"]).optional().describe("Log level filter"),
    },
    async ({ page, pageSize, sortKey, sortDirection, level }) => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
        sortKey,
        sortDirection,
      };
      if (level && level !== "all") params.level = level;
      const data: any = await client.get("/api/v1/log", params);
      const records = Array.isArray(data) ? data : (data.records ?? []);
      return ok({
        page: data.page,
        pageSize: data.pageSize,
        totalRecords: data.totalRecords,
        records: records.map((l: any) => slim(l, ["time", "level", "logger", "message"])),
      });
    },
  );

  server.tool(
    `${p}_get_indexer_schema`,
    `Get available indexer types/schemas from ${p}`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v1/indexer/schema");
      return ok(data.map((s: any) => slim(s, ["name", "implementation", "implementationName", "protocol"])));
    },
  );

  // ── Search tools ────────────────────────────────────────────────────

  server.tool(
    `${p}_search`,
    `Search across indexers in ${p}`,
    {
      query: z.string().describe("Search query"),
      type: z.enum(["search", "tvsearch", "movie", "music", "book"]).optional().default("search").describe("Search type"),
      indexerIds: z.array(z.number()).optional().describe("Limit search to specific indexer IDs"),
      categories: z.array(z.number()).optional().describe("Category IDs to filter (e.g. 2000=Movies, 5000=TV)"),
    },
    async ({ query, type, indexerIds, categories }) => {
      const params: Record<string, string> = {
        query,
        type: type ?? "search",
      };
      if (indexerIds?.length) params.indexerIds = indexerIds.join(",");
      if (categories?.length) params.categories = categories.join(",");
      const data: any[] = await client.get("/api/v1/search", params);
      return ok({
        total: data.length,
        results: data.slice(0, 20).map((r: any) =>
          slim(r, ["title", "indexer", "size", "publishDate", "downloadUrl", "categories", "seeders", "leechers", "indexerId"]),
        ),
      });
    },
  );

  // ── Manage tools ────────────────────────────────────────────────────

  server.tool(
    `${p}_add_indexer`,
    `Add a new indexer to ${p}`,
    {
      name: z.string().describe("Indexer name"),
      definitionName: z.string().describe("Indexer definition name (from indexer schema, e.g. 'Nyaa', 'IPTorrents')"),
      implementation: z.string().describe("Implementation type (e.g. 'Torznab', 'Newznab', 'Cardigann')"),
      protocol: z.enum(["torrent", "usenet"]).describe("Indexer protocol"),
      enable: z.boolean().optional().default(true).describe("Enable the indexer"),
      appProfileId: z.number().optional().default(1).describe("App sync profile ID"),
      priority: z.number().optional().default(25).describe("Indexer priority (1-50)"),
      fields: z.array(z.object({
        name: z.string().describe("Field name"),
        value: z.union([z.string(), z.number(), z.boolean()]).describe("Field value"),
      })).describe("Configuration fields (baseUrl, apiKey, etc. - varies per indexer type)"),
      tags: z.array(z.number()).optional().default([]).describe("Tag IDs to assign"),
    },
    async ({ name, definitionName, implementation, protocol, enable, appProfileId, priority, fields, tags }) => {
      const body = {
        name,
        definitionName,
        implementation,
        protocol,
        enable,
        appProfileId,
        priority,
        fields,
        tags,
      };
      const data = await client.post("/api/v1/indexer", body);
      return ok(data);
    },
  );

  server.tool(
    `${p}_update_indexer`,
    `Update an existing indexer configuration in ${p}`,
    {
      indexerId: z.number().describe("Indexer ID to update"),
      body: z.record(z.string(), z.unknown()).describe("Full indexer object with updated fields (get current config via get_indexer_by_id first, modify, then pass here)"),
    },
    async ({ indexerId, body }) => {
      const data = await client.put(`/api/v1/indexer/${indexerId}`, body);
      return ok(data);
    },
  );

  server.tool(
    `${p}_delete_indexer`,
    `Delete an indexer from ${p}`,
    {
      indexerId: z.number().describe("Indexer ID to delete"),
    },
    async ({ indexerId }) => {
      await client.delete(`/api/v1/indexer/${indexerId}`);
      return { content: [{ type: "text" as const, text: `Indexer ${indexerId} deleted.` }] };
    },
  );

  server.tool(
    `${p}_test_indexer`,
    `Test if a specific indexer is working in ${p}`,
    {
      indexerId: z.number().describe("Indexer ID to test"),
    },
    async ({ indexerId }) => {
      const indexer = await client.get(`/api/v1/indexer/${indexerId}`);
      const data = await client.post("/api/v1/indexer/test", indexer);
      return ok(data ?? { valid: true, message: "Test passed" });
    },
  );

  server.tool(
    `${p}_test_all_indexers`,
    `Test all configured indexers in ${p}`,
    {},
    async () => ok(await client.post("/api/v1/indexer/testall")),
  );

  server.tool(
    `${p}_add_tag`,
    `Create a new tag in ${p}`,
    {
      label: z.string().describe("Tag label"),
    },
    async ({ label }) => {
      const data = await client.post("/api/v1/tag", { label });
      return ok(data);
    },
  );

  server.tool(
    `${p}_sync_app`,
    `Trigger an application sync in ${p} (syncs indexers to connected apps)`,
    {},
    async () => ok(await client.post("/api/v1/command", { name: "AppIndexerSync" })),
  );

  server.tool(
    `${p}_add_application`,
    `Add a connected application (Sonarr/Radarr/Lidarr/etc.) to ${p}`,
    {
      name: z.string().describe("Application name"),
      implementation: z.string().describe("Implementation type (e.g. 'Sonarr', 'Radarr', 'Lidarr', 'Readarr', 'Whisparr')"),
      syncLevel: z.enum(["disabled", "addOnly", "fullSync"]).optional().default("fullSync").describe("Sync level for indexer management"),
      fields: z.array(z.object({
        name: z.string().describe("Field name"),
        value: z.union([z.string(), z.number(), z.boolean()]).describe("Field value"),
      })).describe("Configuration fields (prowlarrUrl, baseUrl, apiKey, etc.)"),
      tags: z.array(z.number()).optional().default([]).describe("Tag IDs to assign"),
    },
    async ({ name, implementation, syncLevel, fields, tags }) => {
      const body = {
        name,
        implementation,
        syncLevel,
        fields,
        tags,
      };
      const data = await client.post("/api/v1/applications", body);
      return ok(data);
    },
  );

  server.tool(
    `${p}_delete_application`,
    `Delete a connected application from ${p}`,
    {
      applicationId: z.number().describe("Application ID to delete"),
    },
    async ({ applicationId }) => {
      await client.delete(`/api/v1/applications/${applicationId}`);
      return { content: [{ type: "text" as const, text: `Application ${applicationId} deleted.` }] };
    },
  );
}
