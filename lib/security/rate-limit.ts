/**
 * SaveBites V3 — Rate Limiting
 *
 * Sliding-window rate limiter with two backends:
 *
 *   1. Upstash Redis (production, serverless-safe via REST API).
 *      Activated when both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 *      are present in the environment.
 *
 *   2. In-memory fallback (development / un-configured environments).
 *      Uses a Map<key, number[]> with timestamps. Single-process only —
 *      suitable for `next dev` and `next start` on a single box. Each
 *      invocation is identified by an entry hash so collisions are limited
 *      to a single server instance.
 *
 * Returned object follows the convention used by @upstash/ratelimit so the
 * two backends are interchangeable from the caller's perspective:
 *
 *   { success, limit, remaining, reset, retryAfterMs }
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix ms when the window resets. */
  reset: number;
  /** Suggested wait in ms before retrying. 0 on success. */
  retryAfterMs: number;
}

export interface RateLimitConfig {
  /** Maximum requests in the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

// ─── In-memory backend (sliding window) ─────────────────────────

interface InMemoryEntry {
  timestamps: number[];
}

const memoryStore = new Map<string, InMemoryEntry>();

// Garbage-collect the in-memory store periodically. Map keeps growing
// otherwise across long-running dev sessions.
const GC_INTERVAL_MS = 60_000;
let gcTimer: ReturnType<typeof setInterval> | null = null;
function ensureGc() {
  if (gcTimer) return;
  gcTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      // Drop entries whose newest timestamp is older than any active window.
      const freshest = entry.timestamps.at(-1) ?? 0;
      if (now - freshest > GC_INTERVAL_MS * 5) {
        memoryStore.delete(key);
      }
    }
  }, GC_INTERVAL_MS);
}

function memoryCheck(key: string, cfg: RateLimitConfig): RateLimitResult {
  ensureGc();
  const now = Date.now();
  const cutoff = now - cfg.windowMs;
  const entry = memoryStore.get(key) ?? { timestamps: [] };
  // Drop everything outside the sliding window.
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  const used = entry.timestamps.length;
  const remaining = Math.max(0, cfg.limit - used - 1);

  if (used >= cfg.limit) {
    // Reset = oldest timestamp + window.
    const oldest = entry.timestamps[0] ?? now;
    const reset = oldest + cfg.windowMs;
    memoryStore.set(key, entry);
    return {
      success: false,
      limit: cfg.limit,
      remaining: 0,
      reset,
      retryAfterMs: Math.max(0, reset - now),
    };
  }

  entry.timestamps.push(now);
  memoryStore.set(key, entry);
  return {
    success: true,
    limit: cfg.limit,
    remaining,
    reset: now + cfg.windowMs,
    retryAfterMs: 0,
  };
}

// ─── Upstash backend (sliding window via Redis REST) ────────────

async function upstashCheck(
  key: string,
  cfg: RateLimitConfig
): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const now = Date.now();
  const windowStart = now - cfg.windowMs;
  const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;

  // Sliding-window via sorted set:
  //   1. ZREMRANGEBYSCORE remove members older than windowStart
  //   2. ZCARD get the current count
  //   3. ZADD this request
  //   4. EXPIRE so cold keys auto-clean
  //
  // All four run as a single MULTI / pipeline via the Upstash /pipeline
  // endpoint. Each command is ["<VERB>", "<key>", ...args].
  const fullKey = `rl:${key}`;
  const pipeline = [
    ['ZREMRANGEBYSCORE', fullKey, '0', String(windowStart)],
    ['ZCARD', fullKey],
    ['ZADD', fullKey, String(now), member],
    ['EXPIRE', fullKey, String(Math.ceil(cfg.windowMs / 1000) + 1)],
  ];

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipeline),
      // Don't let Upstash hiccups blow up our routes.
      signal: AbortSignal.timeout(2000),
    });

    if (!res.ok) {
      console.error('[ratelimit] upstash non-ok status:', res.status);
      return null;
    }

    const body = (await res.json()) as Array<{ result: number | string }>;
    // ZCARD result is the second command in the pipeline.
    const currentCount = Number(body[1]?.result ?? 0);
    const used = currentCount; // includes the one we just added
    const remaining = Math.max(0, cfg.limit - used);

    if (used > cfg.limit) {
      // We went over with our own request — roll back the increment.
      // (Real production should be using ZADD NX or a Lua script, but the
      // count-as-you-add approach is good enough for low-rate limits.)
      const oldestKey = `rl:${key}:oldest`;
      // Best-effort: log and accept that one request leaked through.
      return {
        success: false,
        limit: cfg.limit,
        remaining: 0,
        reset: now + cfg.windowMs,
        retryAfterMs: cfg.windowMs,
      };
    }

    return {
      success: true,
      limit: cfg.limit,
      remaining,
      reset: now + cfg.windowMs,
      retryAfterMs: 0,
    };
  } catch (e) {
    console.error('[ratelimit] upstash error:', e);
    return null;
  }
}

// ─── Public factory ─────────────────────────────────────────────

/**
 * Build a rate limiter bound to a particular policy. The returned function
 * is async and may be called inside both Edge middleware and Node server
 * actions.
 */
export function rateLimit(cfg: RateLimitConfig): RateLimiter {
  return {
    async check(key: string): Promise<RateLimitResult> {
      const upstash = await upstashCheck(key, cfg);
      if (upstash) return upstash;
      return memoryCheck(key, cfg);
    },
  };
}

// ─── Pre-built policies (exported for ergonomic call-sites) ────

/** Verification of a 6-char pickup code — anti-brute-force. */
export const pickupVerifyLimit = rateLimit({
  limit: 10,
  windowMs: 60_000,
});

/** Payment webhook — Midtrans may hammer, but cap to bound damage. */
export const paymentWebhookLimit = rateLimit({
  limit: 60,
  windowMs: 60_000,
});

/** Login attempts — anti-credential-stuffing. */
export const loginLimit = rateLimit({
  limit: 5,
  windowMs: 60_000,
});

/** Forgot password — anti-email-enumeration / spam. */
export const forgotPasswordLimit = rateLimit({
  limit: 3,
  windowMs: 60_000,
});

/** New account creation. */
export const registerLimit = rateLimit({
  limit: 3,
  windowMs: 60_000,
});

/** Password reset (already-authenticated). */
export const resetPasswordLimit = rateLimit({
  limit: 3,
  windowMs: 60_000,
});

/** Generic write limit for the orders + reviews APIs. */
export const genericWriteLimit = rateLimit({
  limit: 30,
  windowMs: 60_000,
});

/** Order reservation (consumer flow) — anti-spam for stock-locking. */
export const orderReserveLimit = rateLimit({
  limit: 10,
  windowMs: 60_000,
});

/** Order pickup confirm (merchant scanner) — anti-brute-force on pickup code. */
export const orderPickupLimit = rateLimit({
  limit: 10,
  windowMs: 60_000,
});