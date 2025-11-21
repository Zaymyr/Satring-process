'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { type ColDef, type ICellRendererParams, type IHeaderParams } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ChevronDown, Copy, Download, FileText, Loader2 } from 'lucide-react';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

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

const raciDefinitions: Record<
  (typeof filledRaciValues)[number],
  { short: string; description: string; tooltip: string }
> = {
  R: {
    short: 'Responsable',
    description: "Ce rôle exécute la tâche et rend compte de l’avancement.",
    tooltip: 'Responsable – exécute la tâche'
  },
  A: {
    short: 'Autorité',
    description: 'Détient l’autorité finale pour valider ou trancher.',
    tooltip: 'Autorité – valide / tranche'
  },
  C: {
    short: 'Consulté',
    description: 'Apporte son expertise et doit être consulté avant la décision.',
    tooltip: 'Consulté – apporte son expertise'
  },
  I: {
    short: 'Informé',
    description: 'Doit être tenu au courant de l’avancement et des décisions.',
    tooltip: 'Informé – doit être tenu au courant'
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
type RaciCounts = Record<FilledRaciValue, number>;

const createEmptyCounts = (): RaciCounts => ({ R: 0, A: 0, C: 0, I: 0 });
const formatCountsLabel = (counts: RaciCounts) =>
  `${counts.R}R / ${counts.A}A / ${counts.C}C / ${counts.I}I`;
const getSummaryMeta = (counts: RaciCounts) => {
  const hasResponsible = counts.R > 0;
  const hasAuthorityIssue = counts.A !== 1;
  const hasIssue = !hasResponsible || hasAuthorityIssue;

  return {
    label: formatCountsLabel(counts),
    hasIssue
  };
};

const processGlyphs = ['🔁', '⚡️', '📄', '🛠️', '🚀', '📊', '🧭', '✅', '⚙️', '📌'] as const;
const getProcessGlyph = (title: string) => {
  const total = Array.from(title || 'processus').reduce(
    (sum, char) => sum + (char.codePointAt(0) ?? 0),
    0
  );

  return processGlyphs[Math.abs(total) % processGlyphs.length];
};

type LoadedDepartment = {
  id: string;
  name: string;
  color: string;
  roles: Array<{ id: string; name: string; color: string }>;
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

type AggregatedProcessGroup = {
  id: string;
  title: string;
  steps: AggregatedRoleActionRow[];
};

type RaciGridRow = {
  id: string;
  rowType: 'process' | 'aggregated' | 'manual';
  actionId?: string;
  processId?: string;
  label: string;
  processTitle?: string;
  responsibility?: FilledRaciValue;
  assignedRoleIds?: Set<string>;
  values?: Record<string, RaciValue>;
  summary?: { label: string; hasIssue: boolean };
  zebra?: 'even' | 'odd';
  actionCountLabel?: string;
  isCollapsed?: boolean;
};

type RaciGridContext = {
  toggleProcessVisibility: (processId: string) => void;
  updateMatrix: (departmentId: string, actionId: string, roleId: string, value: RaciValue) => void;
  departmentId: string;
};

type RaciGridProps = {
  aggregatedProcesses: AggregatedProcessGroup[];
  aggregatedRowSummaries: Map<string, RaciCounts>;
  collapsedProcesses: Record<string, boolean>;
  departmentId: string;
  hasAggregatedActions: boolean;
  hasManualActions: boolean;
  manualActions: DepartmentMatrixState['actions'];
  matrix: DepartmentMatrixState['matrix'];
  manualRowSummaries: Map<string, RaciCounts>;
  roleSummaries: Record<string, RaciCounts>;
  roles: LoadedDepartment['roles'];
  showEmptyMatrixState: boolean;
  status: Pick<UseQueryResult<RoleActionSummary[], ApiError>, 'error' | 'isError' | 'isLoading'>;
  toggleProcessVisibility: (processId: string) => void;
  updateMatrix: (departmentId: string, actionId: string, roleId: string, value: RaciValue) => void;
};

type RoleHeaderParams = IHeaderParams & { roleColor: string; summary?: RaciCounts };

const RoleHeader = ({ displayName, roleColor, summary }: RoleHeaderParams) => (
  <div className="flex flex-col items-center justify-center gap-1 px-2 text-center">
    <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: roleColor }} />
      <span className="truncate">{displayName}</span>
    </div>
    <div className="flex flex-wrap justify-center gap-1 text-[11px] font-mono font-normal text-slate-500">
      {filledRaciValues.map((value) => (
        <span key={`${displayName}-${value}`} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5">
          {value}: {summary?.[value] ?? 0}
        </span>
      ))}
    </div>
  </div>
);

type RendererParams<TValue = unknown> = ICellRendererParams<RaciGridRow, TValue, RaciGridContext>;

const ActionCellRenderer = ({ data, context }: RendererParams<string>) => {
  if (!data || !context) {
    return null;
  }

  if (data.rowType === 'process') {
    const actionCountLabel = data.actionCountLabel ?? '';

    return (
      <button
        type="button"
        onClick={() => context.toggleProcessVisibility(data.processId ?? '')}
        className="flex w-full items-center justify-between gap-4 rounded-lg bg-white/70 px-3 py-3 text-left shadow-sm ring-1 ring-inset ring-slate-200 transition hover:bg-white"
        aria-expanded={!(data.isCollapsed ?? false)}
      >
        <div className="flex flex-1 items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-base">
            {getProcessGlyph(data.label)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800 sm:text-base">{data.label}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{actionCountLabel}</p>
          </div>
        </div>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'h-5 w-5 shrink-0 rounded-full bg-slate-100 p-0.5 text-slate-600 transition-transform',
            data.isCollapsed ? '-rotate-90' : 'rotate-0'
          )}
        />
      </button>
    );
  }

  return (
    <div className="space-y-1 px-2">
      <p className="text-sm font-semibold text-slate-900">{data.label}</p>
      {data.processTitle ? <p className="text-xs font-medium text-slate-500">{data.processTitle}</p> : null}
    </div>
  );
};

