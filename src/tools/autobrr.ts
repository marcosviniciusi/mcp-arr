import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AutobrrClient } from "../clients/autobrr-client.js";

export function registerAutobrrTools(server: McpServer, client: AutobrrClient, prefix = "autobrr") {
  const p = prefix;

  server.tool(
    `${p}_get_filters`,
    `List all filters in ${p}`,
    {},
    async () => {
      const data = await client.get("/api/filters");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_filter_by_id`,
    `Get details for a specific filter in ${p}`,
    { filterId: z.number().describe("Filter ID") },
    async ({ filterId }) => {
      const data = await client.get(`/api/filters/${filterId}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_create_filter`,
    `Create a new filter in ${p}`,
    {
      name: z.string().describe("Filter name"),
      enabled: z.boolean().optional().default(true).describe("Enable filter"),
      priority: z.number().optional().default(0).describe("Priority (higher = first)"),
    },
    async ({ name, enabled, priority }) => {
      const data = await client.post("/api/filters", { name, enabled, priority });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_delete_filter`,
    `Delete a filter in ${p}`,
    { filterId: z.number().describe("Filter ID to delete") },
    async ({ filterId }) => {
      await client.delete(`/api/filters/${filterId}`);
      return { content: [{ type: "text", text: `Filter ${filterId} deleted.` }] };
    },
  );

  server.tool(
    `${p}_get_indexers`,
    `List configured indexers in ${p}`,
    {},
    async () => {
      const data = await client.get("/api/indexer");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_irc_networks`,
    `List IRC networks in ${p}`,
    {},
    async () => {
      const data = await client.get("/api/irc");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_releases`,
    `List recent releases captured by ${p}`,
    {
      limit: z.number().optional().default(50).describe("Number of releases to return"),
      offset: z.number().optional().default(0).describe("Offset for pagination"),
    },
    async ({ limit, offset }) => {
      const data = await client.get("/api/release", { limit: String(limit), offset: String(offset) });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_release_stats`,
    `Get release statistics from ${p}`,
    {},
    async () => {
      const data = await client.get("/api/release/stats");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_feeds`,
    `List RSS/Torznab feeds in ${p}`,
    {},
    async () => {
      const data = await client.get("/api/feeds");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_download_clients`,
    `List download clients configured in ${p}`,
    {},
    async () => {
      const data = await client.get("/api/download_clients");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
