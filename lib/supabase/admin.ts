import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/utils/env';

type AdminClient = SupabaseClient;

export function createAdminClient(): AdminClient {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
