# midia-mcp v3.1 — Tracking de Pontos

## Status dos Servicos

| Servico | Client | Tools | Multi-instancia | Action Map | Status |
|---------|--------|-------|-----------------|------------|--------|
| Sonarr | `arr-client.ts` | `sonarr.ts` (39 tools) | sonarr / sonarr_animes | sonarr | OK |
| Radarr | `arr-client.ts` | `radarr.ts` (38 tools) | radarr / radarr_animes | radarr | OK |
| Prowlarr | `arr-client.ts` | `prowlarr.ts` (22 tools) | - | prowlarr | OK |
| Lidarr | `arr-client.ts` | `lidarr.ts` (37 tools) | - | lidarr | OK |
| Whisparr | `arr-client.ts` | `whisparr.ts` (10 tools) | - | whisparr | OK |
| Bazarr | `bazarr-client.ts` | `bazarr.ts` (18 tools) | bazarr / bazarr_animes | bazarr | OK |
| Autobrr | `autobrr-client.ts` | `autobrr.ts` (10 tools) | - | autobrr | OK |
| Jellyfin | `jellyfin-client.ts` | `jellyfin.ts` (14 tools) | - | jellyfin | OK |
| Emby | `emby-client.ts` | `emby.ts` (14 tools) | - | emby | OK |
| Jellyseerr | `jellyseerr-client.ts` | `jellyseerr.ts` (14 tools) | - | jellyseerr | OK |
| Seerr | `seerr-client.ts` | `seerr.ts` (14 tools) | - | seerr | OK |
| qBittorrent | `qbittorrent-client.ts` | `qbittorrent.ts` | - | qbittorrent | OK |
| NZBGet | `nzbget-client.ts` | `nzbget.ts` | - | nzbget | OK |
| TMDB | `tmdb-client.ts` | `tmdb.ts` (18 tools) | - | tmdb | OK |
| MAL | `mal-client.ts` | `mal.ts` (15 tools) | - | mal | OK |
| Ryot | `ryot-client.ts` | `ryot.ts` (13 tools) | - | ryot | OK |

**Total: ~301 tools across 16 service types**

---

## Infraestrutura RBAC

- [x] `action-map.ts` — ACTION_MAP com 16 servicos e categorias
- [x] `rbac.ts` — parseToolName suporta multi-instancia (radarr_animes_get_movies)
- [x] `rbac.ts` — deny_actions, @category expansion, glob patterns
- [x] `rbac.ts` — resolveServiceType para multi-instancia
- [x] `server-wrapper.ts` — Audit log com actionCategory
- [x] `logger.ts` — OTel com actionCategory

---

## Transportes

- [x] stdio
- [x] SSE (Server-Sent Events)
- [x] Streamable HTTP (StreamableHTTPServerTransport)

---

## Multi-instancia

- [x] Suporte a prefix em: sonarr, radarr, bazarr, lidarr, whisparr, autobrr, jellyfin
- [x] Config: `sonarr`, `sonarr_animes`, `radarr`, `radarr_animes`, `bazarr`, `bazarr_animes`
- [x] Tools registradas com prefix dinamico: `radarr_animes_get_movies`
- [x] RBAC parseToolName resolve `radarr_animes_get_movies` -> app=radarr_animes, action=get_movies
- [x] resolveServiceType: `radarr_animes` -> `radarr` para lookup no ACTION_MAP

---

## Deploy Kubernetes

- [x] Namespace `mcp-arr` criado no cluster `casa-prd`
- [x] Docker image `marcosviniciusi/midia-mcp:v3.1` no Docker Hub
- [x] Manifests: deployment, service, configmap, sealedsecret, namespace
- [x] Image v3.1 no deployment
- [x] Todas API keys coletadas (16 servicos)
- [x] SealedSecret `midia-mcp-config` via kubeseal
- [x] Service LoadBalancer com IP 192.168.253.41
- [x] Deploy validado — 2 replicas running
- [x] Health check OK: `{"status":"ok","name":"midia-mcp","version":"3.1.0"}`

---

## Codigo

- [x] Expandir sonarr.ts com API v3 completa (39 tools)
- [x] Expandir radarr.ts com API v3 completa (38 tools)
- [x] Expandir prowlarr.ts com API v1 completa (22 tools)
- [x] Expandir lidarr.ts com API v1 completa (37 tools)
- [x] ACTION_MAP atualizado com todas as 301 actions
- [x] examples/config.yaml com todos os 16 servicos
- [x] tokens.yaml com config de producao (gitignored)
- [x] .gitignore protege tokens.yaml e *.secret.yaml
- [x] npm run build compila sem erros
- [x] Revisao completa de codigo (verificar gaps/buracos)
- [ ] Atualizar README.md com contagem final de tools e servicos
- [ ] Atualizar docs/auth-permissions.md com novos servicos

---

## Servicos no Cluster (Referencia)

### Namespace `arr`
- sonarr, sonarr-animes
- radarr, radarr-animes
- bazarr, bazarr-animes
- prowlarr, lidarr, whisparr
- autobrr, jackett
- ryot

### Namespace `jelly`
- emby, jellyfin, jellystat, overseerr

### Acesso
- LoadBalancer: `192.168.253.41:80`
- Admin token: ver tokens.yaml (gitignored)
