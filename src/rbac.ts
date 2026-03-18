/**
 * RBAC — Per-app, per-action permission system.
 *
 * Each token defines which apps it can access and which actions
 * within each app are allowed. Inspired by mcp-k8s permission model.
 *
 * Supports:
 *   - Wildcard: actions: ["*"]
 *   - Exact match: actions: ["get_series"]
 *   - Category expansion: actions: ["@read", "@search"] → expands via ACTION_MAP
 *   - Glob patterns: actions: ["get_*"] → matches get_series, get_movies, etc.
 *   - Deny list: deny_actions: ["delete_*"] → blocklist overrides allowlist
 */
import { expandCategory, getActionCategory, resolveServiceType, ACTION_MAP } from "./action-map.js";

export interface AppPermission {
  actions: string[];
  /** Blocklist — overrides allowlist. Supports same patterns as actions. */
  deny_actions?: string[];
  /** Jellyseerr/Seerr-specific: which auth context to use (admin | poweruser | requester) */
  auth_level?: string;
}

export interface TokenEntry {
  token: string;
  description: string;
  permissions: Record<string, AppPermission>;
}

/** Tool name prefix → canonical app name mapping */
const PREFIX_TO_APP: Record<string, string> = {
  qbt: "qbittorrent",
};

/**
 * Parse a tool name into app + action.
 *
 * "sonarr_get_series"           → { app: "sonarr", action: "get_series" }
 * "radarr_animes_get_movies"    → { app: "radarr_animes", action: "get_movies" }
 * "bazarr_animes_get_series"    → { app: "bazarr_animes", action: "get_series" }
 * "qbt_get_torrents"            → { app: "qbittorrent", action: "get_torrents" }
 * "jellyseerr_search"           → { app: "jellyseerr", action: "search" }
 */
export function parseToolName(toolName: string): { app: string; action: string } {
  const parts = toolName.split("_");
  if (parts.length <= 1) return { app: toolName, action: toolName };

  // Try progressively longer prefixes to find the best app match.
  // This handles multi-instance names like "radarr_animes_get_movies".
  for (let i = parts.length - 1; i >= 1; i--) {
    const potentialApp = parts.slice(0, i).join("_");
    const potentialAction = parts.slice(i).join("_");

    // Check aliases first
    if (i === 1 && PREFIX_TO_APP[potentialApp]) {
      return { app: PREFIX_TO_APP[potentialApp], action: potentialAction };
    }

    // Check if this resolves to a known service type with a valid action
    const baseType = resolveServiceType(potentialApp);
    if (ACTION_MAP[baseType] && potentialAction.length > 0) {
      // Verify the action exists in the action map for this service type
      const allActions = Object.values(ACTION_MAP[baseType]).flat();
      if (allActions.includes(potentialAction)) {
        return { app: potentialApp, action: potentialAction };
      }
    }
  }

  // Fallback: split on first underscore
  const prefix = parts[0];
  const action = parts.slice(1).join("_");
  const app = PREFIX_TO_APP[prefix] ?? prefix;
  return { app, action };
}

/**
 * Simple glob match — supports only trailing `*` wildcard (e.g. "get_*", "delete_*").
 */
function globMatch(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return pattern === value;

  // Only support trailing wildcard for simplicity and safety
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return value.startsWith(prefix);
  }

  return pattern === value;
}

/**
 * Check if an action matches any entry in a pattern list.
 * Patterns can be: exact strings, glob patterns, or @category references.
 */
function matchesPatternList(patterns: string[], action: string, app: string): boolean {
  for (const pattern of patterns) {
    // Category expansion: "@read" → expand to all actions in the "read" category
    if (pattern.startsWith("@")) {
      const categoryName = pattern.slice(1);
      const expanded = expandCategory(app, categoryName);
      if (expanded.includes(action)) return true;
      continue;
    }

    // Wildcard or glob match
    if (globMatch(pattern, action)) return true;
  }
  return false;
}

/**
 * Check if a token entry has permission for a given app + action.
 *
 * Order of evaluation:
 * 1. App must exist in permissions
 * 2. deny_actions checked first (blocklist wins)
 * 3. actions checked (allowlist)
 */
export function hasPermission(entry: TokenEntry, app: string, action: string): boolean {
  const appPerms = entry.permissions[app];
  if (!appPerms) return false;

  // Deny list takes precedence
  if (appPerms.deny_actions && appPerms.deny_actions.length > 0) {
    if (matchesPatternList(appPerms.deny_actions, action, app)) {
      return false;
    }
  }

  // Allow list
  return matchesPatternList(appPerms.actions, action, app);
}

/**
 * Get the auth_level for a specific app (Jellyseerr/Seerr).
 */
export function getAuthLevel(entry: TokenEntry, app: string): string | undefined {
  return entry.permissions[app]?.auth_level;
}

/**
 * Backward-compatible alias for getAuthLevel("jellyseerr").
 */
export function getJellyseerrAuthLevel(entry: TokenEntry): string | undefined {
  return getAuthLevel(entry, "jellyseerr");
}

/**
 * Validate token entries at startup.
 */
export function validateTokenEntries(entries: TokenEntry[]): void {
  for (const entry of entries) {
    if (!entry.token) {
      throw new Error(`Token entry missing "token" field: ${JSON.stringify(entry)}`);
    }
    if (!entry.description) {
      throw new Error(`Token "${entry.token.slice(0, 8)}..." missing "description" field`);
    }
    if (!entry.permissions || typeof entry.permissions !== "object") {
      throw new Error(`Token "${entry.description}" missing "permissions" object`);
    }
    for (const [app, perm] of Object.entries(entry.permissions)) {
      if (!Array.isArray(perm.actions) || perm.actions.length === 0) {
        throw new Error(
          `Token "${entry.description}" → app "${app}" must have a non-empty "actions" array`,
        );
      }
    }
  }
}
