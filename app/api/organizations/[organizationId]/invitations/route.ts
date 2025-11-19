import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { organizationInvitations, organizationMembers } from '@/drizzle/schema';
import { fetchUserOrganizations } from '@/lib/organization/memberships';
import { db } from '@/lib/db';
import { createAdminClient, findAdminUserByEmail } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import {
  inviteMemberInputSchema,
  inviteMemberResponseSchema,
  organizationInvitationListResponseSchema,
  organizationInvitationSchema,
  organizationInvitationStatusSchema,
  type InvitationRole,
  type InviteMemberResponse,
  type OrganizationInvitation
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

type OrganizationMember = typeof organizationMembers.$inferSelect;
type AdminSupabaseClient = ReturnType<typeof createAdminClient>;

const isConnectionError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const withCode = error as { code?: string | number; errno?: string | number; message?: string };
  const code = withCode.code ?? withCode.errno;
  const message = withCode.message ?? '';

  if (code && typeof code === 'string') {
    const normalizedCode = code.toUpperCase();

    if (['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH'].includes(normalizedCode)) {
      return true;
    }
  }

  return typeof message === 'string'
    ? message.includes('getaddrinfo ENOTFOUND') || message.includes('getaddrinfo EAI_AGAIN')
    : false;
};

const fetchMembershipViaSupabase = async (
  client: AdminSupabaseClient,
  organizationId: string,
  userId: string
): Promise<OrganizationMember | null> => {
  const { data, error } = await client
    .from('organization_members')
    .select('organization_id, user_id, role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as OrganizationMember | null) ?? null;
};

const updateMembershipRole = async (
  client: AdminSupabaseClient,
  organizationId: string,
  userId: string,
  role: OrganizationMember['role']
) => {
  try {
    await db
      .update(organizationMembers)
      .set({ role })
      .where(
        and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId))
      );
  } catch (error) {
    if (!isConnectionError(error)) {
      throw error;
    }

    const { error: supabaseError } = await client
      .from('organization_members')
      .update({ role })
      .eq('organization_id', organizationId)
      .eq('user_id', userId);

    if (supabaseError) {
      throw supabaseError;
    }
  }
};

const insertMembership = async (
  client: AdminSupabaseClient,
  organizationId: string,
  userId: string,
  role: OrganizationMember['role']
) => {
  try {
    await db.insert(organizationMembers).values({
      organizationId,
      userId,
      role
    });
  } catch (error) {
    if (!isConnectionError(error)) {
      throw error;
    }

    const { error: supabaseError } = await client.from('organization_members').insert({
      organization_id: organizationId,
      user_id: userId,
      role
    });

    if (supabaseError) {
      throw supabaseError;
    }
  }
};

const normalizeDate = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

type RawInvitationRecord = {
  id: string;
  organizationId: string;
  invitedUserId: string;
  inviterId: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  respondedAt: Date | string | null;
  revokedAt: Date | string | null;
};

const mapInvitationRecord = (record: RawInvitationRecord): OrganizationInvitation => {
  const parsed = organizationInvitationSchema.safeParse({
    id: record.id,
    organizationId: record.organizationId,
    invitedUserId: record.invitedUserId,
    inviterId: record.inviterId ?? null,
    email: record.email,
    role: record.role,
    status: record.status,
    createdAt: normalizeDate(record.createdAt),
    updatedAt: normalizeDate(record.updatedAt),
    respondedAt: normalizeDate(record.respondedAt),
    revokedAt: normalizeDate(record.revokedAt)
  });

  if (!parsed.success) {
    throw new Error('Invitation record is invalid.');
  }

  return parsed.data;
};

const fetchOrganizationInvitations = async (
  organizationId: string,
  adminClient?: AdminSupabaseClient
): Promise<OrganizationInvitation[]> => {
  try {
    const rows = await db.query.organizationInvitations.findMany({
      where: (fields, { eq: eqFn }) => eqFn(fields.organizationId, organizationId),
      orderBy: (fields, { desc }) => desc(fields.createdAt)
    });

    return rows.map((row) =>
      mapInvitationRecord({
        id: row.id,
        organizationId: row.organizationId,
        invitedUserId: row.invitedUserId,
        inviterId: row.inviterId ?? null,
        email: row.email,
        role: row.role,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        respondedAt: row.respondedAt,
        revokedAt: row.revokedAt
      })
    );
  } catch (error) {
    if (!isConnectionError(error)) {
      throw error;
    }

    if (!adminClient) {
      adminClient = createAdminClient();
    }

    const { data, error: supabaseError } = await adminClient
      .from('organization_invitations')
      .select(
        'id, organization_id, invited_user_id, inviter_id, email, role, status, created_at, updated_at, responded_at, revoked_at'
      )
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (supabaseError) {
      throw supabaseError;
    }

    const records = (data ?? []).map((item) =>
      mapInvitationRecord({
        id: item.id as string,
        organizationId: item.organization_id as string,
        invitedUserId: item.invited_user_id as string,
        inviterId: (item.inviter_id as string | null) ?? null,
        email: item.email as string,
        role: item.role as string,
        status: item.status as string,
        createdAt: item.created_at as string | null,
        updatedAt: item.updated_at as string | null,
        respondedAt: item.responded_at as string | null,
        revokedAt: item.revoked_at as string | null
      })
    );

    return records;
  }
};

