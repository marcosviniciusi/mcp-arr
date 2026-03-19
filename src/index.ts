#!/usr/bin/env node
import { readFileSync } from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import * as yaml from "js-yaml";
import { authMiddleware } from "./auth.js";
import { validateTokenEntries, getJellyseerrAuthLevel, getAuthLevel } from "./rbac.js";
import type { TokenEntry } from "./rbac.js";
import { createGuardedServer, type SessionContext } from "./server-wrapper.js";
import { initOtelLogger, shutdownOtelLogger, emitAuditLog, hashToken } from "./logger.js";
import { resolveServiceType } from "./action-map.js";
import { ArrClient } from "./clients/arr-client.js";
import { QBittorrentClient } from "./clients/qbittorrent-client.js";
import { NZBGetClient } from "./clients/nzbget-client.js";
import { EmbyClient } from "./clients/emby-client.js";
import { JellyfinClient } from "./clients/jellyfin-client.js";
import { BazarrClient } from "./clients/bazarr-client.js";
import { AutobrrClient } from "./clients/autobrr-client.js";
import {
  createJellyseerrClients,
  type JellyseerrClient,
  type JellyseerrConfig,
} from "./clients/jellyseerr-client.js";
import { TmdbClient } from "./clients/tmdb-client.js";
import { TvdbClient } from "./clients/tvdb-client.js";
import { OmdbClient } from "./clients/omdb-client.js";
import { MalClient } from "./clients/mal-client.js";
import { RyotClient, createRyotClients, type RyotConfig } from "./clients/ryot-client.js";
import {
  createSeerrClients,
  type SeerrClient,
  type SeerrConfig,
} from "./clients/seerr-client.js";
import { registerSonarrTools } from "./tools/sonarr.js";
import { registerRadarrTools } from "./tools/radarr.js";
import { registerProwlarrTools } from "./tools/prowlarr.js";
import { registerQBittorrentTools } from "./tools/qbittorrent.js";
import { registerNZBGetTools } from "./tools/nzbget.js";
import { registerEmbyTools } from "./tools/emby.js";
import { registerJellyfinTools } from "./tools/jellyfin.js";
import { registerJellyseerrTools } from "./tools/jellyseerr.js";
import { registerBazarrTools } from "./tools/bazarr.js";
import { registerLidarrTools } from "./tools/lidarr.js";
import { registerWhisparrTools } from "./tools/whisparr.js";
import { registerAutobrrTools } from "./tools/autobrr.js";
import { registerTmdbTools } from "./tools/tmdb.js";
import { registerMalTools } from "./tools/mal.js";
import { registerRyotTools } from "./tools/ryot.js";
import { registerSeerrTools } from "./tools/seerr.js";
import { registerOmdbTools } from "./tools/omdb.js";
import { registerTvdbTools } from "./tools/tvdb.js";

const VERSION = "3.1.0";

// ─── Config types ────────────────────────────────────────────────

