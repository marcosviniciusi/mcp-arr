# midia-mcp

MCP (Model Context Protocol) server for managing your complete media stack:

- **Sonarr** - TV series management
- **Radarr** - Movie management
- **Prowlarr** - Indexer management & search
- **qBittorrent** - Torrent client
- **NZBGet** - Usenet download client
- **Emby** - Media server

Supports **stdio** (local) and **SSE** (remote/K8s) transports. Each service is optional.

## Setup

### Install & Build

```bash
npm install
npm run build
```

### Environment Variables

| Variable | Description |
|---|---|
| `TRANSPORT` | `stdio` (default) or `sse` |
| `PORT` | HTTP port for SSE mode (default: `3000`) |
| `AUTH_TOKENS_CONFIG` | **Required in SSE mode.** JSON array of token entries with RBAC roles |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTel collector endpoint for SigNoz (e.g. `http://signoz:4318`) |
| `OTEL_SERVICE_NAME` | Service name in OTel logs (default: `midia-mcp`) |
| `SONARR_URL` | Sonarr base URL (e.g. `http://localhost:8989`) |
| `SONARR_API_KEY` | Sonarr API key |
| `RADARR_URL` | Radarr base URL (e.g. `http://localhost:7878`) |
| `RADARR_API_KEY` | Radarr API key |
| `PROWLARR_URL` | Prowlarr base URL (e.g. `http://localhost:9696`) |
| `PROWLARR_API_KEY` | Prowlarr API key |
| `QBITTORRENT_URL` | qBittorrent Web UI URL (e.g. `http://localhost:8080`) |
| `QBITTORRENT_USERNAME` | qBittorrent username |
| `QBITTORRENT_PASSWORD` | qBittorrent password |
| `NZBGET_URL` | NZBGet URL (e.g. `http://localhost:6789`) |
| `NZBGET_USERNAME` | NZBGet username |
| `NZBGET_PASSWORD` | NZBGet password |
| `EMBY_URL` | Emby URL (e.g. `http://localhost:8096`) |
| `EMBY_API_KEY` | Emby API key |

## Usage

### Local (stdio) - Claude Desktop

```json
{
  "mcpServers": {
    "midia-mcp": {
      "command": "node",
      "args": ["/path/to/midia-mcp/dist/index.js"],
      "env": {
        "SONARR_URL": "http://localhost:8989",
        "SONARR_API_KEY": "your-key",
        "RADARR_URL": "http://localhost:7878",
        "RADARR_API_KEY": "your-key",
        "EMBY_URL": "http://localhost:8096",
        "EMBY_API_KEY": "your-key"
      }
    }
  }
}
```

### Remote (SSE) - Claude Desktop

```json
{
  "mcpServers": {
    "midia-mcp": {
      "url": "https://midia-mcp.your-domain.com/sse?token=your-secret-token"
    }
  }
}
```

## Authentication & RBAC

In SSE mode, authentication and role-based access control are **mandatory**. The server refuses to start without `AUTH_TOKENS_CONFIG`.

### Token Configuration

Set `AUTH_TOKENS_CONFIG` as a JSON array:

```json
[
  {"token": "abc123...", "name": "marcos",  "role": "admin"},
  {"token": "def456...", "name": "familia", "role": "manager"},
  {"token": "ghi789...", "name": "guest",   "role": "viewer"}
]
```

Generate tokens with: `openssl rand -hex 32`

### Roles & Permissions

Each tool is automatically classified by its permission level based on its name:

| Role | `read` | `write` | `delete` | Description |
|---|---|---|---|---|
| **admin** | yes | yes | yes | Full access to all tools |
| **manager** | yes | yes | no | Can add/modify content, cannot delete |
| **viewer** | yes | no | no | Read-only access (list, search, status) |

**Permission mapping:**

| Permission | Tool patterns | Examples |
|---|---|---|
| `read` | get, list, search, status, calendar, queue | `sonarr_get_series`, `emby_search`, `qbt_get_torrents` |
| `write` | add, create, set, pause, resume, refresh, test | `radarr_add_movie`, `qbt_pause_torrents`, `emby_refresh_library` |
| `delete` | delete, remove | `sonarr_delete_series`, `qbt_delete_torrents` |

