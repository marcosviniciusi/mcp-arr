#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ArrClient } from "./clients/arr-client.js";
import { QBittorrentClient } from "./clients/qbittorrent-client.js";
import { registerSonarrTools } from "./tools/sonarr.js";
import { registerRadarrTools } from "./tools/radarr.js";
import { registerProwlarrTools } from "./tools/prowlarr.js";
import { registerQBittorrentTools } from "./tools/qbittorrent.js";

function getEnv(name: string): string | undefined {
  return process.env[name];
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

const server = new McpServer({
  name: "mcp-arr",
  version: "1.0.0",
});

// Register Sonarr tools if configured
const sonarrUrl = getEnv("SONARR_URL");
const sonarrApiKey = getEnv("SONARR_API_KEY");
if (sonarrUrl && sonarrApiKey) {
  const client = new ArrClient(sonarrUrl, sonarrApiKey);
  registerSonarrTools(server, client);
  console.error("[mcp-arr] Sonarr enabled:", sonarrUrl);
}

// Register Radarr tools if configured
const radarrUrl = getEnv("RADARR_URL");
const radarrApiKey = getEnv("RADARR_API_KEY");
if (radarrUrl && radarrApiKey) {
  const client = new ArrClient(radarrUrl, radarrApiKey);
  registerRadarrTools(server, client);
  console.error("[mcp-arr] Radarr enabled:", radarrUrl);
}

// Register Prowlarr tools if configured
const prowlarrUrl = getEnv("PROWLARR_URL");
const prowlarrApiKey = getEnv("PROWLARR_API_KEY");
if (prowlarrUrl && prowlarrApiKey) {
  const client = new ArrClient(prowlarrUrl, prowlarrApiKey);
  registerProwlarrTools(server, client);
  console.error("[mcp-arr] Prowlarr enabled:", prowlarrUrl);
}

// Register qBittorrent tools if configured
const qbtUrl = getEnv("QBITTORRENT_URL");
const qbtUsername = getEnv("QBITTORRENT_USERNAME");
const qbtPassword = getEnv("QBITTORRENT_PASSWORD");
if (qbtUrl && qbtUsername && qbtPassword) {
  const client = new QBittorrentClient(qbtUrl, qbtUsername, qbtPassword);
  registerQBittorrentTools(server, client);
  console.error("[mcp-arr] qBittorrent enabled:", qbtUrl);
}

// Check that at least one service is configured
if (!sonarrUrl && !radarrUrl && !prowlarrUrl && !qbtUrl) {
  console.error(
    "[mcp-arr] WARNING: No services configured. Set environment variables for at least one service:\n" +
      "  Sonarr:      SONARR_URL, SONARR_API_KEY\n" +
      "  Radarr:      RADARR_URL, RADARR_API_KEY\n" +
      "  Prowlarr:    PROWLARR_URL, PROWLARR_API_KEY\n" +
      "  qBittorrent: QBITTORRENT_URL, QBITTORRENT_USERNAME, QBITTORRENT_PASSWORD",
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp-arr] Server started on stdio");
}

main().catch((err) => {
  console.error("[mcp-arr] Fatal error:", err);
  process.exit(1);
});
