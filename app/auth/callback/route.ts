import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const accessToken = requestUrl.searchParams.get('access_token');
  const refreshToken = requestUrl.searchParams.get('refresh_token');
  const expiresAtParam = requestUrl.searchParams.get('expires_at');
  const expiresInParam = requestUrl.searchParams.get('expires_in');
  
  if (code || (accessToken && refreshToken)) {
    const supabase = createServerClient(cookies());

    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    } else if (accessToken && refreshToken) {
      const expiresAt = expiresAtParam ? Number.parseInt(expiresAtParam, 10) : undefined;
      const expiresIn = expiresInParam ? Number.parseInt(expiresInParam, 10) : undefined;

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
        ...(Number.isFinite(expiresAt) ? { expires_at: expiresAt } : {}),
        ...(Number.isFinite(expiresIn) ? { expires_in: expiresIn } : {})
      });

      if (error) {
        return NextResponse.redirect(new URL('/sign-in?error=invalid_link', requestUrl.origin));
      }
    }
  }

  const rawNext = requestUrl.searchParams.get('next');
  const type = requestUrl.searchParams.get('type');

  let nextPath = '/';

  if (rawNext && rawNext.startsWith('/')) {
    nextPath = rawNext;
  } else if (!rawNext) {
    if (type === 'invite' || type === 'recovery') {
      nextPath = '/reset-password';
    }
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
