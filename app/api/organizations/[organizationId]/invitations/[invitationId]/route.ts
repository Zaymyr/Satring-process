import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { organizationInvitations, organizationMembers } from '@/drizzle/schema';
import { db } from '@/lib/db';
import { fetchUserOrganizations } from '@/lib/organization/memberships';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import {
  organizationInvitationSchema,
  resendInvitationResponseSchema,
  revokeInvitationParamsSchema,
  revokeInvitationResponseSchema,
  type OrganizationInvitation
} from '@/lib/validation/invitation';
import type { ProfileResponse } from '@/lib/validation/profile';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } as const;

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
    throw new Error("Invitation invalide lors de la révocation.");
  }

  return parsed.data;
};

const AUTH_ERROR_RESPONSE = NextResponse.json(
  { error: 'Authentification requise.' },
  { status: 401, headers: NO_STORE_HEADERS }
);

const getAdminClientOrThrow = () => {
  try {
    return createAdminClient();
  } catch (error) {
    throw error instanceof Error && error.message.includes('SUPABASE_SERVICE_ROLE_KEY')
      ? new Error("Les invitations sont désactivées car la clé de service Supabase n'est pas configurée.")
      : error;
  }
};

type RouteContext = {
  params: { organizationId: string; invitationId: string };
};

