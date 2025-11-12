import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

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

const DEFAULT_USERS_PAGE_SIZE = 100;

export async function findAdminUserByEmail(
  adminClient: AdminClient,
  email: string
): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;

  // Limit pagination iterations to avoid potential infinite loops from inconsistent metadata.
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: DEFAULT_USERS_PAGE_SIZE
    });

    if (error) {
      throw error;
    }

    const users = data?.users ?? [];
    const matchingUser = users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail
    );

    if (matchingUser) {
      return matchingUser;
    }

    const nextPage = data?.nextPage;

    if (!nextPage || nextPage <= page) {
      break;
    }

    page = nextPage;
  }

  return null;
}
