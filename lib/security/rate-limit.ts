type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; locked: boolean };

type Bucket = {
  count: number;
  windowStartedAt: number;
  lockedUntil: number;
};

const buckets = new Map<string, Bucket>();

function nowMs() {
  return Date.now();
}

/** Best-effort client IP behind reverse proxies (Coolify/Nginx). */
export function getRequestClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Fixed-window counter with optional lockout after the limit is exceeded.
 * In-memory only (fine for a single app instance).
 */
export function consumeRateLimit(
  key: string,
  options: {
    limit: number;
    windowMs: number;
    lockMs?: number;
  }
): RateLimitResult {
  const current = nowMs();
  const existing = buckets.get(key);

  if (existing?.lockedUntil && existing.lockedUntil > current) {
    return {
      ok: false,
      locked: true,
      retryAfterSec: Math.max(1, Math.ceil((existing.lockedUntil - current) / 1000)),
    };
  }

  if (!existing || current - existing.windowStartedAt >= options.windowMs) {
    buckets.set(key, {
      count: 1,
      windowStartedAt: current,
      lockedUntil: 0,
    });
    return { ok: true };
  }

  existing.count += 1;

  if (existing.count > options.limit) {
    const lockMs = options.lockMs ?? options.windowMs;
    existing.lockedUntil = current + lockMs;
    return {
      ok: false,
      locked: true,
      retryAfterSec: Math.max(1, Math.ceil(lockMs / 1000)),
    };
  }

  return { ok: true };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
