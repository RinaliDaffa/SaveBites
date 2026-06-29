import { describe, it, expect } from 'vitest';
import { guardBodySize } from '@/lib/security/body-limit';
import { NextRequest } from 'next/server';

function makeRequest(contentLength: string | null): NextRequest {
  const headers = new Headers();
  if (contentLength !== null) headers.set('content-length', contentLength);
  return new NextRequest('http://localhost/api/test', {
    method: 'POST',
    headers,
  });
}

describe('guardBodySize', () => {
  it('returns null when no content-length header is present', () => {
    const r = guardBodySize(makeRequest(null), 100);
    expect(r).toBeNull();
  });

  it('returns null when body is under the limit', () => {
    const r = guardBodySize(makeRequest('50'), 100);
    expect(r).toBeNull();
  });

  it('returns 413 when body exceeds the limit', async () => {
    const r = guardBodySize(makeRequest('200'), 100);
    expect(r).not.toBeNull();
    expect(r!.status).toBe(413);
    const body = await r!.json();
    expect(body.error).toMatch(/too large/i);
  });

  it('returns 400 when content-length is invalid', async () => {
    const r = guardBodySize(makeRequest('not-a-number'), 100);
    expect(r).not.toBeNull();
    expect(r!.status).toBe(400);
  });

  it('returns 400 when content-length is negative', async () => {
    const r = guardBodySize(makeRequest('-1'), 100);
    expect(r).not.toBeNull();
    expect(r!.status).toBe(400);
  });

  it('uses default 10 KB limit when not specified', async () => {
    const r = guardBodySize(makeRequest('20000'));
    expect(r).not.toBeNull();
    expect(r!.status).toBe(413);
  });

  it('allows bodies exactly at the limit', () => {
    const r = guardBodySize(makeRequest('100'), 100);
    expect(r).toBeNull();
  });
});