If a viewer tries to call `radarr_add_movie`, they get:
```
Access denied. Your role "viewer" does not have "write" permission required for "radarr_add_movie".
```

### Token via header or query param

```bash
# Header (programmatic)
curl -H "Authorization: Bearer your-token" https://midia-mcp.example.com/sse

# Query param (SSE/EventSource — can't set headers)
https://midia-mcp.example.com/sse?token=your-token
```

### Security

- Timing-safe token comparison (prevents timing attacks)
- Rate limiting: 10 failed auth attempts per minute per IP → 429
- All endpoints protected except `/health`
- Catch-all 404 for undefined routes

## Observability (OpenTelemetry → SigNoz)

Every tool call is logged via OTel with structured audit data, sent to SigNoz.

### Setup

Set these environment variables to enable:

| Variable | Description |
|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP HTTP endpoint (e.g. `http://signoz-otel-collector:4318`) |
| `OTEL_SERVICE_NAME` | Service name in logs (default: `midia-mcp`) |

If `OTEL_EXPORTER_OTLP_ENDPOINT` is not set, OTel is disabled (server still works, just no log export).

### What gets logged

Every tool call emits a structured log with:

| Attribute | Example |
|---|---|
| `audit.user_name` | `marcos` |
| `audit.role` | `admin` |
| `audit.tool` | `radarr_add_movie` |
| `audit.permission` | `write` |
| `audit.granted` | `true` |
| `audit.status` | `success` / `error` / `denied` |
| `audit.duration_ms` | `142` |
| `audit.ip` | `10.0.1.5` |
| `audit.session_id` | `abc-123-...` |
| `audit.error` | (only on failures) |

Session connect/disconnect events are also logged.

### Example log body

```
marcos (admin) → radarr_add_movie [success]
guest (viewer) → sonarr_delete_series [DENIED - requires delete]
```

### SigNoz Dashboard

In SigNoz, you can query these logs with:
- Filter by `audit.user_name` to see all actions by a user
- Filter by `audit.status = denied` to find unauthorized attempts
- Filter by `audit.tool` to see usage per tool
- Group by `audit.role` to compare usage patterns

## Kubernetes Deployment

The project includes Kustomize manifests for deploying to K8s.

### Structure

```
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── namespace.yaml        # Namespace: ia-mcp
│   ├── secret.yaml           # API keys & credentials
│   ├── configmap.yaml        # Service URLs & config
│   ├── deployment.yaml       # midia-mcp deployment
│   ├── service.yaml          # ClusterIP service
│   └── ingress.yaml          # Ingress with SSE support
└── overlays/
    └── production/
        └── kustomization.yaml  # Image, replicas, domain overrides
```

### Deploy

1. **Build and push the Docker image:**

```bash
docker build -t your-registry.com/midia-mcp:latest .
docker push your-registry.com/midia-mcp:latest
```

2. **Edit secrets and config:**

```bash
# Edit the secrets (API keys, passwords)
vim k8s/base/secret.yaml

# Edit the configmap (service URLs for your cluster)
vim k8s/base/configmap.yaml

# Edit the production overlay (image registry, domain)
vim k8s/overlays/production/kustomization.yaml
```

3. **Apply with Kustomize:**

```bash
# Preview
kubectl kustomize k8s/overlays/production

# Apply
kubectl apply -k k8s/overlays/production
```

4. **Verify:**

```bash
kubectl -n ia-mcp get pods
kubectl -n ia-mcp logs -f deployment/midia-mcp
```

### Security Notes

- **Auth + RBAC mandatory**: the server won't start without `AUTH_TOKENS_CONFIG` in SSE mode
- All endpoints except `/health` require a valid Bearer token
- Granular permissions: admin/manager/viewer roles control what each token can do
- The Ingress is configured with HTTPS/TLS — use cert-manager for Let's Encrypt
- The pod runs as non-root with read-only filesystem
- Rate limiting blocks IPs after 10 failed auth attempts per minute
- For production, use sealed-secrets or external-secrets operator instead of plain Secret manifests

## Available Tools

