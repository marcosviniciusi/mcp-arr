# midia-mcp

MCP (Model Context Protocol) server for managing a complete media stack with **per-app, per-action access control**.

## Supported Services

| Service | Tools | Description |
|---|---|---|
| **Jellyseerr** | 15 | Media requests with 3 auth levels (admin, poweruser, requester) |
| **Sonarr** | 11 | TV series management |
| **Radarr** | 11 | Movie management |
| **Prowlarr** | 6 | Indexer management & search |
| **qBittorrent** | 12 | Torrent client |
| **NZBGet** | 12 | Usenet download client |
| **Emby** | 14 | Media server |

**81 tools** total. Each service is optional — only configured services expose tools.

## Architecture

```
┌────────────────────┐     ┌──────────────────────────────────────────┐
│  Claude Desktop    │     │  midia-mcp (K8s / local)                 │
│                    │     │                                          │
│  Token: sk-user-.. │────▶│  Auth + RBAC ──▶ Jellyseerr             │
│                    │ SSE │       │         ▶ Sonarr / Radarr        │
│  (no credentials)  │     │       │         ▶ Prowlarr               │
└────────────────────┘     │       │         ▶ qBittorrent / NZBGet   │
                           │       │         ▶ Emby                   │
                           │       ▼                                  │
                           │  Audit Log ──▶ SigNoz (OTel)            │
                           └──────────────────────────────────────────┘
```

Users only need a **token** and a **URL**. All service credentials stay inside the cluster.

## Quick Start

### Install & Build

```bash
npm install
npm run build
```

### Configuration

midia-mcp uses a YAML config file. Set the path via `MIDIA_MCP_CONFIG` environment variable:

```bash
export MIDIA_MCP_CONFIG=./tokens.yaml
```

Or place it at the default location: `/etc/midia-mcp/config.yaml`

See [`examples/config.yaml`](examples/config.yaml) for a full example.

### Local Mode (stdio)

```json
{
  "mcpServers": {
    "midia-mcp": {
      "command": "node",
      "args": ["/path/to/midia-mcp/dist/index.js"],
      "env": {
        "MIDIA_MCP_CONFIG": "/path/to/midia-mcp/tokens.yaml"
      }
    }
  }
}
```

### Remote Mode (SSE)

```json
{
  "mcpServers": {
    "midia-mcp": {
      "url": "https://midia-mcp.example.com/sse?token=sk-your-token-here"
    }
  }
}
```

See [`docs/claude-desktop-config.md`](docs/claude-desktop-config.md) for more examples.

## Configuration File

```yaml
transport: sse
host: "0.0.0.0"
port: 3000

otel:
  enabled: true
  endpoint: "http://otel-collector.observability.svc:4318"
  service_name: "midia-mcp"

services:
  jellyseerr:
    url: "http://jellyseerr:5055"
    api_key: "your-admin-api-key"
    users:
      poweruser:
        email: "poweruser@home.local"
        password: "secret"
      requester:
        email: "requester@home.local"
        password: "secret"
  sonarr:
    url: "http://sonarr:8989"
    api_key: "your-key"
  radarr:
    url: "http://radarr:7878"
    api_key: "your-key"
  prowlarr:
    url: "http://prowlarr:9696"
    api_key: "your-key"
  qbittorrent:
    url: "http://qbittorrent:8080"
    username: "admin"
    password: "secret"
  nzbget:
    url: "http://nzbget:6789"
    username: "nzbget"
    password: "secret"
  emby:
    url: "http://emby:8096"
    api_key: "your-key"

auth_tokens:
  - token: "sk-admin-token"
    description: "Platform Admin"
    permissions:
      jellyseerr: { actions: ["*"], auth_level: admin }
      sonarr: { actions: ["*"] }
      radarr: { actions: ["*"] }
      prowlarr: { actions: ["*"] }
      qbittorrent: { actions: ["*"] }
      nzbget: { actions: ["*"] }
      emby: { actions: ["*"] }
```

Generate tokens with: `openssl rand -hex 32`

## Permissions

Each token defines **which apps** it can access and **which actions** within each app.

- If an app is **not listed** → zero access
- `actions: ["*"]` → all actions for that app
- Actions map to tool suffixes: `sonarr_get_series` → app=`sonarr`, action=`get_series`

