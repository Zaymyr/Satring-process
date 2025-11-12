import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createServerClient(cookies());
    await supabase.auth.exchangeCodeForSession(code);
  }

  const rawNext = requestUrl.searchParams.get('next');
  const type = requestUrl.searchParams.get('type');

  let nextPath = '/';

  if (rawNext && rawNext.startsWith('/')) {
    nextPath = rawNext;
  } else if (!rawNext && (type === 'invite' || type === 'signup' || type === 'recovery')) {
    nextPath = '/reset-password';
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
