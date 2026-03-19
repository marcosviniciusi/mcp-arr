import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { QBittorrentClient } from "../clients/qbittorrent-client.js";

const slim = (obj: any, keys: string[]) => keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

export function registerQBittorrentTools(server: McpServer, client: QBittorrentClient) {
  server.tool(
    "qbt_get_torrents",
    "List all torrents in qBittorrent",
    {
      filter: z
        .enum(["all", "downloading", "seeding", "completed", "paused", "active", "inactive", "stalled", "errored"])
        .optional()
        .default("all")
        .describe("Filter torrents by state"),
      category: z.string().optional().describe("Filter by category"),
      sort: z.string().optional().describe("Sort by field (e.g. name, size, progress, dlspeed, upspeed, added_on)"),
    },
    async ({ filter, category, sort }) => {
      const params: Record<string, string> = {};
      if (filter) params.filter = filter;
      if (category) params.category = category;
      if (sort) params.sort = sort;
      const qs = new URLSearchParams(params).toString();
      const path = `/api/v2/torrents/info${qs ? `?${qs}` : ""}`;
      const data: any = await client.getJson(path);
      const arr = Array.isArray(data) ? data : [];
      const items = arr.slice(0, 50).map((t: any) => slim(t, ["name", "hash", "size", "progress", "state", "dlspeed", "upspeed", "category", "added_on", "eta"]));
      return { content: [{ type: "text", text: JSON.stringify({ total: arr.length, items }, null, 2) }] };
    },
  );

  server.tool(
    "qbt_get_torrent_details",
    "Get detailed properties of a torrent",
    { hash: z.string().describe("Torrent hash") },
    async ({ hash }) => {
      const [general, trackers, files] = await Promise.all([
        client.getJson(`/api/v2/torrents/properties?hash=${hash}`),
        client.getJson(`/api/v2/torrents/trackers?hash=${hash}`),
        client.getJson(`/api/v2/torrents/files?hash=${hash}`),
      ]);
      return {
        content: [{ type: "text", text: JSON.stringify({ general, trackers, files }, null, 2) }],
      };
    },
  );

  server.tool(
    "qbt_add_torrent",
    "Add a torrent by URL or magnet link",
    {
      urls: z.string().describe("Torrent URL or magnet link (one per line for multiple)"),
      category: z.string().optional().describe("Category to assign"),
      savepath: z.string().optional().describe("Custom save path"),
      paused: z.boolean().optional().default(false).describe("Add in paused state"),
    },
    async ({ urls, category, savepath, paused }) => {
      const params: Record<string, string> = { urls };
      if (category) params.category = category;
      if (savepath) params.savepath = savepath;
      if (paused) params.paused = "true";
      await client.post("/api/v2/torrents/add", params);
      return { content: [{ type: "text", text: "Torrent added successfully." }] };
    },
  );

  server.tool(
    "qbt_pause_torrents",
    "Pause one or more torrents",
    { hashes: z.string().describe("Torrent hashes separated by | or 'all'") },
    async ({ hashes }) => {
      await client.post("/api/v2/torrents/pause", { hashes });
      return { content: [{ type: "text", text: `Paused: ${hashes}` }] };
    },
  );

  server.tool(
    "qbt_resume_torrents",
    "Resume one or more torrents",
    { hashes: z.string().describe("Torrent hashes separated by | or 'all'") },
    async ({ hashes }) => {
      await client.post("/api/v2/torrents/resume", { hashes });
      return { content: [{ type: "text", text: `Resumed: ${hashes}` }] };
    },
  );

  server.tool(
    "qbt_delete_torrents",
    "Delete one or more torrents",
    {
      hashes: z.string().describe("Torrent hashes separated by | or 'all'"),
      deleteFiles: z.boolean().optional().default(false).describe("Also delete files on disk"),
    },
    async ({ hashes, deleteFiles }) => {
      await client.post("/api/v2/torrents/delete", {
        hashes,
        deleteFiles: String(deleteFiles),
      });
      return { content: [{ type: "text", text: `Deleted: ${hashes}` }] };
    },
  );

  server.tool(
    "qbt_get_transfer_info",
    "Get global transfer info (speeds, connection status)",
    {},
    async () => {
      const data = await client.getJson("/api/v2/transfer/info");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "qbt_get_categories",
    "List all torrent categories",
    {},
    async () => {
      const data = await client.getJson("/api/v2/torrents/categories");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "qbt_create_category",
    "Create a new torrent category",
    {
      category: z.string().describe("Category name"),
      savePath: z.string().optional().default("").describe("Save path for this category"),
    },
    async ({ category, savePath }) => {
      await client.post("/api/v2/torrents/createCategory", {
        category,
        savePath: savePath ?? "",
      });
      return { content: [{ type: "text", text: `Category '${category}' created.` }] };
    },
  );

  server.tool(
    "qbt_set_torrent_category",
    "Set category for torrents",
    {
      hashes: z.string().describe("Torrent hashes separated by | or 'all'"),
      category: z.string().describe("Category name"),
    },
    async ({ hashes, category }) => {
      await client.post("/api/v2/torrents/setCategory", { hashes, category });
      return { content: [{ type: "text", text: `Category set to '${category}' for: ${hashes}` }] };
    },
  );

  server.tool(
    "qbt_set_speed_limit",
    "Set global upload/download speed limits",
    {
      downloadLimit: z.number().optional().describe("Download limit in bytes/s (0 = unlimited)"),
      uploadLimit: z.number().optional().describe("Upload limit in bytes/s (0 = unlimited)"),
    },
    async ({ downloadLimit, uploadLimit }) => {
      const results: string[] = [];
      if (downloadLimit !== undefined) {
        await client.post("/api/v2/transfer/setDownloadLimit", {
          limit: String(downloadLimit),
        });
        results.push(`Download limit: ${downloadLimit} B/s`);
      }
      if (uploadLimit !== undefined) {
        await client.post("/api/v2/transfer/setUploadLimit", {
          limit: String(uploadLimit),
        });
        results.push(`Upload limit: ${uploadLimit} B/s`);
      }
      return { content: [{ type: "text", text: results.join("\n") || "No limits changed." }] };
    },
  );

  server.tool(
    "qbt_get_app_version",
    "Get qBittorrent application version",
    {},
    async () => {
      const version = await client.getJson("/api/v2/app/version");
      return { content: [{ type: "text", text: String(version) }] };
    },
  );
}
