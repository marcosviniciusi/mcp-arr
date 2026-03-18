# Autenticação & Permissões

## Visão Geral

O midia-mcp implementa controle de acesso granular **por app, por ação e por categoria**. Cada token define exatamente quais serviços pode acessar e quais operações são permitidas. Suporte a **16 serviços** e **multi-instância**.

## Dimensões de Permissão

Cada token é validado em três dimensões:

1. **App** — qual serviço ou instância (sonarr, radarr_animes, bazarr, etc.)
2. **Actions** — quais operações dentro do app
3. **Deny Actions** — blocklist que sobrescreve a allowlist

Se um app **não está listado** nas permissões de um token, o token tem **zero acesso** a ele.

## Sintaxe de Permissões

```yaml
auth_tokens:
  - token: "admin-abc123..."
    description: "Power User"
    permissions:
      sonarr:
        actions: ["@read", "@search"]       # Categorias expandidas
        deny_actions: ["get_system_status"]  # Blocklist específica
      sonarr_animes:
        actions: ["@read"]                  # Multi-instância
      seerr:
        actions: ["@read", "@request"]
        auth_level: admin
      tmdb:
        actions: ["*"]                      # Wildcard — todas as ações
      qbittorrent:
        actions: ["get_*"]                  # Glob pattern
```

### Tipos de Pattern

| Pattern | Exemplo | Descrição |
|---|---|---|
| Wildcard | `"*"` | Todas as ações |
| Ação exata | `"get_series"` | Ação específica |
| Categoria | `"@read"` | Expande para todas as ações na categoria |
| Glob | `"get_*"` | Match por prefixo |

### deny_actions

A deny_actions é uma **blocklist com precedência** sobre a allowlist:

```yaml
qbittorrent:
  actions: ["*"]                    # Permite tudo...
  deny_actions: ["delete_torrents"] # ...exceto deletar torrents
```

Ordem de avaliação:
1. App existe nas permissões? Não → **DENIED**
2. Ação está em `deny_actions`? Sim → **DENIED**
3. Ação está em `actions`? Sim → **ALLOWED**
4. Default → **DENIED**

## Multi-instância

Serviços que suportam múltiplas instâncias: sonarr, radarr, bazarr, lidarr, whisparr, autobrr, jellyfin.

Cada instância é tratada como um app independente no RBAC:

```yaml
permissions:
  sonarr: { actions: ["*"] }           # Sonarr principal
  sonarr_animes: { actions: ["@read"] } # Sonarr animes — só leitura
  radarr: { actions: ["*"] }
  radarr_animes: { actions: ["@read", "@search"] }
```

O `resolveServiceType` mapeia `radarr_animes` → `radarr` para lookup de categorias no ACTION_MAP.

## Categorias de Ação por App

### Sonarr (39 tools)

| Categoria | Ações |
|---|---|
| `@read` | get_series, get_series_by_id, get_episodes, get_episode_by_id, get_episode_files, get_calendar, get_queue, get_queue_details, get_quality_profiles, get_root_folders, get_system_status, get_tags, get_history, get_blocklist, get_wanted_missing, get_disk_space, get_health, get_backup_list, get_language_profiles, get_commands, get_rename_list, get_logs |
| `@search` | search_series, search_episodes, search_series_download |
| `@manage` | add_series, delete_series, update_series, update_episode, delete_episode_file, monitor_episodes, refresh_series, rescan_series, rename_series, add_tag, delete_queue_item, clear_blocklist, create_backup, restart_app |

### Radarr (38 tools)

| Categoria | Ações |
|---|---|
| `@read` | get_movies, get_movie_by_id, get_calendar, get_queue, get_queue_details, get_quality_profiles, get_root_folders, get_system_status, get_tags, get_history, get_blocklist, get_wanted_missing, get_disk_space, get_health, get_backup_list, get_commands, get_rename_list, get_logs, get_credits, get_extra_files, get_import_lists, get_exclusions |
| `@search` | search_movies, search_movie_download |
| `@manage` | add_movie, delete_movie, update_movie, delete_movie_file, refresh_movie, rescan_movie, rename_movie, add_tag, delete_queue_item, clear_blocklist, add_exclusion, delete_exclusion, create_backup, restart_app |

### Prowlarr (22 tools)

| Categoria | Ações |
|---|---|
| `@read` | get_indexers, get_indexer_by_id, get_indexer_stats, get_system_status, get_tags, get_health, get_app_profiles, get_applications, get_download_clients, get_history, get_logs, get_indexer_schema |
| `@search` | search |
| `@manage` | add_indexer, update_indexer, delete_indexer, test_indexer, test_all_indexers, add_tag, sync_app, add_application, delete_application |

### Lidarr (37 tools)

