#!/usr/bin/env node
import { readFileSync } from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import * as yaml from "js-yaml";
import { authMiddleware } from "./auth.js";
import { validateTokenEntries, getJellyseerrAuthLevel } from "./rbac.js";
import type { TokenEntry } from "./rbac.js";
import { createGuardedServer, type SessionContext } from "./server-wrapper.js";
import { initOtelLogger, shutdownOtelLogger, emitAuditLog, hashToken } from "./logger.js";
import { ArrClient } from "./clients/arr-client.js";
import { QBittorrentClient } from "./clients/qbittorrent-client.js";
import { NZBGetClient } from "./clients/nzbget-client.js";
import { EmbyClient } from "./clients/emby-client.js";
import {
  createJellyseerrClients,
  type JellyseerrClient,
  type JellyseerrConfig,
} from "./clients/jellyseerr-client.js";
import { registerSonarrTools } from "./tools/sonarr.js";
import { registerRadarrTools } from "./tools/radarr.js";
import { registerProwlarrTools } from "./tools/prowlarr.js";
import { registerQBittorrentTools } from "./tools/qbittorrent.js";
import { registerNZBGetTools } from "./tools/nzbget.js";
import { registerEmbyTools } from "./tools/emby.js";
import { registerJellyseerrTools } from "./tools/jellyseerr.js";

// ─── Config types ────────────────────────────────────────────────

interface ServiceConfig {
  url: string;
  api_key?: string;
  username?: string;
  password?: string;
  users?: Record<string, { email: string; password: string }>;
}

interface OtelYamlConfig {
  enabled?: boolean;
  endpoint?: string;
  service_name?: string;
}

interface AppConfig {
  transport?: string;
  host?: string;
  port?: number;
  otel?: OtelYamlConfig;
  services?: Record<string, ServiceConfig>;
  auth_tokens?: TokenEntry[];
}

// ─── Load config ─────────────────────────────────────────────────

function loadConfig(): AppConfig {
  const configPath = process.env.MIDIA_MCP_CONFIG || "/etc/midia-mcp/config.yaml";

  try {
    const raw = readFileSync(configPath, "utf-8");
    return yaml.load(raw) as AppConfig;
  } catch (err) {
    console.error(`[midia-mcp] WARNING: Could not load ${configPath}: ${err}`);
    console.error("[midia-mcp] Falling back to empty config");
    return {};
  }
}

// ─── Jellyseerr client registry (per auth_level) ────────────────

let jellyseerrClients: Map<string, JellyseerrClient> | null = null;

function getJellyseerrClient(authLevel: string): JellyseerrClient {
  if (!jellyseerrClients) throw new Error("Jellyseerr not configured");
  const client = jellyseerrClients.get(authLevel);
  if (!client) {
    // Fallback: try admin, then first available
    return jellyseerrClients.get("admin") ?? jellyseerrClients.values().next().value!;
  }
  return client;
}

// ─── Register tools ──────────────────────────────────────────────

function registerAllTools(
  server: McpServer,
  services: Record<string, ServiceConfig>,
  jellyseerrAuthLevel?: string,
): void {
  if (services.sonarr?.url && services.sonarr.api_key) {
    registerSonarrTools(server, new ArrClient(services.sonarr.url, services.sonarr.api_key));
  }
  if (services.radarr?.url && services.radarr.api_key) {
    registerRadarrTools(server, new ArrClient(services.radarr.url, services.radarr.api_key));
  }
  if (services.prowlarr?.url && services.prowlarr.api_key) {
    registerProwlarrTools(server, new ArrClient(services.prowlarr.url, services.prowlarr.api_key));
  }
  if (services.qbittorrent?.url && services.qbittorrent.username && services.qbittorrent.password) {
    registerQBittorrentTools(
      server,
      new QBittorrentClient(services.qbittorrent.url, services.qbittorrent.username, services.qbittorrent.password),
    );
  }
  if (services.nzbget?.url && services.nzbget.username && services.nzbget.password) {
    registerNZBGetTools(
      server,
      new NZBGetClient(services.nzbget.url, services.nzbget.username, services.nzbget.password),
    );
  }
  if (services.emby?.url && services.emby.api_key) {
    registerEmbyTools(server, new EmbyClient(services.emby.url, services.emby.api_key));
  }
  if (services.jellyseerr?.url && jellyseerrClients) {
    const level = jellyseerrAuthLevel || "admin";
    registerJellyseerrTools(server, () => getJellyseerrClient(level));
  }
}

