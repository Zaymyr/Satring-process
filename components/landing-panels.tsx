'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  type CSSProperties,
  type ReactNode
} from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  ArrowUpDown,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Flag,
  FolderTree,
  GitBranch,
  Loader2,
  ListChecks,
  Pencil,
  PlayCircle,
  Plus,
  GripVertical,
  ShieldCheck,
  Sparkles,
  Trash2,
  type LucideIcon
} from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DEFAULT_PROCESS_STEPS, DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { cn } from '@/lib/utils/cn';
import {
  processResponseSchema,
  processSummarySchema,
  type ProcessPayload,
  type ProcessResponse,
  type ProcessStep,
  type ProcessSummary,
  type StepType
} from '@/lib/validation/process';
import {
  DEFAULT_DEPARTMENT_COLOR,
  departmentInputSchema,
  departmentListSchema,
  departmentSchema,
  type Department,
  type DepartmentInput
} from '@/lib/validation/department';

const highlightIcons = {
  sparkles: Sparkles,
  shield: ShieldCheck
} as const satisfies Record<string, LucideIcon>;

const DEFAULT_DEPARTMENT_NAME = 'Nouveau département';

const HEX_COLOR_REGEX = /^#[0-9A-F]{6}$/;
const CLUSTER_STYLE_TEXT_COLOR = '#0f172a';
const CLUSTER_FILL_OPACITY = 0.18;
const FALLBACK_STEP_FILL_ALPHA = 0.22;

const parseHexColor = (color: string): [number, number, number] | null => {
  if (!HEX_COLOR_REGEX.test(color)) {
    return null;
  }

  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);

  if ([red, green, blue].some((component) => Number.isNaN(component))) {
    return null;
  }

  return [red, green, blue];
};

const toRgba = (color: string, alpha: number, fallback: string) => {
  const rgb = parseHexColor(color);

  if (!rgb) {
    return fallback;
  }

  const normalizedAlpha = Math.min(Math.max(alpha, 0), 1);
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${normalizedAlpha})`;
};

const getClusterStyleDeclaration = (clusterId: string, color: string) => {
  const normalized = HEX_COLOR_REGEX.test(color) ? color : DEFAULT_DEPARTMENT_COLOR;
  return `style ${clusterId} fill:${normalized},stroke:${normalized},color:${CLUSTER_STYLE_TEXT_COLOR},stroke-width:2px,fill-opacity:${CLUSTER_FILL_OPACITY};`;
};

type Highlight = {
  title: string;
  description: string;
  icon: keyof typeof highlightIcons;
};

type Step = ProcessStep;

type DiagramDragState = {
  pointerId: number;
  originX: number;
  originY: number;
  startX: number;
  startY: number;
  target: HTMLDivElement | null;
  hasCapture: boolean;
};

type MermaidAPI = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, definition: string) => Promise<{ svg: string }>;
};

declare global {
  interface Window {
    mermaid?: MermaidAPI;
  }
}

let mermaidLoader: Promise<MermaidAPI> | null = null;

function loadMermaid(): Promise<MermaidAPI> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Mermaid nécessite un environnement navigateur.'));
  }

  if (window.mermaid) {
    return Promise.resolve(window.mermaid);
  }

  if (!mermaidLoader) {
    mermaidLoader = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-mermaid]');

      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (window.mermaid) {
            resolve(window.mermaid);
          } else {
            mermaidLoader = null;
            reject(new Error('Mermaid est introuvable après le chargement du script.'));
          }
        });
        existingScript.addEventListener('error', () => {
          mermaidLoader = null;
          reject(new Error('Impossible de charger le script Mermaid.'));
        });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.mermaid = 'true';
      script.addEventListener('load', () => {
        if (window.mermaid) {
          resolve(window.mermaid);
        } else {
          mermaidLoader = null;
          reject(new Error('Mermaid est introuvable après le chargement du script.'));
        }
      });
      script.addEventListener('error', () => {
        mermaidLoader = null;
        reject(new Error('Impossible de charger le script Mermaid.'));
      });
      document.head.appendChild(script);
    });
  }

  return mermaidLoader;
}

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const parseErrorPayload = (raw: string, fallback: string) => {
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    const parsedMessage = typeof parsed.error === 'string' ? parsed.error.trim() : '';

    if (parsedMessage) {
      return parsedMessage;
    }
  } catch (error) {
    console.error('Impossible de parser la réponse d’erreur', error);
  }

  return raw;
};

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const raw = await response.text();
    return parseErrorPayload(raw, fallback);
  } catch (error) {
    console.error('Impossible de lire la réponse d’erreur', error);
    return fallback;
  }
};

const normalizeBranchTarget = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeDepartmentId = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeStep = (step: ProcessStep): ProcessStep => ({
  ...step,
  departmentId: normalizeDepartmentId(step.departmentId),
  yesTargetId: normalizeBranchTarget(step.yesTargetId),
  noTargetId: normalizeBranchTarget(step.noTargetId)
});

const cloneSteps = (steps: readonly ProcessStep[]): ProcessStep[] => steps.map((step) => normalizeStep({ ...step }));

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const wrapStepLabel = (value: string) => {
  const normalized = value.trim();
  const source = normalized.length > 0 ? normalized : 'Étape';
  const maxCharsPerLine = 18;
  const words = source.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const tentative = currentLine ? `${currentLine} ${word}` : word;
    if (tentative.length <= maxCharsPerLine) {
      currentLine = tentative;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      if (word.length > maxCharsPerLine) {
        const segments = word.match(new RegExp(`.{1,${maxCharsPerLine}}`, 'g')) ?? [word];
        lines.push(...segments.slice(0, -1));
        currentLine = segments.at(-1) ?? '';
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const formatDepartmentClusterLabel = (value: string) => {
  const trimmed = value.trim();
  const base = trimmed.length > 0 ? trimmed : 'Département';
  const escaped = escapeHtml(base);
  return escaped.replace(/&quot;/g, '\\"');
};

const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const DIAGRAM_SCALE_MIN = 0.35;
const DIAGRAM_SCALE_MAX = 5;

const areStepsEqual = (a: readonly ProcessStep[], b: readonly ProcessStep[]) => {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((step, index) => {
    const other = b[index];
    if (!other) {
      return false;
    }

    const normalized = normalizeStep(step);
    const normalizedOther = normalizeStep(other);

    return (
      normalized.id === normalizedOther.id &&
      normalized.label === normalizedOther.label &&
      normalized.type === normalizedOther.type &&
      normalized.departmentId === normalizedOther.departmentId &&
      normalized.yesTargetId === normalizedOther.yesTargetId &&
      normalized.noTargetId === normalizedOther.noTargetId
    );
  });
};

const normalizeProcessTitle = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return DEFAULT_PROCESS_TITLE;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_PROCESS_TITLE;
};

const formatUpdatedAt = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch (error) {
    console.error('Impossible de formater la date de mise à jour', error);
    return null;
  }
};

const requestProcess = async (processId: string): Promise<ProcessResponse> => {
  const response = await fetch(`/api/process?id=${encodeURIComponent(processId)}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store'
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de récupérer le process.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return processResponseSchema.parse(json);
};

const processSummariesSchema = processSummarySchema.array();