### Sonarr (11 tools)

| Tool | Description |
|---|---|
| `sonarr_get_series` | List all series |
| `sonarr_get_series_by_id` | Get series details |
| `sonarr_search_series` | Search for series to add |
| `sonarr_add_series` | Add a new series |
| `sonarr_delete_series` | Delete a series |
| `sonarr_get_episodes` | Get episodes for a series |
| `sonarr_search_episodes` | Trigger episode search |
| `sonarr_get_calendar` | Upcoming episodes |
| `sonarr_get_queue` | Download queue |
| `sonarr_get_quality_profiles` | List quality profiles |
| `sonarr_get_root_folders` | List root folders |
| `sonarr_get_system_status` | System status |

### Radarr (11 tools)

| Tool | Description |
|---|---|
| `radarr_get_movies` | List all movies |
| `radarr_get_movie_by_id` | Get movie details |
| `radarr_search_movies` | Search for movies to add |
| `radarr_add_movie` | Add a new movie |
| `radarr_delete_movie` | Delete a movie |
| `radarr_search_movie_download` | Trigger movie search |
| `radarr_get_calendar` | Upcoming movies |
| `radarr_get_queue` | Download queue |
| `radarr_get_quality_profiles` | List quality profiles |
| `radarr_get_root_folders` | List root folders |
| `radarr_get_system_status` | System status |

### Prowlarr (6 tools)

| Tool | Description |
|---|---|
| `prowlarr_get_indexers` | List all indexers |
| `prowlarr_get_indexer_by_id` | Get indexer details |
| `prowlarr_test_indexer` | Test an indexer |
| `prowlarr_search` | Search across indexers |
| `prowlarr_get_indexer_stats` | Indexer statistics |
| `prowlarr_get_system_status` | System status |

### qBittorrent (12 tools)

| Tool | Description |
|---|---|
| `qbt_get_torrents` | List torrents (with filters) |
| `qbt_get_torrent_details` | Torrent properties, trackers, files |
| `qbt_add_torrent` | Add torrent by URL/magnet |
| `qbt_pause_torrents` | Pause torrents |
| `qbt_resume_torrents` | Resume torrents |
| `qbt_delete_torrents` | Delete torrents |
| `qbt_get_transfer_info` | Global transfer info |
| `qbt_get_categories` | List categories |
| `qbt_create_category` | Create category |
| `qbt_set_torrent_category` | Set torrent category |
| `qbt_set_speed_limit` | Set speed limits |
| `qbt_get_app_version` | App version |

### NZBGet (12 tools)

| Tool | Description |
|---|---|
| `nzbget_get_status` | Server status (speed, remaining) |
| `nzbget_get_downloads` | Active downloads queue |
| `nzbget_get_history` | Download history |
| `nzbget_add_nzb` | Add NZB by URL |
| `nzbget_pause_download` | Pause a download |
| `nzbget_resume_download` | Resume a download |
| `nzbget_delete_download` | Delete a download |
| `nzbget_pause_all` | Pause all downloads |
| `nzbget_resume_all` | Resume all downloads |
| `nzbget_set_speed_limit` | Set speed limit |
| `nzbget_get_config` | Server configuration |
| `nzbget_get_version` | NZBGet version |

### Emby (14 tools)

| Tool | Description |
|---|---|
| `emby_get_system_info` | Server system info |
| `emby_get_libraries` | List media libraries |
| `emby_search` | Search for media |
| `emby_get_item` | Get item details |
| `emby_get_latest_media` | Latest added media |
| `emby_get_movies` | List movies |
| `emby_get_series` | List TV series |
| `emby_get_episodes` | Get episodes for a series |
| `emby_get_sessions` | Active sessions (who's watching) |
| `emby_get_activity_log` | Activity log |
| `emby_get_scheduled_tasks` | Scheduled tasks |
| `emby_run_scheduled_task` | Run a scheduled task |
| `emby_refresh_library` | Trigger library refresh |
| `emby_get_users` | List users |

## Development

```bash
npm run dev    # Run with tsx (no build needed)
npm run build  # Compile TypeScript
npm start      # Run compiled version
```

## License

MIT
