/**
 * Wraps McpServer tool registration with per-app/action RBAC + audit logging.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenEntry } from "./rbac.js";
import { parseToolName, hasPermission } from "./rbac.js";
import { getActionCategory } from "./action-map.js";
import { emitAuditLog, hashToken } from "./logger.js";

export interface SessionContext {
  tokenEntry: TokenEntry;
  ip?: string;
  sessionId?: string;
}

export function createGuardedServer(
  baseServerFactory: () => McpServer,
  context: SessionContext,
): McpServer {
  const server = baseServerFactory();
  const originalTool = server.tool.bind(server);
  const tokenHash = hashToken(context.tokenEntry.token);

  (server as unknown as Record<string, unknown>).tool = function (...args: unknown[]) {
    const name = args[0] as string;
    const { app, action } = parseToolName(name);
    const granted = hasPermission(context.tokenEntry, app, action);
    const actionCategory = getActionCategory(app, action) ?? undefined;

    const handlerIndex = args.findIndex((a) => typeof a === "function");
    if (handlerIndex === -1) {
      return (originalTool as Function).apply(server, args);
    }

    if (!granted) {
      args[handlerIndex] = async () => {
        emitAuditLog({
          tokenDescription: context.tokenEntry.description,
          tokenHash,
          app,
          action,
          actionCategory,
          tool: name,
          granted: false,
          status: "denied",
          ip: context.ip,
          sessionId: context.sessionId,
        });

        return {
          content: [{
            type: "text",
            text: `Access denied. Token "${context.tokenEntry.description}" does not have permission for ${app}.${action}.`,
          }],
          isError: true,
        };
      };
    } else {
      const originalHandler = args[handlerIndex] as Function;
      args[handlerIndex] = async (...handlerArgs: unknown[]) => {
        const start = Date.now();
        try {
          const result = await originalHandler.apply(null, handlerArgs);
          emitAuditLog({
            tokenDescription: context.tokenEntry.description,
            tokenHash,
            app,
            action,
            actionCategory,
            tool: name,
            granted: true,
            status: "success",
            durationMs: Date.now() - start,
            ip: context.ip,
            sessionId: context.sessionId,
          });
          return result;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          emitAuditLog({
            tokenDescription: context.tokenEntry.description,
            tokenHash,
            app,
            action,
            actionCategory,
            tool: name,
            granted: true,
            status: "error",
            durationMs: Date.now() - start,
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
