#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { authMiddleware } from "./auth.js";
import { parseTokenConfig } from "./rbac.js";
import type { TokenEntry } from "./rbac.js";
import { createGuardedServer, type SessionContext } from "./server-wrapper.js";
import { initOtelLogger, shutdownOtelLogger, emitAuditLog } from "./logger.js";
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

/**
 * Register all configured service tools on a McpServer instance.
 */
function registerAllTools(server: McpServer): void {
  const sonarrUrl = getEnv("SONARR_URL");
  const sonarrApiKey = getEnv("SONARR_API_KEY");
  if (sonarrUrl && sonarrApiKey) {
    registerSonarrTools(server, new ArrClient(sonarrUrl, sonarrApiKey));
  }

  const radarrUrl = getEnv("RADARR_URL");
  const radarrApiKey = getEnv("RADARR_API_KEY");
  if (radarrUrl && radarrApiKey) {
    registerRadarrTools(server, new ArrClient(radarrUrl, radarrApiKey));
  }

  const prowlarrUrl = getEnv("PROWLARR_URL");
  const prowlarrApiKey = getEnv("PROWLARR_API_KEY");
  if (prowlarrUrl && prowlarrApiKey) {
    registerProwlarrTools(server, new ArrClient(prowlarrUrl, prowlarrApiKey));
  }

  const qbtUrl = getEnv("QBITTORRENT_URL");
  const qbtUsername = getEnv("QBITTORRENT_USERNAME");
  const qbtPassword = getEnv("QBITTORRENT_PASSWORD");
  if (qbtUrl && qbtUsername && qbtPassword) {
    registerQBittorrentTools(server, new QBittorrentClient(qbtUrl, qbtUsername, qbtPassword));
  }

  const nzbgetUrl = getEnv("NZBGET_URL");
  const nzbgetUsername = getEnv("NZBGET_USERNAME");
  const nzbgetPassword = getEnv("NZBGET_PASSWORD");
  if (nzbgetUrl && nzbgetUsername && nzbgetPassword) {
    registerNZBGetTools(server, new NZBGetClient(nzbgetUrl, nzbgetUsername, nzbgetPassword));
  }

  const embyUrl = getEnv("EMBY_URL");
  const embyApiKey = getEnv("EMBY_API_KEY");
  if (embyUrl && embyApiKey) {
    registerEmbyTools(server, new EmbyClient(embyUrl, embyApiKey));
  }
}

function createBaseServer(): McpServer {
  return new McpServer({ name: "midia-mcp", version: "2.0.0" });
}

function logEnabledServices(): void {
  const services = [
    ["Sonarr", "SONARR_URL"],
    ["Radarr", "RADARR_URL"],
    ["Prowlarr", "PROWLARR_URL"],
    ["qBittorrent", "QBITTORRENT_URL"],
    ["NZBGet", "NZBGET_URL"],
    ["Emby", "EMBY_URL"],
  ] as const;

  let any = false;
  for (const [name, envKey] of services) {
    if (getEnv(envKey)) {
      console.error(`[midia-mcp] ${name} enabled: ${getEnv(envKey)}`);
      any = true;
    }
  }
  if (!any) {
    console.error("[midia-mcp] WARNING: No services configured.");
  }
}

// ─── Stdio mode (local, no auth needed) ──────────────────────────

async function startStdio() {
  const server = createBaseServer();
  registerAllTools(server);
  logEnabledServices();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[midia-mcp] Server started on stdio");
}

// ─── SSE mode (remote, auth + RBAC + OTel) ──────────────────────

async function startSSE() {
  const port = parseInt(getEnv("PORT") || "3000", 10);
  const app = express();

  // Parse token config (required in SSE mode)
  const tokensConfigJson = getEnv("AUTH_TOKENS_CONFIG");
  if (!tokensConfigJson) {
    console.error(
      '[midia-mcp] FATAL: AUTH_TOKENS_CONFIG is required in SSE mode.\n' +
        '  Set AUTH_TOKENS_CONFIG as a JSON array:\n' +
        '  [{"token":"secret","name":"marcos","role":"admin"},{"token":"abc","name":"guest","role":"viewer"}]\n' +
        '  Valid roles: admin, manager, viewer',
    );
    process.exit(1);
  }

  let tokenEntries: TokenEntry[];
  try {
    tokenEntries = parseTokenConfig(tokensConfigJson);
  } catch (err) {
    console.error(`[midia-mcp] FATAL: Invalid AUTH_TOKENS_CONFIG: ${err}`);
    process.exit(1);
  }

  // Init OTel logger if configured
  const otlpEndpoint = getEnv("OTEL_EXPORTER_OTLP_ENDPOINT");
  if (otlpEndpoint) {
    initOtelLogger({
      serviceName: getEnv("OTEL_SERVICE_NAME") || "midia-mcp",
      serviceVersion: "2.0.0",
      otlpEndpoint,
    });
  } else {
    console.error("[midia-mcp] OTel disabled (OTEL_EXPORTER_OTLP_ENDPOINT not set)");
  }

  // Auth middleware
  app.use(
    authMiddleware({
      tokenEntries,
      publicPaths: new Set(["/health"]),
    }),
  );

  console.error(`[midia-mcp] Auth enabled with ${tokenEntries.length} token(s):`);
  for (const entry of tokenEntries) {
    console.error(`  - ${entry.name} (${entry.role})`);
  }

  logEnabledServices();

  // Track active transports
  const transports = new Map<string, SSEServerTransport>();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", name: "midia-mcp", version: "2.0.0" });
  });

  app.get("/sse", async (req, res) => {
    const tokenEntry = req.tokenEntry!;
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

    // Create a guarded server for this session (RBAC + audit)
    const transport = new SSEServerTransport("/messages", res);

    const context: SessionContext = {
      tokenEntry,
      ip,
      sessionId: transport.sessionId,
    };

    const server = createGuardedServer(() => {
      const s = createBaseServer();
      registerAllTools(s);
      return s;
    }, context);

    transports.set(transport.sessionId, transport);

    emitAuditLog({
      userName: tokenEntry.name,
      role: tokenEntry.role,
      tool: "session.connect",
      permission: "read",
      granted: true,
      status: "success",
      ip,
      sessionId: transport.sessionId,
    });

    console.error(`[midia-mcp] Session ${transport.sessionId} opened by ${tokenEntry.name} (${tokenEntry.role}) from ${ip}`);

    res.on("close", () => {
      transports.delete(transport.sessionId);
      console.error(`[midia-mcp] Session ${transport.sessionId} closed (${tokenEntry.name})`);
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

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.listen(port, "0.0.0.0", () => {
    console.error(`[midia-mcp] SSE server listening on http://0.0.0.0:${port}`);
  });

  // Graceful shutdown
  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.on(sig, async () => {
      console.error(`[midia-mcp] ${sig} received, shutting down...`);
      await shutdownOtelLogger();
      process.exit(0);
    });
  }
}

// ─── Entrypoint ──────────────────────────────────────────────────

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
