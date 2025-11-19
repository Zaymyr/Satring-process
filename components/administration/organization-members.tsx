'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  organizationMemberListResponseSchema,
  removeOrganizationMemberResponseSchema,
  type OrganizationMember
} from '@/lib/validation/organization-member';
import type { ProfileResponse } from '@/lib/validation/profile';

const ROLE_ORDER = ['owner', 'admin', 'member'] as const satisfies OrganizationMember['role'][];

const ROLE_LABELS: Record<OrganizationMember['role'], string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre'
};

const ROLE_LIMIT_LABELS: Record<OrganizationMember['role'], string> = {
  owner: 'Propriétaires',
  admin: 'Administrateurs',
  member: 'Membres'
};

const EMPTY_ROLE_LIMITS: ProfileResponse['organizations'][number]['roleLimits'] = {
  owner: null,
  admin: null,
  member: null
};

type OrganizationMembersProps = {
  organizationId: string;
  organizationName: string;
  canManage: boolean;
  planName?: string | null;
  roleLimits?: ProfileResponse['organizations'][number]['roleLimits'];
};

export function OrganizationMembers({
  organizationId,
  organizationName,
  canManage,
  planName,
  roleLimits
}: OrganizationMembersProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [removalTarget, setRemovalTarget] = useState<string | null>(null);
  const [openRoles, setOpenRoles] = useState<Record<OrganizationMember['role'], boolean>>(() =>
    ROLE_ORDER.reduce(
      (acc, role) => {
        acc[role] = true;
        return acc;
      },
      {} as Record<OrganizationMember['role'], boolean>
    )
  );

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

  const members = useMemo(
    () => (membersQuery.data ?? []) as OrganizationMember[],
    [membersQuery.data]
  );

  const normalizedRoleLimits = roleLimits ?? EMPTY_ROLE_LIMITS;

  const membersByRole = useMemo(() => {
    const grouped = ROLE_ORDER.reduce(
      (acc, role) => {
        acc[role] = [] as OrganizationMember[];
        return acc;
      },
      {} as Record<OrganizationMember['role'], OrganizationMember[]>
    );

    for (const member of members) {
      grouped[member.role]?.push(member);
    }

    ROLE_ORDER.forEach((role) => {
      grouped[role].sort((a, b) => {
        const left = a.username ?? a.email;
        const right = b.username ?? b.email;
        return left.localeCompare(right, 'fr', { sensitivity: 'base' });
      });
    });

    return grouped;
  }, [members]);

  const roleSummaries = ROLE_ORDER.map((role) => {
    const count = members.filter((member) => member.role === role).length;
    const limit = normalizedRoleLimits[role];
    const normalizedLimit = typeof limit === 'number' ? limit : null;
    const isAtOrAboveLimit = normalizedLimit !== null ? count >= normalizedLimit : false;
    const isOverLimit = normalizedLimit !== null ? count > normalizedLimit : false;
    const remaining = normalizedLimit !== null ? Math.max(normalizedLimit - count, 0) : null;
    const remainingLabel =
      typeof remaining === 'number'
        ? `${remaining} place${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`
        : null;
    const overBy = isOverLimit && normalizedLimit !== null ? count - normalizedLimit : null;
    const overLimitLabel =
      overBy !== null
        ? `Limite dépassée de ${overBy} place${overBy > 1 ? 's' : ''}`
        : null;

    return {
      role,
      label: ROLE_LABELS[role],
      count,
      limit: normalizedLimit,
      isAtOrAboveLimit,
      isOverLimit,
      remaining,
      remainingLabel,
      overBy,
      overLimitLabel
    };
  });

  const roleSummaryMap = roleSummaries.reduce(
    (acc, summary) => {
      acc[summary.role] = summary;
      return acc;
    },
    {} as Record<OrganizationMember['role'], (typeof roleSummaries)[number]>
  );

  const planLimitSummaries = ROLE_ORDER.map((role) => ({
    role,
    label: ROLE_LIMIT_LABELS[role],
    limit: normalizedRoleLimits[role]
  }));

  const exceededRoles = roleSummaries.filter((summary) => summary.isOverLimit);
  const hasExceededRoles = exceededRoles.length > 0;

  const toggleRoleSection = (role: OrganizationMember['role']) => {
    setOpenRoles((prev) => ({
      ...prev,
      [role]: !prev[role]
    }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-slate-900 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan actuel</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{planName ?? 'Plan non attribué'}</p>
        <dl className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
          {planLimitSummaries.map((entry) => (
            <div key={entry.role} className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {entry.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {typeof entry.limit === 'number'
                  ? `${entry.limit} place${entry.limit > 1 ? 's' : ''} max`
                  : 'Aucune limite'}
              </dd>
            </div>
          ))}
        </dl>
        {hasExceededRoles ? (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            Certaines limites sont dépassées. Pensez à mettre à jour votre plan pour ajouter plus de places.
          </div>
        ) : null}
      </div>

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
                ? summary.isOverLimit
                  ? summary.overLimitLabel
                  : summary.isAtOrAboveLimit
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

      {hasExceededRoles ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-900"
        >
          La limite est dépassée pour :{' '}
          {exceededRoles
            .map((summary) => `${summary.label.toLowerCase()} (${summary.count}/${summary.limit})`)
            .join(', ')}
          . Les invitations restent possibles mais nécessitent une mise à niveau rapide du plan.
        </div>
      ) : null}

      {!membersQuery.isLoading && members.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun membre trouvé pour cette organisation.</p>
      ) : null}

      {members.length > 0 ? (
        <ul className="space-y-3">
          {ROLE_ORDER.map((role) => {
            const roleMembers = membersByRole[role];
            const isOpen = openRoles[role];
            const panelId = `${organizationId}-${role}-members-panel`;
            const summary = roleSummaryMap[role];

            return (
              <li key={role} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => toggleRoleSection(role)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{ROLE_LABELS[role]}</p>
                    <p className="text-xs text-slate-500">
                      {summary.limit !== null
                        ? `${summary.count}/${summary.limit} membre${summary.count > 1 ? 's' : ''}`
                        : `${summary.count} membre${summary.count > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                    {summary.overLimitLabel ? (
                      <span className="text-rose-600">{summary.overLimitLabel}</span>
                    ) : summary.remainingLabel && !summary.isAtOrAboveLimit ? (
                      <span>{summary.remainingLabel}</span>
                    ) : summary.isAtOrAboveLimit ? (
                      <span className="text-amber-600">Limite atteinte</span>
                    ) : null}
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>
                {isOpen ? (
                  <div id={panelId} className="mt-3 space-y-2">
                    {roleMembers.length > 0 ? (
                      roleMembers.map((member) => {
                        const isRemoving = removeMutation.isPending && removalTarget === member.userId;

                        return (
                          <div
                            key={member.userId}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">
                                {member.username ?? member.email}
                              </p>
                              <p className="text-xs text-slate-500">{member.email}</p>
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
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-500">Aucun membre assigné à ce rôle.</p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
