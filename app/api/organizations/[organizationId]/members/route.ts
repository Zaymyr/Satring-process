import { NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';
import {
  organizationMemberListResponseSchema,
  type OrganizationMember
} from '@/lib/validation/organization-member';
import { organizationIdSchema } from '@/lib/validation/organization';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } as const;

type RouteContext = {
  params: { organizationId: string };
};

export async function GET(_: Request, context: RouteContext) {
  const paramsResult = organizationIdSchema.safeParse(context.params.organizationId);

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
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const organizationId = paramsResult.data;

  const { data, error } = await supabase.rpc('get_organization_members', { target_org_id: organizationId });

  if (error) {
    const message = error.code === '42501'
      ? "Vous n'avez pas l'autorisation de consulter les membres de cette organisation."
      : "Impossible de récupérer les membres de l'organisation.";

    return NextResponse.json(
      { error: message },
      { status: error.code === '42501' ? 403 : 500, headers: NO_STORE_HEADERS }
    );
  }

  type RpcMemberRow = {
    user_id: string;
    email: string;
    username: string | null;
    role: string;
    joined_at: string;
  };

  let members: OrganizationMember[] = [];

  try {
    const rawMembers = (data ?? []) as RpcMemberRow[];

    members = rawMembers.map((item: RpcMemberRow) => {
      const joinedAtRaw = String(item.joined_at);
      const joinedAtDate = new Date(joinedAtRaw);

      if (Number.isNaN(joinedAtDate.getTime())) {
        throw new Error('Invalid joined_at value');
      }

      return {
        userId: String(item.user_id),
        email: String(item.email),
        username: item.username ?? null,
        role: String(item.role) as OrganizationMember['role'],
        joinedAt: joinedAtDate.toISOString()
      } satisfies OrganizationMember;
    });
  } catch (parseError) {
    console.error('Invalid organization member payload', parseError);

    return NextResponse.json(
      { error: 'Réponse invalide lors de la récupération des membres.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const parsed = organizationMemberListResponseSchema.safeParse({ members });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Réponse invalide lors de la récupération des membres.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsed.data, { headers: NO_STORE_HEADERS });
}
