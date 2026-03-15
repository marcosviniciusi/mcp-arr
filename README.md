# mcp-arr

MCP (Model Context Protocol) server for managing your media stack:

- **Sonarr** - TV series management
- **Radarr** - Movie management
- **Prowlarr** - Indexer management & search
- **qBittorrent** - Torrent client

Each service is optional — configure only the ones you use.

## Setup

### Install

```bash
npm install
npm run build
```

### Environment Variables

Set the variables for each service you want to enable:

| Variable | Description |
|---|---|
| `SONARR_URL` | Sonarr base URL (e.g. `http://localhost:8989`) |
| `SONARR_API_KEY` | Sonarr API key (Settings > General) |
| `RADARR_URL` | Radarr base URL (e.g. `http://localhost:7878`) |
| `RADARR_API_KEY` | Radarr API key |
| `PROWLARR_URL` | Prowlarr base URL (e.g. `http://localhost:9696`) |
| `PROWLARR_API_KEY` | Prowlarr API key |
| `QBITTORRENT_URL` | qBittorrent Web UI URL (e.g. `http://localhost:8080`) |
| `QBITTORRENT_USERNAME` | qBittorrent username |
| `QBITTORRENT_PASSWORD` | qBittorrent password |

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-arr": {
      "command": "node",
      "args": ["/path/to/mcp-arr/dist/index.js"],
      "env": {
        "SONARR_URL": "http://localhost:8989",
        "SONARR_API_KEY": "your-sonarr-api-key",
        "RADARR_URL": "http://localhost:7878",
        "RADARR_API_KEY": "your-radarr-api-key",
        "PROWLARR_URL": "http://localhost:9696",
        "PROWLARR_API_KEY": "your-prowlarr-api-key",
        "QBITTORRENT_URL": "http://localhost:8080",
        "QBITTORRENT_USERNAME": "admin",
        "QBITTORRENT_PASSWORD": "adminadmin"
      }
    }
  }
}
```

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

## Development

```bash
npm run dev    # Run with tsx (no build needed)
npm run build  # Compile TypeScript
npm start      # Run compiled version
```

## License

MIT