| Categoria | Ações |
|---|---|
| `@read` | get_artists, get_artist_by_id, get_albums, get_album_by_id, get_tracks, get_calendar, get_queue, get_queue_details, get_quality_profiles, get_metadata_profiles, get_root_folders, get_system_status, get_tags, get_history, get_wanted_missing, get_wanted_cutoff, get_disk_space, get_health, get_commands, get_rename_list, get_logs |
| `@search` | search_artists, search_albums, search_artist_download, search_album_download |
| `@manage` | add_artist, delete_artist, update_artist, update_album, delete_album, refresh_artist, rescan_artist, rename_artist, add_tag, delete_queue_item, create_backup, restart_app |

### Whisparr (10 tools)

| Categoria | Ações |
|---|---|
| `@read` | get_movies, get_movie_by_id, get_queue, get_quality_profiles, get_root_folders, get_system_status |
| `@search` | search_movies, search_movie_download |
| `@manage` | add_movie, delete_movie |

### Bazarr (18 tools)

| Categoria | Ações |
|---|---|
| `@read` | get_series, get_series_by_id, get_episodes, get_movies, get_movie_by_id, get_wanted_episodes, get_wanted_movies, get_episode_history, get_movie_history, get_providers, get_languages, get_system_status, get_tasks |
| `@manage` | search_episode_subtitles, search_movie_subtitles, run_task |
| `@delete` | delete_episode_subtitles, delete_movie_subtitles |

### Autobrr (10 tools)

| Categoria | Ações |
|---|---|
| `@read` | get_filters, get_filter_by_id, get_indexers, get_irc_networks, get_releases, get_release_stats, get_feeds, get_download_clients |
| `@manage` | create_filter, delete_filter |

### Jellyfin (14 tools)

| Categoria | Ações |
|---|---|
| `@read` | get_system_info, get_libraries, search, get_item, get_latest_media, get_movies, get_series, get_episodes |
| `@playback` | get_sessions |
| `@manage` | run_scheduled_task, refresh_library |
| `@admin` | get_activity_log, get_scheduled_tasks, get_users |

### Emby (14 tools)

| Categoria | Ações |
|---|---|
| `@read` | get_system_info, get_libraries, search, get_item, get_latest_media, get_movies, get_series, get_episodes |
| `@playback` | get_sessions |
| `@manage` | run_scheduled_task, refresh_library |
| `@admin` | get_activity_log, get_scheduled_tasks, get_users |

### Jellyseerr (15 tools)

| Categoria | Ações |
|---|---|
| `@read` | search, get_media, get_media_by_id, get_requests, get_request_by_id, get_status |
| `@request` | request |
| `@manage` | approve_request, deny_request, delete_request |
| `@admin` | get_users, get_user_by_id, get_user_quota, update_user_permissions, get_settings |

### Seerr (14 tools)

| Categoria | Ações |
|---|---|
| `@read` | search, get_media, get_media_by_id, get_requests, get_request_by_id, get_status |
| `@request` | request_movie, request_tv |
| `@manage` | approve_request, deny_request, delete_request |
| `@admin` | get_users, get_user_by_id, get_settings |

### qBittorrent (12 tools)

| Categoria | Ações |
|---|---|
| `@read` | get_torrents, get_torrent_details, get_transfer_info, get_categories, get_app_version |
| `@manage` | add_torrent, pause_torrents, resume_torrents, delete_torrents, set_torrent_category |
| `@config` | create_category, set_speed_limit |

### NZBGet (12 tools)

| Categoria | Ações |
|---|---|
| `@read` | get_status, get_downloads, get_history, get_version |
| `@manage` | add_nzb, pause_download, resume_download, delete_download, pause_all, resume_all |
| `@config` | set_speed_limit, get_config |

### TMDB (18 tools)

| Categoria | Ações |
|---|---|
| `@read` | get_movie_details, get_tv_details, get_person_details, get_trending, get_popular_movies, get_popular_tv, get_movie_credits, get_tv_credits, get_recommendations, get_genres |
| `@search` | search_multi, search_movies, search_tv, search_person |
| `@discover` | discover_movies, discover_tv |
| `@rate` | rate_movie, rate_tv |

### MyAnimeList (15 tools)

| Categoria | Ações |
|---|---|
| `@read` | get_anime_details, get_manga_details, get_seasonal_anime, get_anime_ranking, get_manga_ranking, get_suggested_anime |
| `@search` | search_anime, search_manga |
| `@list` | get_user_animelist, get_user_mangalist, update_animelist, update_mangalist, delete_animelist_item, delete_mangalist_item |
| `@manage` | get_user_info |

### Ryot (13 tools)

| Categoria | Ações |
|---|---|
| `@read` | get_media_details, get_media_list, get_user_summary, get_collections, get_in_progress |
| `@search` | search_media |
| `@track` | add_to_list, update_progress, rate_media, post_review |
| `@manage` | create_collection, delete_from_list, import_from_source |

