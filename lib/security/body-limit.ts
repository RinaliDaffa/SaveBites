/**
 * SaveBites V3 — Body size guard
 *
 * Protects API routes from oversized request bodies (e.g. attacker posts
 * 50MB of garbage to fill memory / bump costs). Read the Content-Length
 * header up front and reject without reading the body.
 *
 * Default limit is 10 KB — generous for our JSON payloads and tight enough
 * to reject almost any abuse pattern.
 */

import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_LIMIT_BYTES = 10 * 1024;

export function guardBodySize(
  request: NextRequest,
  maxBytes: number = DEFAULT_LIMIT_BYTES
): NextResponse | null {
  const contentLength = request.headers.get('content-length');
  if (!contentLength) return null; // chunked / unknown → let route handle
  const bytes = Number(contentLength);
  if (!Number.isFinite(bytes) || bytes < 0) {
    return NextResponse.json({ error: 'Invalid content length' }, { status: 400 });
  }
  if (bytes > maxBytes) {
    return NextResponse.json(
      {
        error: `Request body too large. Maximum ${maxBytes} bytes.`,
      },
      { status: 413 }
    );
  }
  return null;
}