const upsertInvitationRecord = async (
  adminClient: AdminSupabaseClient,
  params: {
    organizationId: string;
    invitedUserId: string;
    inviterId: string;
    email: string;
    role: OrganizationMember['role'];
    status: z.infer<typeof organizationInvitationStatusSchema>;
    respondedAt: Date | null;
  }
) => {
  const { organizationId, invitedUserId, inviterId, email, role, status, respondedAt } = params;

  organizationInvitationStatusSchema.parse(status);

  try {
    await db
      .insert(organizationInvitations)
      .values({
        organizationId,
        invitedUserId,
        inviterId,
        email,
        role,
        status,
        respondedAt,
        revokedAt: null
      })
      .onConflictDoUpdate({
        target: [organizationInvitations.organizationId, organizationInvitations.invitedUserId],
        set: {
          inviterId,
          email,
          role,
          status,
          respondedAt,
          revokedAt: null
        }
      });
  } catch (error) {
    if (!isConnectionError(error)) {
      throw error;
    }

    const { error: supabaseError } = await adminClient
      .from('organization_invitations')
      .upsert(
        [{
          organization_id: organizationId,
          invited_user_id: invitedUserId,
          inviter_id: inviterId,
          email,
          role,
          status,
          responded_at: respondedAt,
          revoked_at: null
        }],
        { onConflict: 'organization_id,invited_user_id' }
      );

    if (supabaseError) {
      throw supabaseError;
    }
  }
};

type RouteContext = {
  params: { organizationId: string };
};

const AUTH_ERROR_RESPONSE = NextResponse.json(
  { error: 'Authentification requise.' },
  { status: 401, headers: NO_STORE_HEADERS }
);

