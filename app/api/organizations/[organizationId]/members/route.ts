import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createServerClient } from '@/lib/supabase/server';
import {
  organizationMemberListResponseSchema,
  userIdSchema,
  type OrganizationMember
} from '@/lib/validation/organization-member';
import { organizationIdSchema } from '@/lib/validation/organization';
import { organizationRoleSchema, usernameSchema } from '@/lib/validation/profile';

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

  type RawMember = {
    joined_at: string | Date;
    user_id: string;
    email: string;
    username: string | null;
    role: string;
  };

  const rawMemberSchema = z.object({
    joined_at: z.union([z.string(), z.date()]),
    user_id: userIdSchema,
    email: z.string().email(),
    username: z.string().nullable(),
    role: organizationRoleSchema
  });

  const parseJoinedAt = (value: RawMember['joined_at']): string => {
    const raw = value instanceof Date ? value : new Date(String(value));

    if (!Number.isNaN(raw.getTime())) {
      return raw.toISOString();
    }

    if (typeof value === 'string') {
      const normalized = value.replace(' ', 'T');
      const retry = new Date(normalized);

      if (!Number.isNaN(retry.getTime())) {
        return retry.toISOString();
      }
    }

    throw new Error('Invalid joined_at value');
  };

  let members: OrganizationMember[] = [];

  try {
    const rawMembers = rawMemberSchema.array().parse((data ?? []) as RawMember[]);

    members = rawMembers.map((item) => {
      const joinedAt = parseJoinedAt(item.joined_at);
      const parsedUsername = item.username ? usernameSchema.safeParse(item.username.trim()) : null;

      return {
        userId: String(item.user_id),
        email: String(item.email),
        username: parsedUsername?.success ? parsedUsername.data : null,
        role: String(item.role) as OrganizationMember['role'],
        joinedAt
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
