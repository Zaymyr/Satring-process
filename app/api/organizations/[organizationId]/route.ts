import { NextResponse } from 'next/server';

import { fetchUserOrganizations } from '@/lib/organization/memberships';
import { createServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/auth';
import {
  profileOrganizationSchema,
  type ProfileResponse
} from '@/lib/validation/profile';
import {
  updateOrganizationNameInputSchema,
  updateOrganizationNameParamsSchema,
  type UpdateOrganizationNameInput
} from '@/lib/validation/organization';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } as const;

const mapUpdateError = (error: { code?: string | null }) => {
  const code = (error.code ?? '').toUpperCase();

  switch (code) {
    case '42501':
      return {
        status: 403,
        message: "Vous n'avez pas l'autorisation de modifier cette organisation."
      } as const;
    case '23505':
      return {
        status: 409,
        message: "Une autre organisation porte déjà ce nom."
      } as const;
    default:
      return {
        status: 500,
        message: "Impossible de mettre à jour le nom de l'organisation."
      } as const;
  }
};

type RouteContext = {
  params: { organizationId: string };
};

export async function PATCH(request: Request, context: RouteContext) {
  const paramsResult = updateOrganizationNameParamsSchema.safeParse(context.params);

  if (!paramsResult.success) {
    return NextResponse.json(
      { error: "Identifiant d'organisation invalide." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const parsedBody = updateOrganizationNameInputSchema.safeParse(body);

  if (!parsedBody.success) {
    const firstIssue = parsedBody.error.issues[0];
    const message = firstIssue?.message ?? 'Requête invalide.';

    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const payload: UpdateOrganizationNameInput = parsedBody.data;

  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const organizationId = paramsResult.data.organizationId;

  const { data: updatedRow, error: updateError } = await supabase
    .from('organizations')
    .update({ name: payload.name })
    .eq('id', organizationId)
    .select('id')
    .single();

  if (updateError) {
    const mapped = mapUpdateError(updateError);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (!updatedRow) {
    return NextResponse.json({ error: 'Organisation introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  let memberships: ProfileResponse['organizations'];

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations après mise à jour', membershipError);
    return NextResponse.json(
      { error: "Le nom a été mis à jour, mais une erreur est survenue lors de la récupération des organisations." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const updatedOrganization = memberships.find((membership) => membership.organizationId === organizationId);

  if (!updatedOrganization) {
    return NextResponse.json(
      { error: 'Organisation introuvable après mise à jour.' },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const parsedOrganization = profileOrganizationSchema.safeParse(updatedOrganization);

  if (!parsedOrganization.success) {
    console.error('Organisation mise à jour invalide', parsedOrganization.error);
    return NextResponse.json(
      { error: "Le nom a été mis à jour, mais les données retournées sont invalides." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsedOrganization.data, { headers: NO_STORE_HEADERS });
}
