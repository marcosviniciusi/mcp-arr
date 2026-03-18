/**
 * ACTION_MAP — Maps each app's actions to categories.
 * Equivalent to mcp-k8s's ACTION_MAP for granular RBAC.
 *
 * Usage in permissions:
 *   actions: ["@read"]           → expands to all actions in the "read" category
 *   actions: ["@read", "@search"] → union of both categories
 *   actions: ["get_series"]      → exact action (unchanged behavior)
 *   actions: ["*"]               → all actions (unchanged behavior)
 */

export const ACTION_MAP: Record<string, Record<string, string[]>> = {
  sonarr: {
    read: [
      "get_series", "get_series_by_id", "get_episodes", "get_episode_by_id",
      "get_episode_files", "get_calendar", "get_queue", "get_queue_details",
      "get_quality_profiles", "get_root_folders", "get_system_status",
      "get_tags", "get_history", "get_blocklist", "get_wanted_missing",
      "get_disk_space", "get_health", "get_backup_list", "get_language_profiles",
      "get_commands", "get_rename_list", "get_logs",
    ],
    search: ["search_series", "search_episodes", "search_series_download"],
    manage: [
      "add_series", "delete_series", "update_series", "update_episode",
      "delete_episode_file", "monitor_episodes", "refresh_series",
      "rescan_series", "rename_series", "add_tag", "delete_queue_item",
      "clear_blocklist", "create_backup", "restart_app",
    ],
  },

  radarr: {
    read: [
      "get_movies", "get_movie_by_id", "get_calendar", "get_queue",
      "get_queue_details", "get_quality_profiles", "get_root_folders",
      "get_system_status", "get_tags", "get_history", "get_blocklist",
      "get_wanted_missing", "get_disk_space", "get_health", "get_backup_list",
      "get_commands", "get_rename_list", "get_logs", "get_credits",
      "get_extra_files", "get_import_lists", "get_exclusions",
    ],
    search: ["search_movies", "search_movie_download"],
    manage: [
      "add_movie", "delete_movie", "update_movie", "delete_movie_file",
      "refresh_movie", "rescan_movie", "rename_movie", "add_tag",
      "delete_queue_item", "clear_blocklist", "add_exclusion",
      "delete_exclusion", "create_backup", "restart_app",
    ],
  },

  prowlarr: {
    read: [
      "get_indexers", "get_indexer_by_id", "get_indexer_stats",
      "get_system_status", "get_tags", "get_health", "get_app_profiles",
      "get_applications", "get_download_clients", "get_history", "get_logs",
      "get_indexer_schema",
    ],
    search: ["search"],
    manage: [
      "add_indexer", "update_indexer", "delete_indexer", "test_indexer",
      "test_all_indexers", "add_tag", "sync_app", "add_application",
      "delete_application",
    ],
  },

  jellyseerr: {
    read: [
      "search", "get_media", "get_media_by_id", "get_requests",
      "get_request_by_id", "get_status",
    ],
    request: ["request"],
    manage: ["approve_request", "deny_request", "delete_request"],
    admin: [
      "get_users", "get_user_by_id", "get_user_quota",
      "update_user_permissions", "get_settings",
    ],
  },

  qbittorrent: {
    read: [
      "get_torrents", "get_torrent_details", "get_transfer_info",
      "get_categories", "get_app_version",
    ],
    manage: [
      "add_torrent", "pause_torrents", "resume_torrents", "delete_torrents",
      "set_torrent_category",
    ],
    config: ["create_category", "set_speed_limit"],
  },

  nzbget: {
    read: ["get_status", "get_downloads", "get_history", "get_version"],
    manage: [
      "add_nzb", "pause_download", "resume_download", "delete_download",
      "pause_all", "resume_all",
    ],
    config: ["set_speed_limit", "get_config"],
  },

  emby: {
    read: [
      "get_system_info", "get_libraries", "search", "get_item",
      "get_latest_media", "get_movies", "get_series", "get_episodes",
    ],
    playback: ["get_sessions"],
    manage: ["run_scheduled_task", "refresh_library"],
    admin: ["get_activity_log", "get_scheduled_tasks", "get_users"],
  },

  tmdb: {
    read: [
      "get_movie_details", "get_tv_details", "get_person_details",
      "get_trending", "get_popular_movies", "get_popular_tv",
      "get_movie_credits", "get_tv_credits", "get_recommendations", "get_genres",
    ],
    search: ["search_multi", "search_movies", "search_tv", "search_person"],
    discover: ["discover_movies", "discover_tv"],
    rate: ["rate_movie", "rate_tv"],
  },

  mal: {
    read: [
      "get_anime_details", "get_manga_details", "get_seasonal_anime",
      "get_anime_ranking", "get_manga_ranking", "get_suggested_anime",
    ],
    search: ["search_anime", "search_manga"],
    list: [
      "get_user_animelist", "get_user_mangalist",
      "update_animelist", "update_mangalist",
      "delete_animelist_item", "delete_mangalist_item",
    ],
    manage: ["get_user_info"],
  },

  ryot: {
    read: [
      "get_media_details", "get_media_list", "get_user_summary",
      "get_collections", "get_in_progress",
    ],
    search: ["search_media"],
    track: ["add_to_list", "update_progress", "rate_media", "post_review"],
    manage: ["create_collection", "delete_from_list", "import_from_source"],
  },

  seerr: {
    read: [
      "search", "get_media", "get_media_by_id", "get_requests",
      "get_request_by_id", "get_status",
    ],
    request: ["request_movie", "request_tv"],
    manage: ["approve_request", "deny_request", "delete_request"],
    admin: ["get_users", "get_user_by_id", "get_settings"],
  },

  bazarr: {
    read: [
      "get_series", "get_series_by_id", "get_episodes", "get_movies",
      "get_movie_by_id", "get_wanted_episodes", "get_wanted_movies",
      "get_episode_history", "get_movie_history", "get_providers",
      "get_languages", "get_system_status", "get_tasks",
    ],
    manage: ["search_episode_subtitles", "search_movie_subtitles", "run_task"],
    delete: ["delete_episode_subtitles", "delete_movie_subtitles"],
  },

  lidarr: {
    read: [
      "get_artists", "get_artist_by_id", "get_albums", "get_album_by_id",
      "get_tracks", "get_calendar", "get_queue", "get_queue_details",
      "get_quality_profiles", "get_metadata_profiles", "get_root_folders",
      "get_system_status", "get_tags", "get_history", "get_wanted_missing",
      "get_wanted_cutoff", "get_disk_space", "get_health", "get_commands",
      "get_rename_list", "get_logs",
    ],
    search: [
      "search_artists", "search_albums", "search_artist_download",
      "search_album_download",
    ],
    manage: [
      "add_artist", "delete_artist", "update_artist", "update_album",
      "delete_album", "refresh_artist", "rescan_artist", "rename_artist",
      "add_tag", "delete_queue_item", "create_backup", "restart_app",
    ],
  },

  whisparr: {
    read: [
      "get_movies", "get_movie_by_id", "get_queue",
      "get_quality_profiles", "get_root_folders", "get_system_status",
    ],
    search: ["search_movies", "search_movie_download"],
    manage: ["add_movie", "delete_movie"],
  },

  autobrr: {
    read: [
      "get_filters", "get_filter_by_id", "get_indexers", "get_irc_networks",
      "get_releases", "get_release_stats", "get_feeds", "get_download_clients",
    ],
    manage: ["create_filter", "delete_filter"],
  },

  jellyfin: {
    read: [
      "get_system_info", "get_libraries", "search", "get_item",
      "get_latest_media", "get_movies", "get_series", "get_episodes",
    ],
    playback: ["get_sessions"],
    manage: ["run_scheduled_task", "refresh_library"],
    admin: ["get_activity_log", "get_scheduled_tasks", "get_users"],
  },
};

