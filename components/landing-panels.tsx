'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useId, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';

import { useI18n } from '@/components/providers/i18n-provider';
import { BottomPanel } from '@/components/landing/LandingPanels/BottomPanel';
import type { Highlight as HighlightsGridHighlight } from '@/components/landing/LandingPanels/HighlightsGrid';
import { PrimaryPanel } from '@/components/landing/LandingPanels/PrimaryPanel';
import { ProcessIaChat } from '@/components/landing/LandingPanels/ProcessIaChat';
import { SecondaryPanel } from '@/components/landing/LandingPanels/SecondaryPanel';
import { ProcessShell } from '@/components/landing/LandingPanels/ProcessShell';
import { Button } from '@/components/ui/button';
import { DEFAULT_PROCESS_STEPS, DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { processSummariesSchema } from '@/lib/process/schema';
import { type ProcessErrorMessages, type RoleLookupEntry, type Step } from '@/lib/process/types';
import { getInviteDemoDepartments } from '@/lib/department/demo';
import { DEFAULT_LOCALE, getDictionary } from '@/lib/i18n/dictionaries';
import { createDateTimeFormatter } from '@/lib/i18n/format';
import {
  processResponseSchema,
  processSummarySchema,
  type ProcessPayload,
  type ProcessResponse,
  type ProcessStep,
  type ProcessSummary,
  type StepType
} from '@/lib/validation/process';
import { useProcessIaChat } from '@/lib/process/use-process-ia-chat';
import { profileResponseSchema, type ProfileResponse } from '@/lib/validation/profile';
import {
  DEFAULT_DEPARTMENT_COLOR,
  departmentCascadeFormSchema,
  departmentListSchema,
  departmentSchema,
  type Department,
  type DepartmentCascadeForm,
  type DepartmentInput
} from '@/lib/validation/department';
import {
  DEFAULT_ROLE_COLOR,
  roleSchema,
  type Role,
  type RoleCreateInput,
  type RoleUpdateInput
} from '@/lib/validation/role';

const ROLE_ID_REGEX = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
const HEX_COLOR_REGEX = /^#[0-9A-F]{6}$/;
const RGB_COLOR_REGEX = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;
const RGBA_COLOR_REGEX =
  /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/i;
const CLUSTER_STYLE_TEXT_COLOR = '#0f172a';
const CLUSTER_FILL_OPACITY = 0.18;
const FALLBACK_STEP_FILL_ALPHA = 0.12;

type IaDepartmentsPayload = Parameters<typeof useProcessIaChat>[0]['departments'];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toRgba = (color: string, alpha: number, fallback: string) => {
  if (!color) {
    return fallback;
  }

  const normalizedAlpha = clamp(Number.isFinite(alpha) ? alpha : FALLBACK_STEP_FILL_ALPHA, 0, 1);

  if (HEX_COLOR_REGEX.test(color)) {
    const red = parseInt(color.slice(1, 3), 16);
    const green = parseInt(color.slice(3, 5), 16);
    const blue = parseInt(color.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${normalizedAlpha})`;
  }

  const rgbMatch = color.match(RGB_COLOR_REGEX);
  if (rgbMatch) {
    const [, red, green, blue] = rgbMatch;
    return `rgba(${Number(red)}, ${Number(green)}, ${Number(blue)}, ${normalizedAlpha})`;
  }

  const rgbaMatch = color.match(RGBA_COLOR_REGEX);
  if (rgbaMatch) {
    const [, red, green, blue] = rgbaMatch;
    return `rgba(${Number(red)}, ${Number(green)}, ${Number(blue)}, ${normalizedAlpha})`;
  }

  return fallback;
};

const getClusterStyleDeclaration = (clusterId: string, color: string) => {
  const normalized = HEX_COLOR_REGEX.test(color) ? color : DEFAULT_DEPARTMENT_COLOR;
  return `style ${clusterId} fill:${normalized},stroke:${normalized},color:${CLUSTER_STYLE_TEXT_COLOR},stroke-width:2px,fill-opacity:${CLUSTER_FILL_OPACITY};`;
};

const normalizeNameKey = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.toLowerCase();
};

type Highlight = HighlightsGridHighlight;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export type DepartmentWithDraftStatus = Department & {
  isDraft: boolean;
  roles: (Role & { isDraft: boolean })[];
};

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

const normalizeDraftName = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeRoleId = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  return ROLE_ID_REGEX.test(trimmed) ? trimmed : null;
};

const normalizeStep = (step: ProcessStep): ProcessStep => {
  const normalizedDepartmentId = normalizeDepartmentId(step.departmentId);
  const normalizedRoleId = normalizeRoleId(step.roleId);

  return {
    ...step,
    departmentId: normalizedDepartmentId,
    draftDepartmentName: normalizedDepartmentId ? null : normalizeDraftName(step.draftDepartmentName),
    roleId: normalizedRoleId,
    draftRoleName: normalizedRoleId ? null : normalizeDraftName(step.draftRoleName),
    yesTargetId: normalizeBranchTarget(step.yesTargetId),
    noTargetId: normalizeBranchTarget(step.noTargetId)
  };
};

const cloneSteps = (steps: readonly ProcessStep[]): ProcessStep[] => steps.map((step) => normalizeStep({ ...step }));

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const wrapStepLabel = (value: string) => {
  const normalized = value.trim();
  const source = normalized.length > 0 ? normalized : 'Step';
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
  const base = trimmed.length > 0 ? trimmed : 'Department';
  const escaped = escapeHtml(base);
  return escaped.replace(/&quot;/g, '\\"');
};

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
      normalized.draftDepartmentName === normalizedOther.draftDepartmentName &&
      normalized.roleId === normalizedOther.roleId &&
      normalized.draftRoleName === normalizedOther.draftRoleName &&
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

const requestProcess = async (
  processId: string,
  messages: ProcessErrorMessages
): Promise<ProcessResponse> => {
  const response = await fetch(`/api/process?id=${encodeURIComponent(processId)}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store'
  });

  if (response.status === 401) {
    throw new ApiError(messages.authRequired, 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, messages.process.fetchFailed);
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return processResponseSchema.parse(json);
};

const requestProcessSummaries = async (
  messages: ProcessErrorMessages
): Promise<ProcessSummary[]> => {
  const response = await fetch('/api/processes', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store'
  });

  if (response.status === 401) {
    throw new ApiError(messages.authRequired, 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, messages.process.listFailed);
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return processSummariesSchema.parse(json);
};

const createProcessRequest = async (
  messages: ProcessErrorMessages,
  title?: string
): Promise<ProcessResponse> => {
  const response = await fetch('/api/processes', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(title ? { title } : {})
  });

  if (response.status === 401) {
    throw new ApiError(messages.authRequired, 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, messages.process.createFailed);
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return processResponseSchema.parse(json);
};

const renameProcessRequest = async (
  messages: ProcessErrorMessages,
  input: { id: string; title: string }
): Promise<ProcessSummary> => {
  const response = await fetch(`/api/processes/${encodeURIComponent(input.id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: input.title })
  });

  if (response.status === 401) {
    throw new ApiError(messages.authRequired, 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, messages.process.renameFailed);
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return processSummarySchema.parse(json);
};

const deleteProcessRequest = async (
  messages: ProcessErrorMessages,
  processId: string
): Promise<void> => {
  const response = await fetch(`/api/processes/${encodeURIComponent(processId)}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (response.status === 401) {
    throw new ApiError(messages.authRequired, 401);
  }

  if (response.status === 204) {
    return;
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, messages.process.deleteFailed);
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

const updateDepartmentRequest = async (input: DepartmentInput & { id: string }): Promise<Department> => {
  const response = await fetch(`/api/departments/${encodeURIComponent(input.id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name, color: input.color })
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, "Impossible de mettre à jour le département.");
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return departmentSchema.parse(json);
};

const createRoleRequest = async (input: RoleCreateInput): Promise<Role> => {
  const response = await fetch(`/api/departments/${encodeURIComponent(input.departmentId)}/roles`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name, color: input.color })
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de créer le rôle.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return roleSchema.parse(json);
};

const updateRoleRequest = async (input: RoleUpdateInput): Promise<Role> => {
  const response = await fetch(`/api/roles/${encodeURIComponent(input.id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name, color: input.color })
  });

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Impossible de mettre à jour le rôle.');
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return roleSchema.parse(json);
};

const deleteRoleRequest = async (roleId: string): Promise<void> => {
  const response = await fetch(`/api/roles/${encodeURIComponent(roleId)}`, {
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
    const message = await readErrorMessage(response, 'Impossible de supprimer le rôle.');
    throw new ApiError(message, response.status);
  }
};

const FALLBACK_ROLE_PICKER_MESSAGES = getDictionary(DEFAULT_LOCALE).landing.primaryPanel.rolePicker;

function generateStepId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `step-${Math.random().toString(36).slice(2, 10)}`;
}

const generateClientUuid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `draft-${Math.random().toString(36).slice(2, 10)}`;
};

const mergeDraftEntitiesFromSteps = (
  steps: readonly ProcessStep[],
  baseDepartments: readonly Department[]
): Department[] => {
  const now = new Date().toISOString();
  const byName = new Map<string, Department>();

  baseDepartments.forEach((department) => {
    const key = normalizeNameKey(department.name);
    if (!key) {
      return;
    }

    byName.set(key, { ...department, roles: department.roles.map((role) => ({ ...role })) });
  });

  steps.forEach((step) => {
    const draftDepartmentName = normalizeDraftName(step.draftDepartmentName);

    if (!draftDepartmentName) {
      return;
    }

    const departmentKey = normalizeNameKey(draftDepartmentName);

    if (!departmentKey) {
      return;
    }

    const existingDepartment = byName.get(departmentKey);
    const department: Department = existingDepartment ?? {
      id: generateClientUuid(),
      name: draftDepartmentName,
      color: DEFAULT_DEPARTMENT_COLOR,
      createdAt: now,
      updatedAt: now,
      roles: []
    };

    const draftRoleName = normalizeDraftName(step.draftRoleName);

    if (draftRoleName) {
      const roleKey = normalizeNameKey(draftRoleName);
      const hasRole = roleKey
        ? department.roles.some((role) => normalizeNameKey(role.name) === roleKey)
        : false;

      if (!hasRole) {
        department.roles = [
          ...department.roles,
          {
            id: generateClientUuid(),
            departmentId: department.id,
            name: draftRoleName,
            color: DEFAULT_ROLE_COLOR,
            createdAt: now,
            updatedAt: now
          }
        ];
      }
    }

    byName.set(departmentKey, department);
  });

  return Array.from(byName.values());
};

type LandingPanelsProps = {
  highlights: readonly Highlight[];
};

export function LandingPanels({ highlights }: LandingPanelsProps) {
  const queryClient = useQueryClient();
  const { dictionary, locale } = useI18n();
  const searchParams = useSearchParams();
  const processIdFromQuery = searchParams.get('processId');
  const {
    formatting: { dateTime: dateTimeFormatOptions },
    landing: {
      defaults: { departmentName: defaultDepartmentName, roleName: defaultRoleName },
      actions: { createLabel },
      primaryPanel,
      secondaryPanel,
      errors: landingErrorMessages,
      status: statusMessages,
      saveButton: saveButtonLabels,
      diagramControls,
      ia: iaPanel
    }
  } = dictionary;
  const stepTypeLabels = primaryPanel.stepLabels;
  const tooltipLabels = useMemo(
    () =>
      locale === 'fr'
        ? { type: 'Type', department: 'Département', role: 'Rôle' }
        : { type: 'Step type', department: 'Department', role: 'Role' },
    [locale]
  );
  const rolePickerMessages = {
    addRole: primaryPanel.rolePicker.addRole || FALLBACK_ROLE_PICKER_MESSAGES.addRole,
    noDepartmentRoles:
      primaryPanel.rolePicker.noDepartmentRoles || FALLBACK_ROLE_PICKER_MESSAGES.noDepartmentRoles,
    chooseRoleForDepartment:
      primaryPanel.rolePicker.chooseRoleForDepartment ||
      FALLBACK_ROLE_PICKER_MESSAGES.chooseRoleForDepartment
  };
  const mermaidErrorMessages = landingErrorMessages.mermaid;

  const getStepDisplayLabel = useCallback(
    (step: Step) => {
      const trimmed = step.label.trim();
      return trimmed.length > 0 ? trimmed : stepTypeLabels[step.type];
    },
    [stepTypeLabels]
  );
  const [areDepartmentsVisible, setAreDepartmentsVisible] = useState(true);
  const [diagramDirection, setDiagramDirection] = useState<'TD' | 'LR'>('TD');
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [processTitle, setProcessTitle] = useState(DEFAULT_PROCESS_TITLE);
  const [steps, setSteps] = useState<ProcessStep[]>(() => cloneSteps(DEFAULT_PROCESS_STEPS));
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const baselineStepsRef = useRef<ProcessStep[]>(cloneSteps(DEFAULT_PROCESS_STEPS));
  const baselineTitleRef = useRef(DEFAULT_PROCESS_TITLE);
  const shouldSkipProcessHydrationRef = useRef(false);
  const hasResetForUnauthorizedRef = useRef(false);
  const hasResetDepartmentEditorRef = useRef(false);
  const hasInitializedDraftDepartmentsRef = useRef(false);
  const draggedStepIdRef = useRef<string | null>(null);
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const diagramElementId = useMemo(() => `process-diagram-${generateStepId()}`, []);
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const appliedQueryProcessIdRef = useRef<string | null>(null);
  const [activeSecondaryTab, setActiveSecondaryTab] = useState<'processes' | 'departments'>('processes');
  const hasAppliedInviteTabRef = useRef(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [deleteDepartmentId, setDeleteDepartmentId] = useState<string | null>(null);
  const [draftDepartments, setDraftDepartments] = useState<Department[]>([]);
  const departmentEditForm = useForm<DepartmentCascadeForm>({
    resolver: zodResolver(departmentCascadeFormSchema),
    defaultValues: { name: '', color: DEFAULT_DEPARTMENT_COLOR, roles: [] }
  });
  const departmentRoleFields = useFieldArray({
    control: departmentEditForm.control,
    name: 'roles'
  });
  const editingDepartmentBaselineRef = useRef<Department | null>(null);

  const formatDateTime = useMemo(
    () => createDateTimeFormatter(locale, dateTimeFormatOptions),
    [dateTimeFormatOptions, locale]
  );

  const processSummariesQuery = useQuery<ProcessSummary[], ApiError>({
    queryKey: ['processes'],
    queryFn: () => requestProcessSummaries(landingErrorMessages),
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
    queryFn: () => requestProcess(currentProcessId as string, landingErrorMessages),
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

  const profileQuery = useQuery<ProfileResponse, ApiError>({
    queryKey: ['profile', 'self'],
    queryFn: async () => {
      const response = await fetch('/api/profile', {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      const json = await response.json().catch(() => null);

      if (response.status === 401) {
        throw new ApiError('Authentification requise', 401);
      }

      if (!response.ok || !json) {
        const message = json && typeof json.error === 'string'
          ? json.error
          : 'Impossible de charger votre profil.';
        throw new ApiError(message, response.status);
      }

      return profileResponseSchema.parse(json);
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      return failureCount < 2;
    }
  });

  const createDepartmentMutation = useMutation<Department, ApiError, void>({
    mutationFn: async () => {
      const now = new Date().toISOString();

      return {
        id: generateClientUuid(),
        name: defaultDepartmentName,
        color: DEFAULT_DEPARTMENT_COLOR,
        createdAt: now,
        updatedAt: now,
        roles: []
      } satisfies Department;
    },
    onSuccess: (department) => {
      setDraftDepartments((previous) => [department, ...previous]);
      setEditingDepartmentId(department.id);
      editingDepartmentBaselineRef.current = null;
      departmentEditForm.reset({ name: department.name, color: department.color, roles: [] });
      departmentRoleFields.replace([]);
      createDepartmentRoleMutation.reset();
    }
  });

  const createDepartmentRoleMutation = useMutation<Role, ApiError, { departmentId: string }>({
    mutationFn: async ({ departmentId }) => {
      const department = departments.find((item) => item.id === departmentId);
      const fallbackColor = department?.color ?? DEFAULT_ROLE_COLOR;
      const now = new Date().toISOString();

      return {
        id: generateClientUuid(),
        departmentId,
        name: defaultRoleName,
        color: fallbackColor,
        createdAt: now,
        updatedAt: now
      } satisfies Role;
    },
    onSuccess: (role) => {
      setDraftDepartments((previous) =>
        previous.map((department) => {
          if (department.id !== role.departmentId) {
            return department;
          }

          return {
            ...department,
            roles: [...department.roles, role]
          };
        })
      );

      const newIndex = departmentEditForm.getValues('roles').length;
      departmentRoleFields.append({ roleId: role.id, name: role.name, color: role.color });

      const roleIdField = `roles.${newIndex}.roleId` as const;
      const roleNameField = `roles.${newIndex}.name` as const;
      const roleColorField = `roles.${newIndex}.color` as const;

      departmentEditForm.setValue(roleIdField, role.id, {
        shouldDirty: true,
        shouldTouch: true
      });
      departmentEditForm.setValue(roleNameField, role.name, {
        shouldDirty: true,
        shouldTouch: true
      });
      departmentEditForm.setValue(roleColorField, role.color, {
        shouldDirty: true,
        shouldTouch: true
      });
      departmentEditForm.clearErrors(roleNameField);
      departmentEditForm.clearErrors(roleColorField);

      setTimeout(() => {
        departmentEditForm.setFocus(roleNameField);
      }, 0);
    }
  });

  const saveDepartmentMutation = useMutation<
    Department[],
    ApiError,
    {
      departments: {
        id: string;
        name: string;
        color: string;
        roles: { id?: string; name: string; color: string }[];
      }[];
    }
  >({
    mutationFn: async ({ departments: stagedDepartments }) => {
      const baselineDepartments = departmentsQuery.data ?? [];
      const baselineById = new Map(baselineDepartments.map((item) => [item.id, item]));

      for (const staged of stagedDepartments) {
        const baseline = baselineById.get(staged.id) ?? null;
        let targetDepartmentId = baseline?.id ?? staged.id;

        if (!baseline) {
          const created = await createDepartmentRequest({ name: staged.name, color: staged.color });
          targetDepartmentId = created.id;
        } else if (baseline.name !== staged.name || baseline.color !== staged.color) {
          await updateDepartmentRequest({ id: staged.id, name: staged.name, color: staged.color });
        }

        const baselineRoles = new Map(baseline?.roles.map((role) => [role.id, role]));
        const seenRoleIds = new Set<string>();

        for (const roleInput of staged.roles) {
          if (roleInput.id) {
            seenRoleIds.add(roleInput.id);
            const originalRole = baselineRoles.get(roleInput.id);

            if (
              !originalRole ||
              originalRole.name !== roleInput.name ||
              originalRole.color !== roleInput.color
            ) {
              await updateRoleRequest({ id: roleInput.id, name: roleInput.name, color: roleInput.color });
            }

            continue;
          }

          await createRoleRequest({ departmentId: targetDepartmentId, name: roleInput.name, color: roleInput.color });
        }

        for (const [roleId] of baselineRoles) {
          if (!seenRoleIds.has(roleId)) {
            await deleteRoleRequest(roleId);
          }
        }
      }

      const refreshedDepartments = await requestDepartments();
      return refreshedDepartments;
    },
    onSuccess: async (departmentsList) => {
      queryClient.setQueryData(['departments'], departmentsList);
      setDraftDepartments(departmentsList);
      hasInitializedDraftDepartmentsRef.current = true;
      setEditingDepartmentId(null);
      editingDepartmentBaselineRef.current = null;
      departmentEditForm.reset({
        name: '',
        color: DEFAULT_DEPARTMENT_COLOR,
        roles: []
      });
      departmentRoleFields.replace([]);
      createDepartmentRoleMutation.reset();

      const updatedLookup = new Map<string, string>();
      departmentsList.forEach((department) => {
        updatedLookup.set(department.id, department.name);
        department.roles.forEach((role) => {
          updatedLookup.set(role.id, role.name);
        });
      });

      if (selectedStepId) {
        setSteps((previousSteps) =>
          previousSteps.map((step) => {
            if (step.id !== selectedStepId) {
              return step;
            }

            const updatedDepartmentName = updatedLookup.get(step.departmentId ?? '') ?? step.draftDepartmentName;
            const updatedRoleName = updatedLookup.get(step.roleId ?? '') ?? step.draftRoleName;

            return {
              ...step,
              draftDepartmentName: updatedDepartmentName ?? step.draftDepartmentName,
              draftRoleName: updatedRoleName ?? step.draftRoleName
            };
          })
        );
      }

      await queryClient.invalidateQueries({ queryKey: ['departments'] });
      await queryClient.invalidateQueries({ queryKey: ['roles', { departmentId: editingDepartmentId }] });
    }
  });

  const deleteDepartmentMutation = useMutation<void, ApiError, { id: string }>({
    mutationFn: ({ id }) => deleteDepartmentRequest(id),
    onMutate: async ({ id }) => {
      setDeleteDepartmentId(id);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDraftDepartments((previous) => previous.filter((item) => item.id !== variables.id));
      let shouldReset = false;
      setEditingDepartmentId((current) => {
        if (current === variables.id) {
          shouldReset = true;
          return null;
        }
        return current;
      });
      if (shouldReset) {
        departmentEditForm.reset({
          name: '',
          color: DEFAULT_DEPARTMENT_COLOR,
          roles: []
        });
        departmentRoleFields.replace([]);
        createDepartmentRoleMutation.reset();
      }
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

  useEffect(() => {
    if (!editingDepartmentId) {
      createDepartmentRoleMutation.reset();
    }
  }, [createDepartmentRoleMutation, editingDepartmentId]);

  const manageableMembershipCount =
    profileQuery.data?.organizations.filter(
      (organization) => organization.role === 'owner' || organization.role === 'admin'
    ).length ?? 0;
  const isProcessManagementRestricted = profileQuery.isSuccess && manageableMembershipCount === 0;
  const isProfileUnauthorized =
    profileQuery.isError && profileQuery.error instanceof ApiError && profileQuery.error.status === 401;

  const isProcessListUnauthorized =
    processSummariesQuery.isError &&
    processSummariesQuery.error instanceof ApiError &&
    processSummariesQuery.error.status === 401;

  const isProcessQueryUnauthorized =
    processQuery.isError && processQuery.error instanceof ApiError && processQuery.error.status === 401;

  const isUnauthorized = isProcessListUnauthorized || isProcessQueryUnauthorized;
  const isAuthMissing = isUnauthorized || isProfileUnauthorized;
  const isProcessEditorReadOnly = isAuthMissing || isProcessManagementRestricted;
  const processSummaries = useMemo(
    () => processSummariesQuery.data ?? [],
    [processSummariesQuery.data]
  );
  const hasProcesses = processSummaries.length > 0;
  const isDepartmentUnauthorized =
    departmentsQuery.isError &&
    departmentsQuery.error instanceof ApiError &&
    departmentsQuery.error.status === 401;
  const shouldUseDepartmentDemo = isAuthMissing || isDepartmentUnauthorized;
  const sourceDepartments = useMemo(
    () => (shouldUseDepartmentDemo ? getInviteDemoDepartments() : departmentsQuery.data ?? []),
    [departmentsQuery.data, shouldUseDepartmentDemo]
  );

  useEffect(() => {
    if (shouldUseDepartmentDemo) {
      setDraftDepartments(sourceDepartments);
      hasInitializedDraftDepartmentsRef.current = true;
      return;
    }

    if (draftDepartments.length === 0 && sourceDepartments.length > 0 && !hasInitializedDraftDepartmentsRef.current) {
      setDraftDepartments(sourceDepartments);
      hasInitializedDraftDepartmentsRef.current = true;
    }
  }, [draftDepartments.length, shouldUseDepartmentDemo, sourceDepartments]);

  const departments: DepartmentWithDraftStatus[] = useMemo(() => {
    const persistedById = new Map((departmentsQuery.data ?? []).map((department) => [department.id, department]));

    return draftDepartments.map((department) => {
      const persisted = persistedById.get(department.id);
      const rolesWithStatus = department.roles.map((role) => ({
        ...role,
        isDraft: !persisted?.roles.some((item) => item.id === role.id)
      }));

      return {
        ...department,
        isDraft: !persisted,
        roles: rolesWithStatus
      } satisfies DepartmentWithDraftStatus;
    });
  }, [departmentsQuery.data, draftDepartments]);
  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((department) => {
      map.set(department.id, department.name);
    });
    return map;
  }, [departments]);

  const roleLookup = useMemo(() => {
    const byId = new Map<string, RoleLookupEntry>();
    const byDepartment = new Map<string, RoleLookupEntry[]>();
    const all: RoleLookupEntry[] = [];

    for (const department of departments) {
      const entries: RoleLookupEntry[] = [];

      for (const role of department.roles) {
        const entry: RoleLookupEntry = {
          role,
          departmentId: department.id,
          departmentName: department.name
        };

        byId.set(role.id, entry);
        entries.push(entry);
        all.push(entry);
      }

      byDepartment.set(department.id, entries);
    }

    return { byId, byDepartment, all };
  }, [departments]);

  const getStepDepartmentLabel = useCallback(
    (step: Step) => {
      const normalizedDepartmentId = normalizeDepartmentId(step.departmentId);

      if (normalizedDepartmentId) {
        const departmentName = departmentNameById.get(normalizedDepartmentId);
        if (departmentName) {
          return departmentName;
        }
      }

      const departmentFromRole = step.roleId ? roleLookup.byId.get(step.roleId)?.departmentName : null;
      const draftDepartmentName = normalizeDraftName(step.draftDepartmentName);

      return draftDepartmentName ?? departmentFromRole ?? defaultDepartmentName;
    },
    [defaultDepartmentName, departmentNameById, roleLookup.byId]
  );

  const getStepRoleLabel = useCallback(
    (step: Step) => {
      if (step.roleId) {
        const entry = roleLookup.byId.get(step.roleId);
        if (entry) {
          return entry.role.name;
        }
      }

      const draftRoleName = normalizeDraftName(step.draftRoleName);
      return draftRoleName ?? defaultRoleName;
    },
    [defaultRoleName, roleLookup.byId]
  );

  const iaDepartmentsPayload = useMemo<IaDepartmentsPayload>(
    () =>
      departments.map((department) => ({
        id: department.id,
        name: department.name,
        status: department.isDraft ? 'draft' : 'persisted',
        roles: department.roles.map((role) => ({
          id: role.id,
          name: role.name,
          status: 'isDraft' in role && role.isDraft ? 'draft' : 'persisted'
        }))
      })),
    [departments]
  );

  useEffect(() => {
    if (!hasAppliedInviteTabRef.current && shouldUseDepartmentDemo) {
      setActiveSecondaryTab('departments');
      hasAppliedInviteTabRef.current = true;
    }
  }, [shouldUseDepartmentDemo]);
  const hasDepartments = departments.length > 0;
  const hasRoles = roleLookup.all.length > 0;
  const isProcessesTabActive = activeSecondaryTab === 'processes';
  const isDepartmentsTabActive = activeSecondaryTab === 'departments';
  const isDepartmentActionsDisabled = shouldUseDepartmentDemo;
  const isCreatingDepartment = createDepartmentMutation.isPending;
  const isSavingDepartment = saveDepartmentMutation.isPending;
  const isAddingDepartmentRole = createDepartmentRoleMutation.isPending;
  const isDeletingDepartment = deleteDepartmentMutation.isPending;
  const secondaryPanelTitle = isDepartmentsTabActive
    ? secondaryPanel.title.departments
    : secondaryPanel.title.processes;
  const formatTemplateText = useCallback(
    (template: string, value: string | null, token = '{timestamp}') =>
      value ? template.replace(token, value) : null,
    []
  );

  const handleCreateDepartment = useCallback(() => {
    if (isDepartmentActionsDisabled || isCreatingDepartment) {
      return;
    }
    createDepartmentMutation.mutate();
  }, [createDepartmentMutation, isCreatingDepartment, isDepartmentActionsDisabled]);

  const handleSaveAllDepartments = useCallback(async () => {
    if (isDepartmentActionsDisabled || isSavingDepartment || isAddingDepartmentRole) {
      return;
    }

    let editedDepartmentValues: DepartmentCascadeForm | null = null;

    if (editingDepartmentId) {
      const isValid = await departmentEditForm.trigger();
      if (!isValid) {
        return;
      }
      editedDepartmentValues = departmentEditForm.getValues();
    }

    const stagedDepartments = draftDepartments.map((department) => {
      if (editedDepartmentValues && department.id === editingDepartmentId) {
        return {
          id: department.id,
          name: editedDepartmentValues.name,
          color: editedDepartmentValues.color,
          roles: editedDepartmentValues.roles.map((role) => ({
            id: role.roleId ?? undefined,
            name: role.name,
            color: role.color
          }))
        };
      }

      return {
        id: department.id,
        name: department.name,
        color: department.color,
        roles: department.roles.map((role) => ({ id: role.id, name: role.name, color: role.color }))
      };
    });

    saveDepartmentMutation.mutate({ departments: stagedDepartments });
  }, [
    departmentEditForm,
    draftDepartments,
    editingDepartmentId,
    isAddingDepartmentRole,
    isDepartmentActionsDisabled,
    isSavingDepartment,
    saveDepartmentMutation
  ]);

  const handleAddRole = useCallback(() => {
    if (
      !editingDepartmentId ||
      isDepartmentActionsDisabled ||
      isSavingDepartment ||
      isAddingDepartmentRole
    ) {
      return;
    }

    if (!departments.some((department) => department.id === editingDepartmentId)) {
      return;
    }

    createDepartmentRoleMutation.mutate({ departmentId: editingDepartmentId });
  }, [
    departments,
    createDepartmentRoleMutation,
    editingDepartmentId,
    isAddingDepartmentRole,
    isDepartmentActionsDisabled,
    isSavingDepartment
  ]);

  const handleDeleteDepartment = useCallback(
    (id: string) => {
      if (isDepartmentActionsDisabled) {
        return;
      }

      const isPersisted = (departmentsQuery.data ?? []).some((department) => department.id === id);

      if (!isPersisted) {
        setDraftDepartments((previous) => previous.filter((department) => department.id !== id));

        setEditingDepartmentId((current) => {
          if (current !== id) {
            return current;
          }

          departmentEditForm.reset({ name: '', color: DEFAULT_DEPARTMENT_COLOR, roles: [] });
          departmentRoleFields.replace([]);
          return null;
        });

        return;
      }
      deleteDepartmentMutation.mutate({ id });
    },
    [
      departmentEditForm,
      departmentRoleFields,
      departmentsQuery.data,
      deleteDepartmentMutation,
      isDepartmentActionsDisabled
    ]
  );

  const startEditingDepartment = useCallback(
    (department: DepartmentWithDraftStatus) => {
      if (isDepartmentActionsDisabled || isSavingDepartment) {
        return;
      }

      setEditingDepartmentId(department.id);
      editingDepartmentBaselineRef.current =
        (departmentsQuery.data ?? []).find((item) => item.id === department.id) ?? null;
      const mappedRoles = department.roles.map((role) => ({ roleId: role.id, name: role.name, color: role.color }));
      departmentEditForm.reset({ name: department.name, color: department.color, roles: mappedRoles });
      departmentRoleFields.replace(mappedRoles);
    },
    [
      departmentEditForm,
      departmentRoleFields,
      departmentsQuery.data,
      editingDepartmentBaselineRef,
      isDepartmentActionsDisabled,
      isSavingDepartment
    ]
  );

  useEffect(() => {
    const subscription = departmentEditForm.watch((values) => {
      if (!editingDepartmentId) {
        return;
      }

      setDraftDepartments((previous) => {
        const targetIndex = previous.findIndex((department) => department.id === editingDepartmentId);

        if (targetIndex === -1) {
          return previous;
        }

        const targetDepartment = previous[targetIndex];
        const rolesById = new Map(targetDepartment.roles.map((role) => [role.id, role]));

        const updatedRoles: Role[] = (values.roles ?? []).map((roleInput, roleIndex) => {
          const existingRoleById = roleInput.roleId ? rolesById.get(roleInput.roleId) : undefined;
          const existingRoleByIndex = targetDepartment.roles[roleIndex];
          const baseRole = existingRoleById ?? existingRoleByIndex;

          if (baseRole) {
            if (baseRole.name === roleInput.name && baseRole.color === roleInput.color) {
              return baseRole;
            }

            return {
              ...baseRole,
              name: roleInput.name ?? baseRole.name,
              color: roleInput.color ?? baseRole.color
            } satisfies Role;
          }

          const now = new Date().toISOString();

          return {
            id: roleInput.roleId ?? generateClientUuid(),
            departmentId: targetDepartment.id,
            name: roleInput.name ?? '',
            color: roleInput.color ?? DEFAULT_ROLE_COLOR,
            createdAt: now,
            updatedAt: now
          } satisfies Role;
        });

        const hasRoleUpdates =
          updatedRoles.length !== targetDepartment.roles.length ||
          updatedRoles.some((role, index) => role !== targetDepartment.roles[index]);

        const hasDepartmentUpdates =
          values.name !== targetDepartment.name || values.color !== targetDepartment.color || hasRoleUpdates;

        if (!hasDepartmentUpdates) {
          return previous;
        }

        const nextDepartment: Department = {
          ...targetDepartment,
          name: values.name ?? targetDepartment.name,
          color: values.color ?? targetDepartment.color,
          roles: updatedRoles
        };

        const nextDrafts = [...previous];
        nextDrafts[targetIndex] = nextDepartment;
        return nextDrafts;
      });
    });

    return () => subscription.unsubscribe();
  }, [departmentEditForm, editingDepartmentId, setDraftDepartments]);

  useEffect(() => {
    if (!isDepartmentActionsDisabled) {
      hasResetDepartmentEditorRef.current = false;
      return;
    }

    if (hasResetDepartmentEditorRef.current) {
      return;
    }

    hasResetDepartmentEditorRef.current = true;

    setEditingDepartmentId(null);
    editingDepartmentBaselineRef.current = null;
    departmentEditForm.reset({
      name: '',
      color: DEFAULT_DEPARTMENT_COLOR,
      roles: []
    });
    departmentRoleFields.replace([]);
    createDepartmentRoleMutation.reset();
  }, [
    createDepartmentRoleMutation,
    departmentEditForm,
    departmentRoleFields,
    editingDepartmentBaselineRef,
    isDepartmentActionsDisabled
  ]);

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
    if (!processQuery.data) {
      return;
    }

    if (shouldSkipProcessHydrationRef.current) {
      shouldSkipProcessHydrationRef.current = false;
      return;
    }

    const fromServer = cloneSteps(processQuery.data.steps);
    baselineStepsRef.current = cloneSteps(fromServer);
    baselineTitleRef.current = normalizeProcessTitle(processQuery.data.title);
    setSteps(fromServer);
    setLastSavedAt(processQuery.data.updatedAt);
    setProcessTitle(normalizeProcessTitle(processQuery.data.title));
  }, [processQuery.data]);

  useEffect(() => {
    if (!isUnauthorized) {
      hasResetForUnauthorizedRef.current = false;
      return;
    }

    if (hasResetForUnauthorizedRef.current) {
      return;
    }

    hasResetForUnauthorizedRef.current = true;

    const fallback = cloneSteps(DEFAULT_PROCESS_STEPS);
    baselineStepsRef.current = cloneSteps(fallback);
    baselineTitleRef.current = DEFAULT_PROCESS_TITLE;
    setSteps(fallback);
    setLastSavedAt(null);
    setSelectedProcessId(null);
    setProcessTitle(DEFAULT_PROCESS_TITLE);
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
      baselineTitleRef.current = DEFAULT_PROCESS_TITLE;
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
    if (!processIdFromQuery) {
      return;
    }

    const summaries = processSummariesQuery.data;

    if (!summaries || summaries.length === 0) {
      return;
    }

    const matchingSummary = summaries.find((item) => item.id === processIdFromQuery);

    if (!matchingSummary) {
      return;
    }

    if (appliedQueryProcessIdRef.current === processIdFromQuery) {
      return;
    }

    setSelectedProcessId(processIdFromQuery);
    setProcessTitle(normalizeProcessTitle(matchingSummary.title));
    appliedQueryProcessIdRef.current = processIdFromQuery;
  }, [processIdFromQuery, processSummariesQuery.data]);

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
      baselineTitleRef.current = DEFAULT_PROCESS_TITLE;
      setSteps(fallback);
      setLastSavedAt(null);
      setProcessTitle(DEFAULT_PROCESS_TITLE);
    }
  }, [currentProcessId, processQuery.error, processQuery.isError, queryClient]);

  const isDirty = useMemo(() => {
    const normalizedTitle = normalizeProcessTitle(processTitle);
    return (
      normalizedTitle !== baselineTitleRef.current || !areStepsEqual(steps, baselineStepsRef.current)
    );
  }, [processTitle, steps]);

  const createProcessMutation = useMutation<ProcessResponse, ApiError, string | undefined>({
    mutationFn: (title) => createProcessRequest(landingErrorMessages, title),
    onSuccess: (data) => {
      const sanitizedSteps = cloneSteps(data.steps);
      const normalizedTitle = normalizeProcessTitle(data.title);
      baselineStepsRef.current = cloneSteps(sanitizedSteps);
      baselineTitleRef.current = normalizedTitle;
      setSteps(sanitizedSteps);
      setLastSavedAt(data.updatedAt);
      setSelectedProcessId(data.id);
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
    mutationFn: (input) => renameProcessRequest(landingErrorMessages, input),
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
        baselineTitleRef.current = normalizedTitle;
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
    mutationFn: (processId) => deleteProcessRequest(landingErrorMessages, processId),
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
        baselineTitleRef.current = DEFAULT_PROCESS_TITLE;
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
      const normalizedTitle = normalizeProcessTitle(data.title);
      baselineStepsRef.current = cloneSteps(sanitized);
      baselineTitleRef.current = normalizedTitle;
      setSteps(sanitized);
      setLastSavedAt(data.updatedAt);
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

  const formattedSavedAt = formatDateTime(lastSavedAt);

  const statusMessage = useMemo<ReactNode>(() => {
    if (isAuthMissing) {
      return (
        <>
          {statusMessages.unauthorized.prompt}
          <Link href="/sign-up" className="font-medium text-slate-900 underline-offset-2 hover:underline">
            {statusMessages.unauthorized.createAccount}
          </Link>{' '}
          {statusMessages.unauthorized.saveRequirement}
          {' '}
          <Link href="/sign-in" className="font-medium text-slate-900 underline-offset-2 hover:underline">
            {statusMessages.unauthorized.signIn}
          </Link>
        </>
      );
    }

    if (isProcessManagementRestricted) {
      return statusMessages.readerRestriction;
    }

    if (!currentProcessId) {
      if (isCreating) {
        return statusMessages.creating;
      }
      return statusMessages.createPrompt;
    }

    if (saveMutation.isError && saveMutation.error) {
      return saveMutation.error.message || statusMessages.saveErrorFallback;
    }

    if (processQuery.isLoading) {
      return statusMessages.loading;
    }

    if (isDirty) {
      return statusMessages.unsavedChanges;
    }

    if (formattedSavedAt) {
      return `${statusMessages.lastSavedLabel} : ${formattedSavedAt}`;
    }

    return statusMessages.noSavedYet;
  }, [
    currentProcessId,
    formattedSavedAt,
    isAuthMissing,
    isCreating,
    isDirty,
    isProcessManagementRestricted,
    processQuery.isLoading,
    statusMessages,
    saveMutation.error,
    saveMutation.isError
  ]);

  const statusToneClass = useMemo(() => {
    if (saveMutation.isError) {
      return 'text-red-600';
    }
    if (isProcessEditorReadOnly) {
      return 'text-slate-500';
    }
    if (!currentProcessId) {
      return 'text-slate-500';
    }
    if (!isDirty && formattedSavedAt) {
      return 'text-emerald-600';
    }
    return 'text-slate-500';
  }, [currentProcessId, formattedSavedAt, isDirty, isProcessEditorReadOnly, saveMutation.isError]);

  const saveButtonLabel = useMemo(() => {
    if (isAuthMissing) {
      return saveButtonLabels.authRequired;
    }
    if (isProcessManagementRestricted) {
      return saveButtonLabels.readOnly;
    }
    if (!currentProcessId) {
      return isCreating ? saveButtonLabels.creating : saveButtonLabels.create;
    }
    if (isSaving) {
      return saveButtonLabels.saving;
    }
    if (isDirty) {
      return saveButtonLabels.save;
    }
    return saveButtonLabels.upToDate;
  }, [
    currentProcessId,
    isAuthMissing,
    isCreating,
    isDirty,
    isProcessManagementRestricted,
    isSaving,
    saveButtonLabels
  ]);

  const stepPositions = useMemo(
    () => new Map(steps.map((step, index) => [step.id, index + 1] as const)),
    [steps]
  );

  const startEditingProcess = useCallback(
    (process: ProcessSummary) => {
      if (isProcessEditorReadOnly) {
        return;
      }

      setEditingProcessId(process.id);
      setRenameDraft(normalizeProcessTitle(process.title));
    },
    [isProcessEditorReadOnly]
  );

  const cancelEditingProcess = useCallback(() => {
    setEditingProcessId(null);
    setRenameDraft('');
  }, []);

  const confirmRenameProcess = useCallback(
    (processId: string) => {
      if (isRenaming || isProcessEditorReadOnly) {
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
    [
      cancelEditingProcess,
      isProcessEditorReadOnly,
      isRenaming,
      processSummaries,
      renameDraft,
      renameProcessMutation
    ]
  );

  const handleCreateProcess = useCallback(() => {
    if (isProcessEditorReadOnly || isCreating) {
      return;
    }

    createProcessMutation.mutate(undefined);
  }, [createProcessMutation, isCreating, isProcessEditorReadOnly]);

  const handleDeleteProcess = useCallback(
    (processId: string) => {
      if (isProcessEditorReadOnly) {
        return;
      }

      deleteProcessMutation.mutate(processId);
    },
    [deleteProcessMutation, isProcessEditorReadOnly]
  );

  const clearDragState = useCallback(() => {
    draggedStepIdRef.current = null;
    setDraggedStepId(null);
  }, []);

  const handleStepDragStart = useCallback(
    (event: React.DragEvent<HTMLButtonElement>, stepId: string) => {
      if (isProcessEditorReadOnly) {
        event.preventDefault();
        return;
      }

      event.stopPropagation();
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', stepId);
      draggedStepIdRef.current = stepId;
      setDraggedStepId(stepId);
      setSelectedStepId(stepId);
    },
    [isProcessEditorReadOnly, setSelectedStepId]
  );

  const handleStepDragEnd = useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  const handleStepDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();

      if (isProcessEditorReadOnly) {
        clearDragState();
        return;
      }

      clearDragState();
    },
    [clearDragState, isProcessEditorReadOnly]
  );

  const handleStepDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>, overStepId: string) => {
      event.preventDefault();

      if (isProcessEditorReadOnly) {
        return;
      }

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
    },
    [isProcessEditorReadOnly]
  );

  const handleStepListDragOverEnd = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      if (isProcessEditorReadOnly) {
        return;
      }

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
    },
    [isProcessEditorReadOnly]
  );

  const diagramDefinition = useMemo(() => {
    const flowchartDeclaration = `flowchart ${diagramDirection}`;

    if (steps.length === 0) {
      return flowchartDeclaration;
    }

    const nodeStyles: string[] = [];
    const stepIndexMap = new Map(steps.map((step, index) => [step.id, index] as const));
    const departmentLookup = new Map(
      departments.map((department, index) => [
        department.id,
        { department, clusterId: `cluster_${index}` }
      ])
    );
    const departmentLookupByName = new Map(
      departments
        .map((department, index) => ({ department, clusterId: `cluster_${index}` }))
        .map((entry) => {
          const key = normalizeNameKey(entry.department.name);
          return key ? ([key, entry] as const) : null;
        })
        .filter(Boolean) as Array<readonly [string, { department: DepartmentWithDraftStatus; clusterId: string }]>
    );
    const roleLookup = new Map<string, Role>();

    for (const department of departments) {
      for (const role of department.roles) {
        roleLookup.set(role.id, role);
      }
    }
    const clusterNodes = new Map<string, { label: string; nodes: string[]; color: string }>();
    const ungroupedNodes: string[] = [];

    steps.forEach((step, index) => {
      const nodeId = `S${index}`;
      const baseLabel = getStepDisplayLabel(step);
      const lines = wrapStepLabel(baseLabel);
      const label = lines.map((line) => escapeHtml(line)).join('<br/>');
      const departmentId = normalizeDepartmentId(step.departmentId);
      const draftDepartmentKey = normalizeNameKey(step.draftDepartmentName);
      const clusterEntry = areDepartmentsVisible
        ? departmentId
          ? departmentLookup.get(departmentId)
          : draftDepartmentKey
            ? departmentLookupByName.get(draftDepartmentKey)
            : undefined
        : undefined;
      const roleColor = step.roleId ? roleLookup.get(step.roleId)?.color ?? null : null;
      const departmentColor = areDepartmentsVisible
        ? (clusterEntry?.department.color ?? null)
        : null;
      const isTerminal = step.type === 'start' || step.type === 'finish';
      const baseFill = isTerminal ? '#f8fafc' : '#ffffff';
      const strokeDefault = '#0f172a';
      const colorSource = roleColor ?? departmentColor ?? null;
      const strokeColor = colorSource ?? strokeDefault;

      let declaration: string;

      if (step.type === 'action') {
        declaration = `${nodeId}["${label}"]`;
      } else if (step.type === 'decision') {
        declaration = `${nodeId}{"${label}"}`;
      } else {
        declaration = `${nodeId}(("${label}"))`;
      }

      nodeStyles.push(
        `style ${nodeId} fill:${baseFill},stroke:${strokeColor},color:#0f172a,stroke-width:2px;`
      );

      if (clusterEntry) {
        const lookup = clusterEntry;
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

    const clusterDirection = diagramDirection === 'TD' ? 'TB' : diagramDirection;
    const clusterDeclarations: string[] = [];

    if (areDepartmentsVisible) {
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
    }

    return [
      flowchartDeclaration,
      ...ungroupedNodes,
      ...clusterDeclarations,
      ...connections,
      ...nodeStyles
    ].join('\n');
  }, [areDepartmentsVisible, departments, diagramDirection, getStepDisplayLabel, steps]);

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
    const departmentByName = new Map(
      departments
        .map((department) => {
          const key = normalizeNameKey(department.name);
          return key ? ([key, department] as const) : null;
        })
        .filter(Boolean) as Array<readonly [string, DepartmentWithDraftStatus]>
    );
    const roleById = new Map<string, { role: Role; department: DepartmentWithDraftStatus }>();

    for (const department of departments) {
      for (const role of department.roles) {
        roleById.set(role.id, { role, department });
      }
    }

    const nodes = steps.reduce<
      Array<{
        step: Step;
        centerY: number;
        halfHeight: number;
        lines: string[];
        width: number;
        height: number;
        department: Department | undefined;
        roleColor: string | null;
      }>
    >((acc, step) => {
      const baseLabel = getStepDisplayLabel(step);
      const labelLines = wrapStepLabel(baseLabel);
      const displayLines = [...labelLines];
      const roleEntry = step.roleId ? roleById.get(step.roleId) : undefined;
      const departmentFromStep = step.departmentId ? departmentById.get(step.departmentId) : undefined;
      const draftDepartmentName = normalizeDraftName(step.draftDepartmentName);
      const departmentFromDraft = draftDepartmentName
        ? departmentByName.get(normalizeNameKey(draftDepartmentName) ?? '')
        : undefined;
      const department = areDepartmentsVisible
        ? roleEntry?.department ?? departmentFromStep ?? departmentFromDraft
        : undefined;
      const departmentLabel = department?.name ?? draftDepartmentName ?? roleEntry?.department.name ?? defaultDepartmentName;
      const role = roleEntry?.role;
      const roleLabel = role?.name ?? normalizeDraftName(step.draftRoleName) ?? defaultRoleName;
      const stepIndex = acc.length;
      const defaultNextStep = steps[stepIndex + 1];
      const fallbackLabel = defaultNextStep ? getStepDisplayLabel(defaultNextStep) : '—';

      const metadataLines: string[] = [];

      if (roleLabel) {
        metadataLines.push(`Rôle : ${roleLabel}`);
      }

      if (areDepartmentsVisible && departmentLabel) {
        metadataLines.push(`Département : ${departmentLabel}`);
      }

      if (metadataLines.length > 0) {
        displayLines.push('');
        displayLines.push(...metadataLines);
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

      acc.push({
        step,
        centerY,
        halfHeight,
        lines: displayLines,
        width,
        height,
        department,
        roleColor: role?.color ?? null
      });
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
          const { step, centerY, lines, width, height, department, roleColor } = node;
          const isTerminal = step.type === 'start' || step.type === 'finish';
          const isDecision = step.type === 'decision';
          const isAction = step.type === 'action';
          const baseFill = isTerminal ? '#f8fafc' : '#ffffff';
          const strokeDefault = '#0f172a';
          const departmentColor = areDepartmentsVisible ? department?.color ?? null : null;
          const colorSource = roleColor ?? departmentColor;
          const fillColor = colorSource ? toRgba(colorSource, FALLBACK_STEP_FILL_ALPHA, baseFill) : baseFill;
          const strokeColor = colorSource ?? strokeDefault;
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
  }, [areDepartmentsVisible, defaultDepartmentName, defaultRoleName, departments, getStepDisplayLabel, steps]);

  const mermaidJson = useMemo(
    () =>
      JSON.stringify(
        { title: processTitle || DEFAULT_PROCESS_TITLE, definition: diagramDefinition, steps },
        null,
        2
      ),
    [diagramDefinition, processTitle, steps]
  );

  const missingDepartments = useMemo(
    () => steps.filter((step) => !step.departmentId).map((step) => getStepDisplayLabel(step)),
    [getStepDisplayLabel, steps]
  );

  const missingRoles = useMemo(
    () => steps.filter((step) => !step.roleId).map((step) => getStepDisplayLabel(step)),
    [getStepDisplayLabel, steps]
  );

  const handleProcessUpdateFromIa = useCallback(
    (payload: ProcessPayload) => {
      const targetProcessId = payload.id ?? currentProcessId;

      if (!targetProcessId) {
        return;
      }

      const sanitizedSteps = cloneSteps(payload.steps);
      const normalizedTitle = normalizeProcessTitle(payload.title);

      setDraftDepartments((previous) =>
        mergeDraftEntitiesFromSteps(sanitizedSteps, previous.length > 0 ? previous : sourceDepartments)
      );

      shouldSkipProcessHydrationRef.current = true;
      setSteps(sanitizedSteps);
      setSelectedStepId(null);
      setProcessTitle(normalizedTitle);
      queryClient.setQueryData(['process', targetProcessId], (previous: ProcessResponse | undefined) => {
        const nextUpdatedAt = previous?.updatedAt ?? null;

        return previous
          ? { ...previous, steps: sanitizedSteps, title: normalizedTitle, updatedAt: nextUpdatedAt }
          : { id: targetProcessId, title: normalizedTitle, steps: sanitizedSteps, updatedAt: nextUpdatedAt };
      });
    },
    [currentProcessId, queryClient, sourceDepartments]
  );

  const iaChat = useProcessIaChat({
    processId: currentProcessId,
    locale,
    processTitle,
    mermaidJson,
    missingDepartments,
    missingRoles,
    departments: iaDepartmentsPayload,
    copy: {
      intro: iaPanel.intro,
      followUpHeading: iaPanel.followUpHeading,
      missingDepartmentsHeading: iaPanel.missingDepartmentsHeading,
      missingRolesHeading: iaPanel.missingRolesHeading,
      languageInstruction: iaPanel.languageInstruction,
      modelInstruction: iaPanel.modelInstruction,
      missingProcess: iaPanel.missingProcess,
      validation: iaPanel.validation,
      responseTitle: iaPanel.responseTitle,
      applyNotice: iaPanel.applyNotice
    },
    onProcessUpdate: handleProcessUpdateFromIa
  });

  const isSaveDisabled =
    isProcessEditorReadOnly || isSaving || !isDirty || !currentProcessId || iaChat.isLoading;

  const handleSave = () => {
    if (isSaveDisabled || !currentProcessId) {
      return;
    }

    const payloadSteps = steps.map((step) => normalizeStep({ ...step, label: step.label.trim() }));
    const payload: ProcessPayload = {
      id: currentProcessId,
      title: normalizeProcessTitle(processTitle),
      steps: payloadSteps
    };
    saveMutation.mutate(payload);
  };

  const addStep = (type: Extract<StepType, 'action' | 'decision'>) => {
    if (isProcessEditorReadOnly) {
      return;
    }

    const label = type === 'action' ? 'New action' : 'New decision';
    const newStepId = generateStepId();
    const nextStep: Step = {
      id: newStepId,
      label,
      type,
      departmentId: null,
      draftDepartmentName: null,
      roleId: null,
      draftRoleName: null,
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
    if (isProcessEditorReadOnly) {
      return;
    }

    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, label } : step)));
  };

  const updateStepDepartment = (id: string, departmentId: string | null) => {
    if (isProcessEditorReadOnly) {
      return;
    }

    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== id) {
          return step;
        }

        const normalizedDepartmentId = normalizeDepartmentId(departmentId);
        const currentRole = step.roleId ? roleLookup.byId.get(step.roleId) : undefined;
        const nextRoleId =
          normalizedDepartmentId && currentRole?.departmentId === normalizedDepartmentId
            ? currentRole.role.id
            : null;

        return normalizeStep({
          ...step,
          departmentId: normalizedDepartmentId,
          roleId: nextRoleId
        });
      })
    );
  };

  const updateStepRole = (id: string, roleId: string | null) => {
    if (isProcessEditorReadOnly) {
      return;
    }

    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== id) {
          return step;
        }

        const normalizedRoleId = normalizeRoleId(roleId);

        if (!normalizedRoleId) {
          return normalizeStep({ ...step, roleId: null });
        }

        const entry = roleLookup.byId.get(normalizedRoleId);

        if (!entry) {
          return normalizeStep({ ...step, roleId: null });
        }

        return normalizeStep({
          ...step,
          roleId: entry.role.id,
          departmentId: entry.departmentId
        });
      })
    );
  };

  const updateDecisionBranch = (id: string, branch: 'yes' | 'no', targetId: string | null) => {
    if (isProcessEditorReadOnly) {
      return;
    }

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
    if (isProcessEditorReadOnly) {
      return;
    }

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

  const diagramControlsContentId = useId();

  const iaPanelSaveButton = (
    <Button
      type="button"
      onClick={handleSave}
      disabled={isSaveDisabled}
      className="h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
    >
      {saveButtonLabel}
    </Button>
  );

  const iaPanelContent = (
    <ProcessIaChat
      messages={iaChat.messages}
      onSend={iaChat.sendMessage}
      isLoading={iaChat.isLoading}
      inputError={iaChat.inputError}
      errorMessage={iaChat.errorMessage}
      labels={{
        title: iaPanel.title,
        placeholder: iaPanel.placeholder,
        send: iaPanel.send,
        loading: iaPanel.loading,
        errorLabel: iaPanel.errorLabel
      }}
      disabled={!currentProcessId || isProcessEditorReadOnly}
      footerAction={iaPanelSaveButton}
    />
  );

  const primaryPanelContent = (
    <PrimaryPanel
      processTitle={processTitle}
      primaryPanel={primaryPanel}
      iaPanel={iaPanelContent}
      addStep={addStep}
      isProcessEditorReadOnly={isProcessEditorReadOnly}
      steps={steps}
      draggedStepId={draggedStepId}
      selectedStepId={selectedStepId}
      setSelectedStepId={setSelectedStepId}
      getStepDisplayLabel={getStepDisplayLabel}
      getStepDepartmentLabel={getStepDepartmentLabel}
      getStepRoleLabel={getStepRoleLabel}
      roleLookup={roleLookup}
      tooltipLabels={tooltipLabels}
      stepTypeLabels={stepTypeLabels}
      hasRoles={hasRoles}
      rolePickerMessages={rolePickerMessages}
      hasDepartments={hasDepartments}
      departments={departments}
      updateStepLabel={updateStepLabel}
      updateStepDepartment={updateStepDepartment}
      updateStepRole={updateStepRole}
      stepPositions={stepPositions}
      updateDecisionBranch={updateDecisionBranch}
      handleStepDragOver={handleStepDragOver}
      handleStepDrop={handleStepDrop}
      handleStepDragStart={handleStepDragStart}
      handleStepDragEnd={handleStepDragEnd}
      handleStepListDragOverEnd={handleStepListDragOverEnd}
      removeStep={removeStep}
      handleSave={handleSave}
      isSaveDisabled={isSaveDisabled}
      saveButtonLabel={saveButtonLabel}
      statusToneClass={statusToneClass}
      statusMessage={statusMessage}
      missingAssignments={{
        departmentsLabel: iaPanel.missingDepartmentsHeading,
        rolesLabel: iaPanel.missingRolesHeading,
        departments: missingDepartments,
        roles: missingRoles
      }}
      isDirty={isDirty}
    />
  );

  const secondaryPanelContent = (
    <SecondaryPanel
      highlights={highlights}
      secondaryPanelTitle={secondaryPanelTitle}
      isProcessesTabActive={isProcessesTabActive}
      isDepartmentsTabActive={isDepartmentsTabActive}
      createLabel={createLabel}
      handleCreateProcess={handleCreateProcess}
      handleCreateDepartment={handleCreateDepartment}
      isProcessEditorReadOnly={isProcessEditorReadOnly}
      isCreating={isCreating}
      isDepartmentActionsDisabled={isDepartmentActionsDisabled}
      isCreatingDepartment={isCreatingDepartment}
      isProcessManagementRestricted={isProcessManagementRestricted}
      statusMessages={statusMessages}
      secondaryPanel={secondaryPanel}
      setActiveSecondaryTab={setActiveSecondaryTab}
      isProcessListUnauthorized={isProcessListUnauthorized}
      landingErrorMessages={landingErrorMessages}
      processSummariesQuery={processSummariesQuery}
      hasProcesses={hasProcesses}
      processSummaries={processSummaries}
      currentProcessId={currentProcessId}
      editingProcessId={editingProcessId}
      setSelectedProcessId={setSelectedProcessId}
      startEditingProcess={startEditingProcess}
      renameInputRef={renameInputRef}
      renameDraft={renameDraft}
      setRenameDraft={setRenameDraft}
      confirmRenameProcess={confirmRenameProcess}
      cancelEditingProcess={cancelEditingProcess}
      deleteProcessMutation={deleteProcessMutation}
      handleDeleteProcess={handleDeleteProcess}
      shouldUseDepartmentDemo={shouldUseDepartmentDemo}
      createDepartmentMutation={createDepartmentMutation}
      departmentsQuery={departmentsQuery}
      departments={departments}
      editingDepartmentId={editingDepartmentId}
      isDeletingDepartment={isDeletingDepartment}
      deleteDepartmentId={deleteDepartmentId}
      formatDateTime={formatDateTime}
      departmentEditForm={departmentEditForm}
      handleSaveAllDepartments={handleSaveAllDepartments}
      handleDeleteDepartment={handleDeleteDepartment}
      isSavingDepartment={isSavingDepartment}
      departmentRoleFields={departmentRoleFields}
      isAddingDepartmentRole={isAddingDepartmentRole}
      handleAddRole={handleAddRole}
      createDepartmentRoleMutation={createDepartmentRoleMutation}
      saveDepartmentMutation={saveDepartmentMutation}
      deleteDepartmentMutation={deleteDepartmentMutation}
      startEditingDepartment={startEditingDepartment}
      formatTemplateText={formatTemplateText}
    />
  );

  const renderBottomPanel = ({ isCollapsed }: { isCollapsed: boolean }) => (
    <BottomPanel
      diagramControls={diagramControls}
      diagramDirection={diagramDirection}
      setDiagramDirection={setDiagramDirection}
      areDepartmentsVisible={areDepartmentsVisible}
      setAreDepartmentsVisible={setAreDepartmentsVisible}
      diagramControlsContentId={diagramControlsContentId}
      isCollapsed={isCollapsed}
    />
  );

  return (
    <ProcessShell
      diagramDefinition={diagramDefinition}
      fallbackDiagram={fallbackDiagram}
      mermaidErrorMessages={mermaidErrorMessages}
      diagramDirection={diagramDirection}
      diagramElementId={diagramElementId}
      primaryPanel={primaryPanelContent}
      secondaryPanel={secondaryPanelContent}
      renderBottomPanel={renderBottomPanel}
      primaryToggleLabel={primaryPanel.toggleLabel}
      secondaryToggleLabel={secondaryPanel.toggleLabel}
      bottomToggleLabel={diagramControls.toggleLabel}
    />
  );
}
