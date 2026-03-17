/**
 * OpenTelemetry Log-only setup for SigNoz.
 * Sends structured audit logs via OTLP HTTP exporter.
 */
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

let loggerProvider: LoggerProvider | null = null;

export interface OtelConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  otlpEndpoint: string;
}

export function initOtelLogger(config: OtelConfig): void {
  if (!config.enabled || !config.otlpEndpoint) {
    console.error("[midia-mcp] OTel disabled");
    return;
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion,
  });

  const exporter = new OTLPLogExporter({
    url: `${config.otlpEndpoint.replace(/\/+$/, "")}/v1/logs`,
  });

  loggerProvider = new LoggerProvider({
    resource,
    processors: [new SimpleLogRecordProcessor(exporter)],
  });

  logs.setGlobalLoggerProvider(loggerProvider);
  console.error(`[midia-mcp] OTel logs enabled → ${config.otlpEndpoint}`);
}

export async function shutdownOtelLogger(): Promise<void> {
  if (loggerProvider) {
    await loggerProvider.shutdown();
  }
}

export interface AuditLogEntry {
  /** Token description (never the token itself) */
  tokenDescription: string;
  /** Truncated SHA256 hash of the token */
  tokenHash: string;
  /** App being accessed */
  app: string;
  /** Action being performed */
  action: string;
  /** Full tool name */
  tool: string;
  /** Whether access was granted */
  granted: boolean;
  /** Execution result */
  status: "success" | "error" | "denied";
  /** Duration in ms */
  durationMs?: number;
  /** Error message if failed */
  error?: string;
  /** Client IP */
  ip?: string;
  /** MCP session ID */
  sessionId?: string;
}

/**
 * Create a truncated SHA256 hash of a token (12 chars).
 * The real token never appears in logs.
 */
export function hashToken(token: string): string {
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

export function emitAuditLog(entry: AuditLogEntry): void {
  const logger = logs.getLogger("midia-mcp-audit");

  const severity = entry.granted ? SeverityNumber.INFO : SeverityNumber.WARN;

  const body = entry.granted
    ? `${entry.tokenDescription} → ${entry.app}.${entry.action} [${entry.status}]`
    : `${entry.tokenDescription} → ${entry.app}.${entry.action} [DENIED]`;

  logger.emit({
    severityNumber: severity,
    severityText: entry.granted ? "INFO" : "WARN",
    body,
    attributes: {
      "audit.token_description": entry.tokenDescription,
      "audit.token_hash": entry.tokenHash,
      "audit.app": entry.app,
      "audit.action": entry.action,
      "audit.tool": entry.tool,
      "audit.granted": entry.granted,
      "audit.status": entry.status,
      ...(entry.durationMs !== undefined && { "audit.duration_ms": entry.durationMs }),
      ...(entry.error && { "audit.error": entry.error }),
      ...(entry.ip && { "audit.ip": entry.ip }),
      ...(entry.sessionId && { "audit.session_id": entry.sessionId }),
    },
  });
}
