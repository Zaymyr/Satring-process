'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  organizationMemberListResponseSchema,
  removeOrganizationMemberResponseSchema,
  type OrganizationMember
} from '@/lib/validation/organization-member';

const ROLE_LABELS: Record<OrganizationMember['role'], string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre'
};

type OrganizationMembersProps = {
  organizationId: string;
  organizationName: string;
  canManage: boolean;
  roleLimits?: Partial<Record<OrganizationMember['role'], number>>;
};

export function OrganizationMembers({
  organizationId,
  organizationName,
  canManage,
  roleLimits = {}
}: OrganizationMembersProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [removalTarget, setRemovalTarget] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ['organization', organizationId, 'members'],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${organizationId}/members`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json) {
        const message = (json && typeof json.error === 'string')
          ? json.error
          : "Impossible de récupérer les membres de l'organisation.";

        throw new Error(message);
      }

      const parsed = organizationMemberListResponseSchema.safeParse(json);

      if (!parsed.success) {
        throw new Error('Réponse invalide lors du chargement des membres.');
      }

      return parsed.data.members;
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/organizations/${organizationId}/members/${userId}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' }
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json) {
        const message = (json && typeof json.error === 'string')
          ? json.error
          : "Impossible de retirer ce membre.";

        throw new Error(message);
      }

      const parsed = removeOrganizationMemberResponseSchema.safeParse(json);

      if (!parsed.success) {
        throw new Error('Réponse invalide après la suppression du membre.');
      }

      return parsed.data;
    },
    onMutate: (userId) => {
      setServerError(null);
      setSuccessMessage(null);
      setRemovalTarget(userId);
    },
    onError: (error: unknown) => {
      setSuccessMessage(null);
      setServerError(error instanceof Error ? error.message : 'Une erreur inattendue est survenue.');
    },
    onSuccess: () => {
      setServerError(null);
      setSuccessMessage('Membre retiré de l’organisation.');
    },
    onSettled: () => {
      setRemovalTarget(null);
      queryClient.invalidateQueries({ queryKey: ['organization', organizationId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'self'] });
    }
  });

  const members = (membersQuery.data ?? []) as OrganizationMember[];

  const roleSummaries = (['owner', 'admin', 'member'] satisfies OrganizationMember['role'][]).map((role) => {
    const count = members.filter((member) => member.role === role).length;
    const limit = roleLimits[role];
    const isAtOrAboveLimit = typeof limit === 'number' ? count >= limit : false;
    const remaining = typeof limit === 'number' ? Math.max(limit - count, 0) : null;
    const remainingLabel =
      typeof remaining === 'number'
        ? `${remaining} place${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`
        : null;

    return {
      role,
      label: ROLE_LABELS[role],
      count,
      limit: typeof limit === 'number' ? limit : null,
      isAtOrAboveLimit,
      remaining,
      remainingLabel
    };
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {roleSummaries.map((summary) => (
          <div
            key={summary.role}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{summary.label}</p>
              {summary.limit !== null ? (
                <span
                  className={`text-xs font-semibold ${summary.isAtOrAboveLimit ? 'text-amber-600' : 'text-slate-500'}`}
                >
                  {summary.count}/{summary.limit}
                </span>
              ) : (
                <span className="text-xs font-semibold text-slate-400">—</span>
              )}
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{summary.count}</p>
            <p className="text-xs text-slate-500">
              {summary.limit !== null
                ? summary.isAtOrAboveLimit
                  ? 'Limite atteinte'
                  : summary.remainingLabel ?? ''
                : 'Aucune limite configurée'}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">Membres de l’organisation</h3>
        <p className="text-sm text-slate-500">
          Gérez les personnes qui ont accès à {organizationName} et leurs rôles.
        </p>
      </div>

      {membersQuery.isLoading ? (
        <p className="text-sm text-slate-500">Chargement des membres…</p>
      ) : null}

      {membersQuery.isError ? (
        <p className="text-sm text-red-600" role="alert">
          {membersQuery.error instanceof Error
            ? membersQuery.error.message
            : "Impossible de récupérer les membres pour le moment."}
        </p>
      ) : null}

      {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      {!membersQuery.isLoading && members.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun membre trouvé pour cette organisation.</p>
      ) : null}

      {members.length > 0 ? (
        <ul className="space-y-2">
          {members.map((member) => {
            const isRemoving = removeMutation.isPending && removalTarget === member.userId;

            return (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {member.username ?? member.email}
                  </p>
                  <p className="text-xs text-slate-500">
                    {ROLE_LABELS[member.role]} • {member.email}
                  </p>
                </div>
                {canManage ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 text-slate-900 hover:text-white"
                    onClick={() => removeMutation.mutate(member.userId)}
                    disabled={isRemoving}
                  >
                    {isRemoving ? 'Suppression…' : 'Retirer'}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
