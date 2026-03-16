import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NZBGetClient } from "../clients/nzbget-client.js";

export function registerNZBGetTools(server: McpServer, client: NZBGetClient) {
  server.tool(
    "nzbget_get_status",
    "Get NZBGet server status (speed, remaining, quota)",
    {},
    async () => {
      const data = await client.call("status");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "nzbget_get_downloads",
    "List active downloads in NZBGet queue",
    {},
    async () => {
      const data = await client.call("listgroups");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "nzbget_get_history",
    "Get NZBGet download history",
    {
      hidden: z.boolean().optional().default(false).describe("Include hidden entries"),
    },
    async ({ hidden }) => {
      const data = await client.call("history", [hidden]);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "nzbget_add_nzb",
    "Add an NZB by URL to NZBGet",
    {
      filename: z.string().describe("Display name for the NZB"),
      url: z.string().describe("URL of the NZB file"),
      category: z.string().optional().default("").describe("Category to assign"),
      priority: z.number().optional().default(0).describe("Priority (-100 to 900, 0=normal, 900=force)"),
      addPaused: z.boolean().optional().default(false).describe("Add in paused state"),
    },
    async ({ filename, url, category, priority, addPaused }) => {
      // append(NZBFilename, NZBContent, Category, Priority, DupeKey, DupeScore, DupeMode, AddTop, AddPaused, URL, ...)
      const id = await client.call<number>("append", [
        filename,
        "",            // NZBContent (empty = use URL)
        category,
        priority,
        false,         // AddToTop
        addPaused,
        "",            // DupeKey
        0,             // DupeScore
        "SCORE",       // DupeMode
        [{ "*URL": url }],
      ]);
      return { content: [{ type: "text", text: `NZB added with ID: ${id}` }] };
    },
  );

  server.tool(
    "nzbget_pause_download",
    "Pause a download in NZBGet",
    { id: z.number().describe("Download group ID") },
    async ({ id }) => {
      await client.call("editqueue", ["GroupPause", "", [id]]);
      return { content: [{ type: "text", text: `Paused download ${id}` }] };
    },
  );

  server.tool(
    "nzbget_resume_download",
    "Resume a download in NZBGet",
    { id: z.number().describe("Download group ID") },
    async ({ id }) => {
      await client.call("editqueue", ["GroupResume", "", [id]]);
      return { content: [{ type: "text", text: `Resumed download ${id}` }] };
    },
  );

  server.tool(
    "nzbget_delete_download",
    "Delete a download from NZBGet queue",
    { id: z.number().describe("Download group ID") },
    async ({ id }) => {
      await client.call("editqueue", ["GroupDelete", "", [id]]);
      return { content: [{ type: "text", text: `Deleted download ${id}` }] };
    },
  );

  server.tool(
    "nzbget_pause_all",
    "Pause all downloads in NZBGet",
    {},
    async () => {
      await client.call("pausedownload");
      return { content: [{ type: "text", text: "All downloads paused." }] };
    },
  );

  server.tool(
    "nzbget_resume_all",
    "Resume all downloads in NZBGet",
    {},
    async () => {
      await client.call("resumedownload");
      return { content: [{ type: "text", text: "All downloads resumed." }] };
    },
  );

  server.tool(
    "nzbget_set_speed_limit",
    "Set NZBGet download speed limit",
    { limit: z.number().describe("Speed limit in KB/s (0 = unlimited)") },
    async ({ limit }) => {
      await client.call("rate", [limit]);
      return { content: [{ type: "text", text: `Speed limit set to ${limit} KB/s` }] };
    },
  );

  server.tool(
    "nzbget_get_config",
    "Get NZBGet server configuration",
    {},
    async () => {
      const data = await client.call("config");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "nzbget_get_version",
    "Get NZBGet version",
    {},
    async () => {
      const version = await client.call("version");
      return { content: [{ type: "text", text: String(version) }] };
    },
  );
}
