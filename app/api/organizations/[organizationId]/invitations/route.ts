import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { organizationMembers } from '@/drizzle/schema';
import { fetchUserOrganizations } from '@/lib/organization/memberships';
import { db } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import {
  inviteMemberInputSchema,
  inviteMemberResponseSchema,
  type InvitationRole,
  type InviteMemberResponse
} from '@/lib/validation/invitation';
import type { ProfileResponse } from '@/lib/validation/profile';
import {
  updateOrganizationNameParamsSchema
} from '@/lib/validation/organization';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } as const;

const ROLE_MAPPING: Record<InvitationRole, ProfileResponse['organizations'][number]['role']> = {
  owner: 'owner',
  creator: 'admin',
  viewer: 'member'
};

type RouteContext = {
  params: { organizationId: string };
};

const AUTH_ERROR_RESPONSE = NextResponse.json(
  { error: 'Authentification requise.' },
  { status: 401, headers: NO_STORE_HEADERS }
);

export async function POST(request: Request, context: RouteContext) {
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

  const parsedBody = inviteMemberInputSchema.safeParse(body);

  if (!parsedBody.success) {
    const firstIssue = parsedBody.error.issues[0];
    const message = firstIssue?.message ?? 'Requête invalide.';

    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const { email, role } = parsedBody.data;
  const organizationId = paramsResult.data.organizationId;

  const supabase = createServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return AUTH_ERROR_RESPONSE;
  }

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la vérification des organisations pour invitation', membershipError);
    return NextResponse.json(
      { error: "Impossible de vérifier vos autorisations d'organisation." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const membership = memberships.find((item) => item.organizationId === organizationId);

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json(
      { error: "Vous n'avez pas l'autorisation d'inviter des membres dans cette organisation." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  let adminClient;

  try {
    adminClient = createAdminClient();
  } catch (error) {
    console.error('Client administrateur Supabase indisponible', error);
    return NextResponse.json(
      { error: "Impossible d'envoyer une invitation pour le moment." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const mappedRole = ROLE_MAPPING[role];

  const { data: existingUserResult, error: existingUserError } = await adminClient.auth.admin.getUserByEmail(normalizedEmail);

  if (existingUserError) {
    console.error("Erreur lors de la recherche d'un utilisateur avant invitation", existingUserError);
    return NextResponse.json(
      { error: "Impossible de vérifier l'état du compte à inviter." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  let targetUserId = existingUserResult?.user?.id ?? null;
  let invitationStatus: InviteMemberResponse['status'] = 'added';

  if (!targetUserId) {
    const { data: invitation, error: invitationError } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail);

    if (invitationError) {
      console.error("Erreur lors de la création de l'invitation", invitationError);
      return NextResponse.json(
        { error: "Impossible d'envoyer une invitation à cette adresse." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    targetUserId = invitation.user?.id ?? null;
    invitationStatus = 'invited';
  }

  if (!targetUserId) {
    return NextResponse.json(
      { error: "L'invitation a été envoyée, mais aucun identifiant utilisateur n'a été retourné." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const existingMembership = await db.query.organizationMembers.findFirst({
    where: (fields, { and: andFn, eq: eqFn }) =>
      andFn(eqFn(fields.organizationId, organizationId), eqFn(fields.userId, targetUserId))
  });

  if (existingMembership) {
    if (existingMembership.role === mappedRole) {
      return NextResponse.json(
        inviteMemberResponseSchema.parse({
          success: true,
          status: 'already-member',
          message: 'Cet utilisateur fait déjà partie de cette organisation avec ce rôle.'
        }),
        { headers: NO_STORE_HEADERS }
      );
    }

    await db
      .update(organizationMembers)
      .set({ role: mappedRole })
      .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, targetUserId)));

    return NextResponse.json(
      inviteMemberResponseSchema.parse({
        success: true,
        status: invitationStatus === 'invited' ? 'invited' : 'updated',
        message:
          invitationStatus === 'invited'
            ? "Invitation envoyée et rôle mis à jour pour l'utilisateur." : 'Rôle du membre mis à jour.'
      }),
      { headers: NO_STORE_HEADERS }
    );
  }

  await db.insert(organizationMembers).values({
    organizationId,
    userId: targetUserId,
    role: mappedRole
  });

  return NextResponse.json(
    inviteMemberResponseSchema.parse({
      success: true,
      status: invitationStatus,
      message:
        invitationStatus === 'invited'
          ? 'Invitation envoyée avec succès.'
          : 'Utilisateur ajouté à l’organisation.'
    }),
    { headers: NO_STORE_HEADERS }
  );
}
