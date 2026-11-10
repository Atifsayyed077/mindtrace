/**
 * Minimal in-memory fixed-window rate limiter for server actions.
 * Per-process on a single Node server; adequate for the free-plan
 * deployment and public write endpoints. Cryptographic hot paths get
 * tight limits; unauthenticated abuse keys off IP + route.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5000;

function pruneExpired(now: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export type RateResult = { ok: true } | { ok: false; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  pruneExpired(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { ok: true };
}