export async function GET(_: Request, context: RouteContext) {
  const paramsResult = updateOrganizationNameParamsSchema.safeParse(context.params);

  if (!paramsResult.success) {
    return NextResponse.json(
      { error: "Identifiant d'organisation invalide." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const supabase = createServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return AUTH_ERROR_RESPONSE;
  }

  let memberships: ProfileResponse['organizations'];

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour consultation des invitations', membershipError);
    return NextResponse.json(
      { error: "Impossible de vérifier vos autorisations d'organisation." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const organizationId = paramsResult.data.organizationId;
  const membership = memberships.find((item) => item.organizationId === organizationId);

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json(
      { error: "Vous n'avez pas l'autorisation de consulter les invitations de cette organisation." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const invitations = await fetchOrganizationInvitations(organizationId);
    const payload = organizationInvitationListResponseSchema.parse({ invitations });

    return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('Erreur lors de la récupération des invitations de l\'organisation', error);

    const message =
      error instanceof Error && error.message.includes('SUPABASE_SERVICE_ROLE_KEY')
        ? "Les invitations ne peuvent pas être consultées car la clé de service Supabase est manquante."
        : "Impossible de récupérer les invitations de l'organisation.";

    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

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

  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin') ?? `${requestUrl.protocol}//${requestUrl.host}`;
  const invitationRedirect = new URL('/auth/callback', origin);
  invitationRedirect.searchParams.set('next', '/reset-password');

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
    const message =
      error instanceof Error && error.message.includes('SUPABASE_SERVICE_ROLE_KEY')
        ?
          "Les invitations sont désactivées car la clé de service Supabase n'est pas configurée."
        : "Impossible d'envoyer une invitation pour le moment.";

    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const mappedRole = ROLE_MAPPING[role];

  let existingUser = null;

  try {
    existingUser = await findAdminUserByEmail(adminClient, normalizedEmail);
  } catch (existingUsersError) {
    console.error("Erreur lors de la recherche d'un utilisateur avant invitation", existingUsersError);
    return NextResponse.json(
      { error: "Impossible de vérifier l'état du compte à inviter." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  let targetUserId = existingUser?.id ?? null;
  let invitationStatus: InviteMemberResponse['status'] = 'added';

  if (!targetUserId) {
    const { data: invitation, error: invitationError } = await adminClient.auth.admin.inviteUserByEmail(
      normalizedEmail,
      { redirectTo: invitationRedirect.toString() }
    );

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

  let existingMembership: OrganizationMember | null = null;

  try {
    const membershipRecord = await db.query.organizationMembers.findFirst({
      where: (fields, { and: andFn, eq: eqFn }) =>
        andFn(eqFn(fields.organizationId, organizationId), eqFn(fields.userId, targetUserId))
    });

    existingMembership = membershipRecord ?? null;
  } catch (membershipLookupError) {
    if (!isConnectionError(membershipLookupError)) {
      console.error(
        "Erreur lors de la récupération de l'état du membre dans l'organisation",
        membershipLookupError
      );
      return NextResponse.json(
        { error: "Impossible d'enregistrer l'invitation dans la base de données." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    console.warn(
      'Connexion directe à la base de données indisponible, utilisation de Supabase en secours',
      membershipLookupError
    );

    try {
      existingMembership = await fetchMembershipViaSupabase(adminClient, organizationId, targetUserId);
    } catch (fallbackLookupError) {
      console.error(
        "Erreur lors de l'utilisation de Supabase pour récupérer l'état du membre",
        fallbackLookupError
      );
      return NextResponse.json(
        { error: "Impossible d'enregistrer l'invitation dans la base de données." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  }

  let finalStatus: InviteMemberResponse['status'];
  let responseMessage: string;

  if (existingMembership) {
    if (existingMembership.role === mappedRole) {
      finalStatus = 'already-member';
      responseMessage = 'Cet utilisateur fait déjà partie de cette organisation avec ce rôle.';
    } else {
      if (existingMembership.role === 'owner' && mappedRole !== 'owner') {
        const { data: ownerRows, error: ownerCountError } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', organizationId)
          .eq('role', 'owner');

        if (ownerCountError) {
          console.error('Erreur lors du comptage des propriétaires avant changement de rôle', ownerCountError);
          return NextResponse.json(
            { error: "Impossible de vérifier les propriétaires de l'organisation." },
            { status: 500, headers: NO_STORE_HEADERS }
          );
        }

        if ((ownerRows?.length ?? 0) <= 1) {
          return NextResponse.json(
            { error: "Vous ne pouvez pas retirer le dernier propriétaire de l'organisation." },
            { status: 400, headers: NO_STORE_HEADERS }
          );
        }
      }

      try {
        await updateMembershipRole(adminClient, organizationId, targetUserId, mappedRole);
      } catch (updateMembershipError) {
        console.error(
          'Erreur lors de la mise à jour du rôle du membre dans la base de données',
          updateMembershipError
        );
        return NextResponse.json(
          { error: "Impossible de mettre à jour le rôle du membre dans l'organisation." },
          { status: 500, headers: NO_STORE_HEADERS }
        );
      }

      finalStatus = invitationStatus === 'invited' ? 'invited' : 'updated';
      responseMessage =
        invitationStatus === 'invited'
          ? "Invitation envoyée et rôle mis à jour pour l'utilisateur."
          : 'Rôle du membre mis à jour.';
    }
  } else {
    try {
      await insertMembership(adminClient, organizationId, targetUserId, mappedRole);
    } catch (createMembershipError) {
      console.error(
        "Erreur lors de l'enregistrement du nouveau membre dans l'organisation",
        createMembershipError
      );
      return NextResponse.json(
        { error: "Impossible d'enregistrer l'invitation dans la base de données." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    finalStatus = invitationStatus;
    responseMessage =
      invitationStatus === 'invited'
        ? 'Invitation envoyée avec succès.'
        : 'Utilisateur ajouté à l’organisation.';
  }

  const invitationRecordStatus = finalStatus === 'invited' ? 'pending' : 'accepted';
  const respondedAt = invitationRecordStatus === 'accepted' ? new Date() : null;

  try {
    await upsertInvitationRecord(adminClient, {
      organizationId,
      invitedUserId: targetUserId,
      inviterId: user.id,
      email: normalizedEmail,
      role: mappedRole,
      status: invitationRecordStatus,
      respondedAt
    });
  } catch (invitationRecordError) {
    console.error('Erreur lors de la mise à jour du suivi des invitations', invitationRecordError);
    return NextResponse.json(
      { error: "L'invitation a été traitée, mais son suivi n'a pas pu être mis à jour." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    inviteMemberResponseSchema.parse({
      success: true,
      status: finalStatus,
      message: responseMessage
    }),
    { headers: NO_STORE_HEADERS }
  );
}
