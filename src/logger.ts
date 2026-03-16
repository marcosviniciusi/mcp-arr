/**
 * OpenTelemetry Log-only setup for SigNoz.
 * Sends structured logs via OTLP HTTP exporter.
 */
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

let loggerProvider: LoggerProvider | null = null;

export interface OtelConfig {
  serviceName: string;
  serviceVersion: string;
  otlpEndpoint: string;
}

export function initOtelLogger(config: OtelConfig): void {
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
  userName: string;
  role: string;
  tool: string;
  permission: string;
  granted: boolean;
  status: "success" | "error" | "denied";
  durationMs?: number;
  error?: string;
  ip?: string;
  sessionId?: string;
}

export function emitAuditLog(entry: AuditLogEntry): void {
  const logger = logs.getLogger("midia-mcp-audit");

  const severity = entry.granted
    ? SeverityNumber.INFO
    : SeverityNumber.WARN;

  const body = entry.granted
    ? `${entry.userName} (${entry.role}) → ${entry.tool} [${entry.status}]`
    : `${entry.userName} (${entry.role}) → ${entry.tool} [DENIED - requires ${entry.permission}]`;

  logger.emit({
    severityNumber: severity,
    severityText: entry.granted ? "INFO" : "WARN",
    body,
    attributes: {
      "audit.user_name": entry.userName,
      "audit.role": entry.role,
      "audit.tool": entry.tool,
      "audit.permission": entry.permission,
      "audit.granted": entry.granted,
      "audit.status": entry.status,
      ...(entry.durationMs !== undefined && { "audit.duration_ms": entry.durationMs }),
      ...(entry.error && { "audit.error": entry.error }),
      ...(entry.ip && { "audit.ip": entry.ip }),
      ...(entry.sessionId && { "audit.session_id": entry.sessionId }),
    },
  });
}
