import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArrClient } from "../clients/arr-client.js";

export function registerProwlarrTools(server: McpServer, client: ArrClient) {
  server.tool(
    "prowlarr_get_indexers",
    "List all configured indexers in Prowlarr",
    {},
    async () => {
      const data = await client.get("/api/v1/indexer");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "prowlarr_get_indexer_by_id",
    "Get details for a specific indexer",
    { indexerId: z.number().describe("Indexer ID") },
    async ({ indexerId }) => {
      const data = await client.get(`/api/v1/indexer/${indexerId}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "prowlarr_test_indexer",
    "Test if an indexer is working",
    { indexerId: z.number().describe("Indexer ID to test") },
    async ({ indexerId }) => {
      const indexer = await client.get(`/api/v1/indexer/${indexerId}`);
      const data = await client.post("/api/v1/indexer/test", indexer);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "prowlarr_search",
    "Search across all indexers in Prowlarr",
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
      const data = await client.get("/api/v1/search", params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "prowlarr_get_indexer_stats",
    "Get indexer statistics",
    {},
    async () => {
      const data = await client.get("/api/v1/indexerstats");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "prowlarr_get_system_status",
    "Get Prowlarr system status",
    {},
    async () => {
      const data = await client.get("/api/v1/system/status");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
