/**
 * RBAC — Role-Based Access Control for MCP tools.
 *
 * Each tool is classified by permission level (read/write/delete).
 * Each token maps to a role, and each role has allowed permission levels.
 */

export type Permission = "read" | "write" | "delete";

export type Role = "admin" | "manager" | "viewer";

export interface TokenEntry {
  token: string;
  name: string;
  role: Role;
}

/** Role → allowed permissions */
const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  admin: new Set(["read", "write", "delete"]),
  manager: new Set(["read", "write"]),
  viewer: new Set(["read"]),
};

/**
 * Tool name → required permission.
 * Convention-based: tool names containing these keywords map to permissions.
 */
const DELETE_KEYWORDS = ["delete", "remove"];
const WRITE_KEYWORDS = [
  "add", "create", "set", "pause", "resume", "search_episodes",
  "search_movie_download", "run_scheduled", "refresh_library",
  "test_indexer",
];

export function getToolPermission(toolName: string): Permission {
  const lower = toolName.toLowerCase();
  if (DELETE_KEYWORDS.some((kw) => lower.includes(kw))) return "delete";
  if (WRITE_KEYWORDS.some((kw) => lower.includes(kw))) return "write";
  return "read";
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function getPermissionsForRole(role: Role): Set<Permission> {
  return ROLE_PERMISSIONS[role];
}

/**
 * Parse AUTH_TOKENS_CONFIG JSON env var.
 *
 * Format:
 * [
 *   {"token": "abc123", "name": "marcos", "role": "admin"},
 *   {"token": "def456", "name": "guest",  "role": "viewer"}
 * ]
 */
export function parseTokenConfig(configJson: string): TokenEntry[] {
  const entries = JSON.parse(configJson) as TokenEntry[];

  for (const entry of entries) {
    if (!entry.token || !entry.name || !entry.role) {
      throw new Error(
        `Invalid token config entry: ${JSON.stringify(entry)}. Required fields: token, name, role`,
      );
    }
    if (!ROLE_PERMISSIONS[entry.role]) {
      throw new Error(
        `Invalid role "${entry.role}" for token "${entry.name}". Valid roles: admin, manager, viewer`,
      );
    }
  }

  return entries;
}

/**
 * Find the TokenEntry that matches a given token value.
 */
export function findTokenEntry(
  entries: TokenEntry[],
  tokenValue: string,
): TokenEntry | undefined {
  return entries.find((e) => e.token === tokenValue);
}
