'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RotateCw } from 'lucide-react';

import { useI18n } from '@/components/providers/i18n-provider';
import { cn } from '@/lib/utils/cn';
import { departmentListSchema, type Department as ApiDepartment } from '@/lib/validation/department';
import { jobDescriptionResponseSchema, type JobDescription } from '@/lib/validation/job-description';
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

const fetchJobDescription = async (roleId: string): Promise<JobDescription | null> => {
  const response = await fetch(`/api/job-descriptions/${roleId}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store'
  });

  if (response.status === 404) {
    return null;
  }

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de récupérer la fiche de poste.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  const parsed = jobDescriptionResponseSchema.parse(json);
  return parsed.jobDescription;
};

const refreshJobDescription = async (roleId: string): Promise<JobDescription> => {
  const response = await fetch(`/api/job-descriptions/${roleId}`, {
    method: 'POST',
    credentials: 'include'
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de générer la fiche de poste.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  const parsed = jobDescriptionResponseSchema.parse(json);

  if (!parsed.jobDescription) {
    throw new ApiError('Aucune fiche de poste renvoyée par le serveur.', 500);
  }

  return parsed.jobDescription;
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

const formatUpdatedAt = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date inconnue';
  }

  return date.toLocaleString('fr-FR');
};

export function JobDescriptionExplorer() {
  const { dictionary } = useI18n();
  const sidebarTexts = dictionary.jobDescriptions.explorer.sidebar;
  const actionTexts = dictionary.jobDescriptions.explorer.actions;
  const queryClient = useQueryClient();
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
  const [expandedDepartments, setExpandedDepartments] = useState<Record<string, boolean>>({});

  const jobDescriptionQuery = useQuery({
    queryKey: ['job-description', selectedRoleId],
    queryFn: () => fetchJobDescription(selectedRoleId as string),
    enabled: Boolean(selectedRoleId),
    staleTime: 30_000
  });

  const refreshDescriptionMutation = useMutation({
    mutationFn: (roleId: string) => refreshJobDescription(roleId),
    onSuccess: (data) => {
      queryClient.setQueryData(['job-description', data.roleId], data);
    }
  });

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
    return departments.reduce<Map<string, { id: string; name: string; color: string }>>(
      (accumulator, department) => {
        for (const role of department.roles ?? []) {
          accumulator.set(role.id, { id: role.id, name: role.name, color: role.color });
        }
        return accumulator;
      },
      new Map()
    );
  }, [departments]);

  useEffect(() => {
    if (selectedRoleId && !roleById.has(selectedRoleId)) {
      setSelectedRoleId(null);
    }
  }, [roleById, selectedRoleId]);

  useEffect(() => {
    setExpandedDepartments((previous) => {
      const next: Record<string, boolean> = {};
      for (const department of departments) {
        next[department.id] = previous[department.id] ?? false;
      }
      return next;
    });
  }, [departments]);

  useEffect(() => {
    if (!selectedRoleId) {
      return;
    }

    const department = departmentByRoleId.get(selectedRoleId);
    if (!department) {
      return;
    }

    setExpandedDepartments((previous) => {
      if (previous[department.id]) {
        return previous;
      }

      return {
        ...previous,
        [department.id]: true
      };
    });
  }, [departmentByRoleId, selectedRoleId]);

  const selectedSummary = selectedRoleId ? roleSummaryById.get(selectedRoleId) : undefined;
  const selectedRole = selectedRoleId ? roleById.get(selectedRoleId) : undefined;
  const selectedDepartment = selectedRoleId
    ? departmentByRoleId.get(selectedRoleId) ??
      (selectedSummary
        ? { id: selectedSummary.departmentId, name: selectedSummary.departmentName, color: '#E2E8F0', roles: [] }
        : undefined)
    : undefined;

  const jobDescription = jobDescriptionQuery.data ?? null;
  const jobDescriptionError = jobDescriptionQuery.error ?? refreshDescriptionMutation.error;
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'doc' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

  const downloadFile = async (format: 'pdf' | 'doc') => {
    if (!selectedRoleId || !jobDescription) {
      return;
    }

    setDownloadError(null);
    setDownloadFormat(format);

    try {
      const response = await fetch(`/api/job-descriptions/${selectedRoleId}/export?format=${format}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.status === 401) {
        throw new ApiError('Authentification requise', 401);
      }

      if (!response.ok) {
        const message = await readErrorMessage(response, 'Impossible de télécharger la fiche de poste.');
        throw new ApiError(message, response.status);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeRoleName = selectedRole?.name?.replace(/[^a-z0-9-_]/gi, '-').toLowerCase() || 'role';
      const extension = format === 'pdf' ? 'pdf' : 'doc';

      link.href = url;
      link.download = `fiche-${safeRoleName}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(getErrorMessage(error, 'Impossible de télécharger la fiche de poste.'));
    } finally {
      setDownloadFormat(null);
    }
  };

  const isLoading = departmentQuery.isLoading || roleActionQuery.isLoading;
  const hasError = departmentQuery.isError || roleActionQuery.isError;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex w-full flex-1 flex-col gap-6 px-4 py-10 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[340px,minmax(0,1fr)] xl:grid-cols-[360px,minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{sidebarTexts.title}</p>
              <p className="text-sm text-slate-600">{sidebarTexts.description}</p>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    <span className="ml-2 text-sm font-medium">Chargement des rôles…</span>
                  </div>
                ) : hasError ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {getErrorMessage(
                      departmentQuery.error ?? roleActionQuery.error,
                      'Une erreur est survenue lors du chargement.'
                    )}
                  </p>
                ) : departments.length === 0 ? (
                  <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                    Aucun département n’a encore été créé.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {departments.map((department) => {
                      const departmentRoles = department.roles ?? [];
                      return (
                        <details
                          key={department.id}
                          open={expandedDepartments[department.id] ?? false}
                          onToggle={(event) => {
                            const isOpen = event.currentTarget.open;
                            setExpandedDepartments((previous) => ({
                              ...previous,
                              [department.id]: isOpen
                            }));
                          }}
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
                                    <span className="flex items-center gap-2 truncate">
                                      <span
                                        aria-hidden="true"
                                        className="inline-block h-2.5 w-2.5 rounded-full"
                                        style={{ backgroundColor: role.color }}
                                      />
                                      <span className="truncate">{role.name}</span>
                                    </span>
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
          <section className="flex min-h-0 flex-col">
            <div className="flex h-full w-full flex-1 flex-col gap-6 py-2">
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
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fiche de poste</p>
                        <div className="mt-2 flex items-center gap-2">
                          {selectedRole ? (
                            <span
                              aria-hidden="true"
                              className="inline-block h-3 w-3 rounded-full"
                              style={{ backgroundColor: selectedRole.color }}
                            />
                          ) : null}
                          <h1 className="text-2xl font-bold text-slate-900">{selectedRole?.name ?? 'Rôle non nommé'}</h1>
                        </div>
                        <div className="mt-4 space-y-2">
                          {jobDescriptionError ? (
                            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                              {getErrorMessage(jobDescriptionError, 'Impossible de charger la fiche de poste.')}
                            </p>
                          ) : jobDescriptionQuery.isLoading ? (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              <span>Chargement de la fiche de poste…</span>
                            </div>
                          ) : jobDescription ? (
                            <>
                              <p className="text-sm leading-relaxed text-slate-700">
                                {jobDescription.sections.generalDescription}
                              </p>
                              <p className="text-xs text-slate-500">
                                Dernière mise à jour : {formatUpdatedAt(jobDescription.updatedAt)}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm leading-relaxed text-slate-600">
                              {selectedDepartment ? (
                                <>
                                  Au sein du département{' '}
                                  <span className="font-semibold text-slate-900">{selectedDepartment.name}</span>, ce rôle coordonne
                                  et exécute les actions clés qui suivent afin d’assurer la réussite des processus opérationnels.
                                </>
                              ) : (
                                "Ce rôle coordonne et exécute les actions clés suivantes afin d’assurer la réussite des processus opérationnels."
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:items-end">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className={cn(
                              'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500',
                              refreshDescriptionMutation.isPending
                                ? 'border-slate-200 bg-slate-100 text-slate-500'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            )}
                            onClick={() => selectedRoleId && refreshDescriptionMutation.mutate(selectedRoleId)}
                            disabled={!selectedRoleId || refreshDescriptionMutation.isPending}
                          >
                            <RotateCw
                            className={cn('h-4 w-4', refreshDescriptionMutation.isPending && 'animate-spin')}
                            aria-hidden="true"
                          />
                          {refreshDescriptionMutation.isPending
                            ? actionTexts.refreshing
                            : actionTexts.refresh}
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                          onClick={() => downloadFile('doc')}
                            disabled={!jobDescription || Boolean(downloadFormat)}
                          >
                            {downloadFormat === 'doc' ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : null}
                            {downloadFormat === 'doc'
                              ? actionTexts.preparing
                              : actionTexts.downloadDoc}
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                          onClick={() => downloadFile('pdf')}
                            disabled={!jobDescription || Boolean(downloadFormat)}
                          >
                            {downloadFormat === 'pdf' ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : null}
                            {downloadFormat === 'pdf'
                              ? actionTexts.preparing
                              : actionTexts.downloadPdf}
                        </button>
                        </div>
                        {downloadError ? <p className="max-w-md text-xs text-red-600">{downloadError}</p> : null}
                        {refreshDescriptionMutation.error ? (
                          <p className="max-w-md text-xs text-red-600">
                            {getErrorMessage(refreshDescriptionMutation.error, 'Impossible de générer la fiche de poste.')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </header>

                  <div className="space-y-6">
                    <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
                      <h2 className="text-lg font-semibold text-slate-900">Responsabilités principales</h2>
                      {jobDescription ? (
                        <ul className="mt-3 space-y-2 text-sm text-slate-700">
                          {jobDescription.sections.responsibilities.map((item) => (
                            <li key={item} className="list-disc pl-4">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : groupedActions.length === 0 ? (
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
                      {jobDescription ? (
                        <ul className="mt-3 space-y-2 text-sm text-slate-700">
                          {jobDescription.sections.objectives.map((item) => (
                            <li key={item} className="list-disc pl-4">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm text-slate-600">
                          Utilisez les actions associées à ce rôle pour définir des objectifs mesurables. Identifiez les indicateurs clés de performance
                          (KPI) liés à chaque processus afin de suivre efficacement la contribution du rôle.
                        </p>
                      )}
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
                      <h2 className="text-lg font-semibold text-slate-900">Collaboration attendue</h2>
                      {jobDescription ? (
                        <ul className="mt-3 space-y-2 text-sm text-slate-700">
                          {jobDescription.sections.collaboration.map((item) => (
                            <li key={item} className="list-disc pl-4">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm text-slate-600">
                          Cette fiche met en lumière les interactions principales du rôle avec les autres équipes. Servez-vous des matrices RACI pour
                          préciser qui intervient, valide ou doit être informé sur chaque étape des processus partagés.
                        </p>
                      )}
                    </section>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
