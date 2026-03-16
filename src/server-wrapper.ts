/**
 * Wraps McpServer tool registration to add RBAC checks and audit logging.
 *
 * Strategy: each SSE session gets its own McpServer. When creating a server
 * for an authenticated session, we wrap every tool handler to:
 *   1. Check if the user's role allows the tool's permission level
 *   2. Emit an OTel audit log for every call (granted or denied)
 *   3. Measure execution duration
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Role, TokenEntry } from "./rbac.js";
import { getToolPermission, roleHasPermission } from "./rbac.js";
import { emitAuditLog } from "./logger.js";

export interface SessionContext {
  tokenEntry: TokenEntry;
  ip?: string;
  sessionId?: string;
}

type ToolHandler = (...args: unknown[]) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

/**
 * Create a tool-registration proxy that wraps each tool handler
 * with RBAC + audit logging for a specific session context.
 */
export function createGuardedServer(
  baseServerFactory: () => McpServer,
  context: SessionContext,
): McpServer {
  const server = baseServerFactory();
  const originalTool = server.tool.bind(server);

  // Override the tool method to wrap handlers
  (server as unknown as Record<string, unknown>).tool = function (...args: unknown[]) {
    // server.tool(name, description, schema, handler)
    // or server.tool(name, description, handler) for no-schema
    const name = args[0] as string;
    const permission = getToolPermission(name);
    const hasAccess = roleHasPermission(context.tokenEntry.role, permission);

    // Find the handler (last argument that's a function)
    const handlerIndex = args.findIndex((a) => typeof a === "function");
    if (handlerIndex === -1) {
      // No handler — just pass through
      return (originalTool as Function).apply(server, args);
    }

    if (!hasAccess) {
      // Replace handler with a denial response
      args[handlerIndex] = async () => {
        emitAuditLog({
          userName: context.tokenEntry.name,
          role: context.tokenEntry.role,
          tool: name,
          permission,
          granted: false,
          status: "denied",
          ip: context.ip,
          sessionId: context.sessionId,
        });

        return {
          content: [{
            type: "text",
            text: `Access denied. Your role "${context.tokenEntry.role}" does not have "${permission}" permission required for "${name}".`,
          }],
          isError: true,
        };
      };
    } else {
      // Wrap handler with audit logging
      const originalHandler = args[handlerIndex] as ToolHandler;
      args[handlerIndex] = async (...handlerArgs: unknown[]) => {
        const start = Date.now();
        try {
          const result = await (originalHandler as Function).apply(null, handlerArgs);
          const durationMs = Date.now() - start;

          emitAuditLog({
            userName: context.tokenEntry.name,
            role: context.tokenEntry.role,
            tool: name,
            permission,
            granted: true,
            status: "success",
            durationMs,
            ip: context.ip,
            sessionId: context.sessionId,
          });

          return result;
        } catch (err) {
          const durationMs = Date.now() - start;
          const errorMsg = err instanceof Error ? err.message : String(err);

          emitAuditLog({
            userName: context.tokenEntry.name,
            role: context.tokenEntry.role,
            tool: name,
            permission,
            granted: true,
            status: "error",
            durationMs,
            error: errorMsg,
            ip: context.ip,
            sessionId: context.sessionId,
          });

          return {
            content: [{ type: "text", text: `Error: ${errorMsg}` }],
            isError: true,
          };
        }
      };
    }

    return (originalTool as Function).apply(server, args);
  };

  return server;
}
