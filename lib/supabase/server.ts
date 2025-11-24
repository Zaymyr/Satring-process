import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/utils/env';

type CookieStore = ReturnType<typeof cookies>;

const MAX_ERROR_BODY_LENGTH = 500;

const safeFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json') && !response.ok) {
    const bodyText = (await response.clone().text().catch(() => ''))?.trim();
    const message = bodyText ? bodyText.slice(0, MAX_ERROR_BODY_LENGTH) : response.statusText;

    return new Response(
      JSON.stringify({
        error: {
          message,
          status: response.status
        }
      }),
      {
        status: response.status,
        headers: { 'content-type': 'application/json' },
        statusText: response.statusText
      }
    );
  }

  return response;
};

export function createServerClient(cookieStore: CookieStore = cookies()) {
  return createSupabaseServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        fetch: safeFetch
      },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete({ name, ...options });
        }
      }
    }
  );
}
