import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import type { TokenEntry } from "./rbac.js";

declare global {
  namespace Express {
    interface Request {
      /** Authenticated token entry — set by authMiddleware */
      tokenEntry?: TokenEntry;
    }
  }
}

export interface AuthConfig {
  tokenEntries: TokenEntry[];
  publicPaths: Set<string>;
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

class RateLimiter {
  private attempts = new Map<string, { count: number; resetAt: number }>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts = 10, windowMs = 60_000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isBlocked(ip: string): boolean {
    const entry = this.attempts.get(ip);
    if (!entry) return false;
    if (Date.now() > entry.resetAt) {
      this.attempts.delete(ip);
      return false;
    }
    return entry.count >= this.maxAttempts;
  }

  recordFailure(ip: string): void {
    const now = Date.now();
    const entry = this.attempts.get(ip);
    if (!entry || now > entry.resetAt) {
      this.attempts.set(ip, { count: 1, resetAt: now + this.windowMs });
    } else {
      entry.count++;
    }
  }

  reset(ip: string): void {
    this.attempts.delete(ip);
  }
}

const rateLimiter = new RateLimiter();

/**
 * Express middleware for Bearer token authentication with RBAC.
 * Sets req.tokenEntry on successful auth for downstream use.
 */
export function authMiddleware(config: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (config.publicPaths.has(req.path)) {
      next();
      return;
    }

    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

    if (rateLimiter.isBlocked(ip)) {
      res.status(429).json({ error: "Too many failed attempts. Try again later." });
      return;
    }

    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }

    if (!token && typeof req.query.token === "string") {
      token = req.query.token;
    }

    if (!token) {
      rateLimiter.recordFailure(ip);
      res.status(401).json({
        error: "Authentication required",
        hint: "Provide a Bearer token in the Authorization header or ?token= query parameter",
      });
      return;
    }

    // Find matching token entry (timing-safe comparison)
    const matched = config.tokenEntries.find((entry) => safeCompare(token!, entry.token));

    if (!matched) {
      rateLimiter.recordFailure(ip);
      res.status(403).json({ error: "Invalid token" });
      return;
    }

    rateLimiter.reset(ip);
    req.tokenEntry = matched;
    next();
  };
}
