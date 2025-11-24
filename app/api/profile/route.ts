import type { SupabaseClient, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/auth';
import { fetchUserOrganizations } from '@/lib/organization/memberships';
import {
  profileResponseSchema,
  type ProfileResponse,
  updateProfileInputSchema,
  type UpdateProfileInput
} from '@/lib/validation/profile';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } as const;

async function buildProfileResponse(supabase: SupabaseClient, user: User): Promise<ProfileResponse> {
  const { data: profileData, error: profileError } = await supabase
    .from('user_profiles')
    .select('username')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const memberships = await fetchUserOrganizations(supabase);

  const parsed = profileResponseSchema.safeParse({
    email: user.email ?? '',
    username: profileData?.username ?? null,
    organizations: memberships
  });

  if (!parsed.success) {
    throw parsed.error;
  }

  return parsed.data;
}

export async function GET() {
  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  try {
    const profile = await buildProfileResponse(supabase, user);
    return NextResponse.json(profile, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('Erreur lors de la récupération du profil utilisateur', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer les informations de votre profil.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

const mapUpsertError = (error: { code?: string | null }) => {
  const code = (error.code ?? '').toUpperCase();

  switch (code) {
    case '23505':
      return { status: 409, message: "Ce nom d'utilisateur est déjà utilisé." } as const;
    case '42501':
      return { status: 403, message: "Vous n'avez pas l'autorisation de modifier ce profil." } as const;
    case '23503':
      return { status: 404, message: 'Profil utilisateur introuvable.' } as const;
    default:
      return { status: 500, message: "Impossible de mettre à jour le nom d'utilisateur." } as const;
  }
};

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsedBody = updateProfileInputSchema.safeParse(body);

  if (!parsedBody.success) {
    const firstIssue = parsedBody.error.issues[0];
    const message = firstIssue?.message ?? 'Requête invalide.';

    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const payload: UpdateProfileInput = parsedBody.data;

  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const { error: upsertError } = await supabase
    .from('user_profiles')
    .upsert({ user_id: user.id, username: payload.username }, { onConflict: 'user_id' })
    .select('username')
    .single();

  if (upsertError) {
    const mapped = mapUpsertError(upsertError);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  try {
    const profile = await buildProfileResponse(supabase, user);
    return NextResponse.json(profile, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('Erreur lors de la récupération du profil après mise à jour', error);
    return NextResponse.json(
      { error: 'Le profil a été mis à jour, mais une erreur est survenue lors de la récupération des données.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