const requestProcessSummaries = async (): Promise<ProcessSummary[]> => {
  const response = await fetch('/api/processes', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store'
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de lister vos process.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return processSummariesSchema.parse(json);
};

const createProcessRequest = async (title?: string): Promise<ProcessResponse> => {
  const response = await fetch('/api/processes', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(title ? { title } : {})
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de créer un nouveau process.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return processResponseSchema.parse(json);
};

const renameProcessRequest = async (input: { id: string; title: string }): Promise<ProcessSummary> => {
  const response = await fetch(`/api/processes/${encodeURIComponent(input.id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: input.title })
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de renommer le process.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return processSummarySchema.parse(json);
};

const deleteProcessRequest = async (processId: string): Promise<void> => {
  const response = await fetch(`/api/processes/${encodeURIComponent(processId)}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (response.status === 204) {
    return;
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de supprimer le process.');
    throw new ApiError(message, response.status);
  }
};

const requestDepartments = async (): Promise<Department[]> => {
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

const createDepartmentRequest = async (input: DepartmentInput): Promise<Department> => {
  const response = await fetch('/api/departments', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de créer le département.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return departmentSchema.parse(json);
};

const updateDepartmentRequest = async (input: { id: string; values: DepartmentInput }): Promise<Department> => {
  const response = await fetch(`/api/departments/${encodeURIComponent(input.id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input.values)
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de mettre à jour le département.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return departmentSchema.parse(json);
};

const deleteDepartmentRequest = async (departmentId: string): Promise<void> => {
  const response = await fetch(`/api/departments/${encodeURIComponent(departmentId)}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (response.status === 204) {
    return;
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de supprimer le département.');
    throw new ApiError(message, response.status);
  }
};

const STEP_TYPE_LABELS: Record<StepType, string> = {
  start: 'Départ',
  action: 'Action',
  decision: 'Décision',
  finish: 'Arrivée'
};

const STEP_TYPE_ICONS: Record<StepType, LucideIcon> = {
  start: PlayCircle,
  action: ListChecks,
  decision: GitBranch,
  finish: Flag
};

const getStepDisplayLabel = (step: Step) => {
  const trimmed = step.label.trim();
  return trimmed.length > 0 ? trimmed : STEP_TYPE_LABELS[step.type];
};

function generateStepId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `step-${Math.random().toString(36).slice(2, 10)}`;
}

type LandingPanelsProps = {
  highlights: readonly Highlight[];
};

export function LandingPanels({ highlights }: LandingPanelsProps) {
  const queryClient = useQueryClient();
  const [isPrimaryCollapsed, setIsPrimaryCollapsed] = useState(false);
  const [isSecondaryCollapsed, setIsSecondaryCollapsed] = useState(false);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);
  const [diagramDirection, setDiagramDirection] = useState<'TD' | 'LR'>('TD');
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [processTitle, setProcessTitle] = useState(DEFAULT_PROCESS_TITLE);
  const [steps, setSteps] = useState<ProcessStep[]>(() => cloneSteps(DEFAULT_PROCESS_STEPS));
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const baselineStepsRef = useRef<ProcessStep[]>(cloneSteps(DEFAULT_PROCESS_STEPS));
  const draggedStepIdRef = useRef<string | null>(null);
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [diagramSvg, setDiagramSvg] = useState('');
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [diagramUserOffset, setDiagramUserOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [diagramScale, setDiagramScale] = useState(1);
  const [isDiagramDragging, setIsDiagramDragging] = useState(false);
  const diagramDragStateRef = useRef<DiagramDragState | null>(null);
  const diagramViewportRef = useRef<HTMLDivElement | null>(null);
  const [isMermaidReady, setIsMermaidReady] = useState(false);
  const mermaidAPIRef = useRef<MermaidAPI | null>(null);
  const diagramElementId = useMemo(() => `process-diagram-${generateStepId()}`, []);
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [activeSecondaryTab, setActiveSecondaryTab] = useState<'processes' | 'departments'>('processes');
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [deleteDepartmentId, setDeleteDepartmentId] = useState<string | null>(null);
  const departmentEditForm = useForm<DepartmentInput>({
    resolver: zodResolver(departmentInputSchema),
    defaultValues: { name: '', color: DEFAULT_DEPARTMENT_COLOR }
  });

  const processSummariesQuery = useQuery<ProcessSummary[], ApiError>({
    queryKey: ['processes'],
    queryFn: requestProcessSummaries,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      return failureCount < 2;
    }
  });

  const currentProcessId = selectedProcessId;

  const processQuery = useQuery<ProcessResponse, ApiError>({
    queryKey: ['process', currentProcessId],
    queryFn: () => requestProcess(currentProcessId as string),
    enabled: typeof currentProcessId === 'string',
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      return failureCount < 2;
    }
  });

  const departmentsQuery = useQuery<Department[], ApiError>({
    queryKey: ['departments'],
    queryFn: requestDepartments,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      return failureCount < 2;
    }
  });

  const createDepartmentMutation = useMutation<Department, ApiError, void>({
    mutationFn: () =>
      createDepartmentRequest({ name: DEFAULT_DEPARTMENT_NAME, color: DEFAULT_DEPARTMENT_COLOR }),
    onSuccess: async (department) => {
      queryClient.setQueryData(['departments'], (previous?: Department[]) => {
        if (!previous) {
          return [department];
        }

        const filtered = previous.filter((item) => item.id !== department.id);
        return [department, ...filtered];
      });
      setEditingDepartmentId(department.id);
      departmentEditForm.reset({ name: department.name, color: department.color });
      await queryClient.invalidateQueries({ queryKey: ['departments'] });
    }
  });

  const updateDepartmentMutation = useMutation<Department, ApiError, { id: string; values: DepartmentInput }>({
    mutationFn: updateDepartmentRequest,
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['departments'] });
      setEditingDepartmentId((current) => (current === variables.id ? null : current));
      departmentEditForm.reset({ name: '', color: DEFAULT_DEPARTMENT_COLOR });
    }
  });

  const deleteDepartmentMutation = useMutation<void, ApiError, { id: string }>({
    mutationFn: ({ id }) => deleteDepartmentRequest(id),
    onMutate: async ({ id }) => {
      setDeleteDepartmentId(id);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['departments'] });
      setEditingDepartmentId((current) => (current === variables.id ? null : current));
    },
    onSettled: () => {
      setDeleteDepartmentId(null);
    }
  });

  useEffect(() => {
    if (editingProcessId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingProcessId]);

  useEffect(() => {
    if (!editingProcessId) {
      renameInputRef.current = null;
    }
  }, [editingProcessId]);

  const isProcessListUnauthorized =
    processSummariesQuery.isError &&
    processSummariesQuery.error instanceof ApiError &&
    processSummariesQuery.error.status === 401;

  const isProcessQueryUnauthorized =
    processQuery.isError && processQuery.error instanceof ApiError && processQuery.error.status === 401;

  const isUnauthorized = isProcessListUnauthorized || isProcessQueryUnauthorized;
  const processSummaries = useMemo(
    () => processSummariesQuery.data ?? [],
    [processSummariesQuery.data]
  );
  const hasProcesses = processSummaries.length > 0;
  const selectedStep = useMemo(
    () => steps.find((step) => step.id === selectedStepId) ?? null,
    [selectedStepId, steps]
  );
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);
  const hasDepartments = departments.length > 0;
  const isDepartmentUnauthorized =
    departmentsQuery.isError &&
    departmentsQuery.error instanceof ApiError &&
    departmentsQuery.error.status === 401;
  const isProcessesTabActive = activeSecondaryTab === 'processes';
  const isDepartmentsTabActive = activeSecondaryTab === 'departments';
  const isDepartmentActionsDisabled = isUnauthorized || isDepartmentUnauthorized;
  const isCreatingDepartment = createDepartmentMutation.isPending;
  const isUpdatingDepartment = updateDepartmentMutation.isPending;
  const isDeletingDepartment = deleteDepartmentMutation.isPending;
  const secondaryPanelTitle = isDepartmentsTabActive ? 'Mes départements' : 'Mes process';
  const secondaryPanelDescription = isDepartmentsTabActive
    ? 'Organisez vos départements et renommez-les pour structurer votre équipe.'
    : 'Gérez vos parcours enregistrés et renommez-les directement depuis cette liste.';

  const handleCreateDepartment = useCallback(() => {
    if (isDepartmentActionsDisabled || isCreatingDepartment) {
      return;
    }
    createDepartmentMutation.mutate();
  }, [createDepartmentMutation, isCreatingDepartment, isDepartmentActionsDisabled]);

  const handleUpdateDepartment = useCallback(
    (values: DepartmentInput) => {
      if (!editingDepartmentId || isDepartmentActionsDisabled) {
        return;
      }
      updateDepartmentMutation.mutate({ id: editingDepartmentId, values });
    },
    [editingDepartmentId, isDepartmentActionsDisabled, updateDepartmentMutation]
  );

  const handleDeleteDepartment = useCallback(
    (id: string) => {
      if (isDepartmentActionsDisabled) {
        return;
      }
      deleteDepartmentMutation.mutate({ id });
    },
    [deleteDepartmentMutation, isDepartmentActionsDisabled]
  );

  const startEditingDepartment = useCallback(
    (department: Department) => {
      if (isDepartmentActionsDisabled) {
        return;
      }
      setEditingDepartmentId(department.id);
      departmentEditForm.reset({ name: department.name, color: department.color });
    },
    [departmentEditForm, isDepartmentActionsDisabled]
  );

  const cancelEditingDepartment = useCallback(() => {
    setEditingDepartmentId(null);
    departmentEditForm.reset({ name: '', color: DEFAULT_DEPARTMENT_COLOR });
  }, [departmentEditForm]);

  useEffect(() => {
    if (isDepartmentActionsDisabled) {
      setEditingDepartmentId(null);
      departmentEditForm.reset({ name: '', color: DEFAULT_DEPARTMENT_COLOR });
    }
  }, [departmentEditForm, isDepartmentActionsDisabled]);

  useEffect(() => {
    if (steps.length === 0) {
      if (selectedStepId !== null) {
        setSelectedStepId(null);
      }
      return;
    }

    if (selectedStepId && steps.some((step) => step.id === selectedStepId)) {
      return;
    }

    const fallback =
      steps.find((step) => step.type === 'action' || step.type === 'decision') ??
      steps.find((step) => step.type === 'start') ??
      steps[0] ??
      null;

    const fallbackId = fallback ? fallback.id : null;

    if (fallbackId !== selectedStepId) {
      setSelectedStepId(fallbackId);
    }
  }, [selectedStepId, steps]);

  useEffect(() => {
    if (processQuery.data) {
      const fromServer = cloneSteps(processQuery.data.steps);
      baselineStepsRef.current = cloneSteps(fromServer);
      setSteps(fromServer);
      setLastSavedAt(processQuery.data.updatedAt);
      setProcessTitle(normalizeProcessTitle(processQuery.data.title));
    }
  }, [processQuery.data]);

  useEffect(() => {
    if (isUnauthorized) {
      const fallback = cloneSteps(DEFAULT_PROCESS_STEPS);
      baselineStepsRef.current = cloneSteps(fallback);
      setSteps(fallback);
      setLastSavedAt(null);
      setSelectedProcessId(null);
      setProcessTitle(DEFAULT_PROCESS_TITLE);
    }
  }, [isUnauthorized]);

  useEffect(() => {
    if (isUnauthorized) {
      return;
    }

    const summaries = processSummariesQuery.data;

    if (!summaries) {
      return;
    }

    if (summaries.length === 0) {
      setSelectedProcessId(null);
      setProcessTitle(DEFAULT_PROCESS_TITLE);
      const fallback = cloneSteps(DEFAULT_PROCESS_STEPS);
      baselineStepsRef.current = cloneSteps(fallback);
      setSteps(fallback);
      setLastSavedAt(null);
      return;
    }

    const hasSelection = currentProcessId && summaries.some((item) => item.id === currentProcessId);

    if (!hasSelection) {
      const [first] = summaries;
      setSelectedProcessId(first.id);
      setProcessTitle(normalizeProcessTitle(first.title));
      return;
    }

    const currentSummary = summaries.find((item) => item.id === currentProcessId);

    if (currentSummary) {
      setProcessTitle(normalizeProcessTitle(currentSummary.title));
    }
  }, [currentProcessId, isUnauthorized, processSummariesQuery.data]);

  useEffect(() => {
    if (
      processQuery.isError &&
      processQuery.error instanceof ApiError &&
      processQuery.error.status === 404 &&
      currentProcessId
    ) {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      setSelectedProcessId(null);
      const fallback = cloneSteps(DEFAULT_PROCESS_STEPS);
      baselineStepsRef.current = cloneSteps(fallback);
      setSteps(fallback);
      setLastSavedAt(null);
      setProcessTitle(DEFAULT_PROCESS_TITLE);
    }
  }, [currentProcessId, processQuery.error, processQuery.isError, queryClient]);

  const isDirty = useMemo(() => !areStepsEqual(steps, baselineStepsRef.current), [steps]);

  const createProcessMutation = useMutation<ProcessResponse, ApiError, string | undefined>({
    mutationFn: (title) => createProcessRequest(title),
    onSuccess: (data) => {
      const sanitizedSteps = cloneSteps(data.steps);
      baselineStepsRef.current = cloneSteps(sanitizedSteps);
      setSteps(sanitizedSteps);
      setLastSavedAt(data.updatedAt);
      setSelectedProcessId(data.id);
      const normalizedTitle = normalizeProcessTitle(data.title);
      setProcessTitle(normalizedTitle);
      queryClient.setQueryData(['processes'], (previous?: ProcessSummary[]) => {
        const summary: ProcessSummary = { id: data.id, title: normalizedTitle, updatedAt: data.updatedAt };

        if (!previous) {
          return [summary];
        }

        const filtered = previous.filter((item) => item.id !== data.id);
        return [summary, ...filtered];
      });
      queryClient.setQueryData(['process', data.id], data);
      setEditingProcessId(data.id);
      setRenameDraft(normalizedTitle);
    },
    onError: (error) => {
      console.error('Erreur lors de la création du process', error);
    }
  });

  const renameProcessMutation = useMutation<ProcessSummary, ApiError, { id: string; title: string }>({
    mutationFn: renameProcessRequest,
    onSuccess: (summary) => {
      const normalizedTitle = normalizeProcessTitle(summary.title);
      queryClient.setQueryData(['processes'], (previous?: ProcessSummary[]) => {
        const summaryEntry: ProcessSummary = {
          id: summary.id,
          title: normalizedTitle,
          updatedAt: summary.updatedAt
        };

        if (!previous) {
          return [summaryEntry];
        }

        const filtered = previous.filter((item) => item.id !== summary.id);
        return [summaryEntry, ...filtered];
      });

      queryClient.setQueryData(['process', summary.id], (previous: ProcessResponse | undefined) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          title: normalizedTitle,
          updatedAt: summary.updatedAt ?? previous.updatedAt
        };
      });

      if (selectedProcessId === summary.id) {
        setProcessTitle(normalizedTitle);
        setLastSavedAt((prev) => summary.updatedAt ?? prev);
      }

      setEditingProcessId(null);
      setRenameDraft('');
    },
    onError: (error) => {
      console.error('Erreur lors du renommage du process', error);
      if (renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
      }
    }
  });

  const deleteProcessMutation = useMutation<void, ApiError, string>({
    mutationFn: deleteProcessRequest,
    onSuccess: (_data, processId) => {
      queryClient.setQueryData(['processes'], (previous?: ProcessSummary[]) => {
        if (!previous) {
          return previous;
        }

        return previous.filter((item) => item.id !== processId);
      });
      queryClient.removeQueries({ queryKey: ['process', processId] });

      let shouldResetSelection = false;
      setSelectedProcessId((current) => {
        if (current === processId) {
          shouldResetSelection = true;
          return null;
        }
        return current;
      });

      let shouldResetRename = false;
      setEditingProcessId((current) => {
        if (current === processId) {
          shouldResetRename = true;
          return null;
        }
        return current;
      });

      if (shouldResetRename) {
        setRenameDraft('');
      }

      if (shouldResetSelection) {
        const fallback = cloneSteps(DEFAULT_PROCESS_STEPS);
        baselineStepsRef.current = cloneSteps(fallback);
        setSteps(fallback);
        setProcessTitle(DEFAULT_PROCESS_TITLE);
        setLastSavedAt(null);
      }
    },
    onError: (error) => {
      console.error('Erreur lors de la suppression du process', error);
    }
  });

  const saveMutation = useMutation<ProcessResponse, ApiError, ProcessPayload>({
    mutationFn: async (payload) => {
      if (!payload.id) {
        throw new ApiError('Identifiant de process manquant', 400);
      }

      const response = await fetch(`/api/process?id=${encodeURIComponent(payload.id)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: payload.title, steps: payload.steps })
      });

      if (response.status === 401) {
        throw new ApiError('Authentification requise', 401);
      }

      if (!response.ok) {
        const message = await readErrorMessage(response, 'Impossible de sauvegarder le process.');
        throw new ApiError(message, response.status);
      }

      const json = await response.json();
      return processResponseSchema.parse(json);
    },
    onSuccess: (data) => {
      const sanitized = cloneSteps(data.steps);
      baselineStepsRef.current = cloneSteps(sanitized);
      setSteps(sanitized);
      setLastSavedAt(data.updatedAt);
      const normalizedTitle = normalizeProcessTitle(data.title);
      setProcessTitle(normalizedTitle);
      queryClient.setQueryData(['process', data.id], data);
      queryClient.setQueryData(['processes'], (previous?: ProcessSummary[]) => {
        const summary: ProcessSummary = { id: data.id, title: normalizedTitle, updatedAt: data.updatedAt };

        if (!previous) {
          return [summary];
        }

        const filtered = previous.filter((item) => item.id !== data.id);
        return [summary, ...filtered];
      });
    },
    onError: (error) => {
      console.error('Erreur de sauvegarde du process', error);
    }
  });

  const isSaving = saveMutation.isPending;
  const isCreating = createProcessMutation.isPending;
  const isRenaming = renameProcessMutation.isPending;

  const formattedSavedAt = useMemo(() => {
    if (!lastSavedAt) {
      return null;
    }

    try {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(new Date(lastSavedAt));
    } catch (error) {
      console.error('Impossible de formater la date de sauvegarde', error);
      return null;
    }
  }, [lastSavedAt]);

  const statusMessage = useMemo<ReactNode>(() => {
    if (isUnauthorized) {
      return (
        <>
          Connectez-vous ou{' '}
          <Link href="/sign-up" className="font-medium text-slate-900 underline-offset-2 hover:underline">
            créez un compte
          </Link>{' '}
          pour sauvegarder votre process.
          {' '}
          <Link href="/sign-in" className="font-medium text-slate-900 underline-offset-2 hover:underline">
            Se connecter
          </Link>
        </>
      );
    }

    if (!currentProcessId) {
      if (isCreating) {
        return 'Création du process en cours…';
      }
      return 'Créez un process pour commencer.';
    }

    if (saveMutation.isError && saveMutation.error) {
      return saveMutation.error.message || 'Impossible de sauvegarder le process.';
    }

    if (processQuery.isLoading) {
      return 'Chargement du process en cours…';
    }

    if (isDirty) {
      return 'Des modifications non sauvegardées sont en attente.';
    }

    if (formattedSavedAt) {
      return `Dernière sauvegarde : ${formattedSavedAt}`;
    }

    return 'Aucune sauvegarde enregistrée pour le moment.';
  }, [
    currentProcessId,
    formattedSavedAt,
    isCreating,
    isDirty,
    isUnauthorized,
    processQuery.isLoading,
    saveMutation.error,
    saveMutation.isError
  ]);

  const statusToneClass = useMemo(() => {
    if (saveMutation.isError) {
      return 'text-red-600';
    }
    if (isUnauthorized) {
      return 'text-slate-500';
    }
    if (!currentProcessId) {
      return 'text-slate-500';
    }
    if (!isDirty && formattedSavedAt) {
      return 'text-emerald-600';
    }
    return 'text-slate-500';
  }, [currentProcessId, formattedSavedAt, isDirty, isUnauthorized, saveMutation.isError]);

  const saveButtonLabel = useMemo(() => {
    if (isUnauthorized) {
      return 'Connexion requise';
    }
    if (!currentProcessId) {
      return isCreating ? 'Création…' : 'Créer un process';
    }
    if (isSaving) {
      return 'Sauvegarde…';
    }
    if (isDirty) {
      return 'Sauvegarder le process';
    }
    return 'Process à jour';
  }, [currentProcessId, isCreating, isDirty, isSaving, isUnauthorized]);

  const isSaveDisabled = isUnauthorized || isSaving || !isDirty || !currentProcessId;

  const handleSave = () => {
    if (isSaveDisabled || !currentProcessId) {
      return;
    }

    const payloadSteps = steps.map((step) => ({
      ...step,
      label: step.label.trim(),
      departmentId: normalizeDepartmentId(step.departmentId),
      yesTargetId: normalizeBranchTarget(step.yesTargetId),
      noTargetId: normalizeBranchTarget(step.noTargetId)
    }));
    const payload: ProcessPayload = {
      id: currentProcessId,
      title: normalizeProcessTitle(processTitle),
      steps: payloadSteps
    };
    saveMutation.mutate(payload);
  };

  const stepPositions = useMemo(
    () => new Map(steps.map((step, index) => [step.id, index + 1] as const)),
    [steps]
  );

  const startEditingProcess = useCallback(
    (process: ProcessSummary) => {
      setEditingProcessId(process.id);
      setRenameDraft(normalizeProcessTitle(process.title));
    },
    []
  );

  const cancelEditingProcess = useCallback(() => {
    setEditingProcessId(null);
    setRenameDraft('');
  }, []);

  const confirmRenameProcess = useCallback(
    (processId: string) => {
      if (isRenaming) {
        return;
      }

      const trimmed = renameDraft.trim();
      const normalized = trimmed.length > 0 ? trimmed : DEFAULT_PROCESS_TITLE;
      const current = processSummaries.find((item) => item.id === processId);

      if (!current) {
        return;
      }

      if (normalizeProcessTitle(current.title) === normalizeProcessTitle(normalized)) {
        cancelEditingProcess();
        return;
      }

      renameProcessMutation.mutate({ id: processId, title: normalized });
    },
    [cancelEditingProcess, isRenaming, processSummaries, renameDraft, renameProcessMutation]
  );

  const handleCreateProcess = useCallback(() => {
    if (isUnauthorized || isCreating) {
      return;
    }

    createProcessMutation.mutate(undefined);
  }, [createProcessMutation, isCreating, isUnauthorized]);

  const clearDragState = useCallback(() => {
    draggedStepIdRef.current = null;
    setDraggedStepId(null);
  }, []);

  const handleStepDragStart = useCallback(
    (event: React.DragEvent<HTMLButtonElement>, stepId: string) => {
      event.stopPropagation();
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', stepId);
      draggedStepIdRef.current = stepId;
      setDraggedStepId(stepId);
      setSelectedStepId(stepId);
    },
    [setSelectedStepId]
  );

  const handleStepDragEnd = useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  const handleStepDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      clearDragState();
    },
    [clearDragState]
  );

  const handleStepDragOver = useCallback((event: React.DragEvent<HTMLElement>, overStepId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const draggedId = draggedStepIdRef.current;

    if (!draggedId || draggedId === overStepId) {
      return;
    }

    setSteps((previous) => {
      const fromIndex = previous.findIndex((item) => item.id === draggedId);
      const toIndex = previous.findIndex((item) => item.id === overStepId);
      const lastDraggableIndex = previous.length - 2;

      if (
        fromIndex <= 0 ||
        fromIndex >= previous.length - 1 ||
        lastDraggableIndex < 1 ||
        toIndex === -1
      ) {
        return previous;
      }

      const clampedTargetIndex = Math.min(Math.max(toIndex, 1), lastDraggableIndex);

      if (fromIndex === clampedTargetIndex) {
        return previous;
      }

      const updated = [...previous];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(clampedTargetIndex, 0, moved);
      return updated;
    });
  }, []);

  const handleStepListDragOverEnd = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const draggedId = draggedStepIdRef.current;

    if (!draggedId) {
      return;
    }

    setSteps((previous) => {
      const fromIndex = previous.findIndex((item) => item.id === draggedId);
      const finishIndex = previous.length - 1;
      const lastDraggableIndex = finishIndex - 1;

      if (
        fromIndex <= 0 ||
        fromIndex >= finishIndex ||
        lastDraggableIndex < 1 ||
        fromIndex === lastDraggableIndex
      ) {
        return previous;
      }

      const updated = [...previous];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(lastDraggableIndex, 0, moved);
      return updated;
    });
  }, []);

  const diagramDefinition = useMemo(() => {
    const flowchartDeclaration = `flowchart ${diagramDirection}`;

    if (steps.length === 0) {
      return flowchartDeclaration;
    }

    const classAssignments: string[] = [];
    const stepIndexMap = new Map(steps.map((step, index) => [step.id, index] as const));
    const departmentLookup = new Map(
      departments.map((department, index) => [
        department.id,
        { department, clusterId: `cluster_${index}` }
      ])
    );
    const clusterNodes = new Map<string, { label: string; nodes: string[]; color: string }>();
    const ungroupedNodes: string[] = [];

    steps.forEach((step, index) => {
      const nodeId = `S${index}`;
      const baseLabel = getStepDisplayLabel(step);
      const lines = wrapStepLabel(baseLabel);
      const label = lines.map((line) => escapeHtml(line)).join('<br/>');
      const departmentId = normalizeDepartmentId(step.departmentId);

      let declaration: string;

      if (step.type === 'action') {
        classAssignments.push(`class ${nodeId} action;`);
        declaration = `${nodeId}["${label}"]`;
      } else if (step.type === 'decision') {
        classAssignments.push(`class ${nodeId} decision;`);
        declaration = `${nodeId}{"${label}"}`;
      } else {
        classAssignments.push(`class ${nodeId} terminal;`);
        declaration = `${nodeId}(("${label}"))`;
      }

      if (departmentId) {
        const lookup = departmentLookup.get(departmentId);
        if (lookup) {
          const existing = clusterNodes.get(lookup.clusterId);
          if (existing) {
            existing.nodes.push(declaration);
          } else {
            clusterNodes.set(lookup.clusterId, {
              label: lookup.department.name,
              nodes: [declaration],
              color: lookup.department.color
            });
          }
          return;
        }
      }

      ungroupedNodes.push(declaration);
    });

    const buildEdge = (sourceId: string, targetIndex: number, label?: string) =>
      label ? `${sourceId} -- ${label} --> S${targetIndex}` : `${sourceId} --> S${targetIndex}`;

    const connections: string[] = [];

    steps.forEach((step, index) => {
      const nodeId = `S${index}`;
      const defaultNextIndex = index + 1 < steps.length ? index + 1 : undefined;

      if (step.type === 'decision') {
        const yesTarget = normalizeBranchTarget(step.yesTargetId);
        const noTarget = normalizeBranchTarget(step.noTargetId);

        if (!yesTarget && !noTarget) {
          if (typeof defaultNextIndex === 'number') {
            connections.push(buildEdge(nodeId, defaultNextIndex));
          }
          return;
        }

        const resolveTargetIndex = (targetId: string | null | undefined) => {
          if (targetId) {
            const resolved = stepIndexMap.get(targetId);
            if (typeof resolved === 'number') {
              return resolved;
            }
          }
          return defaultNextIndex;
        };

        const yesIndex = resolveTargetIndex(yesTarget);
        const noIndex = resolveTargetIndex(noTarget);

        if (
          typeof yesIndex === 'number' &&
          typeof noIndex === 'number' &&
          yesIndex === noIndex
        ) {
          connections.push(buildEdge(nodeId, yesIndex, 'Oui/Non'));
          return;
        }

        if (typeof yesIndex === 'number') {
          connections.push(buildEdge(nodeId, yesIndex, 'Oui'));
        }

        if (typeof noIndex === 'number') {
          connections.push(buildEdge(nodeId, noIndex, 'Non'));
        }

        return;
      }

      if (typeof defaultNextIndex === 'number') {
        connections.push(buildEdge(nodeId, defaultNextIndex));
      }
    });

    const classDefinitions = [
      'classDef terminal fill:#f8fafc,stroke:#0f172a,color:#0f172a,stroke-width:2px;',
      'classDef action fill:#ffffff,stroke:#0f172a,color:#0f172a,stroke-width:2px;',
      'classDef decision fill:#ffffff,stroke:#0f172a,color:#0f172a,stroke-width:2px;'
    ];

    const clusterDirection = diagramDirection === 'TD' ? 'TB' : diagramDirection;
    const clusterDeclarations: string[] = [];

    for (const [clusterId, { label, nodes, color }] of clusterNodes.entries()) {
      if (nodes.length === 0) {
        continue;
      }

      clusterDeclarations.push(`subgraph ${clusterId}["${formatDepartmentClusterLabel(label)}"]`);
      clusterDeclarations.push(`  direction ${clusterDirection}`);
      nodes.forEach((node) => {
        clusterDeclarations.push(`  ${node}`);
      });
      clusterDeclarations.push('end');
      clusterDeclarations.push(getClusterStyleDeclaration(clusterId, color));
    }

    return [
      flowchartDeclaration,
      ...classDefinitions,
      ...ungroupedNodes,
      ...clusterDeclarations,
      ...connections,
      ...classAssignments
    ].join('\n');
  }, [departments, diagramDirection, steps]);

  useEffect(() => {
    setDiagramUserOffset((previous) =>
      previous.x === 0 && previous.y === 0 ? previous : { x: 0, y: 0 }
    );
    setDiagramScale((previous) => (previous === 1 ? previous : 1));
  }, [diagramDirection]);

  const fallbackDiagram = useMemo(() => {
    if (steps.length === 0) {
      return null;
    }

    const centerX = 450;
    const canvasWidth = 900;
    const horizontalPadding = 64;
    const verticalPadding = 120;
    const stackSpacing = 80;
    const charWidth = 9;
    const lineHeight = 26;
    const maxWidth = 320;
    const minWidth = 180;
    const minActionHeight = 88;
    const minDecisionHeight = 120;
    const minTerminalHeight = 96;
    const contentPaddingY = 36;

    const stepById = new Map(steps.map((step) => [step.id, step] as const));
    const departmentById = new Map(departments.map((department) => [department.id, department] as const));

    const nodes = steps.reduce<
      Array<{
        step: Step;
        centerY: number;
        halfHeight: number;
        lines: string[];
        width: number;
        height: number;
        department: Department | undefined;
      }>
    >((acc, step) => {
      const baseLabel = getStepDisplayLabel(step);
      const labelLines = wrapStepLabel(baseLabel);
      const displayLines = [...labelLines];
      const department = step.departmentId ? departmentById.get(step.departmentId) : undefined;
      const stepIndex = acc.length;
      const defaultNextStep = steps[stepIndex + 1];
      const fallbackLabel = defaultNextStep ? getStepDisplayLabel(defaultNextStep) : '—';

      if (department) {
        displayLines.push('');
        displayLines.push(`Département : ${department.name}`);
      }

      if (step.type === 'decision') {
        const resolveTargetLabel = (targetId: string | null | undefined) => {
          const normalized = normalizeBranchTarget(targetId);
          if (!normalized) {
            return fallbackLabel;
          }

          const target = stepById.get(normalized);
          return target ? getStepDisplayLabel(target) : fallbackLabel;
        };

        const yesLabel = resolveTargetLabel(step.yesTargetId);
        const noLabel = resolveTargetLabel(step.noTargetId);
        const branchLines: string[] = [];

        if (yesLabel) {
          branchLines.push(`Oui → ${yesLabel}`);
        }
        if (noLabel) {
          branchLines.push(`Non → ${noLabel}`);
        }

        if (branchLines.length > 0) {
          displayLines.push('');
          displayLines.push(...branchLines);
        }
      }

      const longestLine = displayLines.reduce((max, line) => Math.max(max, line.length), 0);
      const rawWidth = longestLine * charWidth + horizontalPadding;
      const width = Math.min(maxWidth, Math.max(minWidth, rawWidth));
      const contentHeight = Math.max(displayLines.length, 1) * lineHeight;
      let height = contentHeight + contentPaddingY;

      if (step.type === 'action') {
        height = Math.max(height, minActionHeight);
      } else if (step.type === 'decision') {
        height = Math.max(height, minDecisionHeight);
      } else {
        height = Math.max(height, minTerminalHeight);
      }

      const halfHeight = height / 2;
      const previous = acc.at(-1);
      const centerY = previous
        ? previous.centerY + previous.halfHeight + stackSpacing + halfHeight
        : verticalPadding + halfHeight;

      acc.push({ step, centerY, halfHeight, lines: displayLines, width, height, department });
      return acc;
    }, []);

    const canvasHeight =
      (nodes.at(-1)?.centerY ?? verticalPadding) + (nodes.at(-1)?.halfHeight ?? 0) + verticalPadding;

    const diamondPoints = (centerY: number, width: number, height: number) =>
      [
        `${centerX},${centerY - height / 2}`,
        `${centerX + width / 2},${centerY}`,
        `${centerX},${centerY + height / 2}`,
        `${centerX - width / 2},${centerY}`
      ].join(' ');

    return (
      <svg
        role="presentation"
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        className="max-h-full w-full max-w-6xl opacity-90"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="process-arrow"
            viewBox="0 0 12 12"
            refX="6"
            refY="6"
            markerWidth="10"
            markerHeight="10"
            orient="auto"
          >
            <path d="M0 0L12 6L0 12Z" fill="#0f172a" />
          </marker>
          <filter id="process-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="rgba(15,23,42,0.18)" />
          </filter>
        </defs>
        {nodes.slice(0, -1).map((node, index) => {
          const nextNode = nodes[index + 1];
          const startY = node.centerY + node.halfHeight;
          const endY = nextNode.centerY - nextNode.halfHeight;

          return (
            <path
              key={`edge-${node.step.id}-${nextNode.step.id}`}
              d={`M ${centerX} ${startY} C ${centerX} ${startY + 48} ${centerX} ${endY - 48} ${centerX} ${endY}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth={2}
              markerEnd="url(#process-arrow)"
              opacity={0.7}
            />
          );
        })}
        {nodes.map((node) => {
          const { step, centerY, lines, width, height, department } = node;
          const isTerminal = step.type === 'start' || step.type === 'finish';
          const isDecision = step.type === 'decision';
          const isAction = step.type === 'action';
          const baseFill = isTerminal ? '#f8fafc' : '#ffffff';
          const strokeDefault = '#0f172a';
          const fillColor = department
            ? toRgba(department.color, FALLBACK_STEP_FILL_ALPHA, baseFill)
            : baseFill;
          const strokeColor = department ? department.color : strokeDefault;
          const blockOffset = ((lines.length - 1) * 24) / 2;

          return (
            <g key={step.id} filter="url(#process-shadow)">
              {isTerminal ? (
                <ellipse
                  cx={centerX}
                  cy={centerY}
                  rx={width / 2}
                  ry={height / 2}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={2}
                />
              ) : null}
              {isAction ? (
                <rect
                  x={centerX - width / 2}
                  y={centerY - height / 2}
                  width={width}
                  height={height}
                  rx={24}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={2}
                />
              ) : null}
              {isDecision ? (
                <polygon
                  points={diamondPoints(centerY, width, height)}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={2}
                />
              ) : null}
              <text
                x={centerX}
                y={centerY}
                textAnchor="middle"
                fontSize={20}
                fontWeight={600}
                fill="#0f172a"
                dominantBaseline="middle"
              >
                {lines.map((line, lineIndex) => {
                  const dy = lineIndex === 0 ? (lines.length > 1 ? -blockOffset : 0) : 24;

                  return (
                    <tspan key={`${step.id}-line-${lineIndex}`} x={centerX} dy={dy}>
                      {line}
                    </tspan>
                  );
                })}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }, [departments, steps]);

  useEffect(() => {
    let isActive = true;

    loadMermaid()
      .then((mermaid) => {
        if (!isActive) {
          return;
        }
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'neutral',
          themeVariables: {
            fontFamily:
              'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            primaryColor: '#ffffff',
            primaryTextColor: '#0f172a',
            primaryBorderColor: '#0f172a',
            lineColor: '#0f172a',
            tertiaryColor: '#e2e8f0',
            clusterBkg: '#f8fafc',
            clusterBorder: '#94a3b8'
          }
        });
        mermaidAPIRef.current = mermaid;
        setDiagramError(null);
        setIsMermaidReady(true);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }
        console.error('Erreur lors du chargement de Mermaid', error);
        setDiagramError('Impossible de charger le diagramme.');
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const mermaid = mermaidAPIRef.current;
    if (!isMermaidReady || !mermaid) {
      return;
    }

    let isCurrent = true;

    const renderDiagram = async () => {
      try {
        const { svg } = await mermaid.render(diagramElementId, diagramDefinition);
        if (!isCurrent) {
          return;
        }
        setDiagramError(null);
        setDiagramSvg(svg);
      } catch (error) {
        if (!isCurrent) {
          return;
        }
        console.error('Erreur lors du rendu Mermaid', error);
        setDiagramSvg('');
        setDiagramError("Impossible de générer le diagramme pour l'instant.");
      }
    };

    setDiagramSvg('');
    setDiagramError(null);
    void renderDiagram();

    return () => {
      isCurrent = false;
    };
  }, [diagramDefinition, diagramElementId, isMermaidReady]);

  const addStep = (type: Extract<StepType, 'action' | 'decision'>) => {
    const label = type === 'action' ? 'Nouvelle action' : 'Nouvelle décision';
    const newStepId = generateStepId();
    const nextStep: Step = {
      id: newStepId,
      label,
      type,
      departmentId: null,
      yesTargetId: null,
      noTargetId: null
    };

    setSteps((prev) => {
      const finishIndex = prev.findIndex((step) => step.type === 'finish');
      const selectedIndex = selectedStepId ? prev.findIndex((step) => step.id === selectedStepId) : -1;

      const insertionIndex = (() => {
        if (selectedIndex === -1) {
          return finishIndex === -1 ? prev.length : finishIndex;
        }

        if (finishIndex === -1) {
          return Math.min(selectedIndex + 1, prev.length);
        }

        return Math.min(selectedIndex + 1, finishIndex);
      })();

      const clampedIndex = Math.max(0, Math.min(insertionIndex, prev.length));
      const before = prev.slice(0, clampedIndex);
      const after = prev.slice(clampedIndex);
      return [...before, nextStep, ...after];
    });

    setSelectedStepId(newStepId);
  };

  const updateStepLabel = (id: string, label: string) => {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, label } : step)));
  };

  const updateStepDepartment = (id: string, departmentId: string | null) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === id ? { ...step, departmentId: normalizeDepartmentId(departmentId) } : step
      )
    );
  };

  const updateDecisionBranch = (id: string, branch: 'yes' | 'no', targetId: string | null) => {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== id || step.type !== 'decision') {
          return step;
        }

        const normalizedTarget = normalizeBranchTarget(targetId);
        const updated: ProcessStep =
          branch === 'yes'
            ? { ...step, yesTargetId: normalizedTarget }
            : { ...step, noTargetId: normalizedTarget };

        return normalizeStep(updated);
      })
    );
  };

  const removeStep = (id: string) => {
    let nextSelectedId: string | null = selectedStepId;
    setSteps((prev) => {
      const filtered = prev
        .filter((step) => step.id !== id)
        .map((step) => {
          if (step.type !== 'decision') {
            return step;
          }

          const updated: ProcessStep = {
            ...step,
            yesTargetId: step.yesTargetId === id ? null : step.yesTargetId,
            noTargetId: step.noTargetId === id ? null : step.noTargetId
          };

          return normalizeStep(updated);
        });

      if (selectedStepId === id) {
        const removedIndex = prev.findIndex((step) => step.id === id);
        const fallbackIndex = removedIndex > 0 ? removedIndex - 1 : 0;
        nextSelectedId = filtered[fallbackIndex]?.id ?? filtered[0]?.id ?? null;
      } else if (selectedStepId && !filtered.some((step) => step.id === selectedStepId)) {
        nextSelectedId =
          filtered.find((step) => step.type === 'action' || step.type === 'decision')?.id ??
          filtered[0]?.id ??
          null;
      }

      return filtered;
    });
    setSelectedStepId(nextSelectedId ?? null);
  };

  const applyDiagramWheelZoom = useCallback((event: WheelEvent, viewportRect: DOMRect) => {
    event.preventDefault();
    event.stopPropagation();

    const pointerX = event.clientX - (viewportRect.left + viewportRect.width / 2);
    const pointerY = event.clientY - (viewportRect.top + viewportRect.height / 2);

    let normalizedDeltaY = event.deltaY;

    if (event.deltaMode === 1) {
      normalizedDeltaY *= 32;
    } else if (event.deltaMode === 2) {
      normalizedDeltaY *= viewportRect.height;
    }

    if (!Number.isFinite(normalizedDeltaY)) {
      return;
    }

    const limitedDelta = clampValue(normalizedDeltaY, -480, 480);

    if (Math.abs(limitedDelta) < 0.01) {
      return;
    }

    const direction = Math.sign(limitedDelta) || 1;
    const distance = Math.min(Math.abs(limitedDelta), 480);
    const baseStep = event.ctrlKey || event.metaKey ? 0.35 : 0.22;
    const magnitude = Math.max(distance / 160, 0.2);
    const scaleStep = 1 + baseStep * magnitude;

    if (!Number.isFinite(scaleStep) || scaleStep <= 0) {
      return;
    }

    setDiagramScale((previousScale) => {
      const proposedScale =
        direction < 0
          ? previousScale * scaleStep
          : previousScale / scaleStep;

      const nextScale = clampValue(proposedScale, DIAGRAM_SCALE_MIN, DIAGRAM_SCALE_MAX);

      if (nextScale === previousScale) {
        return previousScale;
      }

      setDiagramUserOffset((previousOffset) => {
        const scaleRatio = nextScale / previousScale;
        return {
          x: pointerX - scaleRatio * (pointerX - previousOffset.x),
          y: pointerY - scaleRatio * (pointerY - previousOffset.y)
        };
      });

      return nextScale;
    });
  }, []);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const viewport = diagramViewportRef.current;

      if (!viewport) {
        return;
      }

      const composedPath = typeof event.composedPath === 'function' ? event.composedPath() : [];
      const eventTarget = (event.target as Node | null) ?? null;
      const isEventWithinViewport =
        (Array.isArray(composedPath) && composedPath.includes(viewport)) ||
        (eventTarget ? viewport.contains(eventTarget) : false);

      if (!isEventWithinViewport) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const isWithinHorizontalBounds = event.clientX >= rect.left && event.clientX <= rect.right;
      const isWithinVerticalBounds = event.clientY >= rect.top && event.clientY <= rect.bottom;

      if (!isWithinHorizontalBounds || !isWithinVerticalBounds) {
        return;
      }

      applyDiagramWheelZoom(event, rect);
    };

    const listenerOptions: AddEventListenerOptions = { passive: false, capture: true };
    window.addEventListener('wheel', handleWheel, listenerOptions);

    return () => {
      window.removeEventListener('wheel', handleWheel, listenerOptions);
    };
  }, [applyDiagramWheelZoom]);

  const updateDiagramDrag = useCallback((pointerId: number, clientX: number, clientY: number) => {
    const dragState = diagramDragStateRef.current;

    if (!dragState || dragState.pointerId !== pointerId) {
      return;
    }

    const deltaX = clientX - dragState.startX;
    const deltaY = clientY - dragState.startY;

    setDiagramUserOffset({
      x: dragState.originX + deltaX,
      y: dragState.originY + deltaY
    });
  }, []);

  const endDiagramDrag = useCallback((pointerId: number) => {
    const dragState = diagramDragStateRef.current;

    if (!dragState || dragState.pointerId !== pointerId) {
      return;
    }

    if (dragState.hasCapture && dragState.target?.hasPointerCapture?.(pointerId)) {
      try {
        dragState.target.releasePointerCapture(pointerId);
      } catch {
        // ignore pointer capture release errors
      }
    }

    diagramDragStateRef.current = null;
    setIsDiagramDragging(false);
  }, []);

  const handleDiagramPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      updateDiagramDrag(event.pointerId, event.clientX, event.clientY);
    },
    [updateDiagramDrag]
  );

  const handleDiagramPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      endDiagramDrag(event.pointerId);
    },
    [endDiagramDrag]
  );

  useEffect(() => {
    if (!isDiagramDragging) {
      return;
    }

    const dragState = diagramDragStateRef.current;

    if (!dragState || dragState.hasCapture) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (diagramDragStateRef.current?.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      updateDiagramDrag(event.pointerId, event.clientX, event.clientY);
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.type === 'pointerout' && event.relatedTarget) {
        return;
      }

      if (diagramDragStateRef.current?.pointerId !== event.pointerId) {
        return;
      }

      endDiagramDrag(event.pointerId);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('pointerout', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('pointerout', handlePointerEnd);
    };
  }, [endDiagramDrag, isDiagramDragging, updateDiagramDrag]);

  const handleDiagramPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.pointerType !== 'touch') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const target = event.currentTarget;
      let hasCapture = false;

      try {
        target.setPointerCapture(event.pointerId);
        hasCapture = target.hasPointerCapture?.(event.pointerId) ?? false;
      } catch {
        // ignore pointer capture errors on unsupported browsers
      }

      diagramDragStateRef.current = {
        pointerId: event.pointerId,
        originX: diagramUserOffset.x,
        originY: diagramUserOffset.y,
        startX: event.clientX,
        startY: event.clientY,
        target,
        hasCapture
      };

      setIsDiagramDragging(true);
    },
    [diagramUserOffset.x, diagramUserOffset.y]
  );

  const primaryWidth = isPrimaryCollapsed ? '3.5rem' : 'clamp(18rem, 28vw, 34rem)';
  const secondaryWidth = isSecondaryCollapsed ? '3.5rem' : 'clamp(16rem, 22vw, 26rem)';
  const layoutStyle = useMemo<CSSProperties>(
    () => ({
      gridTemplateColumns: `${primaryWidth} minmax(0, 1fr) ${secondaryWidth}`
    }),
    [primaryWidth, secondaryWidth]
  );

  const diagramControlsContentId = useId();

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900">
      <div className="absolute inset-0 z-0 flex items-center justify-center overflow-visible">
        <div
          ref={diagramViewportRef}
          className={cn(
            'pointer-events-auto relative flex h-full w-full select-none touch-none items-center justify-center',
            isDiagramDragging ? 'cursor-grabbing' : 'cursor-grab'
          )}
          onPointerDown={handleDiagramPointerDown}
          onPointerMove={handleDiagramPointerMove}
          onPointerUp={handleDiagramPointerEnd}
          onPointerCancel={handleDiagramPointerEnd}
          onLostPointerCapture={handleDiagramPointerEnd}
        >
          <div
            className={cn(
              'pointer-events-auto absolute left-1/2 top-1/2 h-auto w-auto max-h-none max-w-none opacity-90 transition-transform [filter:drop-shadow(0_25px_65px_rgba(15,23,42,0.22))] [&_svg]:h-auto [&_svg]:max-h-none [&_svg]:max-w-none [&_.node rect]:stroke-slate-900 [&_.node rect]:stroke-[1.5px] [&_.node polygon]:stroke-slate-900 [&_.node polygon]:stroke-[1.5px] [&_.node circle]:stroke-slate-900 [&_.node circle]:stroke-[1.5px] [&_.node ellipse]:stroke-slate-900 [&_.node ellipse]:stroke-[1.5px] [&_.edgePath path]:stroke-slate-900 [&_.edgePath path]:stroke-[1.5px] [&_.edgeLabel]:text-slate-900'
            )}
            style={{
              transform: `translate(-50%, -50%) translate3d(${diagramUserOffset.x}px, ${diagramUserOffset.y}px, 0) scale(${diagramScale})`,
              transformOrigin: 'center center',
              willChange: 'transform'
            }}
          >
            {diagramSvg ? (
              <div
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: diagramSvg }}
              />
            ) : (
              fallbackDiagram
            )}
          </div>
        </div>
        {diagramError ? (
          <span role="status" aria-live="polite" className="sr-only">
            {diagramError}
          </span>
        ) : null}
      </div>
      <div className="pointer-events-none relative z-10 flex h-full min-h-0 w-full flex-col gap-6 px-4 py-8 lg:px-8 lg:py-12 xl:px-12">
        <div
          className="pointer-events-none flex min-h-0 flex-1 flex-col gap-6 lg:grid lg:items-stretch lg:gap-0"
          style={layoutStyle}
        >
        <div
          className="pointer-events-auto relative flex shrink-0 items-stretch overflow-hidden transition-[width] duration-300 ease-out lg:col-start-1 lg:row-start-1 lg:h-full lg:min-h-0"
          style={{ width: primaryWidth }}
        >
          <button
            type="button"
            onClick={() => setIsPrimaryCollapsed((prev) => !prev)}
            aria-expanded={!isPrimaryCollapsed}
            aria-controls="primary-panel"
            className={cn(
              'absolute right-2 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white',
              'lg:right-3'
            )}
          >
            {isPrimaryCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            <span className="sr-only">Basculer le panneau principal</span>
          </button>
          <div
            id="primary-panel"
            className={cn(
              'flex h-full w-full flex-col gap-8 overflow-hidden rounded-3xl border border-slate-200 bg-white/85 px-8 py-10 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.35)] backdrop-blur transition-all duration-300 ease-out sm:px-10',
              isPrimaryCollapsed
                ? 'pointer-events-none opacity-0 lg:-translate-x-[110%]'
                : 'pointer-events-auto opacity-100 lg:translate-x-0'
            )}
          >
            <h1 className="text-base font-semibold text-slate-900">{processTitle}</h1>
            <div className="flex flex-wrap gap-2.5">
              <Button type="button" onClick={() => addStep('action')} className="h-9 rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Ajouter une action
              </Button>
              <Button type="button" variant="outline" onClick={() => addStep('decision')} className="h-9 rounded-md border-slate-300 bg-white px-3 text-sm text-slate-900 hover:bg-slate-50">
                <GitBranch className="mr-2 h-3.5 w-3.5" />
                Ajouter une décision
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="h-full space-y-6 overflow-y-auto rounded-2xl border border-slate-200 bg-white/75 p-5 pr-2 shadow-inner sm:pr-3">
                {selectedStep ? (
                  <p className="text-xs text-slate-600">
                    Étape sélectionnée :{' '}
                    <span className="font-medium text-slate-900">{getStepDisplayLabel(selectedStep)}</span>
                  </p>
                ) : null}
                <div className="space-y-3.5">
                  {steps.map((step, index) => {
                    const Icon = STEP_TYPE_ICONS[step.type];
                    const isRemovable = step.type === 'action' || step.type === 'decision';
                    const stepPosition = index + 1;
                    const availableTargets = steps.filter((candidate) => candidate.id !== step.id);
                    const isDragging = draggedStepId === step.id;
                    const isFixedStep = step.type === 'start' || step.type === 'finish';
                    const canReorderStep = !isFixedStep;
                    const isSelectedStep = selectedStepId === step.id;
                    const displayLabel = getStepDisplayLabel(step);

                    return (
                      <Card
                        key={step.id}
                        className={cn(
                          'border-slate-200 bg-white/90 shadow-sm transition',
                          isDragging
                            ? 'opacity-70 ring-2 ring-slate-300'
                            : isSelectedStep
                            ? 'border-slate-900 ring-2 ring-slate-900/20'
                            : 'hover:border-slate-300'
                        )}
                        onDragOver={(event) => handleStepDragOver(event, step.id)}
                        onDrop={handleStepDrop}
                        onClick={() => setSelectedStepId(step.id)}
                        onFocusCapture={() => setSelectedStepId(step.id)}
                        aria-selected={isSelectedStep}
                      >
                        <CardContent
                          className={cn(
                            'flex gap-3 p-3.5',
                            isSelectedStep ? 'items-start' : 'items-center gap-2 p-2.5'
                          )}
                        >
                          <div
                            className={cn(
                              'flex items-center',
                              isSelectedStep ? 'flex-col gap-1' : 'flex-row gap-2'
                            )}
                          >
                            <button
                              type="button"
                              className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-slate-100 text-slate-500 transition',
                                canReorderStep ? 'hover:border-slate-300 hover:bg-white' : 'cursor-not-allowed opacity-60'
                              )}
                              draggable={canReorderStep}
                              onDragStart={(event) => {
                                if (!canReorderStep) {
                                  event.preventDefault();
                                  return;
                                }
                                handleStepDragStart(event, step.id);
                              }}
                              onDragEnd={handleStepDragEnd}
                              aria-label={`Réorganiser ${getStepDisplayLabel(step)}`}
                              aria-grabbed={isDragging}
                              disabled={!canReorderStep}
                            >
                              <GripVertical className="h-3.5 w-3.5" />
                            </button>
                            <span
                              className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-full text-[0.65rem] font-semibold transition-colors',
                                isSelectedStep ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {stepPosition}
                            </span>
                          </div>
                          {isSelectedStep ? (
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Icon className="h-3.5 w-3.5" />
                                <span className="text-[0.6rem] font-medium uppercase tracking-[0.24em]">
                                  {STEP_TYPE_LABELS[step.type]}
                                </span>
                              </div>
                              <Input
                                id={`step-${step.id}-label`}
                                value={step.label}
                                onChange={(event) => updateStepLabel(step.id, event.target.value)}
                                placeholder="Intitulé de l’étape"
                                className="h-8 w-full border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50"
                              />
                              <label className="flex flex-col gap-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                <span>Département</span>
                                <select
                                  value={step.departmentId ?? ''}
                                  onChange={(event) =>
                                    updateStepDepartment(
                                      step.id,
                                      event.target.value.length > 0 ? event.target.value : null
                                    )
                                  }
                                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 transition focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed"
                                  disabled={!hasDepartments}
                                >
                                  <option value="">Aucun département</option>
                                  {departments.map((department) => (
                                    <option key={department.id} value={department.id}>
                                      {department.name}
                                    </option>
                                  ))}
                                </select>
                                {!hasDepartments ? (
                                  <span className="text-[0.6rem] font-normal normal-case tracking-normal text-slate-500">
                                    Ajoutez un département pour l’associer à cette étape.
                                  </span>
                                ) : null}
                              </label>
                              {step.type === 'decision' ? (
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  <label className="flex flex-col gap-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    <span>Branche Oui</span>
                                    <select
                                      value={step.yesTargetId ?? ''}
                                      onChange={(event) =>
                                        updateDecisionBranch(step.id, 'yes', event.target.value || null)
                                      }
                                      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 transition focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                                    >
                                      <option value="">Étape suivante (défaut)</option>
                                      {availableTargets.map((candidate) => {
                                        const position = stepPositions.get(candidate.id);
                                        const optionLabel = position
                                          ? `${position}. ${getStepDisplayLabel(candidate)}`
                                          : getStepDisplayLabel(candidate);

                                        return (
                                          <option key={candidate.id} value={candidate.id}>
                                            {optionLabel}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </label>
                                  <label className="flex flex-col gap-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    <span>Branche Non</span>
                                    <select
                                      value={step.noTargetId ?? ''}
                                      onChange={(event) =>
                                        updateDecisionBranch(step.id, 'no', event.target.value || null)
                                      }
                                      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 transition focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                                    >
                                      <option value="">Étape suivante (défaut)</option>
                                      {availableTargets.map((candidate) => {
                                        const position = stepPositions.get(candidate.id);
                                        const optionLabel = position
                                          ? `${position}. ${getStepDisplayLabel(candidate)}`
                                          : getStepDisplayLabel(candidate);

                                        return (
                                          <option key={candidate.id} value={candidate.id}>
                                            {optionLabel}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </label>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="truncate text-sm font-medium text-slate-900" title={displayLabel}>
                                {displayLabel}
                              </span>
                            </div>
                          )}
                          {isRemovable ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeStep(step.id)}
                              className="h-7 w-7 shrink-0 text-slate-400 hover:text-slate-900"
                              aria-label="Supprimer l’étape"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  })}
                  <div
                    role="presentation"
                    className={cn(
                      'h-4 rounded border border-dashed border-transparent transition',
                      draggedStepId ? 'border-slate-300 bg-white/60' : 'border-transparent'
                    )}
                    onDragOver={handleStepListDragOverEnd}
                    onDrop={handleStepDrop}
                  >
                    {draggedStepId ? (
                      <span className="sr-only">Déposer ici pour placer l’étape à la fin</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-inner">
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaveDisabled}
                className="h-10 w-full rounded-md bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                {saveButtonLabel}
              </Button>
              <p className={cn('mt-2 text-xs', statusToneClass)} aria-live="polite">
                {statusMessage}
              </p>
            </div>
          </div>
        </div>
        <div
          className="pointer-events-auto relative flex shrink-0 items-stretch overflow-hidden transition-[width] duration-300 ease-out lg:col-start-3 lg:row-start-1 lg:h-full lg:min-h-0"
          style={{ width: secondaryWidth }}
        >
          <button
            type="button"
            onClick={() => setIsSecondaryCollapsed((prev) => !prev)}
            aria-expanded={!isSecondaryCollapsed}
            aria-controls="secondary-panel"
            className={cn(
              'absolute left-2 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white',
              'lg:left-3'
            )}
          >
            {isSecondaryCollapsed ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            <span className="sr-only">Basculer le panneau secondaire</span>
          </button>
          <aside
            id="secondary-panel"
            className={cn(
              'flex h-full w-full flex-col gap-5 overflow-hidden rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.35)] backdrop-blur transition-all duration-300 ease-out',
              isSecondaryCollapsed
                ? 'pointer-events-none opacity-0 lg:translate-x-[110%]'
                : 'pointer-events-auto opacity-100 lg:translate-x-0'
            )}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{secondaryPanelTitle}</h2>
                  <p className="text-xs text-slate-600">{secondaryPanelDescription}</p>
                </div>
                {isProcessesTabActive ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateProcess}
                    disabled={isUnauthorized || isCreating}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                  >
                    {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Nouveau
                  </Button>
                ) : isDepartmentsTabActive ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateDepartment}
                    disabled={isDepartmentActionsDisabled || isCreatingDepartment}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                  >
                    {isCreatingDepartment ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Nouveau
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center gap-2" role="tablist" aria-label="Navigation des listes">
                <button
                  type="button"
                  id="processes-tab"
                  role="tab"
                  aria-selected={isProcessesTabActive}
                  aria-controls="processes-panel"
                  onClick={() => setActiveSecondaryTab('processes')}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition',
                    isProcessesTabActive
                      ? 'bg-slate-900 text-white shadow'
                      : 'bg-transparent text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <FolderTree className="h-3.5 w-3.5" />
                  Process
                </button>
                <button
                  type="button"
                  id="departments-tab"
                  role="tab"
                  aria-selected={isDepartmentsTabActive}
                  aria-controls="departments-panel"
                  onClick={() => setActiveSecondaryTab('departments')}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition',
                    isDepartmentsTabActive
                      ? 'bg-slate-900 text-white shadow'
                      : 'bg-transparent text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Départements
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
                <div className="flex-1 overflow-y-auto px-3 py-4">
                  <div
                    role="tabpanel"
                    id="processes-panel"
                    aria-labelledby="processes-tab"
                    hidden={!isProcessesTabActive}
                    className={cn('h-full', !isProcessesTabActive && 'hidden')}
                  >
                    {isProcessListUnauthorized ? (
                      <p className="text-sm text-slate-600">
                        Connectez-vous pour accéder à vos process sauvegardés.
                      </p>
                    ) : processSummariesQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Chargement des process…
                      </div>
                    ) : processSummariesQuery.isError ? (
                      <p className="text-sm text-red-600">
                        {processSummariesQuery.error instanceof ApiError
                          ? processSummariesQuery.error.message
                          : 'Impossible de récupérer la liste des process.'}
                      </p>
                    ) : hasProcesses ? (
                      <ul role="tree" aria-label="Process sauvegardés" className="space-y-2">
                        {processSummaries.map((summary) => {
                          const isSelected = summary.id === currentProcessId;
                          const isEditing = editingProcessId === summary.id;
                          const updatedLabel = formatUpdatedAt(summary.updatedAt);

                          return (
                            <li key={summary.id} role="treeitem" aria-selected={isSelected} className="focus:outline-none">
                              <div
                                role={isEditing ? undefined : 'button'}
                                tabIndex={isEditing ? undefined : 0}
                                onClick={
                                  isEditing
                                    ? undefined
                                    : () => {
                                        setSelectedProcessId(summary.id);
                                      }
                                }
                                onDoubleClick={isEditing ? undefined : () => startEditingProcess(summary)}
                                onKeyDown={
                                  isEditing
                                    ? undefined
                                    : (event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                          event.preventDefault();
                                          setSelectedProcessId(summary.id);
                                        }
                                      }
                                }
                                className={cn(
                                  'group flex flex-col gap-1 rounded-lg border border-transparent px-2 py-2 transition focus:outline-none',
                                  isSelected
                                    ? 'border-slate-900/30 bg-slate-900/5 shadow-inner'
                                    : 'hover:border-slate-300 hover:bg-slate-100',
                                  isEditing
                                    ? undefined
                                    : 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400'
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                                      <FolderTree className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                      {isEditing ? (
                                        <div className="flex items-center gap-2">
                                          <Input
                                            ref={renameInputRef}
                                            value={renameDraft}
                                            onChange={(event) => setRenameDraft(event.target.value)}
                                            className="h-8 w-40 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                                          />
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => confirmRenameProcess(summary.id)}
                                              className="inline-flex h-8 items-center justify-center rounded-md bg-slate-900 px-2 text-xs font-medium text-white hover:bg-slate-800"
                                            >
                                              Enregistrer
                                            </button>
                                            <button
                                              type="button"
                                              onClick={cancelEditingProcess}
                                              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                            >
                                              Annuler
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <p className="truncate text-sm font-medium text-slate-900">{summary.title}</p>
                                          {updatedLabel ? (
                                            <p className="text-xs text-slate-500">Mis à jour {updatedLabel}</p>
                                          ) : null}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {!isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => startEditingProcess(summary)}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                                      >
                                        <Pencil className="h-4 w-4" />
                                        <span className="sr-only">Renommer le process</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteProcessMutation.mutate(summary.id)}
                                        disabled={deleteProcessMutation.isPending && deleteProcessMutation.variables === summary.id}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-red-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                                      >
                                        {deleteProcessMutation.isPending && deleteProcessMutation.variables === summary.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                        <span className="sr-only">Supprimer le process</span>
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-600">Créez votre premier process pour le retrouver facilement ici.</p>
                    )}
                  </div>
                  <div
                    role="tabpanel"
                    id="departments-panel"
                    aria-labelledby="departments-tab"
                    hidden={!isDepartmentsTabActive}
                    className={cn('h-full', !isDepartmentsTabActive && 'hidden')}
                  >
                    {isDepartmentUnauthorized ? (
                      <p className="text-sm text-slate-600">
                        Connectez-vous pour gérer vos départements.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {createDepartmentMutation.isError ? (
                          <p className="text-xs text-red-600">{createDepartmentMutation.error.message}</p>
                        ) : null}
                        {departmentsQuery.isLoading ? (
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Chargement des départements…
                          </div>
                        ) : departmentsQuery.isError ? (
                          <p className="text-sm text-red-600">
                            {departmentsQuery.error instanceof ApiError
                              ? departmentsQuery.error.message
                              : 'Impossible de récupérer la liste des départements.'}
                          </p>
                        ) : departments.length > 0 ? (
                          <ul role="list" aria-label="Départements" className="space-y-2">
                            {departments.map((department) => {
                              const isEditingDepartment = editingDepartmentId === department.id;
                              const isUpdatingCurrent = isUpdatingDepartment && editingDepartmentId === department.id;
                              const isDeletingCurrent = isDeletingDepartment && deleteDepartmentId === department.id;
                              const updatedLabel = formatUpdatedAt(department.updatedAt);
                              const colorInputId = `department-color-${department.id}`;

                              return (
                                <li key={department.id} className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm">
                                  {isEditingDepartment ? (
                                    <form
                                      onSubmit={departmentEditForm.handleSubmit(handleUpdateDepartment)}
                                      className="space-y-2"
                                    >
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                                          <div className="flex items-center gap-2">
                                            <label htmlFor={colorInputId} className="sr-only">
                                              Couleur du département
                                            </label>
                                            <input
                                              id={colorInputId}
                                              type="color"
                                              {...departmentEditForm.register('color')}
                                              disabled={isUpdatingCurrent}
                                              className="h-9 w-9 cursor-pointer rounded-md border border-slate-300 bg-white p-1 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                                              aria-describedby={
                                                departmentEditForm.formState.errors.color
                                                  ? `${colorInputId}-error`
                                                  : undefined
                                              }
                                            />
                                          </div>
                                          <Input
                                            {...departmentEditForm.register('name')}
                                            autoFocus
                                            disabled={isUpdatingCurrent}
                                            className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            type="submit"
                                            size="sm"
                                            disabled={isUpdatingCurrent}
                                            className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                                          >
                                            {isUpdatingCurrent ? (
                                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                              <Pencil className="h-3.5 w-3.5" />
                                            )}
                                            Enregistrer
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={cancelEditingDepartment}
                                            disabled={isUpdatingCurrent}
                                          >
                                            Annuler
                                          </Button>
                                        </div>
                                      </div>
                                      {departmentEditForm.formState.errors.color ? (
                                        <p id={`${colorInputId}-error`} className="text-xs text-red-600">
                                          {departmentEditForm.formState.errors.color.message}
                                        </p>
                                      ) : null}
                                      {departmentEditForm.formState.errors.name ? (
                                        <p className="text-xs text-red-600">
                                          {departmentEditForm.formState.errors.name.message}
                                        </p>
                                      ) : null}
                                      {updateDepartmentMutation.isError && isEditingDepartment ? (
                                        <p className="text-xs text-red-600">{updateDepartmentMutation.error.message}</p>
                                      ) : null}
                                    </form>
                                  ) : (
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2" title={department.color}>
                                          <span
                                            className="inline-flex h-3 w-3 shrink-0 rounded-full border border-slate-300"
                                            style={{ backgroundColor: department.color }}
                                            aria-hidden="true"
                                          />
                                          <p className="truncate text-sm font-medium text-slate-900">{department.name}</p>
                                          <span className="sr-only">Couleur : {department.color}</span>
                                        </div>
                                        {updatedLabel ? (
                                          <p className="text-xs text-slate-500">Mis à jour {updatedLabel}</p>
                                        ) : null}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => startEditingDepartment(department)}
                                          disabled={isDepartmentActionsDisabled || isDeletingCurrent}
                                          className="border border-slate-200 !text-slate-600 hover:bg-slate-100 hover:!text-slate-900"
                                        >
                                          <Pencil className="h-4 w-4" />
                                          <span className="sr-only">Renommer le département</span>
                                        </Button>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => handleDeleteDepartment(department.id)}
                                          disabled={isDepartmentActionsDisabled || isDeletingCurrent}
                                          className="text-red-500 hover:text-red-600"
                                        >
                                          {isDeletingCurrent ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-4 w-4" />
                                          )}
                                          <span className="sr-only">Supprimer le département</span>
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                  {deleteDepartmentMutation.isError && deleteDepartmentId === department.id ? (
                                    <p className="mt-2 text-xs text-red-600">{deleteDepartmentMutation.error.message}</p>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-sm text-slate-600">Aucun département enregistré pour le moment.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {highlights.map((item) => {
                const Icon = highlightIcons[item.icon];

                return (
                  <Card key={item.title} className="border-slate-200 bg-white/90 shadow-sm">
                    <CardContent className="flex flex-col gap-1.5 p-4">
                      <Icon className="h-4 w-4 text-slate-500" />
                      <p className="text-xs font-medium text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-600">{item.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
      <div className="pointer-events-auto flex w-full justify-center">
        <div className="relative w-full max-w-4xl pt-6">
          <button
            type="button"
            onClick={() => setIsBottomCollapsed((previous) => !previous)}
            aria-expanded={!isBottomCollapsed}
            aria-controls="diagram-controls-panel"
            className={cn(
              'z-30 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white',
              isBottomCollapsed
                ? 'fixed bottom-6 left-1/2 -translate-x-1/2'
                : 'absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2'
            )}
          >
            {isBottomCollapsed ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            <span className="sr-only">Basculer le panneau des options du diagramme</span>
          </button>
          <section
            id="diagram-controls-panel"
            aria-hidden={isBottomCollapsed}
            className={cn(
              'w-full rounded-3xl border border-slate-200 bg-white/85 p-6 pt-10 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.35)] backdrop-blur transition-all duration-300 ease-out',
              isBottomCollapsed
                ? 'pointer-events-none -translate-y-2 opacity-0'
                : 'pointer-events-auto translate-y-0 opacity-100'
            )}
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <h2 className="text-sm font-semibold text-slate-900">Options du diagramme</h2>
                <p className="truncate text-xs text-slate-600">
                  {diagramDirection === 'TD'
                    ? 'Affichage actuel : de haut en bas.'
                    : 'Affichage actuel : de gauche à droite.'}
                </p>
              </div>
              <div
                id={diagramControlsContentId}
                role="group"
                aria-label="Orientation du diagramme"
                className={cn(
                  'flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white/70 p-1 shadow-inner sm:flex-none',
                  isBottomCollapsed && 'hidden'
                )}
              >
                <button
                  type="button"
                  onClick={() => setDiagramDirection('TD')}
                  aria-pressed={diagramDirection === 'TD'}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
                    diagramDirection === 'TD'
                      ? 'bg-slate-900 text-white shadow'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Haut-bas
                </button>
                <button
                  type="button"
                  onClick={() => setDiagramDirection('LR')}
                  aria-pressed={diagramDirection === 'LR'}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
                    diagramDirection === 'LR'
                      ? 'bg-slate-900 text-white shadow'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  Gauche-droite
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsBottomCollapsed((previous) => !previous)}
                aria-expanded={!isBottomCollapsed}
                aria-controls={diagramControlsContentId}
                className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100"
              >
                <ChevronDown
                  aria-hidden="true"
                  className={cn('h-4 w-4 transition-transform duration-200', !isBottomCollapsed && 'rotate-180')}
                />
                <span className="sr-only">Replier les options du diagramme</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
  );
}
