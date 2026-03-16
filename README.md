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
| `AUTH_TOKENS` | **Required in SSE mode.** Comma-separated Bearer tokens for authentication |
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

## Authentication

In SSE mode, authentication is **mandatory**. The server will refuse to start without `AUTH_TOKENS` configured.

### How it works

- All endpoints are protected except `/health` (for K8s probes)
- Supports **Bearer token** via `Authorization` header or `?token=` query parameter
- The `?token=` query param is necessary for SSE because the browser `EventSource` API cannot set custom headers
- Multiple tokens are supported (comma-separated) for multi-user access or key rotation
- Uses **timing-safe comparison** to prevent timing attacks
- Includes **rate limiting** (10 failed attempts per minute per IP)
- Any undefined route returns 404

### Generating a token

```bash
# Generate a secure random token
openssl rand -hex 32
```

### Token via header (programmatic clients)

```bash
curl -H "Authorization: Bearer your-token" https://midia-mcp.example.com/sse
```

### Token via query param (SSE/EventSource)

```
https://midia-mcp.example.com/sse?token=your-token
```

### Multiple tokens (key rotation / multi-user)

```bash
AUTH_TOKENS=token-user-1,token-user-2,token-admin
```

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

- **Auth is mandatory**: the server won't start without `AUTH_TOKENS` in SSE mode
- All endpoints except `/health` require a valid Bearer token
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
