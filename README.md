# mcp-arr v4.3

Monorepo containing **17 independent MCP servers** (Model Context Protocol) for managing a complete media stack. Each MCP is a standalone server with its own Docker image, deployable independently via Docker Compose or Kubernetes.

## Architecture

Each MCP server is self-contained, reads only its own service entries from a shared `config.yaml`, and exposes tools scoped to its domain. All MCPs include deep health checks that verify actual backend connectivity.

| MCP | Apps | Tools | LB IP | Docker Image |
|---|---|---|---|---|
| **mcp-sonarr** | sonarr + sonarr_animes | 28 (14x2) | .56 | `marcosviniciusi/mcp-sonarr` |
| **mcp-radarr** | radarr + radarr_animes | 24 (12x2) | .57 | `marcosviniciusi/mcp-radarr` |
| **mcp-tmdb** | tmdb + searxng | 27 | .58 | `marcosviniciusi/mcp-tmdb` |
| **mcp-omdb** | omdb + searxng | 5 | .59 | `marcosviniciusi/mcp-omdb` |
| **mcp-prowlarr** | prowlarr | 22 | .60 | `marcosviniciusi/mcp-prowlarr` |
| **mcp-autobrr** | autobrr | 10 | .61 | `marcosviniciusi/mcp-autobrr` |
| **mcp-bazarr** | bazarr + bazarr_animes | 32 (16x2) | .62 | `marcosviniciusi/mcp-bazarr` |
| **mcp-emby** | emby | 14 | .63 | `marcosviniciusi/mcp-emby` |
| **mcp-jellyfin** | jellyfin | 14 | .64 | `marcosviniciusi/mcp-jellyfin` |
| **mcp-mal** | mal + searxng | 14 | .65 | `marcosviniciusi/mcp-mal` |
| **mcp-ryot** | ryot | 12 | .66 | `marcosviniciusi/mcp-ryot` |
| **mcp-lidarr** | lidarr | 16 | .68 | `marcosviniciusi/mcp-lidarr` |
| **mcp-whisparr** | whisparr | 9 | .69 | `marcosviniciusi/mcp-whisparr` |
| **mcp-tvdb** | tvdb + searxng | 9 | .70 | `marcosviniciusi/mcp-tvdb` |
| **mcp-jellyseerr** | jellyseerr/overseerr | 15 | .71 | `marcosviniciusi/mcp-jellyseerr` |
| **mcp-qbittorrent** | qbittorrent | 9 | .72 | `marcosviniciusi/mcp-qbittorrent` |
| **mcp-nzbget** | nzbget | 10 | .73 | `marcosviniciusi/mcp-nzbget` |

**~290 tools** across all MCPs. Each MCP is optional -- deploy only what you need.

### Multi-instance

Sonarr, Radarr, and Bazarr support multiple instances via config key suffix (e.g., `sonarr_animes`). Each instance registers tools with its own prefix (e.g., `radarr_animes_get_movies`).

### Web Search (SearXNG)

mcp-tmdb, mcp-omdb, mcp-mal, and mcp-tvdb include `web_search` and `web_fetch` tools powered by a self-hosted SearXNG instance. This enables real-time web queries (Oscar nominees, trending releases, etc.) and full page content extraction.

## Quick Start

### Build a single MCP

```bash
cd mcp-sonarr
npm install
npm run build
```

### Docker

```bash
docker build -t marcosviniciusi/mcp-sonarr:v4.3.0 mcp-sonarr/
```

### Docker Compose

Each MCP directory contains a `docker-compose.yaml` example. To run a single MCP:

```bash
cd mcp-sonarr
# Edit config.yaml with your API keys
docker compose up -d
```

See each MCP's directory for its specific `docker-compose.yaml` and `config.yaml` example.

### Configuration

All MCPs share the same `config.yaml` format. Each MCP reads only the service entries relevant to it. Set the config path via environment variable:

```bash
export MIDIA_MCP_CONFIG=./config.yaml
```

Or use the default path: `/etc/midia-mcp/config.yaml`

## Transports

| Transport | Config | Endpoint | Usage |
|---|---|---|---|
| `stdio` | `transport: stdio` | (local process) | Claude Desktop local |
| `sse` | `transport: sse` | GET `/sse`, POST `/messages` | K8s, remote |
| `streamable-http` | `transport: streamable-http` | POST `/mcp` | K8s, remote (recommended) |

### Claude Desktop (stdio)

```json
{
  "mcpServers": {
    "mcp-sonarr": {
      "command": "node",
      "args": ["/path/to/mcp-sonarr/dist/index.js"],
      "env": { "MIDIA_MCP_CONFIG": "/path/to/config.yaml" }
    }
  }
}
```

