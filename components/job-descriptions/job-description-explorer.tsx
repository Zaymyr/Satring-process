'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { departmentListSchema, type Department as ApiDepartment } from '@/lib/validation/department';
import { roleActionSummaryListSchema, type RoleActionSummary } from '@/lib/validation/role-action';

class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const json = await response.json();
    if (json && typeof json === 'object' && typeof json.message === 'string') {
      return json.message;
    }
  } catch (error) {
    console.error('Unable to parse error response', error);
  }

  return fallback;
};

const fetchDepartments = async (): Promise<ApiDepartment[]> => {
  const response = await fetch('/api/departments', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store'
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de lister vos départements.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return departmentListSchema.parse(json);
};

const fetchRoleActions = async (): Promise<RoleActionSummary[]> => {
  const response = await fetch('/api/roles/actions', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store'
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de récupérer les actions des rôles.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return roleActionSummaryListSchema.parse(json);
};

const EMPTY_DEPARTMENTS: ApiDepartment[] = [];
const EMPTY_ROLE_SUMMARIES: RoleActionSummary[] = [];

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

const formatActionsCount = (count: number) => {
  if (count === 0) {
    return 'Aucune action';
  }

  if (count === 1) {
    return '1 action';
  }

  return `${count} actions`;
};

export function JobDescriptionExplorer() {
  const departmentQuery = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    staleTime: 30_000
  });
  const roleActionQuery = useQuery({
    queryKey: ['role-actions'],
    queryFn: fetchRoleActions,
    staleTime: 30_000
  });

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const departments = departmentQuery.data ?? EMPTY_DEPARTMENTS;
  const roleSummaries = roleActionQuery.data ?? EMPTY_ROLE_SUMMARIES;

  const roleSummaryById = useMemo(() => {
    return roleSummaries.reduce<Map<string, RoleActionSummary>>((accumulator, summary) => {
      accumulator.set(summary.roleId, summary);
      return accumulator;
    }, new Map());
  }, [roleSummaries]);

  const departmentByRoleId = useMemo(() => {
    return departments.reduce<Map<string, ApiDepartment>>((accumulator, department) => {
      for (const role of department.roles ?? []) {
        accumulator.set(role.id, department);
      }
      return accumulator;
    }, new Map());
  }, [departments]);

  const roleById = useMemo(() => {
    return departments.reduce<Map<string, { id: string; name: string }>>((accumulator, department) => {
      for (const role of department.roles ?? []) {
        accumulator.set(role.id, { id: role.id, name: role.name });
      }
      return accumulator;
    }, new Map());
  }, [departments]);

  useEffect(() => {
    if (selectedRoleId) {
      return;
    }

    if (roleSummaries.length > 0) {
      setSelectedRoleId(roleSummaries[0].roleId);
      return;
    }

    for (const department of departments) {
      const firstRole = department.roles?.[0];
      if (firstRole) {
        setSelectedRoleId(firstRole.id);
        return;
      }
    }
  }, [departments, roleSummaries, selectedRoleId]);

  const selectedSummary = selectedRoleId ? roleSummaryById.get(selectedRoleId) : undefined;
  const selectedRole = selectedRoleId ? roleById.get(selectedRoleId) : undefined;
  const selectedDepartment = selectedRoleId
    ? departmentByRoleId.get(selectedRoleId) ??
      (selectedSummary
        ? { id: selectedSummary.departmentId, name: selectedSummary.departmentName, color: '#E2E8F0', roles: [] }
        : undefined)
    : undefined;

  const groupedActions = useMemo(() => {
    if (!selectedSummary) {
      return [] as Array<{ processId: string; processTitle: string; steps: string[] }>;
    }

    const map = new Map<string, { processId: string; processTitle: string; steps: string[] }>();

    for (const action of selectedSummary.actions) {
      const existing = map.get(action.processId);
      if (existing) {
        existing.steps.push(action.stepLabel);
        continue;
      }

      map.set(action.processId, {
        processId: action.processId,
        processTitle: action.processTitle,
        steps: [action.stepLabel]
      });
    }

    return Array.from(map.values()).map((group) => ({
      ...group,
      steps: Array.from(new Set(group.steps))
    }));
  }, [selectedSummary]);

  const isLoading = departmentQuery.isLoading || roleActionQuery.isLoading;
  const hasError = departmentQuery.isError || roleActionQuery.isError;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 bg-slate-50 lg:grid-cols-[320px,1fr]">
      <aside className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
        <div className="flex h-full max-h-full flex-col">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Départements & rôles</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sélectionnez un rôle pour afficher sa fiche de poste générée automatiquement.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                <span className="ml-2 text-sm font-medium">Chargement des rôles…</span>
              </div>
            ) : hasError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {getErrorMessage(departmentQuery.error ?? roleActionQuery.error, 'Une erreur est survenue lors du chargement.')}
              </p>
            ) : departments.length === 0 ? (
              <p className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600">
                Aucun département n’a encore été créé.
              </p>
            ) : (
              <div className="space-y-4">
                {departments.map((department) => {
                  const departmentRoles = department.roles ?? [];
                  return (
                    <details
                      key={department.id}
                      open
                      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                    >
                      <summary className="flex cursor-pointer items-center justify-between gap-2 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: department.color }}
                          />
                          {department.name}
                        </span>
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          {formatActionsCount(
                            departmentRoles.reduce((total, role) => {
                              const summary = roleSummaryById.get(role.id);
                              return total + (summary?.actions.length ?? 0);
                            }, 0)
                          )}
                        </span>
                      </summary>
                      <div className="space-y-2 bg-white px-4 py-3">
                        {departmentRoles.length === 0 ? (
                          <p className="text-sm text-slate-500">Aucun rôle défini pour ce département.</p>
                        ) : (
                          departmentRoles.map((role) => {
                            const summary = roleSummaryById.get(role.id);
                            const actionCount = summary?.actions.length ?? 0;
                            const isActive = selectedRoleId === role.id;
                            return (
                              <button
                                key={role.id}
                                type="button"
                                onClick={() => setSelectedRoleId(role.id)}
                                className={cn(
                                  'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500',
                                  isActive
                                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                )}
                              >
                                <span className="truncate">{role.name}</span>
                                <span
                                  className={cn(
                                    'ml-3 shrink-0 text-xs font-semibold uppercase tracking-wide',
                                    isActive ? 'text-white/80' : 'text-slate-400'
                                  )}
                                >
                                  {formatActionsCount(actionCount)}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>
      <section className="flex min-h-0 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
          {isLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">Chargement de la fiche de poste…</p>
            </div>
          ) : hasError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-6 text-sm text-red-600">
              {getErrorMessage(
                departmentQuery.error ?? roleActionQuery.error,
                'Impossible de générer la fiche de poste pour le moment.'
              )}
            </div>
          ) : !selectedRoleId ? (
            <div className="rounded-lg border border-slate-200 bg-white px-5 py-6 text-sm text-slate-600">
              Sélectionnez un rôle dans la colonne de gauche pour afficher sa fiche de poste détaillée.
            </div>
          ) : (
            <>
              <header className="rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fiche de poste</p>
                <h1 className="mt-2 text-2xl font-bold text-slate-900">{selectedRole?.name ?? 'Rôle non nommé'}</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {selectedDepartment ? (
                    <>
                      Au sein du département <span className="font-semibold text-slate-900">{selectedDepartment.name}</span>, ce rôle
                      coordonne et exécute les actions clés qui suivent afin d’assurer la réussite des processus opérationnels.
                    </>
                  ) : (
                    "Ce rôle coordonne et exécute les actions clés suivantes afin d’assurer la réussite des processus opérationnels."
                  )}
                </p>
              </header>

              <div className="space-y-6">
                <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Responsabilités principales</h2>
                  {groupedActions.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-600">
                      Aucune action n’est encore associée à ce rôle. Assignez des étapes depuis vos processus pour générer une fiche de poste
                      complète.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-5">
                      {groupedActions.map((group) => (
                        <div key={group.processId} className="space-y-2">
                          <h3 className="text-sm font-semibold text-slate-800">{group.processTitle}</h3>
                          <ul className="space-y-1 pl-4 text-sm text-slate-600">
                            {group.steps.map((step) => (
                              <li key={step} className="list-disc">
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Objectifs et indicateurs</h2>
                  <p className="mt-3 text-sm text-slate-600">
                    Utilisez les actions associées à ce rôle pour définir des objectifs mesurables. Identifiez les indicateurs clés de performance
                    (KPI) liés à chaque processus afin de suivre efficacement la contribution du rôle.
                  </p>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Collaboration attendue</h2>
                  <p className="mt-3 text-sm text-slate-600">
                    Cette fiche met en lumière les interactions principales du rôle avec les autres équipes. Servez-vous des matrices RACI pour
                    préciser qui intervient, valide ou doit être informé sur chaque étape des processus partagés.
                  </p>
                </section>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