const RaciCellRenderer = (params: RendererParams<RaciValue>) => {
  const { data, context, value, colDef } = params;
  const roleId = colDef.field;

  if (!data || !context || !roleId || data.rowType === 'process') {
    return null;
  }

  if (data.rowType === 'aggregated') {
    const isAssigned = data.assignedRoleIds?.has(roleId) ?? false;

    return (
      <div className="flex justify-center">
        <span
          className={cn(
            'inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm ring-1 ring-inset',
            isAssigned ? raciBadgeStyles[data.responsibility as FilledRaciValue] : 'bg-white text-transparent ring-slate-100'
          )}
          title={
            isAssigned && data.responsibility
              ? raciDefinitions[data.responsibility].tooltip
              : 'Non attribué'
          }
        >
          {isAssigned ? data.responsibility : '—'}
        </span>
      </div>
    );
  }

  const isFilled = Boolean(value);

  return (
    <div className="flex flex-col items-center gap-3 px-2 py-1">
      <span
        className={cn(
          'inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm ring-1 ring-inset transition',
          isFilled && value ? raciBadgeStyles[value as FilledRaciValue] : 'bg-white text-transparent ring-slate-100'
        )}
        title={isFilled && value ? raciDefinitions[value as FilledRaciValue].tooltip : 'Non attribué'}
        aria-label={isFilled && value ? raciDefinitions[value as FilledRaciValue].short : 'Non attribué'}
      >
        {isFilled ? value : '—'}
      </span>

      <select
        value={value ?? ''}
        onChange={(event) =>
          context.updateMatrix(
            context.departmentId,
            data.actionId ?? '',
            roleId,
            event.target.value as RaciValue
          )
        }
        className="w-full rounded-md border border-slate-300 bg-inherit px-2 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:bg-inherit focus:outline-none focus:ring-2 focus:ring-slate-500"
      >
        {raciOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

const SummaryCellRenderer = ({ data }: RendererParams<string>) => {
  if (!data?.summary) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs font-mono">
      {data.summary.hasIssue ? <span className="h-1.5 w-1.5 rounded-full bg-red-400" aria-hidden="true" /> : null}
      <span className={cn(data.summary.hasIssue ? 'text-red-500' : 'text-slate-600')}>{data.summary.label}</span>
    </span>
  );
};

const RaciGrid = ({
  aggregatedProcesses,
  aggregatedRowSummaries,
  collapsedProcesses,
  departmentId,
  hasAggregatedActions,
  hasManualActions,
  manualActions,
  matrix,
  manualRowSummaries,
  roleSummaries,
  roles,
  showEmptyMatrixState,
  status,
  toggleProcessVisibility,
  updateMatrix
}: RaciGridProps) => {
  const rows = useMemo<RaciGridRow[]>(() => {
    let zebra: 'even' | 'odd' = 'odd';
    const nextZebra = () => {
      zebra = zebra === 'even' ? 'odd' : 'even';
      return zebra;
    };

    const gridRows: RaciGridRow[] = [];

    if (hasAggregatedActions) {
      aggregatedProcesses.forEach((process) => {
        const isCollapsed = collapsedProcesses[process.id] ?? false;
        const actionCount = process.steps.length;
        const actionCountLabel = `${actionCount} action${actionCount > 1 ? 's' : ''}`;

        gridRows.push({
          id: `process-${process.id}`,
          rowType: 'process',
          label: process.title,
          processId: process.id,
          actionCountLabel,
          isCollapsed
        });

        if (!isCollapsed) {
          process.steps.forEach((step) => {
            const values: Record<string, RaciValue> = {};

            for (const role of roles) {
              values[role.id] = step.assignedRoleIds.has(role.id) ? step.responsibility : '';
            }

            const summaryCounts = aggregatedRowSummaries.get(step.id) ?? createEmptyCounts();

            gridRows.push({
              id: `aggregated-${process.id}-${step.id}`,
              actionId: step.id,
              label: step.label,
              processId: process.id,
              processTitle: step.processTitle,
              responsibility: step.responsibility,
              assignedRoleIds: step.assignedRoleIds,
              rowType: 'aggregated',
              values,
              zebra: nextZebra(),
              summary: getSummaryMeta(summaryCounts)
            });
          });
        }
      });
    }

    if (hasManualActions) {
      manualActions.forEach((action) => {
        const summaryCounts = manualRowSummaries.get(action.id) ?? createEmptyCounts();

        gridRows.push({
          id: `manual-${action.id}`,
          actionId: action.id,
          label: action.name,
          rowType: 'manual',
          values: matrix[action.id] ?? {},
          zebra: nextZebra(),
          summary: getSummaryMeta(summaryCounts)
        });
      });
    }

    return gridRows;
  }, [
    aggregatedProcesses,
    aggregatedRowSummaries,
    collapsedProcesses,
    hasAggregatedActions,
    hasManualActions,
    manualActions,
    manualRowSummaries,
    matrix,
    roles
  ]);

  const columnDefs = useMemo<ColDef[]>(() => {
    const actionColumn: ColDef<RaciGridRow> = {
      field: 'action',
      headerName: 'Actions',
      pinned: 'left',
      width: 280,
      lockPinned: true,
      cellRenderer: ActionCellRenderer,
      cellClass: 'align-top'
    };

    const roleColumns: Array<ColDef<RaciGridRow, RaciValue>> = roles.map((role) => ({
      field: role.id,
      headerName: role.name,
      cellRenderer: RaciCellRenderer,
      headerComponent: RoleHeader,
      headerComponentParams: {
        roleColor: role.color,
        summary: roleSummaries[role.id]
      },
      valueGetter: (params) => params.data?.values?.[role.id] ?? '',
      minWidth: 180
    }));

    const summaryColumn: ColDef<RaciGridRow> = {
      field: 'summary',
      headerName: 'Synthèse',
      cellRenderer: SummaryCellRenderer,
      minWidth: 200,
      valueGetter: (params) => params.data?.summary?.label ?? ''
    };

    return [actionColumn, ...roleColumns, summaryColumn];
  }, [roleSummaries, roles]);

  if (status.isLoading) {
    return (
      <div className="flex items-center justify-center px-6 py-4 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyse des actions en cours…
      </div>
    );
  }

  if (status.isError) {
    return (
      <div className="px-6 py-4 text-sm text-red-600">
        {status.error instanceof ApiError && status.error.status === 401
          ? 'Connectez-vous pour consulter les actions assignées à vos rôles.'
          : status.error instanceof Error
            ? status.error.message
            : 'Une erreur est survenue lors du chargement de la matrice.'}
      </div>
    );
  }

  return (
    <div className="ag-theme-quartz raci-grid min-h-[520px] w-full overflow-hidden rounded-xl border border-slate-200">
      <AgGridReact<RaciGridRow>
        ref={gridRef}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={{
          resizable: true,
          sortable: false,
          suppressMenu: true,
          flex: 1,
          minWidth: 140,
          cellClass: 'text-sm text-slate-900',
          headerClass: 'bg-white'
        }}
        rowHoverHighlight
        columnHoverHighlight
        tooltipShowDelay={0}
        animateRows
        suppressMovableColumns={false}
        getRowHeight={(params) => {
          if (params.data?.rowType === 'manual') {
            return 140;
          }

          if (params.data?.rowType === 'process') {
            return 80;
          }

          return 88;
        }}
        getRowStyle={(params) => {
          if (params.data?.rowType === 'process') {
            return { backgroundColor: '#f8fafc' };
          }

          if (params.data?.zebra === 'odd') {
            return { backgroundColor: '#f1f5f9' };
          }

          return { backgroundColor: '#ffffff' };
        }}
        context={{
          toggleProcessVisibility,
          updateMatrix,
          departmentId
        }}
        suppressRowClickSelection
        enableRangeSelection={false}
        suppressCellFocus
        noRowsOverlayComponent={() => (
          <div className="px-6 py-6 text-center text-sm text-slate-500">
            {showEmptyMatrixState
              ? 'Aucune action n’est disponible pour ce département pour le moment.'
              : 'Aucune donnée à afficher.'}
          </div>
        )}
      />

      <style jsx global>{`
        .raci-grid .ag-root-wrapper-body.ag-layout-normal {
          height: auto;
        }

        .raci-grid .ag-header {
          position: sticky;
          top: 0;
          z-index: 3;
        }

        .raci-grid .ag-row-hover .ag-cell,
        .raci-grid .ag-row-hover .ag-pinned-left-cols-container .ag-cell {
          background-color: #e0f2fe !important;
        }

        .raci-grid .ag-column-hover,
        .raci-grid .ag-pinned-left-cols-container .ag-column-hover {
          background-color: #e0f2fe !important;
        }

        .raci-grid .ag-cell {
          display: flex;
          align-items: stretch;
          justify-content: center;
        }
      `}</style>
    </div>
  );
};

type MatrixExportRow = {
  id: string;
  label: string;
  values: Record<string, RaciValue>;
};

type ViewMode = 'actions' | 'roles';

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
        roles: (department.roles ?? []).map((role) => ({ id: role.id, name: role.name, color: role.color }))
      })),
    [departmentsQuery.data]
  );

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [departmentStates, setDepartmentStates] = useState<Record<string, DepartmentMatrixState>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('actions');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [markdownCopied, setMarkdownCopied] = useState(false);
  const [csvCopied, setCsvCopied] = useState(false);

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

  useEffect(() => {
    if (viewMode !== 'roles') {
      return;
    }

    if (!selectedDepartment) {
      setSelectedRoleId(null);
      return;
    }

    setSelectedRoleId((current) => {
      if (current && selectedDepartment.roles.some((role) => role.id === current)) {
        return current;
      }

      return selectedDepartment.roles[0]?.id ?? null;
    });
  }, [selectedDepartment, viewMode]);

  const selectedRole = useMemo(
    () => selectedDepartment?.roles.find((role) => role.id === selectedRoleId) ?? null,
    [selectedDepartment, selectedRoleId]
  );

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

  const departmentAggregatedProcesses = useMemo<AggregatedProcessGroup[]>(() => {
    if (!selectedDepartment) {
      return [];
    }

    const processes = new Map<
      string,
      {
        id: string;
        title: string;
        steps: Map<string, AggregatedRoleActionRow>;
      }
    >();

    for (const role of selectedDepartment.roles) {
      const summary = roleActionsByRoleId.get(role.id);
      if (!summary) {
        continue;
      }

      for (const action of summary.actions) {
        let process = processes.get(action.processId);

        if (!process) {
          process = {
            id: action.processId,
            title: action.processTitle,
            steps: new Map<string, AggregatedRoleActionRow>()
          };
          processes.set(action.processId, process);
        }

        let aggregated = process.steps.get(action.stepId);

        if (!aggregated) {
          aggregated = {
            id: action.stepId,
            label: action.stepLabel,
            processTitle: action.processTitle,
            responsibility: action.responsibility,
            assignedRoleIds: new Set<string>()
          };
          process.steps.set(action.stepId, aggregated);
        }

        aggregated.assignedRoleIds.add(role.id);
      }
    }

    return Array.from(processes.values())
      .map((process) => ({
        id: process.id,
        title: process.title,
        steps: Array.from(process.steps.values()).sort((left, right) =>
          left.label.localeCompare(right.label, 'fr', { sensitivity: 'base' })
        )
      }))
      .sort((left, right) => left.title.localeCompare(right.title, 'fr', { sensitivity: 'base' }));
  }, [roleActionsByRoleId, selectedDepartment]);

  const aggregatedActionCount = useMemo(
    () => departmentAggregatedProcesses.reduce((total, process) => total + process.steps.length, 0),
    [departmentAggregatedProcesses]
  );

  const manualActionCount = selectedDepartmentState.actions.length;
  const totalActionCount = aggregatedActionCount + manualActionCount;

  const aggregatedRowSummaries = useMemo(() => {
    if (!selectedDepartment) {
      return new Map<string, RaciCounts>();
    }

    const summaries = new Map<string, RaciCounts>();

    for (const process of departmentAggregatedProcesses) {
      for (const step of process.steps) {
        const counts = createEmptyCounts();
        counts[step.responsibility] = step.assignedRoleIds.size;
        summaries.set(step.id, counts);
      }
    }

    return summaries;
  }, [departmentAggregatedProcesses, selectedDepartment]);

  const manualRowSummaries = useMemo(() => {
    if (!selectedDepartment) {
      return new Map<string, RaciCounts>();
    }

    const summaries = new Map<string, RaciCounts>();

    for (const action of selectedDepartmentState.actions) {
      const row = selectedDepartmentState.matrix[action.id] ?? {};
      const counts = createEmptyCounts();

      for (const role of selectedDepartment.roles) {
        const value = row[role.id];

        if (value) {
          counts[value as FilledRaciValue] += 1;
        }
      }

      summaries.set(action.id, counts);
    }

    return summaries;
  }, [selectedDepartment, selectedDepartmentState]);

  const matrixRows = useMemo<MatrixExportRow[]>(() => {
    if (!selectedDepartment) {
      return [];
    }

    const rows: MatrixExportRow[] = [];

    for (const process of departmentAggregatedProcesses) {
      for (const step of process.steps) {
        const values: Record<string, RaciValue> = {};

        for (const role of selectedDepartment.roles) {
          values[role.id] = step.assignedRoleIds.has(role.id) ? step.responsibility : '';
        }

        rows.push({
          id: step.id,
          label: process.title ? `${process.title} — ${step.label}` : step.label,
          values
        });
      }
    }

    for (const action of selectedDepartmentState.actions) {
      const values: Record<string, RaciValue> = {};
      const row = selectedDepartmentState.matrix[action.id] ?? {};

      for (const role of selectedDepartment.roles) {
        values[role.id] = row[role.id] ?? '';
      }

      rows.push({
        id: action.id,
        label: action.name,
        values
      });
    }

    return rows;
  }, [departmentAggregatedProcesses, selectedDepartment, selectedDepartmentState.actions, selectedDepartmentState.matrix]);

  const hasExportableData = matrixRows.length > 0 && selectedDepartment;

  const departmentSlug = selectedDepartment
    ? selectedDepartment.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
    : 'departement';

  const buildCsvContent = () => {
    if (!selectedDepartment || matrixRows.length === 0) {
      return '';
    }

    const headers = ['Action', ...selectedDepartment.roles.map((role) => role.name)];
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const lines = [
      headers.map(escape).join(';'),
      ...matrixRows.map((row) =>
        [row.label, ...selectedDepartment.roles.map((role) => row.values[role.id] ?? '')]
          .map((value) => escape(value))
          .join(';')
      )
    ];

    return lines.join('\n');
  };

  const handleCsvDownload = () => {
    const content = buildCsvContent();

    if (!content) {
      return;
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `matrice-raci-${departmentSlug}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = async () => {
    if (!selectedDepartment || matrixRows.length === 0 || !navigator.clipboard) {
      return;
    }

    const headers = ['Action', ...selectedDepartment.roles.map((role) => role.name)];
    const separator = `| ${headers.map(() => '---').join(' | ')} |`;
    const tableRows = matrixRows.map(
      (row) =>
        `| ${[row.label, ...selectedDepartment.roles.map((role) => row.values[role.id] || '—')].join(' | ')} |`
    );

    const markdown = [`| ${headers.join(' | ')} |`, separator, ...tableRows].join('\n');
    await navigator.clipboard.writeText(markdown);
    setMarkdownCopied(true);
    setTimeout(() => setMarkdownCopied(false), 1500);
  };

  const handleCopyCsv = async () => {
    if (!navigator.clipboard) {
      return;
    }

    const content = buildCsvContent();

    if (!content) {
      return;
    }

    await navigator.clipboard.writeText(content);
    setCsvCopied(true);
    setTimeout(() => setCsvCopied(false), 1500);
  };

  const handlePrintPdf = () => {
    if (!selectedDepartment || matrixRows.length === 0) {
      return;
    }

    const tableHeaders = ['Action', ...selectedDepartment.roles.map((role) => role.name)]
      .map((header) => `<th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">${header}</th>`)
      .join('');

    const tableRows = matrixRows
      .map((row) => {
        const cells = [row.label, ...selectedDepartment.roles.map((role) => row.values[role.id] || '—')]
          .map((cell) => `<td style="padding:8px;border:1px solid #e2e8f0;">${cell}</td>`)
          .join('');

        return `<tr>${cells}</tr>`;
      })
      .join('');

    const html = `<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Matrice RACI — ${selectedDepartment.name}</title>
            <style>
              @page { size: A4 landscape; margin: 16mm; }
              body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #0f172a; }
              h1 { font-size: 20px; margin-bottom: 12px; }
              table { border-collapse: collapse; width: 100%; font-size: 12px; }
              th { background: #f8fafc; font-weight: 700; }
              tr:nth-child(even) { background: #f8fafc; }
            </style>
          </head>
          <body>
            <h1>Matrice RACI — ${selectedDepartment.name}</h1>
            <table>
              <thead><tr>${tableHeaders}</tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </body>
        </html>`;

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const roleSummaries = useMemo(() => {
    if (!selectedDepartment) {
      return {} as Record<string, RaciCounts>;
    }

    const summaries = selectedDepartment.roles.reduce<Record<string, RaciCounts>>((accumulator, role) => {
      accumulator[role.id] = createEmptyCounts();
      return accumulator;
    }, {});

    for (const process of departmentAggregatedProcesses) {
      for (const step of process.steps) {
        for (const roleId of step.assignedRoleIds) {
          if (!summaries[roleId]) {
            continue;
          }

          summaries[roleId][step.responsibility] += 1;
        }
      }
    }

    for (const action of selectedDepartmentState.actions) {
      const row = selectedDepartmentState.matrix[action.id] ?? {};

      for (const role of selectedDepartment.roles) {
        const value = row[role.id];

        if (!value) {
          continue;
        }

        summaries[role.id][value as FilledRaciValue] += 1;
      }
    }

    return summaries;
  }, [departmentAggregatedProcesses, selectedDepartment, selectedDepartmentState]);

  const smallScreenActions = useMemo(
    () => {
      if (!selectedDepartment) {
        return [] as Array<{
          id: string;
          title: string;
          context?: string;
          source: 'aggregated' | 'manual';
          responsibilities: Record<FilledRaciValue, string[]>;
        }>;
      }

      const actions: Array<{
        id: string;
        title: string;
        context?: string;
        source: 'aggregated' | 'manual';
        responsibilities: Record<FilledRaciValue, string[]>;
      }> = [];

      for (const process of departmentAggregatedProcesses) {
        for (const step of process.steps) {
          const responsibilities: Record<FilledRaciValue, string[]> = {
            R: [],
            A: [],
            C: [],
            I: []
          };

          for (const role of selectedDepartment.roles) {
            if (step.assignedRoleIds.has(role.id)) {
              responsibilities[step.responsibility].push(role.name);
            }
          }

          actions.push({
            id: `aggregated-${process.id}-${step.id}`,
            title: step.label,
            context: process.title,
            source: 'aggregated',
            responsibilities
          });
        }
      }

      for (const action of selectedDepartmentState.actions) {
        const responsibilities: Record<FilledRaciValue, string[]> = {
          R: [],
          A: [],
          C: [],
          I: []
        };
        const row = selectedDepartmentState.matrix[action.id] ?? {};

        for (const role of selectedDepartment.roles) {
          const value = row[role.id];

          if (!value) {
            continue;
          }

          responsibilities[value as FilledRaciValue].push(role.name);
        }

        actions.push({
          id: `manual-${action.id}`,
          title: action.name,
          source: 'manual',
          responsibilities
        });
      }

      return actions;
    },
    [departmentAggregatedProcesses, selectedDepartment, selectedDepartmentState]
  );

  const [collapsedProcesses, setCollapsedProcesses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsedProcesses((previous) => {
      if (departmentAggregatedProcesses.length === 0) {
        return Object.keys(previous).length === 0 ? previous : {};
      }

      const next: Record<string, boolean> = {};
      let hasChanged = departmentAggregatedProcesses.length !== Object.keys(previous).length;

      departmentAggregatedProcesses.forEach((process, index) => {
        const fallbackCollapsed = index > 0;
        const previousValue = previous[process.id];
        const nextValue = typeof previousValue === 'boolean' ? previousValue : fallbackCollapsed;

        next[process.id] = nextValue;

        if (!hasChanged && nextValue !== previousValue) {
          hasChanged = true;
        }
      });

      if (!hasChanged) {
        for (const key of Object.keys(previous)) {
          if (!(key in next)) {
            hasChanged = true;
            break;
          }
        }
      }

      return hasChanged ? next : previous;
    });
  }, [departmentAggregatedProcesses]);

  const hasAggregatedActions = departmentAggregatedProcesses.length > 0;

  const toggleProcessVisibility = (processId: string) => {
    setCollapsedProcesses((previous) => ({
      ...previous,
      [processId]: !(previous[processId] ?? false)
    }));
  };

  const expandAllProcesses = () => {
    if (!hasAggregatedActions) {
      return;
    }

    setCollapsedProcesses(() => {
      const next: Record<string, boolean> = {};
      for (const process of departmentAggregatedProcesses) {
        next[process.id] = false;
      }
      return next;
    });
  };

  const collapseAllProcesses = () => {
    if (!hasAggregatedActions) {
      return;
    }

    setCollapsedProcesses(() => {
      const next: Record<string, boolean> = {};
      for (const process of departmentAggregatedProcesses) {
        next[process.id] = true;
      }
      return next;
    });
  };
  const hasManualActions = selectedDepartmentState.actions.length > 0;
  const showEmptyMatrixState =
    !roleActionsQuery.isLoading &&
    !roleActionsQuery.isError &&
    !hasAggregatedActions &&
    !hasManualActions;

  const roleCentricAssignments = useMemo(() => {
    if (!selectedDepartment || !selectedRole) {
      return null;
    }

    const groups: Record<
      FilledRaciValue,
      Array<{ id: string; label: string; context?: string; source: 'aggregated' | 'manual' }>
    > = {
      R: [],
      A: [],
      C: [],
      I: []
    };

    for (const process of departmentAggregatedProcesses) {
      for (const step of process.steps) {
        if (step.assignedRoleIds.has(selectedRole.id)) {
          groups[step.responsibility].push({
            id: `aggregated-${process.id}-${step.id}`,
            label: step.label,
            context: step.processTitle,
            source: 'aggregated'
          });
        }
      }
    }

    for (const action of selectedDepartmentState.actions) {
      const responsibility = selectedDepartmentState.matrix[action.id]?.[selectedRole.id];

      if (responsibility) {
        groups[responsibility as FilledRaciValue].push({
          id: `manual-${action.id}`,
          label: action.name,
          source: 'manual'
        });
      }
    }

    return groups;
  }, [departmentAggregatedProcesses, selectedDepartment, selectedDepartmentState, selectedRole]);

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
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="flex w-full flex-col gap-10 px-6 py-10">
        <header className="space-y-3">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            Matrices RACI
          </span>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Planifiez les responsabilités par département</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Construisez une matrice RACI pour chaque département : définissez vos équipes, listez les actions clés et
            assignez les rôles de Responsable, Autorité, Consulté ou Informé pour clarifier la collaboration.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)_280px]">
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
                            'flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
                            isSelected
                              ? 'border-slate-900 bg-slate-900/5 text-slate-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <span
                              aria-hidden="true"
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 shadow-inner"
                              style={{ backgroundColor: department.color }}
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-semibold text-slate-900">{department.name}</p>
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: department.color }} aria-hidden />
                                  {rolesCount} rôle{rolesCount > 1 ? 's' : ''}
                                </span>
                              </div>
                              <p className="truncate text-xs text-slate-500">
                                {rolesCount > 0
                                  ? `${rolesCount} rôle${rolesCount > 1 ? 's' : ''} disponible${rolesCount > 1 ? 's' : ''}`
                                  : 'Aucun rôle défini'}
                              </p>
                            </div>
                          </div>
                        </button>
                        {isSelected ? (
                          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Rôles du département</p>
                              <p className="text-xs text-slate-600">
                                Aperçu rapide des rôles disponibles dans ce département.
                              </p>
                            </div>
                            {rolesCount > 0 ? (
                              <ul className="mt-3 space-y-1.5">
                                {department.roles.map((role) => (
                                  <li
                                    key={role.id}
                                    className="flex items-center gap-3 rounded-md bg-white/60 px-2.5 py-2 text-sm text-slate-700 ring-1 ring-inset ring-slate-200"
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="inline-block h-2.5 w-2.5 rounded-full"
                                      style={{ backgroundColor: role.color }}
                                    />
                                    <span className="truncate font-medium">{role.name}</span>
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
              <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
                <div className="border-b border-slate-200 px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-xl font-semibold text-slate-900">Matrice RACI — {selectedDepartment.name}</h2>
                      <p className="text-sm text-slate-600">
                        Assignez un rôle pour chaque action en sélectionnant la responsabilité appropriée.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                        <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden />
                        {selectedDepartment.roles.length} rôle{selectedDepartment.roles.length > 1 ? 's' : ''}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                        <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden />
                        {totalActionCount} action{totalActionCount > 1 ? 's' : ''}
                      </span>
                      <div className="inline-flex items-center rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                        <button
                          type="button"
                          onClick={() => setViewMode('actions')}
                          className={cn(
                            'rounded-full px-3 py-1 transition',
                            viewMode === 'actions'
                              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200'
                              : 'text-slate-600 hover:text-slate-900'
                          )}
                        >
                          Vue par actions
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('roles')}
                          className={cn(
                            'rounded-full px-3 py-1 transition',
                            viewMode === 'roles'
                              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200'
                              : 'text-slate-600 hover:text-slate-900'
                          )}
                        >
                          Vue par rôle
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCsvDownload}
                          disabled={!hasExportableData}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
                            !hasExportableData && 'cursor-not-allowed opacity-60'
                          )}
                        >
                          <Download className="h-4 w-4" aria-hidden />
                          Exporter en CSV
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyCsv}
                          disabled={!hasExportableData}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
                            !hasExportableData && 'cursor-not-allowed opacity-60'
                          )}
                        >
                          <Copy className="h-4 w-4" aria-hidden />
                          {csvCopied ? 'CSV copié !' : 'Copier CSV'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyMarkdown}
                          disabled={!hasExportableData}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
                            !hasExportableData && 'cursor-not-allowed opacity-60'
                          )}
                        >
                          <Copy className="h-4 w-4" aria-hidden />
                          {markdownCopied ? 'Markdown copié !' : 'Copier en Markdown'}
                        </button>
                        <button
                          type="button"
                          onClick={handlePrintPdf}
                          disabled={!hasExportableData}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400',
                            !hasExportableData && 'cursor-not-allowed opacity-60'
                          )}
                        >
                          <FileText className="h-4 w-4" aria-hidden />
                          Export PDF/Impression
                        </button>
                      </div>
                    </div>
                  </div>
                  {viewMode === 'actions' && hasAggregatedActions ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={expandAllProcesses}
                        className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                      >
                        Tout développer
                      </button>
                      <button
                        type="button"
                        onClick={collapseAllProcesses}
                        className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                      >
                        Tout réduire
                      </button>
                    </div>
                  ) : null}
                </div>
                {viewMode === 'actions' ? (
                  <>
                    <div className="space-y-3 md:hidden">
                      {roleActionsQuery.isLoading ? (
                        <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyse des actions en cours…
                        </div>
                      ) : roleActionsQuery.isError ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                          {roleActionsQuery.error instanceof ApiError && roleActionsQuery.error.status === 401
                            ? 'Connectez-vous pour consulter les actions assignées à vos rôles.'
                            : roleActionsQuery.error.message}
                        </div>
                      ) : showEmptyMatrixState ? (
                        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                          Ajoutez des actions ou importez des processus pour générer la matrice RACI du département.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {smallScreenActions.map((action) => (
                            <div
                              key={action.id}
                              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                                  {action.context ? (
                                    <p className="text-xs text-slate-600">{action.context}</p>
                                  ) : null}
                                </div>
                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset',
                                    action.source === 'aggregated'
                                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                      : 'bg-slate-100 text-slate-700 ring-slate-200'
                                  )}
                                >
                                  {action.source === 'aggregated' ? 'Action importée' : 'Action manuelle'}
                                </span>
                              </div>
                              <dl className="mt-3 space-y-2">
                                {filledRaciValues.map((value) => {
                                  const roles = action.responsibilities[value];
                                  const hasRoles = roles.length > 0;

                                  return (
                                    <div key={`${action.id}-${value}`} className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2">
                                      <span
                                        className={cn(
                                          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase tracking-wide ring-1 ring-inset',
                                          raciBadgeStyles[value]
                                        )}
                                      >
                                        {value}
                                      </span>
                                      <div className="space-y-0.5">
                                        <p className="text-sm font-semibold text-slate-900">{raciDefinitions[value].short}</p>
                                        <p className="text-xs text-slate-700">{hasRoles ? roles.join(', ') : 'Non attribué'}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </dl>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  <RaciGrid
                    aggregatedProcesses={departmentAggregatedProcesses}
                    aggregatedRowSummaries={aggregatedRowSummaries}
                    collapsedProcesses={collapsedProcesses}
                    departmentId={selectedDepartment.id}
                    hasAggregatedActions={hasAggregatedActions}
                    hasManualActions={hasManualActions}
                    manualActions={selectedDepartmentState.actions}
                    matrix={selectedDepartmentState.matrix}
                    manualRowSummaries={manualRowSummaries}
                    roleSummaries={roleSummaries}
                    roles={selectedDepartment.roles}
                    showEmptyMatrixState={showEmptyMatrixState}
                    status={roleActionsQuery}
                    toggleProcessVisibility={toggleProcessVisibility}
                    updateMatrix={updateMatrix}
                  />
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
                  </>
                ) : (
                  <div className="border-t border-slate-200 bg-white px-6 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Vue par rôle</p>
                        <p className="text-xs text-slate-600">Identifiez rapidement les actions où un rôle est Responsable, Autorité, Consulté ou Informé.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedDepartment.roles.length > 0 ? (
                          selectedDepartment.roles.map((role) => (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => setSelectedRoleId(role.id)}
                              className={cn(
                                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                                selectedRoleId === role.id
                                  ? 'border-slate-900 bg-slate-900/5 text-slate-900'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: role.color }}
                              />
                              <span className="truncate">{role.name}</span>
                            </button>
                          ))
                        ) : (
                          <span className="text-xs text-slate-600">Aucun rôle n’est disponible.</span>
                        )}
                      </div>
                    </div>

                    {roleCentricAssignments && selectedRole ? (
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {filledRaciValues.map((value) => {
                          const assignmentsForValue = roleCentricAssignments[value];
                          const hasAssignments = assignmentsForValue.length > 0;

                          return (
                            <div key={value} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold uppercase tracking-wide ring-1 ring-inset',
                                      raciBadgeStyles[value]
                                    )}
                                  >
                                    {value}
                                  </span>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{raciDefinitions[value].short}</p>
                                    <p className="text-xs text-slate-600">{raciDefinitions[value].tooltip}</p>
                                  </div>
                                </div>
                                <span className="text-xs font-semibold text-slate-700">{assignmentsForValue.length} action{assignmentsForValue.length > 1 ? 's' : ''}</span>
                              </div>
                              <div className="mt-3 space-y-3">
                                {hasAssignments ? (
                                  assignmentsForValue.map((assignment) => (
                                    <div
                                      key={assignment.id}
                                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm"
                                    >
                                      <p className="font-semibold text-slate-900">{assignment.label}</p>
                                      {assignment.context ? (
                                        <p className="text-xs text-slate-600">{assignment.context}</p>
                                      ) : null}
                                      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                                        {assignment.source === 'aggregated' ? 'Action importée' : 'Action manuelle'}
                                      </p>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs text-slate-600">Aucune action pour ce rôle.</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        Sélectionnez un rôle pour consulter ses responsabilités.
                      </p>
                    )}
                  </div>
                )}
              </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-600">
                  <p>Sélectionnez un département pour générer sa matrice RACI.</p>
                </div>
              )}
          </div>

          <aside className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">Méthodologie RACI</h3>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  ?
                </span>
              </div>
              <p className="text-sm text-slate-600">
                Survolez un rôle ou une cellule pour afficher un rappel rapide des responsabilités.
              </p>
            </div>

            <dl className="space-y-3">
              {filledRaciValues.map((value) => (
                <div key={value} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <dt className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <span
                      className={cn(
                        'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold uppercase tracking-wide ring-1 ring-inset',
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
          </aside>
        </section>
      </div>
    </div>
  );
}