### Jellyseerr Auth Levels

Jellyseerr has a single global API key. For non-admin access, midia-mcp uses dedicated user accounts:

| `auth_level` | Auth Method | Behavior |
|---|---|---|
| `admin` | API key (`X-Api-Key`) | Full access, auto-approve |
| `poweruser` | Cookie (user login) | Requests auto-approved |
| `requester` | Cookie (user login) | Requests need approval |

See [`docs/jellyseerr-setup.md`](docs/jellyseerr-setup.md) for setup instructions.

### Example Token Profiles

**Family Member** — search and request media, browse Emby catalog:
```yaml
- token: "sk-family-..."
  description: "Family Member"
  permissions:
    jellyseerr: { actions: ["search", "request", "get_requests"], auth_level: requester }
    emby: { actions: ["search", "get_movies", "get_series", "get_libraries"] }
```

**Monitoring / Grafana** — read-only status across services:
```yaml
- token: "sk-mon-..."
  description: "Monitoring"
  permissions:
    sonarr: { actions: ["get_system_status", "get_queue"] }
    radarr: { actions: ["get_system_status", "get_queue"] }
    qbittorrent: { actions: ["get_transfer_info"] }
    nzbget: { actions: ["get_status"] }
    emby: { actions: ["get_system_info", "get_sessions"] }
```

Full permissions reference: [`docs/auth-permissions.md`](docs/auth-permissions.md)

## Kubernetes Deployment

### Structure

```
deploy/
├── kustomization.yaml
├── namespace.yaml              # ia-mcp
├── configmap.yaml              # Non-sensitive config
├── deployment.yaml             # Pod spec with config volume mount
├── service.yaml                # ClusterIP
└── sealedsecret-config.yaml    # SealedSecret (generated by kubeseal)
```

### Deploy

1. **Seal your config:**

```bash
./scripts/seal-secrets.sh --config tokens.yaml --fetch-cert
```

2. **Build and push the image:**

```bash
docker build -t your-registry.com/midia-mcp:latest .
docker push your-registry.com/midia-mcp:latest
```

3. **Apply manifests:**

```bash
kubectl apply -k deploy/
```

4. **Verify:**

```bash
kubectl -n ia-mcp get pods
kubectl -n ia-mcp logs -f deployment/midia-mcp
```

The config.yaml (with all credentials) is mounted as a Secret volume at `/etc/midia-mcp/config.yaml`. No credentials are exposed to clients.

### SealedSecrets

