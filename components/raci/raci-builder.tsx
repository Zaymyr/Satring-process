'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Copy, Download, Expand, FileText, Loader2, Shrink } from 'lucide-react';

import { useI18n } from '@/components/providers/i18n-provider';
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

const filledRaciValues = ['R', 'A', 'C', 'I'] as const;

const raciBadgeStyles: Record<FilledRaciValue, string> = {
  R: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  A: 'bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-200',
  C: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200',
  I: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200'
} as const;

const rowHighlightShadow = 'shadow-[0_0_0_1px_rgba(148,163,184,0.6)]';

type FilledRaciValue = (typeof filledRaciValues)[number];
type RaciValue = FilledRaciValue | '';

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

type MatrixExportRow = {
  id: string;
  label: string;
  values: Record<string, RaciValue>;
};

const formatCount = (count: number, labels: { singular: string; plural: string }) =>
  `${count} ${count === 1 ? labels.singular : labels.plural}`;

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
  const { dictionary, locale } = useI18n();

  const raciDefinitions = dictionary.raci.definitions;

  const raciOptions = useMemo<ReadonlyArray<{ value: RaciValue; label: string }>>(
    () => [
      { value: '', label: '—' },
      ...filledRaciValues.map((value) => ({
        value,
        label: `${value} — ${raciDefinitions[value].short}`
      }))
    ],
    [raciDefinitions]
  );

  const fetchDepartments = useCallback(async (): Promise<ApiDepartment[]> => {
    const response = await fetch('/api/departments', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store'
    });

    if (response.status === 401) {
      throw new ApiError(dictionary.raci.errors.authRequired, 401);
    }

    if (!response.ok) {
      const message = await readErrorMessage(response, dictionary.raci.errors.listDepartmentsFailed);
      throw new ApiError(message, response.status);
    }

    const json = await response.json();
    return departmentListSchema.parse(json);
  }, [dictionary.raci.errors.authRequired, dictionary.raci.errors.listDepartmentsFailed]);

  const fetchRoleActions = useCallback(async (): Promise<RoleActionSummary[]> => {
    const response = await fetch('/api/roles/actions', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store'
    });

    if (response.status === 401) {
      throw new ApiError(dictionary.raci.errors.authRequired, 401);
    }

    if (!response.ok) {
      const message = await readErrorMessage(response, dictionary.raci.errors.listRoleActionsFailed);
      throw new ApiError(message, response.status);
    }

    const json = await response.json();
    return roleActionSummaryListSchema.parse(json);
  }, [dictionary.raci.errors.authRequired, dictionary.raci.errors.listRoleActionsFailed]);

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
          left.label.localeCompare(right.label, locale, { sensitivity: 'base' })
        )
      }))
      .sort((left, right) => left.title.localeCompare(right.title, locale, { sensitivity: 'base' }));
  }, [locale, roleActionsByRoleId, selectedDepartment]);

  const aggregatedActionCount = useMemo(
    () => departmentAggregatedProcesses.reduce((total, process) => total + process.steps.length, 0),
    [departmentAggregatedProcesses]
  );

  const manualActionCount = selectedDepartmentState.actions.length;
  const totalActionCount = aggregatedActionCount + manualActionCount;

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
    : dictionary.raci.builder.exports.departmentFallbackSlug;

  const buildCsvContent = () => {
    if (!selectedDepartment || matrixRows.length === 0) {
      return '';
    }

    const headers = [dictionary.raci.builder.exports.headers.action, ...selectedDepartment.roles.map((role) => role.name)];
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
    link.download = `${dictionary.raci.builder.exports.fileName}-${departmentSlug}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = async () => {
    if (!selectedDepartment || matrixRows.length === 0 || !navigator.clipboard) {
      return;
    }

    const headers = [dictionary.raci.builder.exports.headers.action, ...selectedDepartment.roles.map((role) => role.name)];
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

    const tableHeaders = [dictionary.raci.builder.exports.headers.action, ...selectedDepartment.roles.map((role) => role.name)]
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

    const documentTitle = dictionary.raci.builder.exports.documentTitle.replace(
      '{department}',
      selectedDepartment.name
    );

    const html = `<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${documentTitle}</title>
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
            <h1>${documentTitle}</h1>
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

  const [hoveredRoleId, setHoveredRoleId] = useState<string | null>(null);
  const [hoveredActionId, setHoveredActionId] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ actionId: string; roleId: string } | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const columnRefs = useRef<Map<string, HTMLTableCellElement | null>>(new Map());
  const rowRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map());
  const [columnHighlight, setColumnHighlight] = useState<{ left: number; width: number } | null>(null);
  const [rowHighlight, setRowHighlight] = useState<{ top: number; height: number } | null>(null);

  const updateColumnHighlight = useCallback(() => {
    if (!hoveredRoleId) {
      setColumnHighlight(null);
      return;
    }

    const container = tableContainerRef.current;
    const header = columnRefs.current.get(hoveredRoleId);

    if (!container || !header) {
      setColumnHighlight(null);
      return;
    }

    setColumnHighlight({
      left: header.offsetLeft - container.scrollLeft,
      width: header.offsetWidth
    });
  }, [hoveredRoleId]);

  const updateRowHighlight = useCallback(() => {
    if (!hoveredActionId) {
      setRowHighlight(null);
      return;
    }

    const container = tableContainerRef.current;
    const row = rowRefs.current.get(hoveredActionId);

    if (!container || !row) {
      setRowHighlight(null);
      return;
    }

    setRowHighlight({
      top: row.offsetTop - container.scrollTop,
      height: row.offsetHeight
    });
  }, [hoveredActionId]);

  useEffect(() => {
    updateColumnHighlight();
  }, [updateColumnHighlight]);

  useEffect(() => {
    updateRowHighlight();
  }, [updateRowHighlight]);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      updateColumnHighlight();
      updateRowHighlight();
    };

    container.addEventListener('scroll', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [updateColumnHighlight, updateRowHighlight]);

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

  let visibleRowIndex = 0;

  const getRowBackground = () => (visibleRowIndex++ % 2 === 0 ? 'bg-white' : 'bg-slate-100');

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="flex w-full flex-col gap-10 px-6 py-10">
        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)_280px]">
          <div className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900">{dictionary.raci.departments.title}</h2>

              {departmentsQuery.isLoading ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {dictionary.raci.departments.loading}
                </div>
              ) : departmentsQuery.isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {departmentsQuery.error instanceof ApiError && departmentsQuery.error.status === 401
                    ? dictionary.raci.departments.authRequired
                    : departmentsQuery.error.message}
                </div>
              ) : departments.length > 0 ? (
                <ul className="flex flex-col gap-3" role="tree" aria-label={dictionary.raci.departments.ariaLabel}>
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
                                    {formatCount(rolesCount, dictionary.raci.departments.roleCount)}
                                  </span>
                                </div>
                              </div>
                          </div>
                        </button>
                        {isSelected ? (
                          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
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
                              <p className="mt-2 text-sm text-slate-500">{dictionary.raci.departments.noRoles}</p>
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  {dictionary.raci.departments.empty}
                </p>
              )}
            </div>

          </div>

          <div className="flex flex-col gap-6">
            {selectedDepartment ? (
              <>
                <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-semibold text-slate-900">{selectedDepartment.name}</h2>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                            <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden />
                            {formatCount(selectedDepartment.roles.length, dictionary.raci.builder.counts.roles)}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                            <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden />
                            {formatCount(totalActionCount, dictionary.raci.builder.counts.actions)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {hasAggregatedActions ? (
                          <>
                            <button
                              type="button"
                              onClick={expandAllProcesses}
                              title={dictionary.raci.builder.processes.expandAll}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                            >
                              <Expand className="h-4 w-4" aria-hidden />
                              <span className="sr-only">{dictionary.raci.builder.processes.expandAll}</span>
                            </button>
                            <button
                              type="button"
                              onClick={collapseAllProcesses}
                              title={dictionary.raci.builder.processes.collapseAll}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                            >
                              <Shrink className="h-4 w-4" aria-hidden />
                              <span className="sr-only">{dictionary.raci.builder.processes.collapseAll}</span>
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleCsvDownload}
                          disabled={!hasExportableData}
                          title={dictionary.raci.builder.exports.csv.download}
                          className={cn(
                            'inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
                            !hasExportableData && 'cursor-not-allowed opacity-60'
                          )}
                        >
                          <Download className="h-4 w-4" aria-hidden />
                          <span className="sr-only">{dictionary.raci.builder.exports.csv.download}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyCsv}
                          disabled={!hasExportableData}
                          title={csvCopied ? dictionary.raci.builder.exports.csv.copied : dictionary.raci.builder.exports.csv.copy}
                          className={cn(
                            'inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
                            !hasExportableData && 'cursor-not-allowed opacity-60'
                          )}
                        >
                          <Copy className="h-4 w-4" aria-hidden />
                          <span className="sr-only">{csvCopied ? dictionary.raci.builder.exports.csv.copied : dictionary.raci.builder.exports.csv.copy}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyMarkdown}
                          disabled={!hasExportableData}
                          title={
                            markdownCopied
                              ? dictionary.raci.builder.exports.markdown.copied
                              : dictionary.raci.builder.exports.markdown.copy
                          }
                          className={cn(
                            'inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
                            !hasExportableData && 'cursor-not-allowed opacity-60'
                          )}
                        >
                          <Copy className="h-4 w-4" aria-hidden />
                          <span className="sr-only">{markdownCopied ? dictionary.raci.builder.exports.markdown.copied : dictionary.raci.builder.exports.markdown.copy}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handlePrintPdf}
                          disabled={!hasExportableData}
                          title={dictionary.raci.builder.exports.pdf}
                          className={cn(
                            'inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
                            !hasExportableData && 'cursor-not-allowed opacity-60'
                          )}
                        >
                          <FileText className="h-4 w-4" aria-hidden />
                          <span className="sr-only">{dictionary.raci.builder.exports.pdf}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 md:hidden">
                  {roleActionsQuery.isLoading ? (
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {dictionary.raci.builder.mobile.loading}
                    </div>
                  ) : roleActionsQuery.isError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {roleActionsQuery.error instanceof ApiError && roleActionsQuery.error.status === 401
                        ? dictionary.raci.builder.mobile.authError
                        : roleActionsQuery.error.message}
                    </div>
                  ) : showEmptyMatrixState ? (
                    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                      {dictionary.raci.builder.mobile.empty}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {smallScreenActions.map((action) => (
                        <div key={action.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                              {action.context ? <p className="text-xs text-slate-600">{action.context}</p> : null}
                            </div>
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset',
                                action.source === 'aggregated'
                                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                  : 'bg-slate-100 text-slate-700 ring-slate-200'
                              )}
                            >
                              {action.source === 'aggregated'
                                ? dictionary.raci.builder.badges.imported
                                : dictionary.raci.builder.badges.manual}
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
                                    <p className="text-xs text-slate-700">
                                      {hasRoles ? roles.join(', ') : dictionary.raci.builder.table.unassigned}
                                    </p>
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

                <div
                  ref={tableContainerRef}
                  className="relative hidden overflow-auto md:block"
                  onMouseLeave={() => {
                    setHoveredRoleId(null);
                    setHoveredActionId(null);
                    setHoveredCell(null);
                  }}
                >
                  {columnHighlight ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute top-0 z-30 rounded-md border-2 border-slate-800 shadow-[0_0_0_1px_rgba(15,23,42,0.5)]"
                      style={{
                        left: columnHighlight.left,
                        width: columnHighlight.width,
                        height: tableContainerRef.current?.scrollHeight
                      }}
                    />
                  ) : null}
                  {rowHighlight ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute left-0 z-30 rounded-md border-2 border-slate-800 shadow-[0_0_0_1px_rgba(15,23,42,0.5)]"
                      style={{
                        top: rowHighlight.top,
                        height: rowHighlight.height,
                        width: tableContainerRef.current?.scrollWidth
                      }}
                    />
                  ) : null}
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead className="sticky top-0 z-30 bg-white shadow-sm">
                      <tr>
                        <th
                          className="sticky left-0 top-0 z-40 w-64 border-b border-r border-slate-200 bg-white px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                          scope="col"
                        >
                          {dictionary.raci.builder.table.heading}
                        </th>
                        {selectedDepartment.roles.map((role) => (
                          <th
                            key={role.id}
                            scope="col"
                            ref={(node) => {
                              if (node) {
                                columnRefs.current.set(role.id, node);
                              } else {
                                columnRefs.current.delete(role.id);
                              }
                            }}
                            onMouseEnter={() => setHoveredRoleId(role.id)}
                            className={cn(
                              'min-w-[6.5rem] max-w-[8rem] border-b border-slate-200 bg-white px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500'
                            )}
                          >
                            <span className="flex flex-col items-center justify-center gap-1 text-center leading-tight">
                              <span
                                aria-hidden="true"
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: role.color }}
                              />
                              <span className="break-words text-center text-sm font-semibold leading-tight text-slate-900">
                                {role.name}
                              </span>
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="[&_tr:not(:last-child)]:border-b [&_tr:not(:last-child)]:border-slate-100">
                      {roleActionsQuery.isLoading ? (
                        <tr>
                          <td
                            colSpan={selectedDepartment.roles.length + 1}
                            className="px-6 py-4 text-sm text-slate-500"
                          >
                            <span className="flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {dictionary.raci.builder.table.loading}
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
                              ? dictionary.raci.builder.table.authError
                              : roleActionsQuery.error.message}
                          </td>
                        </tr>
                      ) : null}

                      {!roleActionsQuery.isLoading &&
                      !roleActionsQuery.isError &&
                      hasAggregatedActions
                        ? departmentAggregatedProcesses.map((process) => {
                            const isCollapsed = collapsedProcesses[process.id] ?? false;
                            const actionCount = process.steps.length;
                            const actionCountLabel = formatCount(actionCount, dictionary.raci.builder.counts.actions);

                            return (
                              <Fragment key={`process-${process.id}`}>
                                <tr className="border-b border-slate-200 bg-slate-50/80">
                                  <th
                                    colSpan={selectedDepartment.roles.length + 1}
                                    className="px-6 py-3 text-left text-xs font-semibold tracking-wide text-slate-600"
                                  >
                                    <div className="flex w-full items-center justify-between gap-4 rounded-lg bg-white/40 px-2 py-2 text-left shadow-sm ring-1 ring-inset ring-slate-200">
                                      <div className="flex flex-1 items-center gap-3">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-base">
                                          {getProcessGlyph(process.title)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <Link
                                            href={`/?processId=${encodeURIComponent(process.id)}`}
                                            className="truncate text-sm font-semibold text-slate-800 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-900 hover:decoration-slate-400 sm:text-base"
                                          >
                                            {process.title}
                                          </Link>
                                          <p className="mt-0.5 text-xs font-medium text-slate-500">{actionCountLabel}</p>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => toggleProcessVisibility(process.id)}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                                        aria-expanded={!isCollapsed}
                                        aria-label={
                                          isCollapsed
                                            ? dictionary.raci.builder.processes.showSteps
                                            : dictionary.raci.builder.processes.hideSteps
                                        }
                                      >
                                        <ChevronDown
                                          aria-hidden="true"
                                          className={cn(
                                            'h-5 w-5 shrink-0 text-slate-600 transition-transform',
                                            isCollapsed ? '-rotate-90' : 'rotate-0'
                                          )}
                                        />
                                      </button>
                                    </div>
                                  </th>
                                </tr>

                                {!isCollapsed
                                  ? process.steps.map((action) => {
                                      const rowBackground = getRowBackground();

                                      return (
                                        <tr
                                          key={`aggregated-${process.id}-${action.id}`}
                                          ref={(node) => {
                                            if (node) {
                                              rowRefs.current.set(action.id, node);
                                            } else {
                                              rowRefs.current.delete(action.id);
                                            }
                                          }}
                                          onMouseEnter={() => setHoveredActionId(action.id)}
                                          onMouseLeave={() => setHoveredActionId(null)}
                                          className={cn(
                                            rowBackground,
                                            'odd:bg-white even:bg-slate-100 group relative transition-shadow',
                                            hoveredActionId === action.id && rowHighlightShadow
                                          )}
                                        >
                                          <th
                                            scope="row"
                                              className={cn(
                                                'sticky left-0 z-20 px-5 py-3 pl-10 text-left align-top border-r border-slate-200',
                                                'bg-inherit',
                                                'text-sm font-semibold text-slate-900'
                                              )}
                                          >
                                            <div>
                                              <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                                            </div>
                                          </th>
                                          {selectedDepartment.roles.map((role) => (
                                            <td
                                              key={role.id}
                                              onMouseEnter={() => {
                                                setHoveredRoleId(role.id);
                                                setHoveredCell({ actionId: action.id, roleId: role.id });
                                              }}
                                              onMouseLeave={() => setHoveredCell(null)}
                                              className="relative px-2.5 py-2 text-center text-sm align-middle bg-inherit"
                                            >
                                                <div className="group/cell relative inline-flex">
                                                  {action.assignedRoleIds.has(role.id) ? (
                                                    <span
                                                      className={cn(
                                                        'inline-flex min-w-[2.25rem] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm ring-1 ring-inset',
                                                        raciBadgeStyles[action.responsibility]
                                                      )}
                                                      title={raciDefinitions[action.responsibility].tooltip}
                                                    >
                                                    {action.responsibility}
                                                  </span>
                                                ) : (
                                                  <span
                                                    className="inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-transparent ring-1 ring-inset ring-slate-100 transition group-hover/cell:text-slate-400"
                                                    aria-label={dictionary.raci.builder.table.unassigned}
                                                  >
                                                    —
                                                  </span>
                                                )}

                                                {action.assignedRoleIds.has(role.id) &&
                                                hoveredCell?.actionId === action.id &&
                                                hoveredCell?.roleId === role.id ? (
                                                  <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg ring-1 ring-slate-200 group-hover/cell:block">
                                                    <p className="text-xs font-semibold text-slate-900">
                                                      {raciDefinitions[action.responsibility].short}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-600">
                                                      {raciDefinitions[action.responsibility].description}
                                                    </p>
                                                  </div>
                                                ) : null}
                                              </div>
                                            </td>
                                              ))}
                                            </tr>
                                          );
                                        })
                                  : null}
                              </Fragment>
                            );
                          })
                        : null}

                      {hasManualActions
                        ? selectedDepartmentState.actions.map((action) => {
                            const rowBackground = getRowBackground();

                            return (
                              <tr
                                key={action.id}
                                ref={(node) => {
                                  if (node) {
                                    rowRefs.current.set(action.id, node);
                                  } else {
                                    rowRefs.current.delete(action.id);
                                  }
                                }}
                                onMouseEnter={() => setHoveredActionId(action.id)}
                                onMouseLeave={() => setHoveredActionId(null)}
                                className={cn(
                                  rowBackground,
                                  'odd:bg-white even:bg-slate-100 group relative transition-shadow',
                                  hoveredActionId === action.id && rowHighlightShadow
                                )}
                              >
                                <th
                                  scope="row"
                                  className={cn(
                                    'sticky left-0 z-20 px-5 py-3 text-left align-top border-r border-slate-200',
                                    'bg-inherit',
                                    'text-sm font-semibold text-slate-900'
                                  )}
                                >
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{action.name}</p>
                                  </div>
                                </th>
                                    {selectedDepartment.roles.map((role) => {
                                      const currentValue = selectedDepartmentState.matrix[action.id]?.[role.id] ?? '';
                                      const isFilled = currentValue !== '';

                                  return (
                                    <td
                                      key={role.id}
                                      onMouseEnter={() => {
                                        setHoveredRoleId(role.id);
                                        setHoveredCell({ actionId: action.id, roleId: role.id });
                                      }}
                                      onMouseLeave={() => setHoveredCell(null)}
                                      className="relative px-2.5 py-2 text-sm align-middle bg-inherit"
                                    >
                                      <div className="flex flex-col items-center gap-2">
                                        <div className="group/cell relative">
                                          <span
                                            className={cn(
                                              'inline-flex min-w-[2.25rem] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm ring-1 ring-inset transition',
                                              isFilled
                                                ? raciBadgeStyles[currentValue as FilledRaciValue]
                                                : 'bg-white text-transparent ring-slate-100 group-hover/cell:text-slate-400'
                                            )}
                                            title={isFilled ? raciDefinitions[currentValue as FilledRaciValue].tooltip : undefined}
                                            aria-label={
                                              isFilled
                                                ? raciDefinitions[currentValue as FilledRaciValue].short
                                                : dictionary.raci.builder.table.unassigned
                                            }
                                          >
                                            {isFilled ? currentValue : '—'}
                                          </span>

                                          {isFilled && hoveredCell?.actionId === action.id && hoveredCell?.roleId === role.id ? (
                                            <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg ring-1 ring-slate-200 group-hover/cell:block">
                                              <p className="text-xs font-semibold text-slate-900">
                                                {raciDefinitions[currentValue as FilledRaciValue].short}
                                              </p>
                                              <p className="mt-1 text-xs text-slate-600">
                                                {raciDefinitions[currentValue as FilledRaciValue].description}
                                              </p>
                                            </div>
                                          ) : null}
                                        </div>

                                        <select
                                          value={currentValue}
                                          onChange={(event) =>
                                            updateMatrix(selectedDepartment.id, action.id, role.id, event.target.value as RaciValue)
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
                                    </td>
                                  );
                                    })}
                                  </tr>
                                );
                              })
                        : null}

                      {showEmptyMatrixState ? (
                        <tr>
                          <td
                            colSpan={selectedDepartment.roles.length + 1}
                            className="px-6 py-6 text-center text-sm text-slate-500"
                          >
                            {dictionary.raci.builder.table.empty}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                {selectedDepartmentState.actions.length > 0 ? (
                  <div className="border-t border-slate-200 bg-white px-6 py-5">
                    <h3 className="text-sm font-semibold text-slate-900">{dictionary.raci.builder.summary.title}</h3>
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
                                  {roles.length > 0 ? roles.join(', ') : dictionary.raci.builder.summary.unassigned}
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
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-600">
                <p>{dictionary.raci.builder.emptySelection}</p>
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">{dictionary.raci.builder.methodology.title}</h3>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  ?
                </span>
              </div>
              <p className="text-sm text-slate-600">{dictionary.raci.builder.methodology.description}</p>
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