## Auth Levels (Jellyseerr / Seerr)

Jellyseerr e Seerr possuem uma API key global (admin-level). Para acesso não-admin, o midia-mcp usa contas de usuário dedicadas com cookie-based auth:

| `auth_level` | Método Auth | Comportamento |
|---|---|---|
| `admin` | API key (`X-Api-Key`) | Acesso total, auto-approve |
| `poweruser` | Cookie (login do usuário) | Requests auto-aprovados |
| `requester` | Cookie (login do usuário) | Requests precisam de aprovação |

Setup: Crie as contas no Jellyseerr/Seerr com as permissões apropriadas. Veja [jellyseerr-setup.md](./jellyseerr-setup.md).

## Exemplos de Perfis de Token

### Platform Admin
```yaml
- token: "admin-..."
  description: "Platform Admin"
  permissions:
    sonarr: { actions: ["*"] }
    sonarr_animes: { actions: ["*"] }
    radarr: { actions: ["*"] }
    radarr_animes: { actions: ["*"] }
    prowlarr: { actions: ["*"] }
    lidarr: { actions: ["*"] }
    whisparr: { actions: ["*"] }
    bazarr: { actions: ["*"] }
    bazarr_animes: { actions: ["*"] }
    autobrr: { actions: ["*"] }
    emby: { actions: ["*"] }
    jellyfin: { actions: ["*"] }
    seerr: { actions: ["*"], auth_level: admin }
    tmdb: { actions: ["*"] }
    mal: { actions: ["*"] }
    ryot: { actions: ["*"] }
```

### Media Consumer (browse + track)
```yaml
- token: "user-..."
  description: "Media Consumer"
  permissions:
    seerr: { actions: ["@read", "@request"] }
    emby: { actions: ["@read", "@playback"] }
    jellyfin: { actions: ["@read", "@playback"] }
    tmdb: { actions: ["@read", "@search", "@discover"] }
    mal: { actions: ["@read", "@search", "@list"] }
    ryot: { actions: ["@read", "@search", "@track"] }
```

### Anime Tracker
```yaml
- token: "anime-..."
  description: "Anime Tracker"
  permissions:
    sonarr_animes: { actions: ["@read", "@search"] }
    radarr_animes: { actions: ["@read", "@search"] }
    mal: { actions: ["*"] }
    ryot: { actions: ["@read", "@search", "@track"] }
    tmdb: { actions: ["@read", "@search"] }
```

### Family Member
```yaml
- token: "family-..."
  description: "Family Member"
  permissions:
    seerr: { actions: ["@read", "@request"], auth_level: requester }
    emby: { actions: ["@read"] }
    jellyfin: { actions: ["@read"] }
    tmdb: { actions: ["@read", "@search"] }
```

### Monitoring / Grafana
```yaml
- token: "mon-..."
  description: "Monitoring"
  permissions:
    sonarr: { actions: ["@read"] }
    sonarr_animes: { actions: ["@read"] }
    radarr: { actions: ["@read"] }
    radarr_animes: { actions: ["@read"] }
    prowlarr: { actions: ["@read"] }
    lidarr: { actions: ["@read"] }
    emby: { actions: ["@read", "@admin"] }
    jellyfin: { actions: ["@read", "@admin"] }
    ryot: { actions: ["@read"] }
```

### Download Manager (sem delete)
```yaml
- token: "dl-..."
  description: "Download Manager"
  permissions:
    qbittorrent:
      actions: ["*"]
      deny_actions: ["delete_torrents"]
    nzbget:
      actions: ["*"]
      deny_actions: ["delete_download"]
```

### Sonarr/Radarr Manager
```yaml
- token: "arr-..."
  description: "Arr Manager"
  permissions:
    sonarr: { actions: ["*"] }
    sonarr_animes: { actions: ["*"] }
    radarr: { actions: ["*"] }
    radarr_animes: { actions: ["*"] }
    lidarr: { actions: ["*"] }
    prowlarr: { actions: ["@read", "@search"] }
    bazarr: { actions: ["*"] }
    bazarr_animes: { actions: ["*"] }
    tmdb: { actions: ["@read", "@search"] }
```

## Segurança

- Tokens são comparados usando **timing-safe comparison** (`crypto.timingSafeEqual`)
- **Rate limiting**: 10 tentativas de auth falhadas por minuto por IP → HTTP 429
- Valores de token **nunca aparecem em logs** — apenas hash SHA256 truncado (12 chars)
- Todos os endpoints exceto `/health` requerem autenticação
- Credenciais (API keys, passwords) ficam dentro do cluster — usuários só têm seu token
- **SealedSecrets**: secrets encriptados seguros para armazenamento em git
