import { describe, it, expect } from 'vitest';
import { rateLimit } from '@/lib/security/rate-limit';
import type { RateLimitConfig } from '@/lib/security/rate-limit';

describe('rateLimit (in-memory backend)', () => {
  function makeTestLimiter(cfg: Partial<RateLimitConfig>) {
    const limiter = rateLimit({
      limit: 5,
      windowMs: 1000,
      ...cfg,
    });
    return limiter;
  }

  it('allows requests up to the limit', async () => {
    const limiter = makeTestLimiter({ limit: 3, windowMs: 1000 });
    for (let i = 0; i < 3; i++) {
      const r = await limiter.check(`test:allow`);
      expect(r.success).toBe(true);
      expect(r.remaining).toBeGreaterThanOrEqual(0);
    }
  });

  it('rejects requests exceeding the limit', async () => {
    const limiter = makeTestLimiter({ limit: 2, windowMs: 1000 });
    const r1 = await limiter.check(`test:exceed`);
    const r2 = await limiter.check(`test:exceed`);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    const r3 = await limiter.check(`test:exceed`);
    expect(r3.success).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.retryAfterMs).toBeGreaterThan(0);
  });

  it('uses different keys independently', async () => {
    const limiter = makeTestLimiter({ limit: 1, windowMs: 1000 });
    const r1 = await limiter.check(`test:key-a`);
    const r2 = await limiter.check(`test:key-b`);
    // Different keys should not collide
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it('resets remaining correctly after exceeding', async () => {
    const limiter = makeTestLimiter({ limit: 2, windowMs: 1000 });
    await limiter.check('test:remaining');
    await limiter.check('test:remaining');
    const r = await limiter.check('test:remaining');
    expect(r.success).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.limit).toBe(2);
  });

  it('returns reset timestamp in the future', async () => {
    const limiter = makeTestLimiter({ limit: 1, windowMs: 1000 });
    await limiter.check('test:reset');
    const r = await limiter.check('test:reset');
    expect(r.reset).toBeGreaterThan(Date.now());
  });
});