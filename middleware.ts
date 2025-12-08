import { NextResponse, type NextRequest } from 'next/server';
import { LRUCache } from 'lru-cache';


const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 100;

const rateLimitCache = new LRUCache<string, { count: number; expires: number }>({ max: 5000 });

const securityHeaders: Record<string, string> = {
  'Permissions-Policy': 'geolocation=()'
};

export function middleware(request: NextRequest) {
  const requestUrl = request.nextUrl;
  const isAuthCallback = requestUrl.pathname === '/auth/callback';

  if (
    !isAuthCallback &&
    (requestUrl.searchParams.has('code') ||
      (requestUrl.searchParams.has('access_token') && requestUrl.searchParams.has('refresh_token')))
  ) {
    const redirectUrl = new URL('/auth/callback', requestUrl);
    redirectUrl.search = requestUrl.search;

    return NextResponse.redirect(redirectUrl);
  }

  const ip =
    request.ip || request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'anonymous';

  const now = Date.now();
  const existing = rateLimitCache.get(ip);
  if (existing && existing.expires > now) {
    if (existing.count >= RATE_LIMIT_MAX) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
    existing.count += 1;
    rateLimitCache.set(ip, existing);
  } else {
    rateLimitCache.set(ip, { count: 1, expires: now + RATE_LIMIT_WINDOW_MS });
  }

  const response = NextResponse.next();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export const config = {
  matcher: ['/((?!_next/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)).*)']
};
