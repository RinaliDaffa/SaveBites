import { describe, it, expect } from 'vitest';
import {
  getClientIp,
  rateLimitResponse,
  applyRateLimitHeaders,
} from '@/lib/security/request';
import type { RateLimitResult } from '@/lib/security/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

function makeReq(headers: Record<string, string>): NextRequest {
  const h = new Headers();
  for (const [k, v] of Object.entries(headers)) h.set(k, v);
  return new NextRequest('http://localhost/test', { headers: h });
}

describe('getClientIp', () => {
  it('returns the first IP from x-forwarded-for', () => {
    const req = makeReq({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(getClientIp(req)).toBe('203.0.113.5');
  });

  it('returns the leftmost IP when there are 3 entries', () => {
    const req = makeReq({ 'x-forwarded-for': '203.0.113.1, 198.51.100.1, 10.0.0.1' });
    expect(getClientIp(req)).toBe('203.0.113.1');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeReq({ 'x-real-ip': '203.0.113.42' });
    expect(getClientIp(req)).toBe('203.0.113.42');
  });

  it('falls back to cf-connecting-ip', () => {
    const req = makeReq({ 'cf-connecting-ip': '198.51.100.99' });
    expect(getClientIp(req)).toBe('198.51.100.99');
  });

  it('prefers x-forwarded-for over x-real-ip and cf-connecting-ip', () => {
    const req = makeReq({
      'x-forwarded-for': '203.0.113.1',
      'x-real-ip': '203.0.113.2',
      'cf-connecting-ip': '203.0.113.3',
    });
    expect(getClientIp(req)).toBe('203.0.113.1');
  });

  it('returns "unknown" when no IP headers are present', () => {
    const req = makeReq({});
    expect(getClientIp(req)).toBe('unknown');
  });

  it('trims whitespace around forwarded IPs', () => {
    const req = makeReq({ 'x-forwarded-for': '  203.0.113.5  ' });
    expect(getClientIp(req)).toBe('203.0.113.5');
  });
});

describe('rateLimitResponse', () => {
  const fakeResult: RateLimitResult = {
    success: false,
    limit: 5,
    remaining: 0,
    reset: Date.now() + 60_000,
    retryAfterMs: 30_000,
  };

  it('returns status 429 with Retry-After header', async () => {
    const res = rateLimitResponse(fakeResult);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('returns JSON body with retryAfterMs', async () => {
    const res = rateLimitResponse(fakeResult);
    const body = await res.json();
    expect(body.error).toMatch(/too many/i);
    expect(body.retryAfterMs).toBe(30_000);
  });

  it('clamps Retry-After to at least 1 second', () => {
    const r: RateLimitResult = { ...fakeResult, retryAfterMs: 100 };
    const res = rateLimitResponse(r);
    expect(res.headers.get('Retry-After')).toBe('1');
  });
});

describe('applyRateLimitHeaders', () => {
  const fakeResult: RateLimitResult = {
    success: true,
    limit: 10,
    remaining: 5,
    reset: Date.now() + 30_000,
    retryAfterMs: 0,
  };

  it('attaches X-RateLimit-* headers to a response', () => {
    const res = NextResponse.json({ ok: true });
    applyRateLimitHeaders(res, fakeResult);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('5');
  });

  it('adds Retry-After when result is a failure', () => {
    const res = NextResponse.json({ ok: true });
    const failResult: RateLimitResult = {
      ...fakeResult,
      success: false,
      remaining: 0,
      retryAfterMs: 15_000,
    };
    applyRateLimitHeaders(res, failResult);
    expect(res.headers.get('Retry-After')).toBe('15');
  });
});