### Claude Desktop (remote via mcp-remote)

```json
{
  "mcpServers": {
    "mcp-sonarr": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp-sonarr.example.com/mcp",
        "--header",
        "Authorization: Bearer admin-your-token-here"
      ]
    }
  }
}
```

## Deep Health Checks

All MCPs expose a `/health` endpoint that tests actual backend connectivity:

```bash
curl http://192.168.253.56/health
# {"status":"ok","name":"mcp-sonarr","version":"4.3.0","services":{"sonarr":"ok","sonarr_animes":"ok"}}
```

- Returns `200` with `status: "ok"` when all backends are reachable
- Returns `503` with `status: "degraded"` when any backend is down
- Kubernetes liveness/readiness probes use this endpoint

## Permissions (RBAC)

Each token defines which apps it can access and which actions within each app:

- **Wildcard**: `actions: ["*"]`
- **Exact action**: `actions: ["get_series"]`
- **Category**: `actions: ["@read"]`
- **Glob pattern**: `actions: ["get_*"]`
- **Deny list**: `deny_actions: ["delete_*"]`

Generate tokens: `openssl rand -hex 32 | sed 's/^/admin-/'`

## Kubernetes Deployment

All 17 MCPs deploy to namespace `mcp-arr` and share a SealedSecret containing `config.yaml`. IaC is managed in the [k3s-homelab](https://github.com/vinicimatecnologia/k3s-homelab) repository under `kustomize/mcp-arr/`.

### Build and push all images

```bash
for mcp in sonarr radarr tmdb omdb prowlarr autobrr bazarr emby jellyfin mal ryot lidarr whisparr tvdb jellyseerr qbittorrent nzbget; do
  docker build -t marcosviniciusi/mcp-${mcp}:v4.3.0 mcp-${mcp}/
  docker push marcosviniciusi/mcp-${mcp}:v4.3.0
done
```

### Seal secrets

```bash
kubectl create secret generic midia-mcp-config -n mcp-arr \
  --from-file=config.yaml=./tokens.yaml \
  --dry-run=client -o yaml | \
  kubeseal --format yaml --controller-namespace kube-system \
  > deploy/sealedsecret-config.yaml
```

## Observability

Every tool call emits structured audit logs via OpenTelemetry:

| Attribute | Description |
|---|---|
| `audit.token_description` | Human-readable token name |
| `audit.token_hash` | SHA256 hash (12 chars) |
| `audit.app` | Target service |
| `audit.action` | Action executed |
| `audit.status` | `success`, `error` or `denied` |
| `audit.duration_ms` | Execution time |

## Security

- Timing-safe token comparison (`crypto.timingSafeEqual`)
- Rate limiting: 10 attempts per minute per IP
- Token hashing: only truncated SHA256 in logs
- All endpoints protected except `/health`
- Credentials isolated inside pod/cluster
- SealedSecrets for GitOps
- Security context: non-root (UID 1000), readOnlyRootFilesystem, no privilege escalation

## Project Structure

```
mcp-arr/
├── mcp-sonarr/          # Sonarr + Sonarr Animes (28 tools)
├── mcp-radarr/          # Radarr + Radarr Animes (24 tools)
├── mcp-tmdb/            # TMDB + SearXNG (27 tools)
├── mcp-omdb/            # OMDB + SearXNG (5 tools)
├── mcp-prowlarr/        # Prowlarr (22 tools)
├── mcp-autobrr/         # Autobrr (10 tools)
├── mcp-bazarr/          # Bazarr + Bazarr Animes (32 tools)
├── mcp-emby/            # Emby (14 tools)
├── mcp-jellyfin/        # Jellyfin (14 tools)
├── mcp-mal/             # MyAnimeList + SearXNG (14 tools)
├── mcp-ryot/            # Ryot (12 tools)
├── mcp-lidarr/          # Lidarr (16 tools)
├── mcp-whisparr/        # Whisparr (9 tools)
├── mcp-tvdb/            # TVDB + SearXNG (9 tools)
├── mcp-jellyseerr/      # Jellyseerr/Overseerr (15 tools)
├── mcp-qbittorrent/     # qBittorrent (9 tools)
├── mcp-nzbget/          # NZBGet (10 tools)
├── deploy/              # Kustomize manifests + SealedSecrets
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── sealedsecret-config.yaml
│   └── mcp-*/           # Per-MCP deployment + service
└── tokens.yaml          # Main config with secrets (gitignored)
```

## License

MIT
