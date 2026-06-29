/**
 * SaveBites V3 — Security utilities for HTTP request handling.
 *
 * - getClientIp: best-effort IP extraction that respects common
 *   proxy/CDN headers (Vercel x-forwarded-for, x-real-ip, CF-Connecting-IP).
 *
 * - rateLimitResponse: standardized JSON 429 response with the headers
 *   that downstream clients (and load testers) expect.
 *
 * - applyRateLimitHeaders: attach X-RateLimit-* and Retry-After headers
 *   to *any* response (success or failure) so well-behaved clients can
 *   self-throttle before being rejected.
 *
 * - constantTimeEquals: timing-safe string compare to defeat timing
 *   attacks on code-typed comparisons.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { RateLimitResult } from './rate-limit';

/**
 * Extract the originating IP. Prefers the leftmost entry of
 * x-forwarded-for (the original client), with fallbacks for other
 * proxy headers. If nothing is found, returns 'unknown' so the
 * rate limiter can still bucket — slightly degraded isolation in
 * that case, but never a no-op.
 */
export function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  return 'unknown';
}

/**
 * Standard JSON response for rate-limit failures.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfterSec = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return NextResponse.json(
    {
      error: 'Too many requests. Please try again later.',
      retryAfterMs: result.retryAfterMs,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(result.reset / 1000)),
      },
    }
  );
}

/**
 * Add X-RateLimit-* telemetry headers to a response object. Works on
 * both NextResponse (route handlers) and the per-request Response that
 * Server Actions can produce via NextResponse.
 */
export function applyRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.floor(result.reset / 1000)));
  if (!result.success) {
    response.headers.set('Retry-After', String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))));
  }
  return response;
}

/**
 * Constant-time string comparison. Returns false if lengths differ;
 * otherwise compares byte-by-byte with running XOR. Prevents timing
 * attacks against secret comparisons (e.g. 6-char pickup codes).
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still touch the strings to keep timing somewhat consistent.
    let diff = a.length ^ b.length;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Normalize a user-entered code: uppercase, strip non-alphanumeric.
 * Use before comparing / before passing to rate limit keying to make
 * sure case and whitespace don't double the bucket space.
 */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}