import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// ─── Security headers (Harden defaults) ─────────────────────────
//
// Permissions-Policy is computed per-request so that /m/pickup can be
// exempted (camera=() omitted) to allow the merchant QR scanner to access
// the camera. All other routes keep camera blocked.

function getSecurityHeaders(request: NextRequest): Record<string, string> {
  const isPickupRoute = request.nextUrl.pathname.startsWith('/m/pickup');
  const permissionsPolicy = isPickupRoute
    ? 'accelerometer=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    : 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()';

  return {
    // HSTS — enforce HTTPS for 1 year; preload enabled.
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    // Prevent MIME-sniffing.
    'X-Content-Type-Options': 'nosniff',
    // Clickjack protection: SAMEORIGIN only.
    'X-Frame-Options': 'SAMEORIGIN',
    // Referrer policy: strip sensitive info off-origin.
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // X-XSS-Protection disabled (deprecated; CSP does the job).
    'X-XSS-Protection': '0',
    // Permissions policy: restrict legacy browser features.
    'Permissions-Policy': permissionsPolicy,
    // Content Security Policy (tightened for prod).
    'Content-Security-Policy':
      `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://* https://*.midtrans.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://dbizcmezzdsusqymagln.supabase.co https://*.midtrans.com https://app.midtrans.com; frame-src https://*.midtrans.com; object-src 'none'; base-uri 'self'; form-action 'self'`,
    // Disable DNS prefetch (reduce attack surface).
    'X-DNS-Prefetch-Control': 'off',
  };
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  // Attach security headers to the session response.
  const securityHeaders = getSecurityHeaders(request);
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};