/** Known service type prefixes for multi-instance support. */
const SERVICE_TYPES = [
  "sonarr", "radarr", "bazarr", "lidarr", "whisparr", "autobrr",
  "jellyfin", "emby", "prowlarr", "jellyseerr", "seerr",
  "qbittorrent", "nzbget", "tmdb", "mal", "ryot",
];

/**
 * Resolve an app key to its base service type.
 * E.g. "radarr_animes" → "radarr", "sonarr" → "sonarr".
 */
export function resolveServiceType(app: string): string {
  if (ACTION_MAP[app]) return app;
  for (const svc of SERVICE_TYPES) {
    if (app.startsWith(`${svc}_`) || app.startsWith(`${svc}-`)) return svc;
  }
  return app;
}

/**
 * Resolve an action to its category for a given app.
 * Returns null if the action is not mapped.
 */
export function getActionCategory(app: string, action: string): string | null {
  const baseType = resolveServiceType(app);
  const appMap = ACTION_MAP[baseType];
  if (!appMap) return null;

  for (const [category, actions] of Object.entries(appMap)) {
    if (actions.includes(action)) return category;
  }
  return null;
}

/**
 * Expand a category reference (e.g. "@read") to all actions in that category.
 * Returns empty array if the category doesn't exist for this app.
 */
export function expandCategory(app: string, category: string): string[] {
  const baseType = resolveServiceType(app);
  const appMap = ACTION_MAP[baseType];
  if (!appMap) return [];
  return appMap[category] ?? [];
}