All secrets use [SealedSecrets](https://github.com/bitnami-labs/sealed-secrets) for safe GitOps storage. The `scripts/seal-secrets.sh` script wraps kubeseal:

```bash
# With cluster access (fetches cert automatically)
./scripts/seal-secrets.sh --config tokens.yaml --fetch-cert

# With local certificate
./scripts/seal-secrets.sh --config tokens.yaml --cert ./sealed-secrets-cert.pem
```

See [`examples/sealed-secrets/`](examples/sealed-secrets/) for dev and production examples.

## Observability

Every tool call emits structured audit logs via OpenTelemetry to SigNoz.

| Attribute | Description |
|---|---|
| `audit.token_description` | Human-readable token name |
| `audit.token_hash` | SHA256 hash (12 chars) — real token never logged |
| `audit.app` | Target service (sonarr, jellyseerr, etc.) |
| `audit.action` | Action within the service |
| `audit.status` | `success`, `error`, or `denied` |
| `audit.duration_ms` | Execution time |

```
Platform Admin → radarr.add_movie [success]
Regular User → sonarr.delete_series [DENIED]
```

See [`docs/audit-logging.md`](docs/audit-logging.md) for full details.

## Security

- **Timing-safe** token comparison (`crypto.timingSafeEqual`)
- **Rate limiting**: 10 failed auth per minute per IP → HTTP 429
- **Token hashing**: only truncated SHA256 in logs (12 chars)
- **All endpoints protected** except `/health`
- **Credentials isolated**: API keys and passwords stay inside the pod/cluster
- **SealedSecrets**: encrypted secrets safe for git

## Available Tools

### Jellyseerr (15 tools)

| Tool | Action | Description |
|---|---|---|
| `jellyseerr_search` | `search` | Search movies and TV shows |
| `jellyseerr_get_media` | `get_media` | List media items |
| `jellyseerr_get_media_by_id` | `get_media_by_id` | Get media details |
| `jellyseerr_request` | `request` | Create media request |
| `jellyseerr_get_requests` | `get_requests` | List requests |
| `jellyseerr_get_request_by_id` | `get_request_by_id` | Get request details |
| `jellyseerr_approve_request` | `approve_request` | Approve a request |
| `jellyseerr_deny_request` | `deny_request` | Deny a request |
| `jellyseerr_delete_request` | `delete_request` | Delete a request |
| `jellyseerr_get_users` | `get_users` | List users |
| `jellyseerr_get_user_by_id` | `get_user_by_id` | Get user details |
| `jellyseerr_get_user_quota` | `get_user_quota` | Get user quota |
| `jellyseerr_update_user_permissions` | `update_user_permissions` | Update user permissions |
| `jellyseerr_get_settings` | `get_settings` | Server settings |
| `jellyseerr_get_status` | `get_status` | Server status |

### Sonarr (11 tools)

| Tool | Action | Description |
|---|---|---|
| `sonarr_get_series` | `get_series` | List all series |
| `sonarr_get_series_by_id` | `get_series_by_id` | Get series details |
| `sonarr_search_series` | `search_series` | Search for series to add |
| `sonarr_add_series` | `add_series` | Add a new series |
| `sonarr_delete_series` | `delete_series` | Delete a series |
| `sonarr_get_episodes` | `get_episodes` | Get episodes for a series |
| `sonarr_search_episodes` | `search_episodes` | Trigger episode search |
| `sonarr_get_calendar` | `get_calendar` | Upcoming episodes |
| `sonarr_get_queue` | `get_queue` | Download queue |
| `sonarr_get_quality_profiles` | `get_quality_profiles` | List quality profiles |
| `sonarr_get_root_folders` | `get_root_folders` | List root folders |
| `sonarr_get_system_status` | `get_system_status` | System status |

### Radarr (11 tools)

| Tool | Action | Description |
|---|---|---|
| `radarr_get_movies` | `get_movies` | List all movies |
| `radarr_get_movie_by_id` | `get_movie_by_id` | Get movie details |
| `radarr_search_movies` | `search_movies` | Search for movies to add |
| `radarr_add_movie` | `add_movie` | Add a new movie |
| `radarr_delete_movie` | `delete_movie` | Delete a movie |
| `radarr_search_movie_download` | `search_movie_download` | Trigger movie search |
| `radarr_get_calendar` | `get_calendar` | Upcoming movies |
| `radarr_get_queue` | `get_queue` | Download queue |
| `radarr_get_quality_profiles` | `get_quality_profiles` | List quality profiles |
| `radarr_get_root_folders` | `get_root_folders` | List root folders |
| `radarr_get_system_status` | `get_system_status` | System status |

### Prowlarr (6 tools)

| Tool | Action | Description |
|---|---|---|
| `prowlarr_get_indexers` | `get_indexers` | List all indexers |
| `prowlarr_get_indexer_by_id` | `get_indexer_by_id` | Get indexer details |
| `prowlarr_test_indexer` | `test_indexer` | Test an indexer |
| `prowlarr_search` | `search` | Search across indexers |
| `prowlarr_get_indexer_stats` | `get_indexer_stats` | Indexer statistics |
| `prowlarr_get_system_status` | `get_system_status` | System status |

### qBittorrent (12 tools)

| Tool | Action | Description |
|---|---|---|
| `qbt_get_torrents` | `get_torrents` | List torrents |
| `qbt_get_torrent_details` | `get_torrent_details` | Torrent details |
| `qbt_add_torrent` | `add_torrent` | Add torrent by URL/magnet |
| `qbt_pause_torrents` | `pause_torrents` | Pause torrents |
| `qbt_resume_torrents` | `resume_torrents` | Resume torrents |
| `qbt_delete_torrents` | `delete_torrents` | Delete torrents |
| `qbt_get_transfer_info` | `get_transfer_info` | Global transfer info |
| `qbt_get_categories` | `get_categories` | List categories |
| `qbt_create_category` | `create_category` | Create category |
| `qbt_set_torrent_category` | `set_torrent_category` | Set torrent category |
| `qbt_set_speed_limit` | `set_speed_limit` | Set speed limits |
| `qbt_get_app_version` | `get_app_version` | App version |

### NZBGet (12 tools)

| Tool | Action | Description |
|---|---|---|
| `nzbget_get_status` | `get_status` | Server status |
| `nzbget_get_downloads` | `get_downloads` | Active downloads |
| `nzbget_get_history` | `get_history` | Download history |
| `nzbget_add_nzb` | `add_nzb` | Add NZB by URL |
| `nzbget_pause_download` | `pause_download` | Pause a download |
| `nzbget_resume_download` | `resume_download` | Resume a download |
| `nzbget_delete_download` | `delete_download` | Delete a download |
| `nzbget_pause_all` | `pause_all` | Pause all downloads |
| `nzbget_resume_all` | `resume_all` | Resume all downloads |
| `nzbget_set_speed_limit` | `set_speed_limit` | Set speed limit |
| `nzbget_get_config` | `get_config` | Server configuration |
| `nzbget_get_version` | `get_version` | NZBGet version |

### Emby (14 tools)

| Tool | Action | Description |
|---|---|---|
| `emby_get_system_info` | `get_system_info` | Server system info |
| `emby_get_libraries` | `get_libraries` | List media libraries |
| `emby_search` | `search` | Search for media |
| `emby_get_item` | `get_item` | Get item details |
| `emby_get_latest_media` | `get_latest_media` | Latest added media |
| `emby_get_movies` | `get_movies` | List movies |
| `emby_get_series` | `get_series` | List TV series |
| `emby_get_episodes` | `get_episodes` | Get episodes |
| `emby_get_sessions` | `get_sessions` | Active sessions |
| `emby_get_activity_log` | `get_activity_log` | Activity log |
| `emby_get_scheduled_tasks` | `get_scheduled_tasks` | Scheduled tasks |
| `emby_run_scheduled_task` | `run_scheduled_task` | Run a scheduled task |
| `emby_refresh_library` | `refresh_library` | Trigger library refresh |
| `emby_get_users` | `get_users` | List users |

## Project Structure

```
midia-mcp/
├── deploy/                          # Kustomize manifests + SealedSecrets
├── docs/                            # Detailed documentation
│   ├── auth-permissions.md          # Permission system reference
│   ├── audit-logging.md             # OTel + SigNoz setup
│   ├── claude-desktop-config.md     # Client configuration
│   └── jellyseerr-setup.md          # Jellyseerr user setup
├── examples/                        # Configuration examples
│   ├── config.yaml                  # Full config example
│   └── sealed-secrets/              # SealedSecrets examples
├── scripts/
│   └── seal-secrets.sh              # kubeseal wrapper
├── src/
│   ├── index.ts                     # Entry point, config loader
│   ├── auth.ts                      # Token validation
│   ├── rbac.ts                      # Per-app/action permissions
│   ├── server-wrapper.ts            # Permission guard wrapper
│   ├── logger.ts                    # OTel audit logging
│   ├── clients/                     # Service API clients
│   │   ├── arr-client.ts            # Sonarr/Radarr/Prowlarr
│   │   ├── jellyseerr-client.ts     # Jellyseerr (API key + cookie auth)
│   │   ├── qbittorrent-client.ts    # qBittorrent
│   │   ├── nzbget-client.ts         # NZBGet
│   │   └── emby-client.ts           # Emby
│   └── tools/                       # MCP tool definitions
│       ├── jellyseerr.ts            # 15 tools
│       ├── sonarr.ts                # 11 tools
│       ├── radarr.ts                # 11 tools
│       ├── prowlarr.ts              # 6 tools
│       ├── qbittorrent.ts           # 12 tools
│       ├── nzbget.ts                # 12 tools
│       └── emby.ts                  # 14 tools
├── tokens.yaml                      # Main config file
├── Dockerfile
└── package.json
```

## Development

```bash
npm run dev    # Run with tsx (no build needed)
npm run build  # Compile TypeScript
npm start      # Run compiled version
```

## License

MIT
