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

const filledRaciValues = ['R', 'A', 'C', 'I'] as const;

const raciDefinitions: Record<(typeof filledRaciValues)[number], { short: string; description: string }> = {
  R: {
    short: 'Responsable',
    description: "Responsable de l'exécution de la tâche et rend compte de son avancement."
  },
  A: {
    short: 'Autorité',
    description: "Détient l'autorité finale pour valider ou trancher."
  },
  C: {
    short: 'Consulté',
    description: 'Doit être consulté pour apporter son expertise avant la décision.'
  },
  I: {
    short: 'Informé',
    description: "Doit être tenu informé de l'avancement et des décisions."
  }
} as const;

const raciBadgeStyles: Record<FilledRaciValue, string> = {
  R: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  A: 'bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-200',
  C: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200',
  I: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200'
} as const;

const raciOptions: ReadonlyArray<{ value: RaciValue; label: string }> = [
  { value: '', label: '—' },
  ...filledRaciValues.map((value) => ({
    value,
    label: `${value} — ${raciDefinitions[value].short}`
  }))
];

type FilledRaciValue = (typeof filledRaciValues)[number];
type RaciValue = FilledRaciValue | '';

type LoadedDepartment = {
  id: string;
  name: string;
  color: string;
  roles: Array<{ id: string; name: string }>;
};

type DepartmentMatrixState = {
  actions: Array<{ id: string; name: string }>;
  matrix: Record<string, Record<string, RaciValue>>;
};

type AggregatedRoleActionRow = {
  id: string;
  label: string;
  processTitle: string;
  responsibility: FilledRaciValue;
  assignedRoleIds: Set<string>;
};

const EMPTY_DEPARTMENT_STATE: DepartmentMatrixState = {
  actions: [],
  matrix: {}
};

const areMatricesEqual = (
  previous: DepartmentMatrixState['matrix'],
  next: DepartmentMatrixState['matrix']
) => {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);

  if (previousKeys.length !== nextKeys.length) {
    return false;
  }

  for (const key of previousKeys) {
    const previousRow = previous[key];
    const nextRow = next[key];

    if (!nextRow) {
      return false;
    }

    const previousRowKeys = Object.keys(previousRow);
    const nextRowKeys = Object.keys(nextRow);

    if (previousRowKeys.length !== nextRowKeys.length) {
      return false;
    }

    for (const roleId of nextRowKeys) {
      if (previousRow[roleId] !== nextRow[roleId]) {
        return false;
      }
    }
  }

  return true;
};

const ensureMatrixCoverage = (
  state: DepartmentMatrixState,
  roles: ReadonlyArray<{ id: string; name: string }>
): DepartmentMatrixState => {
  if (state.actions.length === 0) {
    if (Object.keys(state.matrix).length === 0) {
      return state;
    }

    if (Object.keys(state.matrix).length > 0) {
      return {
        actions: state.actions,
        matrix: {}
      };
    }
  }

  const nextMatrix = state.actions.reduce<DepartmentMatrixState['matrix']>((accumulator, action) => {
    const previousRow = state.matrix[action.id] ?? {};
    const nextRow: Record<string, RaciValue> = {};

    for (const role of roles) {
      nextRow[role.id] = previousRow[role.id] ?? '';
    }

    accumulator[action.id] = nextRow;
    return accumulator;
  }, {});

  if (areMatricesEqual(state.matrix, nextMatrix)) {
    return state;
  }

  return {
    actions: state.actions,
    matrix: nextMatrix
  };
};