interface ServiceConfig {
  url: string;
  api_key?: string;
  username?: string;
  password?: string;
  users?: Record<string, { email: string; password: string }>;
  /** TMDB: read access token (v4) */
  api_token?: string;
  /** MAL: client ID */
  client_id?: string;
  /** MAL: OAuth2 access token for user operations */
  access_token?: string;
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

// ─── Seerr client registry (per auth_level) ─────────────────────

let seerrClients: Map<string, SeerrClient> | null = null;

function getSeerrClient(authLevel: string): SeerrClient {
  if (!seerrClients) throw new Error("Seerr not configured");
  const client = seerrClients.get(authLevel);
  if (!client) {
    return seerrClients.get("admin") ?? seerrClients.values().next().value!;
  }
  return client;
}

// ─── Ryot client registry (per auth_level) ──────────────────────

let ryotClients: Map<string, RyotClient> | null = null;

function getRyotClient(authLevel: string): RyotClient {
  if (!ryotClients) throw new Error("Ryot not configured");
  const client = ryotClients.get(authLevel);
  if (!client) {
    return ryotClients.get("admin") ?? ryotClients.values().next().value!;
  }
  return client;
}

// ─── Emby user resolution ────────────────────────────────────────

let embyUserName: string | undefined;

// ─── Register tools ──────────────────────────────────────────────

function registerAllTools(
  server: McpServer,
  services: Record<string, ServiceConfig>,
  jellyseerrAuthLevel?: string,
  seerrAuthLevel?: string,
  ryotAuthLevel?: string,
): void {
  for (const [key, svc] of Object.entries(services)) {
    if (!svc) continue;
    const serviceType = resolveServiceType(key);

    switch (serviceType) {
      // ── *arr services (multi-instance aware) ──
      case "sonarr":
        if (svc.url && svc.api_key) {
          registerSonarrTools(server, new ArrClient(svc.url, svc.api_key), key);
        }
        break;

      case "radarr":
        if (svc.url && svc.api_key) {
          registerRadarrTools(server, new ArrClient(svc.url, svc.api_key), key);
        }
        break;

      case "prowlarr":
        if (svc.url && svc.api_key) {
          registerProwlarrTools(server, new ArrClient(svc.url, svc.api_key));
        }
        break;

      case "lidarr":
        if (svc.url && svc.api_key) {
          registerLidarrTools(server, new ArrClient(svc.url, svc.api_key), key);
        }
        break;

      case "whisparr":
        if (svc.url && svc.api_key) {
          registerWhisparrTools(server, new ArrClient(svc.url, svc.api_key), key);
        }
        break;

      // ── Bazarr (multi-instance aware) ──
      case "bazarr":
        if (svc.url && svc.api_key) {
          registerBazarrTools(server, new BazarrClient(svc.url, svc.api_key), key);
        }
        break;

      // ── Autobrr ──
      case "autobrr":
        if (svc.url && (svc.api_token || svc.api_key)) {
          registerAutobrrTools(server, new AutobrrClient(svc.url, svc.api_token || svc.api_key!), key);
        }
        break;

      // ── Download clients ──
      case "qbittorrent":
        if (svc.url && svc.username && svc.password) {
          registerQBittorrentTools(server, new QBittorrentClient(svc.url, svc.username, svc.password));
        }
        break;

      case "nzbget":
        if (svc.url && svc.username && svc.password) {
          registerNZBGetTools(server, new NZBGetClient(svc.url, svc.username, svc.password));
        }
        break;

      // ── Media servers ──
      case "emby":
        if (svc.url && svc.api_key) {
          registerEmbyTools(server, new EmbyClient(svc.url, svc.api_key));
        }
        break;

      case "jellyfin":
        if (svc.url && svc.api_key) {
          registerJellyfinTools(server, new JellyfinClient(svc.url, svc.api_key), key);
        }
        break;

      // ── Request managers ──
      case "jellyseerr":
        if (svc.url && jellyseerrClients) {
          const level = jellyseerrAuthLevel || "admin";
          registerJellyseerrTools(server, () => getJellyseerrClient(level));
        }
        break;

      case "seerr":
        if (svc.url && seerrClients) {
          const level = seerrAuthLevel || "admin";
          registerSeerrTools(server, () => getSeerrClient(level));
        }
        break;

      // ── External APIs ──
      case "tmdb":
        if (svc.api_key) {
          const url = svc.url || "https://api.themoviedb.org/3";
          registerTmdbTools(server, new TmdbClient(url, svc.api_key));
        }
        break;

      case "omdb":
        if (svc.api_key) {
          registerOmdbTools(server, new OmdbClient(svc.api_key));
        }
        break;

      case "mal":
        if (svc.client_id) {
          registerMalTools(server, new MalClient(svc.client_id, svc.access_token));
        }
        break;

      case "ryot":
        if (svc.url && ryotClients) {
          const level = ryotAuthLevel || "admin";
          registerRyotTools(server, () => getRyotClient(level));
        }
        break;

      case "tvdb":
        if (svc.api_key) {
          registerTvdbTools(server, new TvdbClient(svc.api_key));
        }
        break;
    }
  }
}

function logEnabledServices(services: Record<string, ServiceConfig>): void {
  let any = false;
  for (const [name, svc] of Object.entries(services)) {
    if (svc.url || svc.client_id || svc.api_key) {
      const endpoint = svc.url || "(external API)";
      console.error(`[midia-mcp] ${name} enabled: ${endpoint}`);
      any = true;
    }
  }
  if (!any) console.error("[midia-mcp] WARNING: No services configured.");
}

// ─── Init service clients ────────────────────────────────────────

function initServiceClients(services: Record<string, ServiceConfig>): void {
  if (services.jellyseerr?.url) {
    jellyseerrClients = createJellyseerrClients(services.jellyseerr as JellyseerrConfig);
  }
  if (services.seerr?.url) {
    seerrClients = createSeerrClients(services.seerr as SeerrConfig);
  }
  if (services.ryot?.url) {
    ryotClients = createRyotClients(services.ryot as RyotConfig);
  }
}

// ─── Init OTel ───────────────────────────────────────────────────

function initOtel(config: AppConfig): void {
  if (config.otel?.enabled) {
    initOtelLogger({
      enabled: true,
      serviceName: config.otel.service_name ?? "midia-mcp",
      serviceVersion: VERSION,
      otlpEndpoint: config.otel.endpoint ?? "http://localhost:4318",
    });
  }
}

// ─── Stdio mode ──────────────────────────────────────────────────

async function startStdio(config: AppConfig) {
  const services = config.services ?? {};
  const server = new McpServer({ name: "midia-mcp", version: VERSION });

  initServiceClients(services);
  registerAllTools(server, services, "admin", "admin", "admin");
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

  initOtel(config);
  initServiceClients(services);

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
    res.json({ status: "ok", name: "midia-mcp", version: VERSION });
  });

  app.get("/sse", async (req, res) => {
    const tokenEntry = req.tokenEntry!;
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const transport = new SSEServerTransport("/messages", res);
    const jellyseerrLevel = getJellyseerrAuthLevel(tokenEntry);
    const seerrLevel = getAuthLevel(tokenEntry, "seerr");
    const ryotLevel = getAuthLevel(tokenEntry, "ryot");

    const context: SessionContext = {
      tokenEntry,
      ip,
      sessionId: transport.sessionId,
    };

    const server = createGuardedServer(() => {
      const s = new McpServer({ name: "midia-mcp", version: VERSION });
      registerAllTools(s, services, jellyseerrLevel, seerrLevel, ryotLevel);
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

  setupShutdown();
}

// ─── Streamable-HTTP mode ────────────────────────────────────────

async function startStreamableHTTP(config: AppConfig) {
  const port = config.port ?? 3000;
  const host = config.host ?? "0.0.0.0";
  const services = config.services ?? {};
  const app = express();

  // Validate auth tokens
  const tokenEntries = config.auth_tokens ?? [];
  if (tokenEntries.length === 0) {
    console.error(
      "[midia-mcp] FATAL: auth_tokens is required in streamable-http mode.\n" +
        "  Configure auth_tokens in your config.yaml file.",
    );
    process.exit(1);
  }
  validateTokenEntries(tokenEntries);

  initOtel(config);
  initServiceClients(services);

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

  // Session tracking
  const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", name: "midia-mcp", version: VERSION, transport: "streamable-http" });
  });

  // Streamable HTTP endpoint
  app.post("/mcp", async (req, res) => {
    const tokenEntry = req.tokenEntry!;
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // Existing session
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
      return;
    }

    // New session
    const jellyseerrLevel = getJellyseerrAuthLevel(tokenEntry);
    const seerrLevel = getAuthLevel(tokenEntry, "seerr");
    const ryotLevel = getAuthLevel(tokenEntry, "ryot");

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => `sh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      onsessioninitialized: (sid) => {
        sessions.set(sid, { server, transport });
        emitAuditLog({
          tokenDescription: tokenEntry.description,
          tokenHash: hashToken(tokenEntry.token),
          app: "session",
          action: "connect",
          tool: "session.connect",
          granted: true,
          status: "success",
          ip,
          sessionId: sid,
        });
        console.error(
          `[midia-mcp] Streamable-HTTP session ${sid} opened by "${tokenEntry.description}" from ${ip}`,
        );
      },
    });

    transport.onclose = () => {
      const sid = (transport as unknown as { sessionId?: string }).sessionId;
      if (sid) {
        sessions.delete(sid);
        console.error(`[midia-mcp] Streamable-HTTP session ${sid} closed`);
      }
    };

    const context: SessionContext = {
      tokenEntry,
      ip,
    };

    const server = createGuardedServer(() => {
      const s = new McpServer({ name: "midia-mcp", version: VERSION });
      registerAllTools(s, services, jellyseerrLevel, seerrLevel, ryotLevel);
      return s;
    }, context);

    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  // Handle GET and DELETE for session management
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
      return;
    }
    res.status(400).json({ error: "Missing or invalid session ID" });
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
      sessions.delete(sessionId);
      return;
    }
    res.status(400).json({ error: "Missing or invalid session ID" });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.listen(port, host, () => {
    console.error(`[midia-mcp] Streamable-HTTP server listening on http://${host}:${port}`);
  });

  setupShutdown();
}

// ─── Graceful shutdown ───────────────────────────────────────────

function setupShutdown(): void {
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
const mode = process.env.TRANSPORT ?? config.transport ?? "stdio";

if (mode === "sse") {
  startSSE(config).catch((err) => {
    console.error("[midia-mcp] Fatal error:", err);
    process.exit(1);
  });
} else if (mode === "streamable-http" || mode === "streamable_http") {
  startStreamableHTTP(config).catch((err) => {
    console.error("[midia-mcp] Fatal error:", err);
    process.exit(1);
  });
} else {
  startStdio(config).catch((err) => {
    console.error("[midia-mcp] Fatal error:", err);
    process.exit(1);
  });
}
