import { NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';
import {
  removeOrganizationMemberParamsSchema,
  removeOrganizationMemberResponseSchema
} from '@/lib/validation/organization-member';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } as const;

type RouteContext = {
  params: { organizationId: string; userId: string };
};

export async function DELETE(_: Request, context: RouteContext) {
  const paramsResult = removeOrganizationMemberParamsSchema.safeParse(context.params);

  if (!paramsResult.success) {
    const firstIssue = paramsResult.error.issues[0];
    const message = firstIssue?.message ?? 'Paramètres invalides.';

    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const supabase = createServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const { organizationId, userId } = paramsResult.data;

  const { data: callerMembership, error: callerMembershipError } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (callerMembershipError) {
    return NextResponse.json(
      { error: "Impossible de vérifier vos autorisations dans l'organisation." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
    return NextResponse.json(
      { error: "Vous n'avez pas l'autorisation de retirer des membres de cette organisation." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const { data: targetMembership, error: targetError } = await supabase
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json(
      { error: "Impossible de récupérer le membre à supprimer." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!targetMembership) {
    return NextResponse.json(
      { error: 'Ce membre ne fait plus partie de cette organisation.' },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  if (targetMembership.role === 'owner') {
    const { data: ownerRows, error: ownerCountError } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId)
      .eq('role', 'owner');

    if (ownerCountError) {
      return NextResponse.json(
        { error: 'Impossible de vérifier les propriétaires de l’organisation.' },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const ownerCount = ownerRows?.length ?? 0;

    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas supprimer le dernier propriétaire de l'organisation." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
  }

  const { error: deleteError } = await supabase
    .from('organization_members')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', userId);

  if (deleteError) {
    const message = deleteError.code === '42501'
      ? "Vous n'avez pas l'autorisation de retirer ce membre."
      : "Impossible de supprimer ce membre de l'organisation.";

    return NextResponse.json(
      { error: message },
      { status: deleteError.code === '42501' ? 403 : 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(removeOrganizationMemberResponseSchema.parse({ success: true }), {
    headers: NO_STORE_HEADERS
  });
}
