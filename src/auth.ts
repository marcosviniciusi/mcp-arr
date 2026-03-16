import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

export interface AuthConfig {
  /** Comma-separated list of valid Bearer tokens */
  tokens: string[];
  /** Paths that skip auth (e.g. /health) */
  publicPaths: Set<string>;
}

/**
 * Timing-safe token comparison to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Simple in-memory rate limiter per IP.
 * Tracks failed auth attempts and blocks after threshold.
 */
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
 * Express middleware for Bearer token authentication.
 *
 * - Skips auth for public paths (e.g. /health)
 * - Supports multiple tokens (multi-user / rotation)
 * - Uses timing-safe comparison
 * - Rate limits failed attempts per IP
 */
export function authMiddleware(config: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip auth for public paths
    if (config.publicPaths.has(req.path)) {
      next();
      return;
    }

    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

    // Rate limit check
    if (rateLimiter.isBlocked(ip)) {
      res.status(429).json({ error: "Too many failed attempts. Try again later." });
      return;
    }

    // Extract token from Authorization header or query param
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }

    // Also support ?token= query param (useful for SSE EventSource which can't set headers)
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

    // Check against all valid tokens
    const valid = config.tokens.some((t) => safeCompare(token!, t));

    if (!valid) {
      rateLimiter.recordFailure(ip);
      res.status(403).json({ error: "Invalid token" });
      return;
    }

    // Auth passed — reset rate limit for this IP
    rateLimiter.reset(ip);
    next();
  };
}
