/**
 * RBAC — Per-app, per-action permission system.
 *
 * Each token defines which apps it can access and which actions
 * within each app are allowed. Inspired by mcp-k8s permission model.
 */

export interface AppPermission {
  actions: string[];
  /** Jellyseerr-specific: which auth context to use (admin | poweruser | requester) */
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
 * "sonarr_get_series"    → { app: "sonarr", action: "get_series" }
 * "qbt_get_torrents"     → { app: "qbittorrent", action: "get_torrents" }
 * "jellyseerr_search"    → { app: "jellyseerr", action: "search" }
 */
export function parseToolName(toolName: string): { app: string; action: string } {
  const idx = toolName.indexOf("_");
  if (idx === -1) return { app: toolName, action: toolName };

  const prefix = toolName.slice(0, idx);
  const action = toolName.slice(idx + 1);
  const app = PREFIX_TO_APP[prefix] ?? prefix;

  return { app, action };
}

/**
 * Check if a token entry has permission for a given app + action.
 */
export function hasPermission(entry: TokenEntry, app: string, action: string): boolean {
  const appPerms = entry.permissions[app];
  if (!appPerms) return false;

  if (appPerms.actions.includes("*")) return true;
  return appPerms.actions.includes(action);
}

/**
 * Get the Jellyseerr auth_level for a token entry.
 */
export function getJellyseerrAuthLevel(entry: TokenEntry): string | undefined {
  return entry.permissions.jellyseerr?.auth_level;
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