export async function DELETE(_: Request, context: RouteContext) {
  const paramsResult = revokeInvitationParamsSchema.safeParse({
    organizationId: context.params.organizationId,
    invitationId: context.params.invitationId
  });

  if (!paramsResult.success) {
    const message = paramsResult.error.issues[0]?.message ?? 'Requête invalide.';
    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const { organizationId, invitationId } = paramsResult.data;

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
    console.error('Erreur lors de la récupération des organisations pour révocation', membershipError);
    return NextResponse.json(
      { error: "Impossible de vérifier vos autorisations d'organisation." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const membership = memberships.find((item) => item.organizationId === organizationId);

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json(
      { error: "Vous n'avez pas l'autorisation de révoquer des invitations pour cette organisation." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  let adminClient: ReturnType<typeof createAdminClient> | null = null;

  const ensureAdminClient = () => {
    if (!adminClient) {
      adminClient = getAdminClientOrThrow();
    }

    return adminClient;
  };

  let invitationRecord: RawInvitationRecord | null = null;

  try {
    const record = await db.query.organizationInvitations.findFirst({
      where: (fields, { and: andFn, eq: eqFn }) =>
        andFn(eqFn(fields.organizationId, organizationId), eqFn(fields.id, invitationId))
    });

    if (record) {
      invitationRecord = {
        id: record.id,
        organizationId: record.organizationId,
        invitedUserId: record.invitedUserId,
        inviterId: record.inviterId ?? null,
        email: record.email,
        role: record.role,
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        respondedAt: record.respondedAt,
        revokedAt: record.revokedAt
      };
    }
  } catch (error) {
    if (!isConnectionError(error)) {
      throw error;
    }

    try {
      const client = ensureAdminClient();
      const { data, error: supabaseError } = await client
        .from('organization_invitations')
        .select(
          'id, organization_id, invited_user_id, inviter_id, email, role, status, created_at, updated_at, responded_at, revoked_at'
        )
        .eq('organization_id', organizationId)
        .eq('id', invitationId)
        .maybeSingle();

      if (supabaseError) {
        throw supabaseError;
      }

      if (data) {
        invitationRecord = {
          id: data.id as string,
          organizationId: data.organization_id as string,
          invitedUserId: data.invited_user_id as string,
          inviterId: (data.inviter_id as string | null) ?? null,
          email: data.email as string,
          role: data.role as string,
          status: data.status as string,
          createdAt: data.created_at as string | null,
          updatedAt: data.updated_at as string | null,
          respondedAt: data.responded_at as string | null,
          revokedAt: data.revoked_at as string | null
        };
      }
    } catch (fallbackError) {
      console.error('Erreur lors de la récupération de linvitation pour révocation', fallbackError);
      return NextResponse.json(
        { error: "Impossible de récupérer l'invitation à révoquer." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  }

  if (!invitationRecord) {
    return NextResponse.json(
      { error: "Invitation introuvable pour cette organisation." },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const targetUserId = invitationRecord.invitedUserId;

  try {
    await db
      .delete(organizationMembers)
      .where(
        and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, targetUserId))
      );
  } catch (membershipDeleteError) {
    if (!isConnectionError(membershipDeleteError)) {
      console.error('Erreur lors de la suppression du membre pendant la révocation', membershipDeleteError);
      return NextResponse.json(
        { error: "Impossible de retirer le membre de l'organisation." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    try {
      const client = ensureAdminClient();
      const { error: supabaseError } = await client
        .from('organization_members')
        .delete()
        .eq('organization_id', organizationId)
        .eq('user_id', targetUserId);

      if (supabaseError) {
        throw supabaseError;
      }
    } catch (fallbackDeleteError) {
      console.error('Erreur Supabase lors de la suppression du membre', fallbackDeleteError);
      return NextResponse.json(
        { error: "Impossible de retirer le membre de l'organisation." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  }

  const now = new Date();
  let updatedRecord: RawInvitationRecord | null = null;

  try {
    const [record] = await db
      .update(organizationInvitations)
      .set({ status: 'revoked', revokedAt: now })
      .where(
        and(eq(organizationInvitations.organizationId, organizationId), eq(organizationInvitations.id, invitationId))
      )
      .returning();

    if (record) {
      updatedRecord = {
        id: record.id,
        organizationId: record.organizationId,
        invitedUserId: record.invitedUserId,
        inviterId: record.inviterId ?? null,
        email: record.email,
        role: record.role,
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        respondedAt: record.respondedAt,
        revokedAt: record.revokedAt
      };
    }
  } catch (updateError) {
    if (!isConnectionError(updateError)) {
      console.error('Erreur lors de la mise à jour du statut de linvitation', updateError);
      return NextResponse.json(
        { error: "Impossible de mettre à jour le statut de l'invitation." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    try {
      const client = ensureAdminClient();
      const { data, error: supabaseError } = await client
        .from('organization_invitations')
        .update({ status: 'revoked', revoked_at: now.toISOString() })
        .eq('organization_id', organizationId)
        .eq('id', invitationId)
        .select(
          'id, organization_id, invited_user_id, inviter_id, email, role, status, created_at, updated_at, responded_at, revoked_at'
        )
        .maybeSingle();

      if (supabaseError) {
        throw supabaseError;
      }

      if (data) {
        updatedRecord = {
          id: data.id as string,
          organizationId: data.organization_id as string,
          invitedUserId: data.invited_user_id as string,
          inviterId: (data.inviter_id as string | null) ?? null,
          email: data.email as string,
          role: data.role as string,
          status: data.status as string,
          createdAt: data.created_at as string | null,
          updatedAt: data.updated_at as string | null,
          respondedAt: data.responded_at as string | null,
          revokedAt: data.revoked_at as string | null
        };
      }
    } catch (fallbackUpdateError) {
      console.error('Erreur Supabase lors de la mise à jour du statut de linvitation', fallbackUpdateError);
      return NextResponse.json(
        { error: "Impossible de mettre à jour le statut de l'invitation." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  }

  if (!updatedRecord) {
    updatedRecord = invitationRecord;
  }

  let serialized: OrganizationInvitation;

  try {
    serialized = mapInvitationRecord(updatedRecord);
  } catch (serializationError) {
    console.error('Invitation révoquée invalide', serializationError);
    return NextResponse.json(
      { error: "L'invitation a été révoquée, mais les données retournées sont invalides." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const payload = revokeInvitationResponseSchema.parse({ invitation: serialized });

  return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request, context: RouteContext) {
  const paramsResult = revokeInvitationParamsSchema.safeParse({
    organizationId: context.params.organizationId,
    invitationId: context.params.invitationId
  });

  if (!paramsResult.success) {
    const message = paramsResult.error.issues[0]?.message ?? 'Requête invalide.';
    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const { organizationId, invitationId } = paramsResult.data;

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
    console.error('Erreur lors de la récupération des organisations pour renvoi', membershipError);
    return NextResponse.json(
      { error: "Impossible de vérifier vos autorisations d'organisation." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const membership = memberships.find((item) => item.organizationId === organizationId);

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json(
      { error: "Vous n'avez pas l'autorisation de renvoyer des invitations pour cette organisation." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin') ?? `${requestUrl.protocol}//${requestUrl.host}`;
  const invitationRedirect = new URL('/auth/callback', origin);
  invitationRedirect.searchParams.set('next', '/reset-password');

  let adminClient: ReturnType<typeof createAdminClient> | null = null;

  const ensureAdminClient = () => {
    if (!adminClient) {
      adminClient = getAdminClientOrThrow();
    }

    return adminClient;
  };

  let invitationRecord: RawInvitationRecord | null = null;

  try {
    const record = await db.query.organizationInvitations.findFirst({
      where: (fields, { and: andFn, eq: eqFn }) =>
        andFn(eqFn(fields.organizationId, organizationId), eqFn(fields.id, invitationId))
    });

    if (record) {
      invitationRecord = {
        id: record.id,
        organizationId: record.organizationId,
        invitedUserId: record.invitedUserId,
        inviterId: record.inviterId ?? null,
        email: record.email,
        role: record.role,
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        respondedAt: record.respondedAt,
        revokedAt: record.revokedAt
      };
    }
  } catch (error) {
    if (!isConnectionError(error)) {
      throw error;
    }

    try {
      const client = ensureAdminClient();
      const { data, error: supabaseError } = await client
        .from('organization_invitations')
        .select(
          'id, organization_id, invited_user_id, inviter_id, email, role, status, created_at, updated_at, responded_at, revoked_at'
        )
        .eq('organization_id', organizationId)
        .eq('id', invitationId)
        .maybeSingle();

      if (supabaseError) {
        throw supabaseError;
      }

      if (data) {
        invitationRecord = {
          id: data.id as string,
          organizationId: data.organization_id as string,
          invitedUserId: data.invited_user_id as string,
          inviterId: (data.inviter_id as string | null) ?? null,
          email: data.email as string,
          role: data.role as string,
          status: data.status as string,
          createdAt: data.created_at as string | null,
          updatedAt: data.updated_at as string | null,
          respondedAt: data.responded_at as string | null,
          revokedAt: data.revoked_at as string | null
        };
      }
    } catch (fallbackError) {
      console.error('Erreur lors de la récupération de linvitation pour renvoi', fallbackError);
      return NextResponse.json(
        { error: "Impossible de récupérer l'invitation à renvoyer." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  }

  if (!invitationRecord) {
    return NextResponse.json(
      { error: "Invitation introuvable pour cette organisation." },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  if (invitationRecord.status !== 'pending') {
    return NextResponse.json(
      { error: "Seules les invitations en attente peuvent être renvoyées." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const client = ensureAdminClient();
    const { error: inviteError } = await client.auth.admin.inviteUserByEmail(invitationRecord.email, {
      redirectTo: invitationRedirect.toString()
    });

    if (inviteError) {
      throw inviteError;
    }
  } catch (error) {
    console.error('Erreur lors du renvoi de linvitation', error);
    return NextResponse.json(
      { error: "Impossible de renvoyer cette invitation pour le moment." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const now = new Date();
  let updatedRecord: RawInvitationRecord | null = null;

  try {
    const [record] = await db
      .update(organizationInvitations)
      .set({ status: 'pending', respondedAt: null, revokedAt: null, updatedAt: now })
      .where(and(eq(organizationInvitations.organizationId, organizationId), eq(organizationInvitations.id, invitationId)))
      .returning();

    if (record) {
      updatedRecord = {
        id: record.id,
        organizationId: record.organizationId,
        invitedUserId: record.invitedUserId,
        inviterId: record.inviterId ?? null,
        email: record.email,
        role: record.role,
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        respondedAt: record.respondedAt,
        revokedAt: record.revokedAt
      };
    }
  } catch (updateError) {
    if (!isConnectionError(updateError)) {
      console.error('Erreur lors de la mise à jour du statut du renvoi', updateError);
      return NextResponse.json(
        { error: "Impossible de mettre à jour le suivi de l'invitation." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    try {
      const client = ensureAdminClient();
      const { data, error: supabaseError } = await client
        .from('organization_invitations')
        .update({ status: 'pending', responded_at: null, revoked_at: null, updated_at: now.toISOString() })
        .eq('organization_id', organizationId)
        .eq('id', invitationId)
        .select(
          'id, organization_id, invited_user_id, inviter_id, email, role, status, created_at, updated_at, responded_at, revoked_at'
        )
        .maybeSingle();

      if (supabaseError) {
        throw supabaseError;
      }

      if (data) {
        updatedRecord = {
          id: data.id as string,
          organizationId: data.organization_id as string,
          invitedUserId: data.invited_user_id as string,
          inviterId: (data.inviter_id as string | null) ?? null,
          email: data.email as string,
          role: data.role as string,
          status: data.status as string,
          createdAt: data.created_at as string | null,
          updatedAt: data.updated_at as string | null,
          respondedAt: data.responded_at as string | null,
          revokedAt: data.revoked_at as string | null
        };
      }
    } catch (fallbackUpdateError) {
      console.error('Erreur Supabase lors de la mise à jour du renvoi', fallbackUpdateError);
      return NextResponse.json(
        { error: "Impossible de mettre à jour le suivi de l'invitation." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  }

  const recordToSerialize = updatedRecord ?? invitationRecord;
  let serialized: OrganizationInvitation;

  try {
    serialized = mapInvitationRecord(recordToSerialize);
  } catch (serializationError) {
    console.error('Invitation renvoyée invalide', serializationError);
    return NextResponse.json(
      { error: "L'invitation a été renvoyée, mais les données retournées sont invalides." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const payload = resendInvitationResponseSchema.parse({
    invitation: serialized,
    message: 'Invitation renvoyée avec succès.'
  });

  return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
}
