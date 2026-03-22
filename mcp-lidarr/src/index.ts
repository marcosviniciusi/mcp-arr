#!/usr/bin/env node
import { readFileSync } from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import * as yaml from "js-yaml";
import { authMiddleware } from "./auth.js";
import { validateTokenEntries } from "./rbac.js";
import type { TokenEntry } from "./rbac.js";
import { createGuardedServer, type SessionContext } from "./server-wrapper.js";
import { initOtelLogger, shutdownOtelLogger, emitAuditLog, hashToken } from "./logger.js";
import { resolveServiceType } from "./action-map.js";
import { ArrClient } from "./clients/arr-client.js";
import { registerLidarrTools } from "./tools/lidarr.js";

const VERSION = "4.3.1";

// Track clients for deep health checks
const healthClients: { name: string; check: () => Promise<boolean> }[] = [];

interface ServiceConfig {
  url: string;
  api_key?: string;
  default_quality_profile_id?: number;
  default_root_folder?: string;
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

function loadConfig(): AppConfig {
  const configPath = process.env.MIDIA_MCP_CONFIG || "/etc/midia-mcp/config.yaml";
  try {
    const raw = readFileSync(configPath, "utf-8");
    return yaml.load(raw) as AppConfig;
  } catch (err) {
    console.error(`[mcp-lidarr] WARNING: Could not load ${configPath}: ${err}`);
    console.error("[mcp-lidarr] Falling back to empty config");
    return {};
  }
}

// Shared client map — created once, reused across sessions and health checks
const sharedClients = new Map<string, ArrClient>();

function initClients(services: Record<string, ServiceConfig>): void {
  for (const [key, svc] of Object.entries(services)) {
    if (!svc) continue;
    const serviceType = resolveServiceType(key);
    if (serviceType === "lidarr" && svc.url && svc.api_key) {
      const client = new ArrClient(svc.url, svc.api_key);
      sharedClients.set(key, client);
      healthClients.push({
        name: key,
        check: async () => {
          try { await client.get("/api/v1/system/status"); return true; } catch { return false; }
        },
      });
    }
  }
}

function registerAllTools(
  server: McpServer,
  services: Record<string, ServiceConfig>,
): void {
  for (const [key, svc] of Object.entries(services)) {
    if (!svc) continue;
    const client = sharedClients.get(key);
    if (client) {
      registerLidarrTools(server, client, key);
    }
  }
}

function logEnabledServices(services: Record<string, ServiceConfig>): void {
  let any = false;
  for (const [name, svc] of Object.entries(services)) {
    const serviceType = resolveServiceType(name);
    if (serviceType === "lidarr" && (svc.url || svc.api_key)) {
      console.error(`[mcp-lidarr] ${name} enabled: ${svc.url}`);
      any = true;
    }
  }
  if (!any) console.error("[mcp-lidarr] WARNING: No lidarr services configured.");
}

function initOtel(config: AppConfig): void {
  if (config.otel?.enabled) {
    initOtelLogger({
      enabled: true,
      serviceName: config.otel.service_name ?? "mcp-lidarr",
      serviceVersion: VERSION,
      otlpEndpoint: config.otel.endpoint ?? "http://localhost:4318",
    });
  }
}

async function startStdio(config: AppConfig) {
  const services = config.services ?? {};
  initClients(services);
  const server = new McpServer({ name: "mcp-lidarr", version: VERSION });
  registerAllTools(server, services);
  logEnabledServices(services);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp-lidarr] Server started on stdio");
}

async function startSSE(config: AppConfig) {
  const port = config.port ?? 3000;
  const host = config.host ?? "0.0.0.0";
  const services = config.services ?? {};
  initClients(services);
  const app = express();

  const tokenEntries = config.auth_tokens ?? [];
  if (tokenEntries.length === 0) {
    console.error("[mcp-lidarr] FATAL: auth_tokens is required in SSE mode.");
    process.exit(1);
  }
  validateTokenEntries(tokenEntries);
  initOtel(config);

  app.use(authMiddleware({ tokenEntries, publicPaths: new Set(["/health"]) }));

  console.error(`[mcp-lidarr] Auth enabled with ${tokenEntries.length} token(s)`);
  logEnabledServices(services);

  const transports = new Map<string, SSEServerTransport>();

  app.get("/health", async (_req, res) => {
    const checks = await Promise.all(
      healthClients.map(async (c) => ({ name: c.name, ok: await c.check() })),
    );
    const allOk = checks.every((c) => c.ok);
    const body = { status: allOk ? "ok" : "degraded", name: "mcp-lidarr", version: VERSION, services: Object.fromEntries(checks.map((c) => [c.name, c.ok ? "ok" : "down"])) };
    res.status(allOk ? 200 : 503).json(body);
  });

  app.get("/sse", async (req, res) => {
    const tokenEntry = req.tokenEntry!;
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const transport = new SSEServerTransport("/messages", res);

    const context: SessionContext = { tokenEntry, ip, sessionId: transport.sessionId };
    const server = createGuardedServer(() => {
      const s = new McpServer({ name: "mcp-lidarr", version: VERSION });
      registerAllTools(s, services);
      return s;
    }, context);

    transports.set(transport.sessionId, transport);
    emitAuditLog({
      tokenDescription: tokenEntry.description, tokenHash: hashToken(tokenEntry.token),
      app: "session", action: "connect", tool: "session.connect",
      granted: true, status: "success", ip, sessionId: transport.sessionId,
    });

    console.error(`[mcp-lidarr] Session ${transport.sessionId} opened by "${tokenEntry.description}" from ${ip}`);
    res.on("close", () => {
      transports.delete(transport.sessionId);
      console.error(`[mcp-lidarr] Session ${transport.sessionId} closed`);
    });
    await server.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    if (!transport) { res.status(404).json({ error: "Session not found" }); return; }
    await transport.handlePostMessage(req, res);
  });

  app.use((_req, res) => { res.status(404).json({ error: "Not found" }); });

  app.listen(port, host, () => {
    console.error(`[mcp-lidarr] SSE server listening on http://${host}:${port}`);
  });
  setupShutdown();
}

