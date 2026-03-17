# Audit Logging

## Overview

midia-mcp emits structured audit logs for every tool call, tracking who did what, on which app, and whether it succeeded or was denied. Logs are sent via OpenTelemetry to an OTLP collector (e.g., SigNoz).

## Enabling Audit Logging

### In config.yaml

```yaml
otel:
  enabled: true
  endpoint: "http://otel-collector.observability.svc:4318"
  service_name: "midia-mcp"
```

If `otel.enabled` is `false` or the config is missing, audit logging still works via stdout — it just won't be exported to the collector.

## Log Structure

### Resource Attributes

| Attribute | Value |
|---|---|
| `service.name` | Value from `otel.service_name` |
| `service.version` | Application version (e.g., `2.0.0`) |

### Log Attributes

| Attribute | Type | Description |
|---|---|---|
| `audit.token_description` | string | Human-readable token name |
| `audit.token_hash` | string | Truncated SHA256 hash (12 chars) |
| `audit.app` | string | Target app (sonarr, jellyseerr, etc.) |
| `audit.action` | string | Action within the app |
| `audit.tool` | string | Full MCP tool name |
| `audit.granted` | boolean | Whether access was allowed |
| `audit.status` | string | `success`, `error`, or `denied` |
| `audit.duration_ms` | number | Execution time (only for granted calls) |
| `audit.error` | string | Error message (only on failures) |
| `audit.ip` | string | Client IP address |
| `audit.session_id` | string | MCP session identifier |

## Log Examples

### Successful operation
```
INFO: Platform Admin → radarr.add_movie [success]
  audit.token_hash: "a1b2c3d4e5f6"
  audit.app: "radarr"
  audit.action: "add_movie"
  audit.duration_ms: 142
```

### Denied access
```
WARN: Regular User → sonarr.delete_series [DENIED]
  audit.token_hash: "f6e5d4c3b2a1"
  audit.app: "sonarr"
  audit.action: "delete_series"
  audit.granted: false
```

### Execution error
```
WARN: Platform Admin → qbittorrent.add_torrent [error]
  audit.token_hash: "a1b2c3d4e5f6"
  audit.error: "Connection refused"
  audit.duration_ms: 3012
```

## Security

The real token **never appears in logs**. Only a truncated SHA256 hash (12 characters) is recorded, sufficient for correlation but not for token recovery.

## SigNoz Integration

### Querying Logs

In SigNoz Logs Explorer:

- **All actions by a user**: `audit.token_description = "Power User"`
- **Denied attempts**: `audit.status = "denied"`
- **Usage per app**: Group by `audit.app`
- **Slow operations**: `audit.duration_ms > 5000`
- **Errors**: `audit.status = "error"`

### Example OTel Collector Config

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: "0.0.0.0:4318"

exporters:
  clickhouselogsexporter:
    dsn: tcp://clickhouse:9000/
    timeout: 10s

service:
  pipelines:
    logs:
      receivers: [otlp]
      exporters: [clickhouselogsexporter]
```