function logEnabledServices(services: Record<string, ServiceConfig>): void {
  let any = false;
  for (const [name, svc] of Object.entries(services)) {
    if (svc.url) {
      console.error(`[midia-mcp] ${name} enabled: ${svc.url}`);
      any = true;
    }
  }
  if (!any) console.error("[midia-mcp] WARNING: No services configured.");
}

// ─── Stdio mode ──────────────────────────────────────────────────

async function startStdio(config: AppConfig) {
  const services = config.services ?? {};
  const server = new McpServer({ name: "midia-mcp", version: "2.0.0" });

  // Init Jellyseerr clients if configured
  if (services.jellyseerr?.url) {
    jellyseerrClients = createJellyseerrClients(services.jellyseerr as JellyseerrConfig);
  }

  registerAllTools(server, services, "admin");
  logEnabledServices(services);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[midia-mcp] Server started on stdio");
}

// ─── SSE mode ────────────────────────────────────────────────────

async function startSSE(config: AppConfig) {
  const port = config.port ?? 3000;
  const host = config.host ?? "0.0.0.0";
  const services = config.services ?? {};
  const app = express();

  // Validate auth tokens
  const tokenEntries = config.auth_tokens ?? [];
  if (tokenEntries.length === 0) {
    console.error(
      "[midia-mcp] FATAL: auth_tokens is required in SSE mode.\n" +
        "  Configure auth_tokens in your config.yaml file.",
    );
    process.exit(1);
  }
  validateTokenEntries(tokenEntries);

  // Init OTel
  if (config.otel?.enabled) {
    initOtelLogger({
      enabled: true,
      serviceName: config.otel.service_name ?? "midia-mcp",
      serviceVersion: "2.0.0",
      otlpEndpoint: config.otel.endpoint ?? "http://localhost:4318",
    });
  }

  // Init Jellyseerr clients
  if (services.jellyseerr?.url) {
    jellyseerrClients = createJellyseerrClients(services.jellyseerr as JellyseerrConfig);
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
    const apps = Object.keys(entry.permissions).join(", ");
    console.error(`  - ${entry.description} [${apps}]`);
  }

  logEnabledServices(services);

  const transports = new Map<string, SSEServerTransport>();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", name: "midia-mcp", version: "2.0.0" });
  });

  app.get("/sse", async (req, res) => {
    const tokenEntry = req.tokenEntry!;
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const transport = new SSEServerTransport("/messages", res);
    const jellyseerrLevel = getJellyseerrAuthLevel(tokenEntry);

    const context: SessionContext = {
      tokenEntry,
      ip,
      sessionId: transport.sessionId,
    };

    const server = createGuardedServer(() => {
      const s = new McpServer({ name: "midia-mcp", version: "2.0.0" });
      registerAllTools(s, services, jellyseerrLevel);
      return s;
    }, context);

    transports.set(transport.sessionId, transport);

    emitAuditLog({
      tokenDescription: tokenEntry.description,
      tokenHash: hashToken(tokenEntry.token),
      app: "session",
      action: "connect",
      tool: "session.connect",
      granted: true,
      status: "success",
      ip,
      sessionId: transport.sessionId,
    });

    console.error(
      `[midia-mcp] Session ${transport.sessionId} opened by "${tokenEntry.description}" from ${ip}`,
    );

    res.on("close", () => {
      transports.delete(transport.sessionId);
      console.error(`[midia-mcp] Session ${transport.sessionId} closed`);
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

  app.listen(port, host, () => {
    console.error(`[midia-mcp] SSE server listening on http://${host}:${port}`);
  });

  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.on(sig, async () => {
      console.error(`[midia-mcp] ${sig} received, shutting down...`);
      await shutdownOtelLogger();
      process.exit(0);
    });
  }
}

// ─── Entrypoint ──────────────────────────────────────────────────

const config = loadConfig();
const mode = config.transport ?? process.env.TRANSPORT ?? "stdio";

if (mode === "sse") {
  startSSE(config).catch((err) => {
    console.error("[midia-mcp] Fatal error:", err);
    process.exit(1);
  });
} else {
  startStdio(config).catch((err) => {
    console.error("[midia-mcp] Fatal error:", err);
    process.exit(1);
  });
}