async function startStreamableHTTP(config: AppConfig) {
  const port = config.port ?? 3000;
  const host = config.host ?? "0.0.0.0";
  const services = config.services ?? {};
  initClients(services);
  const app = express();

  const tokenEntries = config.auth_tokens ?? [];
  if (tokenEntries.length === 0) {
    console.error("[mcp-lidarr] FATAL: auth_tokens is required in streamable-http mode.");
    process.exit(1);
  }
  validateTokenEntries(tokenEntries);
  initOtel(config);

  app.use(authMiddleware({ tokenEntries, publicPaths: new Set(["/health"]) }));

  console.error(`[mcp-lidarr] Auth enabled with ${tokenEntries.length} token(s)`);
  logEnabledServices(services);

  const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

  app.get("/health", async (_req, res) => {
    const checks = await Promise.all(
      healthClients.map(async (c) => ({ name: c.name, ok: await c.check() })),
    );
    const allOk = checks.every((c) => c.ok);
    const body = { status: allOk ? "ok" : "degraded", name: "mcp-lidarr", version: VERSION, services: Object.fromEntries(checks.map((c) => [c.name, c.ok ? "ok" : "down"])) };
    res.status(allOk ? 200 : 503).json(body);
  });

  app.post("/mcp", async (req, res) => {
    const tokenEntry = req.tokenEntry!;
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => `sh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      onsessioninitialized: (sid) => {
        sessions.set(sid, { server, transport });
        emitAuditLog({
          tokenDescription: tokenEntry.description, tokenHash: hashToken(tokenEntry.token),
          app: "session", action: "connect", tool: "session.connect",
          granted: true, status: "success", ip, sessionId: sid,
        });
        console.error(`[mcp-lidarr] Streamable-HTTP session ${sid} opened by "${tokenEntry.description}" from ${ip}`);
      },
    });

    transport.onclose = () => {
      const sid = (transport as unknown as { sessionId?: string }).sessionId;
      if (sid) { sessions.delete(sid); console.error(`[mcp-lidarr] Streamable-HTTP session ${sid} closed`); }
    };

    const context: SessionContext = { tokenEntry, ip };
    const server = createGuardedServer(() => {
      const s = new McpServer({ name: "mcp-lidarr", version: VERSION });
      registerAllTools(s, services);
      return s;
    }, context);

    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      await sessions.get(sessionId)!.transport.handleRequest(req, res);
      return;
    }
    res.status(400).json({ error: "Missing or invalid session ID" });
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      await sessions.get(sessionId)!.transport.handleRequest(req, res);
      sessions.delete(sessionId);
      return;
    }
    res.status(400).json({ error: "Missing or invalid session ID" });
  });

  app.use((_req, res) => { res.status(404).json({ error: "Not found" }); });

  const server_ = app.listen(port, host, () => {
    console.error(`[mcp-lidarr] Streamable-HTTP server listening on http://${host}:${port}`);
  });
  server_.timeout = 300_000;
  server_.keepAliveTimeout = 120_000;
  setupShutdown();
}

function setupShutdown(): void {
  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.on(sig, async () => {
      console.error(`[mcp-lidarr] ${sig} received, shutting down...`);
      await shutdownOtelLogger();
      process.exit(0);
    });
  }
}

const config = loadConfig();
const mode = process.env.TRANSPORT ?? config.transport ?? "stdio";

if (mode === "sse") {
  startSSE(config).catch((err) => { console.error("[mcp-lidarr] Fatal error:", err); process.exit(1); });
} else if (mode === "streamable-http" || mode === "streamable_http") {
  startStreamableHTTP(config).catch((err) => { console.error("[mcp-lidarr] Fatal error:", err); process.exit(1); });
} else {
  startStdio(config).catch((err) => { console.error("[mcp-lidarr] Fatal error:", err); process.exit(1); });
}
