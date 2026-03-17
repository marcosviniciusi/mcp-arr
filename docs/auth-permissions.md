# Authentication & Permissions

## Overview

midia-mcp implements per-app, per-action access control. Each token defines exactly which services it can access and which operations within each service are allowed.

## Permission Dimensions

Each token is validated across two dimensions:

1. **App** — which service (jellyseerr, sonarr, radarr, etc.)
2. **Actions** — which operations within that app

If an app is **not listed** in a token's permissions, the token has **zero access** to it.

## Token Configuration

Tokens are defined in `config.yaml`:

```yaml
auth_tokens:
  - token: "sk-abc123..."
    description: "Power User"
    permissions:
      jellyseerr:
        actions: ["search", "request", "get_requests"]
        auth_level: poweruser
      emby:
        actions: ["search", "get_movies", "get_series"]
```

### Fields

| Field | Required | Description |
|---|---|---|
| `token` | Yes | Bearer token value. Generate with `openssl rand -hex 32` |
| `description` | Yes | Human-readable name (appears in audit logs, never the token) |
| `permissions` | Yes | Map of app → permission config |
| `permissions.<app>.actions` | Yes | Array of allowed actions, or `["*"]` for all |
| `permissions.<app>.auth_level` | Jellyseerr only | Which auth context: `admin`, `poweruser`, `requester` |

## Available Actions per App

### Jellyseerr (15 actions)

| Action | Description | Typical profiles |
|---|---|---|
| `search` | Search movies/TV shows | All |
| `request` | Create media request | All |
| `get_requests` | List requests | All |
| `get_request_by_id` | Get request details | Power, Admin |
| `get_media` | List media items | Power, Admin |
| `get_media_by_id` | Get media details | Power, Admin |
| `get_status` | Server status | Power, Admin |
| `approve_request` | Approve a request | Admin |
| `deny_request` | Deny a request | Admin |
| `delete_request` | Delete a request | Admin |
| `get_users` | List users | Admin |
| `get_user_by_id` | Get user details | Admin |
| `get_user_quota` | Get user quota | Admin |
| `update_user_permissions` | Modify user permissions | Admin |
| `get_settings` | Server settings | Admin |

### Sonarr (11 actions)

| Action | Description |
|---|---|
| `get_series` | List all series |
| `get_series_by_id` | Get series details |
| `search_series` | Search to add |
| `add_series` | Add a series |
| `delete_series` | Delete a series |
| `get_episodes` | Get episodes |
| `search_episodes` | Trigger episode search |
| `get_calendar` | Upcoming episodes |
| `get_queue` | Download queue |
| `get_quality_profiles` | Quality profiles |
| `get_root_folders` | Root folders |
| `get_system_status` | System status |

### Radarr (11 actions)

| Action | Description |
|---|---|
| `get_movies` | List all movies |
| `get_movie_by_id` | Get movie details |
| `search_movies` | Search to add |
| `add_movie` | Add a movie |
| `delete_movie` | Delete a movie |
| `search_movie_download` | Trigger search |
| `get_calendar` | Upcoming |
| `get_queue` | Download queue |
| `get_quality_profiles` | Quality profiles |
| `get_root_folders` | Root folders |
| `get_system_status` | System status |

### Prowlarr (6 actions)

| Action | Description |
|---|---|
| `get_indexers` | List indexers |
| `get_indexer_by_id` | Indexer details |
| `test_indexer` | Test an indexer |
| `search` | Cross-indexer search |
| `get_indexer_stats` | Statistics |
| `get_system_status` | System status |

### qBittorrent (12 actions)

| Action | Description |
|---|---|
| `get_torrents` | List torrents |
| `get_torrent_details` | Torrent details |
| `add_torrent` | Add torrent |
| `pause_torrents` | Pause |
| `resume_torrents` | Resume |
| `delete_torrents` | Delete |
| `get_transfer_info` | Transfer info |
| `get_categories` | List categories |
| `create_category` | Create category |
| `set_torrent_category` | Set category |
| `set_speed_limit` | Speed limits |
| `get_app_version` | Version |

### NZBGet (12 actions)

| Action | Description |
|---|---|
| `get_status` | Server status |
| `get_downloads` | Active downloads |
| `get_history` | History |
| `add_nzb` | Add NZB |
| `pause_download` | Pause download |
| `resume_download` | Resume download |
| `delete_download` | Delete download |
| `pause_all` | Pause all |
| `resume_all` | Resume all |
| `set_speed_limit` | Speed limit |
| `get_config` | Configuration |
| `get_version` | Version |

### Emby (14 actions)

| Action | Description |
|---|---|
| `get_system_info` | System info |
| `get_libraries` | Libraries |
| `search` | Search media |
| `get_item` | Item details |
| `get_latest_media` | Latest media |
| `get_movies` | List movies |
| `get_series` | List series |
| `get_episodes` | Episodes |
| `get_sessions` | Active sessions |
| `get_activity_log` | Activity log |
| `get_scheduled_tasks` | Scheduled tasks |
| `run_scheduled_task` | Run task |
| `refresh_library` | Refresh |
| `get_users` | Users |

## Jellyseerr Auth Levels

Jellyseerr has a single global API key (admin-level). For non-admin access, we use cookie-based authentication with dedicated Jellyseerr user accounts:

| `auth_level` | Auth Method | Jellyseerr Behavior |
|---|---|---|
| `admin` | API key (`X-Api-Key`) | Full access, auto-approve |
| `poweruser` | Cookie (user login) | Requests auto-approved |
| `requester` | Cookie (user login) | Requests need approval |

Setup: Create the `poweruser` and `requester` accounts in Jellyseerr with appropriate permissions. See [jellyseerr-setup.md](./jellyseerr-setup.md).

## Example Token Profiles

### Platform Admin
```yaml
- token: "sk-admin-..."
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

### Family Member (request + browse)
```yaml
- token: "sk-family-..."
  description: "Family Member"
  permissions:
    jellyseerr: { actions: ["search", "request", "get_requests"], auth_level: requester }
    emby: { actions: ["search", "get_movies", "get_series", "get_libraries"] }
```

### Monitoring / Grafana
```yaml
- token: "sk-mon-..."
  description: "Monitoring"
  permissions:
    sonarr: { actions: ["get_system_status", "get_queue"] }
    radarr: { actions: ["get_system_status", "get_queue"] }
    qbittorrent: { actions: ["get_transfer_info"] }
    nzbget: { actions: ["get_status"] }
    emby: { actions: ["get_sessions", "get_system_info"] }
```

## Security

- Tokens are compared using **timing-safe comparison** (`crypto.timingSafeEqual`)
- **Rate limiting**: 10 failed auth attempts per minute per IP → HTTP 429
- Token values **never appear in logs** — only a truncated SHA256 hash (12 chars)
- All endpoints except `/health` require authentication
- Credentials (API keys, passwords) stay inside the cluster — users only have their token