export function RaciBuilder() {
  const departmentsQuery = useQuery<ApiDepartment[], ApiError>({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    staleTime: 1000 * 60
  });

  const roleActionsQuery = useQuery<RoleActionSummary[], ApiError>({
    queryKey: ['role-actions'],
    queryFn: fetchRoleActions,
    staleTime: 1000 * 60
  });

  const departments = useMemo<LoadedDepartment[]>(
    () =>
      (departmentsQuery.data ?? []).map((department) => ({
        id: department.id,
        name: department.name,
        color: department.color,
        roles: (department.roles ?? []).map((role) => ({ id: role.id, name: role.name }))
      })),
    [departmentsQuery.data]
  );

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [departmentStates, setDepartmentStates] = useState<Record<string, DepartmentMatrixState>>({});

  useEffect(() => {
    if (departments.length === 0) {
      setSelectedDepartmentId((current) => (current === null ? current : null));
      return;
    }

    setSelectedDepartmentId((current) => {
      if (current && departments.some((department) => department.id === current)) {
        return current;
      }

      return departments[0]?.id ?? null;
    });
  }, [departments]);

  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === selectedDepartmentId) ?? null,
    [departments, selectedDepartmentId]
  );

  useEffect(() => {
    if (!selectedDepartment) {
      return;
    }

    setDepartmentStates((previous) => {
      const current = previous[selectedDepartment.id];
      if (!current) {
        return previous;
      }

      const ensured = ensureMatrixCoverage(current, selectedDepartment.roles);

      if (ensured === current) {
        return previous;
      }

      return {
        ...previous,
        [selectedDepartment.id]: ensured
      };
    });
  }, [selectedDepartment]);

  const selectedDepartmentState = selectedDepartmentId
    ? departmentStates[selectedDepartmentId] ?? EMPTY_DEPARTMENT_STATE
    : EMPTY_DEPARTMENT_STATE;

  const roleActionsByRoleId = useMemo(() => {
    const summaries = roleActionsQuery.data ?? [];
    return new Map(summaries.map((summary) => [summary.roleId, summary]));
  }, [roleActionsQuery.data]);

  const assignments = useMemo(() => {
    if (!selectedDepartment) {
      return [] as Array<{
        actionLabel: string;
        responsibilities: Array<{ value: FilledRaciValue; roles: string[] }>;
      }>;
    }

    return selectedDepartmentState.actions.map((action) => {
      const row = selectedDepartmentState.matrix[action.id] ?? {};
      const responsibilities = filledRaciValues.map((value) => ({
        value,
        roles: selectedDepartment.roles
          .filter((role) => row[role.id] === value)
          .map((role) => role.name)
      }));

      return {
        actionLabel: action.name,
        responsibilities
      };
    });
  }, [selectedDepartment, selectedDepartmentState]);

  const departmentAggregatedActions = useMemo<AggregatedRoleActionRow[]>(() => {
    if (!selectedDepartment) {
      return [];
    }

    const actionsByKey = new Map<string, AggregatedRoleActionRow>();

    for (const role of selectedDepartment.roles) {
      const summary = roleActionsByRoleId.get(role.id);
      if (!summary) {
        continue;
      }

      for (const action of summary.actions) {
        const key = `${action.processId}:${action.stepId}`;
        let aggregated = actionsByKey.get(key);

        if (!aggregated) {
          aggregated = {
            id: key,
            label: action.stepLabel,
            processTitle: action.processTitle,
            responsibility: action.responsibility,
            assignedRoleIds: new Set<string>()
          };
          actionsByKey.set(key, aggregated);
        }

        aggregated.assignedRoleIds.add(role.id);
      }
    }

    return Array.from(actionsByKey.values()).sort((left, right) => {
      const processComparison = left.processTitle.localeCompare(right.processTitle, 'fr', {
        sensitivity: 'base'
      });

      if (processComparison !== 0) {
        return processComparison;
      }

      return left.label.localeCompare(right.label, 'fr', { sensitivity: 'base' });
    });
  }, [roleActionsByRoleId, selectedDepartment]);

  const hasAggregatedActions = departmentAggregatedActions.length > 0;
  const hasManualActions = selectedDepartmentState.actions.length > 0;
  const showEmptyMatrixState =
    !roleActionsQuery.isLoading &&
    !roleActionsQuery.isError &&
    !hasAggregatedActions &&
    !hasManualActions;

  const updateMatrix = (departmentId: string, actionId: string, roleId: string, value: RaciValue) => {
    setDepartmentStates((previous) => {
      const current = previous[departmentId];
      if (!current) {
        return previous;
      }

      const currentRow = current.matrix[actionId] ?? {};
      if (currentRow[roleId] === value) {
        return previous;
      }

      const nextMatrix = {
        ...current.matrix,
        [actionId]: {
          ...currentRow,
          [roleId]: value
        }
      };

      return {
        ...previous,
        [departmentId]: {
          actions: current.actions,
          matrix: nextMatrix
        }
      };
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-100">
      <div className="flex w-full flex-col gap-10 px-6 py-10">
        <header className="space-y-3">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            Matrices RACI
          </span>
          <h1 className="text-3xl font-semibold text-slate-900">Planifiez les responsabilités par département</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Construisez une matrice RACI pour chaque département : définissez vos équipes, listez les actions clés et
            assignez les rôles de Responsable, Autorité, Consulté ou Informé pour clarifier la collaboration.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-900">Départements</h2>
                <p className="text-sm text-slate-600">
                  Sélectionnez un département pour construire sa matrice RACI et consultez les rôles disponibles.
                </p>
              </div>

              {departmentsQuery.isLoading ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement des départements…
                </div>
              ) : departmentsQuery.isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {departmentsQuery.error instanceof ApiError && departmentsQuery.error.status === 401
                    ? 'Connectez-vous pour accéder à vos départements.'
                    : departmentsQuery.error.message}
                </div>
              ) : departments.length > 0 ? (
                <ul className="flex flex-col gap-3" role="tree" aria-label="Départements disponibles">
                  {departments.map((department) => {
                    const isSelected = department.id === selectedDepartmentId;
                    const rolesCount = department.roles.length;

                    return (
                      <li key={department.id} role="treeitem" aria-selected={isSelected}>
                        <button
                          type="button"
                          onClick={() => setSelectedDepartmentId(department.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
                            isSelected
                              ? 'border-slate-900 bg-slate-900/5 text-slate-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 shadow-inner"
                            style={{ backgroundColor: department.color }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">{department.name}</p>
                            <p className="truncate text-xs text-slate-500">
                              {rolesCount > 0
                                ? `${rolesCount} rôle${rolesCount > 1 ? 's' : ''} disponible${rolesCount > 1 ? 's' : ''}`
                                : 'Aucun rôle défini'}
                            </p>
                          </div>
                        </button>
                        {isSelected ? (
                          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Rôles du département</p>
                            {rolesCount > 0 ? (
                              <ul className="mt-2 space-y-1">
                                {department.roles.map((role) => (
                                  <li key={role.id} className="text-sm text-slate-600">
                                    {role.name}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-sm text-slate-500">Aucun rôle n’est associé à ce département.</p>
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Aucun département disponible. Créez vos départements depuis l’accueil pour commencer.
                </p>
              )}
            </div>

          </div>

          <div className="flex flex-col gap-6">
            {selectedDepartment ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">Matrice RACI — {selectedDepartment.name}</h2>
                  <p className="text-sm text-slate-600">
                    Assignez un rôle pour chaque action en sélectionnant la responsabilité appropriée.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="w-56 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Actions
                        </th>
                        {selectedDepartment.roles.map((role) => (
                          <th
                            key={role.id}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                          >
                            {role.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {roleActionsQuery.isLoading ? (
                        <tr>
                          <td
                            colSpan={selectedDepartment.roles.length + 1}
                            className="px-6 py-4 text-sm text-slate-500"
                          >
                            <span className="flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Analyse des actions en cours…
                            </span>
                          </td>
                        </tr>
                      ) : roleActionsQuery.isError ? (
                        <tr>
                          <td
                            colSpan={selectedDepartment.roles.length + 1}
                            className="px-6 py-4 text-sm text-red-600"
                          >
                            {roleActionsQuery.error instanceof ApiError && roleActionsQuery.error.status === 401
                              ? 'Connectez-vous pour consulter les actions assignées à vos rôles.'
                              : roleActionsQuery.error.message}
                          </td>
                        </tr>
                      ) : null}

                      {!roleActionsQuery.isLoading &&
                      !roleActionsQuery.isError &&
                      hasAggregatedActions
                        ? departmentAggregatedActions.map((action) => (
                            <tr key={`aggregated-${action.id}`} className="bg-white">
                              <th scope="row" className="px-6 py-4 text-left text-sm font-medium text-slate-900">
                                <span className="block text-sm font-semibold text-slate-900">{action.label}</span>
                                <span className="mt-1 block text-xs text-slate-500">{action.processTitle}</span>
                              </th>
                              {selectedDepartment.roles.map((role) => (
                                <td key={role.id} className="px-4 py-3 text-sm">
                                  {action.assignedRoleIds.has(role.id) ? (
                                    <span
                                      className={cn(
                                        'inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold uppercase tracking-wide',
                                        raciBadgeStyles[action.responsibility]
                                      )}
                                    >
                                      {action.responsibility}
                                    </span>
                                  ) : (
                                    <span className="inline-flex h-8 w-8 items-center justify-center text-xs text-slate-300">—</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))
                        : null}

                      {hasManualActions
                        ? selectedDepartmentState.actions.map((action) => (
                            <tr key={action.id} className="bg-white hover:bg-slate-50/60">
                              <th scope="row" className="px-6 py-4 text-left text-sm font-medium text-slate-900">
                                {action.name}
                              </th>
                              {selectedDepartment.roles.map((role) => (
                                <td key={role.id} className="px-4 py-3 text-sm">
                                  <select
                                    value={selectedDepartmentState.matrix[action.id]?.[role.id] ?? ''}
                                    onChange={(event) =>
                                      updateMatrix(
                                        selectedDepartment.id,
                                        action.id,
                                        role.id,
                                        event.target.value as RaciValue
                                      )
                                    }
                                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                                  >
                                    {raciOptions.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              ))}
                            </tr>
                          ))
                        : null}

                      {showEmptyMatrixState ? (
                        <tr>
                          <td
                            colSpan={selectedDepartment.roles.length + 1}
                            className="px-6 py-6 text-center text-sm text-slate-500"
                          >
                            Aucune action n’est disponible pour ce département pour le moment.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                {selectedDepartmentState.actions.length > 0 ? (
                  <div className="border-t border-slate-200 bg-white px-6 py-5">
                    <h3 className="text-sm font-semibold text-slate-900">Synthèse par action</h3>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      {assignments.map(({ actionLabel, responsibilities }) => (
                        <div key={actionLabel} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-900">{actionLabel}</p>
                          <ul className="mt-3 space-y-2 text-xs text-slate-600">
                            {responsibilities.map(({ value, roles }) => (
                              <li key={value} className="flex items-start justify-between gap-3">
                                <span className="flex items-center gap-2 font-medium text-slate-800">
                                  <span
                                    className={cn(
                                      'inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold uppercase tracking-wide',
                                      raciBadgeStyles[value]
                                    )}
                                  >
                                    {value}
                                  </span>
                                  <span>{raciDefinitions[value].short}</span>
                                </span>
                                <span className="text-right text-slate-600">
                                  {roles.length > 0 ? roles.join(', ') : 'Non attribué'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-600">
                <p>Sélectionnez un département pour générer sa matrice RACI.</p>
              </div>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Rappels sur la méthodologie</h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {filledRaciValues.map((value) => (
                  <div key={value} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <dt className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold uppercase tracking-wide',
                          raciBadgeStyles[value]
                        )}
                      >
                        {value}
                      </span>
                      <span>{raciDefinitions[value].short}</span>
                    </dt>
                    <dd className="mt-1 text-xs text-slate-600">{raciDefinitions[value].description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
