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
};

export function OrganizationMembers({ organizationId, organizationName, canManage }: OrganizationMembersProps) {
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

  return (
    <div className="space-y-3">
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
