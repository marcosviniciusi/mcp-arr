# midia-mcp v3.1 — Validation Report

**Data:** 2026-03-18
**Cluster:** casa-prd
**Namespace:** mcp-arr
**Transport:** streamable-http
**Endpoint:** https://mcp-arr.vinicima.com/mcp
**Pods:** 2 replicas (midia-mcp)

---

## Resumo

| Status | Count |
|--------|-------|
| OK     | 15    |
| PENDENTE (token) | 1 (Ryot - precisa token de user) |
| **Total** | **16 servicos** |

---

## Validacao por Servico

### 1. Sonarr (39 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `sonarr_get_system_status` | OK | v4.0.16 |
| `sonarr_get_series` | OK | Retornou biblioteca completa |
| `sonarr_get_quality_profiles` | OK | |
| `sonarr_get_tags` | OK | |
| `sonarr_get_disk_space` | OK | |
| `sonarr_get_root_folders` | OK | |

### 2. Sonarr Animes (39 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `sonarr_animes_get_system_status` | OK | v4.0.16 |
| `sonarr_animes_get_series` | OK | Retornou biblioteca completa |

### 3. Radarr (38 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `radarr_get_system_status` | OK | v6.0.4 (timeout intermitente por LB) |
| `radarr_get_quality_profiles` | OK | |
| `radarr_get_tags` | OK | |
| `radarr_get_disk_space` | OK | |

### 4. Radarr Animes (38 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `radarr_animes_get_system_status` | OK | v6.0.4 |
| `radarr_animes_get_calendar` | OK | Retornou filmes agendados |

### 5. Prowlarr (22 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `prowlarr_get_system_status` | OK | v2.3.0 |
| `prowlarr_get_indexers` | OK | Retornou todos indexers |
| `prowlarr_get_tags` | OK | |
| `prowlarr_search` | OK | Search "frieren" retornou resultados |

### 6. Lidarr (37 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `lidarr_get_system_status` | OK | v3.1.0 |
| `lidarr_get_root_folders` | OK | |
| `lidarr_get_quality_profiles` | OK | |

### 7. Whisparr (10 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `whisparr_get_system_status` | OK | v2.2.0 |
| `whisparr_get_quality_profiles` | OK | |

### 8. Bazarr (18 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `bazarr_get_system_status` | OK | v1.5.6 |
| `bazarr_get_series` | OK | Retornou series com legendas |
| `bazarr_get_languages` | OK | |
| `bazarr_get_providers` | OK | |

### 9. Bazarr Animes (18 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `bazarr_animes_get_system_status` | OK | v1.5.6 |
| `bazarr_animes_get_languages` | OK | |

### 10. Autobrr (10 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `autobrr_get_filters` | OK | 10 filtros (CapybaraBR, Locadora, etc.) |
| `autobrr_get_indexers` | OK | 17 indexers (IRC + Torznab + Newznab) |
| `autobrr_get_irc_networks` | OK | |
| `autobrr_get_release_stats` | OK | |

### 11. Emby (14 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `emby_get_system_info` | OK | v4.9.3, ServerName: emby.vinicima.com |
| `emby_get_libraries` | OK | |
| `emby_get_latest_media` | OK | Corrigido: usa /emby/Users/{userId}/Items/Latest |

### 12. Jellyfin (14 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `jellyfin_get_system_info` | OK | v10.11.6, ServerName: jelly.vinicima.com |
| `jellyfin_get_libraries` | OK | 5 libs: Filmes, Series, Animes-Movies, Animes-Series, Colecoes |
| `jellyfin_get_users` | OK | |

### 13. Seerr/Overseerr (14 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `seerr_get_status` | OK | v3.1.0 |
| `seerr_search` | OK | "frieren" -> 2 resultados (corrigido: base64 API key) |
| `seerr_get_requests` | OK | |

### 14. TMDB (18 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `tmdb_get_trending` | OK | Top trending: ONE PIECE, Invincible, Scream 7 |
| `tmdb_search_movies` | OK | "inception" -> Inception (2010), vote_avg 8.4 |
| `tmdb_get_genres` | OK | |

### 15. MAL (15 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `mal_get_anime_ranking` | OK | #1 Frieren (9.28), #2 Fullmetal Alchemist |
| `mal_search_anime` | OK | |

### 16. Ryot (13 tools)
| Endpoint | Status | Detalhe |
|----------|--------|---------|
| `ryot_search_media` | PENDENTE | Precisa token de usuario (NO_USER_ID com admin token) |
| `ryot_get_collections` | PENDENTE | Idem |
| `ryot_get_user_summary` | CORRIGIDO | Query atualizada: latestUserSummary -> userAnalytics |

**Nota:** Tokens de usuario configurados (mgabriel, dsoares) no sealed secret. Aguardando validacao pos-deploy.

---

## Correcoes Aplicadas nesta Sessao

| # | Problema | Correcao | Arquivo |
|---|----------|----------|---------|
| 1 | Transport SSE vs streamable-http | Env var TRANSPORT override | `index.ts`, `deployment.yaml` |
| 2 | `require("crypto")` em ESM | `import from "node:crypto"` | `logger.ts` |
| 3 | Service selector mismatch | Re-aplicou service.yaml diretamente | `service.yaml` |
| 4 | Emby /Items/Latest 404 | Usa /emby/Users/{userId}/Items/Latest | `emby.ts` |
| 5 | Seerr 403 (API key) | Base64 encode da API key | `seerr-client.ts` |
| 6 | Ryot latestUserSummary | userAnalytics com dateRange | `ryot.ts` |
| 7 | Ryot SearchDetails.total | totalItems (campo correto) | `ryot.ts` |
| 8 | Ryot mediaList | userMetadataList (nova API) | `ryot.ts` |
| 9 | Ryot mutations desatualizadas | Atualizadas todas para API v8+ | `ryot.ts` |
| 10 | Ryot multi-user | createRyotClients factory | `ryot-client.ts`, `index.ts` |

---

## Infraestrutura

- **Docker Image:** marcosviniciusi/midia-mcp:v3.1
- **Health:** https://mcp-arr.vinicima.com/health -> OK
- **MCP:** https://mcp-arr.vinicima.com/mcp -> streamable-http
- **OTel:** Logs enviados para https://signoz-ingest.vinicima.com
- **RBAC:** 1 token admin com acesso total a 16 servicos
- **Multi-user:** Ryot (mgabriel, dsoares), Seerr (auth_level), Emby (userId resolution)
