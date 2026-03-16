#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { authMiddleware } from "./auth.js";
import { ArrClient } from "./clients/arr-client.js";
import { QBittorrentClient } from "./clients/qbittorrent-client.js";
import { NZBGetClient } from "./clients/nzbget-client.js";
import { EmbyClient } from "./clients/emby-client.js";
import { registerSonarrTools } from "./tools/sonarr.js";
import { registerRadarrTools } from "./tools/radarr.js";
import { registerProwlarrTools } from "./tools/prowlarr.js";
import { registerQBittorrentTools } from "./tools/qbittorrent.js";
import { registerNZBGetTools } from "./tools/nzbget.js";
import { registerEmbyTools } from "./tools/emby.js";

function getEnv(name: string): string | undefined {
  return process.env[name];
}

function createServer(): McpServer {
  const server = new McpServer({
    name: "midia-mcp",
    version: "1.0.0",
  });

  // Sonarr
  const sonarrUrl = getEnv("SONARR_URL");
  const sonarrApiKey = getEnv("SONARR_API_KEY");
  if (sonarrUrl && sonarrApiKey) {
    registerSonarrTools(server, new ArrClient(sonarrUrl, sonarrApiKey));
    console.error("[midia-mcp] Sonarr enabled:", sonarrUrl);
  }

  // Radarr
  const radarrUrl = getEnv("RADARR_URL");
  const radarrApiKey = getEnv("RADARR_API_KEY");
  if (radarrUrl && radarrApiKey) {
    registerRadarrTools(server, new ArrClient(radarrUrl, radarrApiKey));
    console.error("[midia-mcp] Radarr enabled:", radarrUrl);
  }

  // Prowlarr
  const prowlarrUrl = getEnv("PROWLARR_URL");
  const prowlarrApiKey = getEnv("PROWLARR_API_KEY");
  if (prowlarrUrl && prowlarrApiKey) {
    registerProwlarrTools(server, new ArrClient(prowlarrUrl, prowlarrApiKey));
    console.error("[midia-mcp] Prowlarr enabled:", prowlarrUrl);
  }

  // qBittorrent
  const qbtUrl = getEnv("QBITTORRENT_URL");
  const qbtUsername = getEnv("QBITTORRENT_USERNAME");
  const qbtPassword = getEnv("QBITTORRENT_PASSWORD");
  if (qbtUrl && qbtUsername && qbtPassword) {
    registerQBittorrentTools(server, new QBittorrentClient(qbtUrl, qbtUsername, qbtPassword));
    console.error("[midia-mcp] qBittorrent enabled:", qbtUrl);
  }

  // NZBGet
  const nzbgetUrl = getEnv("NZBGET_URL");
  const nzbgetUsername = getEnv("NZBGET_USERNAME");
  const nzbgetPassword = getEnv("NZBGET_PASSWORD");
  if (nzbgetUrl && nzbgetUsername && nzbgetPassword) {
    registerNZBGetTools(server, new NZBGetClient(nzbgetUrl, nzbgetUsername, nzbgetPassword));
    console.error("[midia-mcp] NZBGet enabled:", nzbgetUrl);
  }

  // Emby
  const embyUrl = getEnv("EMBY_URL");
  const embyApiKey = getEnv("EMBY_API_KEY");
  if (embyUrl && embyApiKey) {
    registerEmbyTools(server, new EmbyClient(embyUrl, embyApiKey));
    console.error("[midia-mcp] Emby enabled:", embyUrl);
  }

  // Warn if nothing configured
  if (!sonarrUrl && !radarrUrl && !prowlarrUrl && !qbtUrl && !nzbgetUrl && !embyUrl) {
    console.error(
      "[midia-mcp] WARNING: No services configured. Set environment variables for at least one service:\n" +
        "  Sonarr:      SONARR_URL, SONARR_API_KEY\n" +
        "  Radarr:      RADARR_URL, RADARR_API_KEY\n" +
        "  Prowlarr:    PROWLARR_URL, PROWLARR_API_KEY\n" +
        "  qBittorrent: QBITTORRENT_URL, QBITTORRENT_USERNAME, QBITTORRENT_PASSWORD\n" +
        "  NZBGet:      NZBGET_URL, NZBGET_USERNAME, NZBGET_PASSWORD\n" +
        "  Emby:        EMBY_URL, EMBY_API_KEY",
    );
  }

  return server;
}

async function startStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[midia-mcp] Server started on stdio");
}

async function startSSE() {
  const port = parseInt(getEnv("PORT") || "3000", 10);
  const app = express();

  // Auth is REQUIRED in SSE mode — refuse to start without it
  const authTokens = getEnv("AUTH_TOKENS");
  if (!authTokens || authTokens.trim().length === 0) {
    console.error(
      "[midia-mcp] FATAL: AUTH_TOKENS is required in SSE mode.\n" +
        "  Set AUTH_TOKENS with one or more comma-separated Bearer tokens.\n" +
        "  Example: AUTH_TOKENS=my-secret-token-1,my-secret-token-2",
    );
    process.exit(1);
  }

  const tokens = authTokens.split(",").map((t) => t.trim()).filter(Boolean);
  app.use(
    authMiddleware({
      tokens,
      publicPaths: new Set(["/health"]),
    }),
  );
  console.error(`[midia-mcp] Auth enabled with ${tokens.length} token(s)`);

  // Track active transports for cleanup
  const transports = new Map<string, SSEServerTransport>();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", name: "midia-mcp", version: "1.0.0" });
  });

  app.get("/sse", async (req, res) => {
    const server = createServer();
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, transport);

    res.on("close", () => {
      transports.delete(transport.sessionId);
    });

    await server.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  // Catch-all: block any undefined route
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.listen(port, "0.0.0.0", () => {
    console.error(`[midia-mcp] SSE server listening on http://0.0.0.0:${port}`);
    console.error(`[midia-mcp] SSE endpoint: http://0.0.0.0:${port}/sse`);
    console.error(`[midia-mcp] Health check: http://0.0.0.0:${port}/health`);
  });
}

const mode = getEnv("TRANSPORT") || "stdio";

if (mode === "sse") {
  startSSE().catch((err) => {
    console.error("[midia-mcp] Fatal error:", err);
    process.exit(1);
  });
} else {
  startStdio().catch((err) => {
    console.error("[midia-mcp] Fatal error:", err);
    process.exit(1);
  });
}
