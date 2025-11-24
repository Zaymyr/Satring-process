import type { AuthError, User } from '@supabase/supabase-js';
import { createServerClient } from './server';

export type ServerUserResult = {
  user: User | null;
  error: AuthError | Error | null;
};

export async function getServerUser(
  supabase: ReturnType<typeof createServerClient>
): Promise<ServerUserResult> {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return { user: null, error };
    }

    return { user: data.user, error: null };
  } catch (unknownError) {
    const normalizedError =
      unknownError instanceof Error
        ? unknownError
        : new Error('Unknown error while retrieving authenticated user');

    console.error('Erreur lors de la récupération de l’utilisateur', normalizedError);
    return { user: null, error: normalizedError };
  }
}
