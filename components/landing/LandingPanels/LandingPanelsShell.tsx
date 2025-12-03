'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useId, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useI18n } from '@/components/providers/i18n-provider';
import { BottomPanel } from '@/components/landing/LandingPanels/BottomPanel';
import type { Highlight as HighlightsGridHighlight } from '@/components/landing/LandingPanels/HighlightsGrid';
import { PrimaryPanel } from '@/components/landing/LandingPanels/PrimaryPanel';
import { ProcessIaChat } from '@/components/landing/LandingPanels/ProcessIaChat';
import { SecondaryPanel } from '@/components/landing/LandingPanels/SecondaryPanel';
import { ProcessShell } from '@/components/landing/LandingPanels/ProcessShell';
import { Button } from '@/components/ui/button';
import { DEFAULT_PROCESS_STEPS, DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import { type ProcessErrorMessages, type RoleLookupEntry, type Step } from '@/lib/process/types';
import {
  normalizeBranchTarget,
  normalizeDepartmentId,
  normalizeDraftName,
  normalizeNameKey,
  normalizeProcessTitle,
  normalizeRoleId
} from '@/lib/process/normalizers';
import {
  areStepsEqual,
  cloneSteps,
  generateClientUuid,
  generateStepId,
  mergeDraftEntitiesFromSteps,
  normalizeStep
} from '@/lib/process/steps';
import { escapeHtml, formatDepartmentClusterLabel, getClusterStyleDeclaration, wrapStepLabel } from '@/lib/process/mermaid-format';
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
import {
  DEFAULT_DEPARTMENT_COLOR,
  departmentColorSchema,
  departmentCascadeFormSchema,
  departmentNameSchema,
  type Department,
  type DepartmentCascadeForm
} from '@/lib/validation/department';
import { DEFAULT_ROLE_COLOR, roleColorSchema, roleNameSchema, type Role } from '@/lib/validation/role';
import { ApiError, readErrorMessage } from '@/lib/api/errors';
import { useProcessData, processQueryKeys } from '@/hooks/use-process-data';
import { useDepartments, createDepartment, deleteDepartment, fetchDepartments, updateDepartment } from '@/hooks/use-departments';
import { useRoles, createRole, deleteRole, updateRole } from '@/hooks/use-roles';
import { useProfile } from '@/hooks/use-profile';
import { ProcessDiagram } from '@/components/landing/LandingPanels/ProcessDiagram';

type IaDepartmentsPayload = Parameters<typeof useProcessIaChat>[0]['departments'];

type Highlight = HighlightsGridHighlight;

export type DepartmentWithDraftStatus = Department & {
  isDraft: boolean;
  roles: (Role & { isDraft: boolean })[];
};

const normalizeDepartmentSnapshot = (
  departments: { id: string; name: string; color: string; roles: { id: string; name: string; color: string }[] }[]
) => {
  const normalizedDepartments = departments.map((department) => ({
    id: department.id,
    name: normalizeNameKey(department.name) ?? '',
    color: department.color.toUpperCase(),
    roles: department.roles
      .map((role) => ({ id: role.id, name: normalizeNameKey(role.name) ?? '', color: role.color.toUpperCase() }))
      .sort((a, b) => a.id.localeCompare(b.id) || a.name.localeCompare(b.name))
  }));

  return normalizedDepartments.sort((a, b) => a.id.localeCompare(b.id) || a.name.localeCompare(b.name));
};

const areDepartmentsEqual = (left: Department[], right: Department[]) => {
  const normalizedLeft = normalizeDepartmentSnapshot(left);
  const normalizedRight = normalizeDepartmentSnapshot(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((department, index) => {
    const comparison = normalizedRight[index];
    if (!comparison) {
      return false;
    }

    if (department.id !== comparison.id || department.name !== comparison.name || department.color !== comparison.color) {
      return false;
    }

    if (department.roles.length !== comparison.roles.length) {
      return false;
    }

    return department.roles.every((role, roleIndex) => {
      const roleComparison = comparison.roles[roleIndex];
      if (!roleComparison) {
        return false;
      }

      return role.id === roleComparison.id && role.name === roleComparison.name && role.color === roleComparison.color;
    });
  });
};

const departmentDraftSchema = z.object({
  id: z.string().uuid('Identifiant de département invalide.'),
  name: departmentNameSchema,
  color: departmentColorSchema,
  roles: z
    .array(
      z.object({
        id: z.string().uuid('Identifiant de rôle invalide.').optional(),
        name: roleNameSchema,
        color: roleColorSchema.default(DEFAULT_ROLE_COLOR)
      })
    )
    .default([])
});

const departmentDraftListSchema = z.array(departmentDraftSchema);

type DepartmentDraft = z.infer<typeof departmentDraftSchema>;

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

const FALLBACK_ROLE_PICKER_MESSAGES = getDictionary(DEFAULT_LOCALE).landing.primaryPanel.rolePicker;

export type LandingPanelsShellProps = {
  highlights: readonly Highlight[];
};

export function LandingPanelsShell({ highlights }: LandingPanelsShellProps) {
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
  const hasAutoCreatedProcessRef = useRef(false);
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

  const currentProcessId = selectedProcessId;

  const { processSummariesQuery, processQuery } = useProcessData({
    processId: currentProcessId,
    messages: landingErrorMessages
  });

  const { departmentsQuery, invalidateDepartments, setDepartmentsCache } = useDepartments();
  const { invalidateRoles } = useRoles();
  const { profileQuery } = useProfile();

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

  const deleteDepartmentMutation = useMutation<void, ApiError, { id: string }>({
    mutationFn: ({ id }) => deleteDepartment(id),
    onMutate: async ({ id }) => {
      setDeleteDepartmentId(id);
    },
    onSuccess: async (_data, variables) => {
      await invalidateDepartments();
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
  const isProcessInitialized = Boolean(currentProcessId);
  const isStepEditingDisabled = isProcessEditorReadOnly || !isProcessInitialized;
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
  const departmentById = useMemo(() => {
    const map = new Map<string, DepartmentWithDraftStatus>();
    departments.forEach((department) => {
      map.set(department.id, department);
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
          departmentName: department.name,
          departmentIsDraft: department.isDraft,
          isDraft: 'isDraft' in role && role.isDraft
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
      const departmentFromStep = normalizedDepartmentId
        ? departmentById.get(normalizedDepartmentId)
        : null;
      const roleEntry = step.roleId ? roleLookup.byId.get(step.roleId) : null;
      const draftDepartmentName = normalizeDraftName(step.draftDepartmentName);
      const departmentLabel =
        departmentFromStep?.name ?? draftDepartmentName ?? roleEntry?.departmentName ?? defaultDepartmentName;
      const isDraft =
        Boolean(departmentFromStep?.isDraft) || Boolean(draftDepartmentName) || Boolean(roleEntry?.departmentIsDraft);

      return isDraft && departmentLabel
        ? `${departmentLabel} (${secondaryPanel.departments.draftBadge})`
        : departmentLabel;
    },
    [
      defaultDepartmentName,
      departmentById,
      roleLookup.byId,
      secondaryPanel.departments.draftBadge
    ]
  );

  const getStepRoleLabel = useCallback(
    (step: Step) => {
      if (step.roleId) {
        const entry = roleLookup.byId.get(step.roleId);
        if (entry) {
          const label = entry.role.name;
          return entry.isDraft && label
            ? `${label} (${secondaryPanel.departments.roleDraftBadge})`
            : label;
        }
      }

      const draftRoleName = normalizeDraftName(step.draftRoleName);
      if (draftRoleName) {
        return `${draftRoleName} (${secondaryPanel.departments.roleDraftBadge})`;
      }

      return defaultRoleName;
    },
    [defaultRoleName, roleLookup.byId, secondaryPanel.departments.roleDraftBadge]
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

  const handleAddRole = useCallback(() => {
    if (
      !editingDepartmentId ||
      isDepartmentActionsDisabled ||
      isSaving ||
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
    isSaving
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
      if (isDepartmentActionsDisabled || isSaving) {
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
      isSaving
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
          const safeRoleInput = (roleInput ?? {}) as DepartmentCascadeForm['roles'][number];
          const existingRoleById = safeRoleInput.roleId ? rolesById.get(safeRoleInput.roleId) : undefined;
          const existingRoleByIndex = targetDepartment.roles[roleIndex];
          const baseRole = existingRoleById ?? existingRoleByIndex;

          if (baseRole) {
            if (baseRole.name === safeRoleInput.name && baseRole.color === safeRoleInput.color) {
              return baseRole;
            }

            return {
              ...baseRole,
              name: safeRoleInput.name ?? baseRole.name,
              color: safeRoleInput.color ?? baseRole.color
            } satisfies Role;
          }

          const now = new Date().toISOString();

          return {
            id: safeRoleInput.roleId ?? generateClientUuid(),
            departmentId: targetDepartment.id,
            name: safeRoleInput.name ?? '',
            color: safeRoleInput.color ?? DEFAULT_ROLE_COLOR,
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
      queryClient.invalidateQueries({ queryKey: processQueryKeys.summaries });
      setSelectedProcessId(null);
      const fallback = cloneSteps(DEFAULT_PROCESS_STEPS);
      baselineStepsRef.current = cloneSteps(fallback);
      baselineTitleRef.current = DEFAULT_PROCESS_TITLE;
      setSteps(fallback);
      setLastSavedAt(null);
      setProcessTitle(DEFAULT_PROCESS_TITLE);
    }
  }, [currentProcessId, processQuery.error, processQuery.isError, queryClient]);

  const isDepartmentDraftDirty = useMemo(() => {
    if (departmentEditForm.formState.isDirty) {
      return true;
    }

    return !areDepartmentsEqual(draftDepartments, sourceDepartments);
  }, [departmentEditForm.formState.isDirty, draftDepartments, sourceDepartments]);

  const isDirty = useMemo(() => {
    const normalizedTitle = normalizeProcessTitle(processTitle);
    return (
      normalizedTitle !== baselineTitleRef.current ||
      !areStepsEqual(steps, baselineStepsRef.current) ||
      isDepartmentDraftDirty
    );
  }, [isDepartmentDraftDirty, processTitle, steps]);

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

  const isCreating = createProcessMutation.isPending;

  const handleCreateProcess = useCallback(() => {
    if (isProcessEditorReadOnly || isCreating) {
      return;
    }

    createProcessMutation.mutate(undefined);
  }, [createProcessMutation, isCreating, isProcessEditorReadOnly]);

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

  type SavePayload = { process: ProcessPayload; departments: DepartmentDraft[] };
  type SaveResult = { process: ProcessResponse; departments: Department[] };

  const saveMutation = useMutation<SaveResult, ApiError, SavePayload>({
    mutationFn: async ({ process, departments: stagedDepartments }) => {
      if (!process.id) {
        throw new ApiError('Identifiant de process manquant', 400);
      }

      const baselineDepartments = departmentsQuery.data ?? [];
      const baselineById = new Map(baselineDepartments.map((item) => [item.id, item]));
      const departmentIdMap = new Map<string, string>();
      const roleIdMap = new Map<string, string>();

      for (const staged of stagedDepartments) {
        const baseline = baselineById.get(staged.id) ?? null;
        let targetDepartmentId = baseline?.id ?? staged.id;

        if (!baseline) {
          const created = await createDepartment({ name: staged.name, color: staged.color });
          departmentIdMap.set(staged.id, created.id);
          targetDepartmentId = created.id;
        } else if (baseline.name !== staged.name || baseline.color !== staged.color) {
          await updateDepartment({ id: staged.id, name: staged.name, color: staged.color });
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
              await updateRole({ id: roleInput.id, name: roleInput.name, color: roleInput.color });
            }

            continue;
          }

          const createdRole = await createRole({
            departmentId: targetDepartmentId,
            name: roleInput.name,
            color: roleInput.color
          });
          roleIdMap.set(roleInput.id ?? roleInput.name, createdRole.id);
          seenRoleIds.add(createdRole.id);
        }

        for (const [roleId] of baselineRoles) {
          if (!seenRoleIds.has(roleId)) {
            await deleteRole(roleId);
          }
        }
      }

      const refreshedDepartments = await fetchDepartments();
      const normalizedSteps = process.steps.map((step) => {
        const mappedDepartmentId = step.departmentId
          ? departmentIdMap.get(step.departmentId) ?? step.departmentId
          : null;
        const mappedRoleId = step.roleId ? roleIdMap.get(step.roleId) ?? step.roleId : null;

        return normalizeStep({
          ...step,
          departmentId: mappedDepartmentId,
          roleId: mappedRoleId
        });
      });

      const response = await fetch(`/api/process?id=${encodeURIComponent(process.id)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: process.title, steps: normalizedSteps })
      });

      if (response.status === 401) {
        throw new ApiError('Authentification requise', 401);
      }

      if (!response.ok) {
        const message = await readErrorMessage(response, 'Impossible de sauvegarder le process.');
        throw new ApiError(message, response.status);
      }

      const json = await response.json();
      const parsedProcess = processResponseSchema.parse(json);
      return { process: parsedProcess, departments: refreshedDepartments } satisfies SaveResult;
    },
    onSuccess: (data) => {
      const sanitized = cloneSteps(data.process.steps);
      const normalizedTitle = normalizeProcessTitle(data.process.title);
      baselineStepsRef.current = cloneSteps(sanitized);
      baselineTitleRef.current = normalizedTitle;
      setSteps(sanitized);
      setLastSavedAt(data.process.updatedAt);
      setProcessTitle(normalizedTitle);
      setDepartmentsCache(data.departments);
      setDraftDepartments(data.departments);
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
      data.departments.forEach((department) => {
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
      queryClient.setQueryData(['process', data.process.id], data.process);
      queryClient.setQueryData(['processes'], (previous?: ProcessSummary[]) => {
        const summary: ProcessSummary = {
          id: data.process.id,
          title: normalizedTitle,
          updatedAt: data.process.updatedAt
        };

        if (!previous) {
          return [summary];
        }

        const filtered = previous.filter((item) => item.id !== data.process.id);
        return [summary, ...filtered];
      });
      invalidateDepartments();
      invalidateRoles(editingDepartmentId);
    },
    onError: (error) => {
      console.error('Erreur de sauvegarde du process', error);
    }
  });

  const isSaving = saveMutation.isPending;
  const isRenaming = renameProcessMutation.isPending;

  const formattedSavedAt = formatDateTime(lastSavedAt);

  useEffect(() => {
    if (hasAutoCreatedProcessRef.current) {
      return;
    }

    if (
      isProcessEditorReadOnly ||
      isCreating ||
      processSummariesQuery.isLoading ||
      processSummariesQuery.isError ||
      processSummariesQuery.data?.length
    ) {
      return;
    }

    hasAutoCreatedProcessRef.current = true;
    createProcessMutation.mutate(undefined);
  }, [createProcessMutation, isCreating, isProcessEditorReadOnly, processSummariesQuery]);

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
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span>{statusMessages.createPrompt}</span>
          <Button
            type="button"
            size="sm"
            onClick={handleCreateProcess}
            disabled={isProcessEditorReadOnly || isCreating}
            className="h-8 rounded-md bg-slate-900 px-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:bg-slate-200"
          >
            {saveButtonLabels.create}
          </Button>
        </div>
      );
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
    handleCreateProcess,
    isCreating,
    isDirty,
    isProcessManagementRestricted,
    isProcessEditorReadOnly,
    processQuery.isLoading,
    statusMessages,
    saveButtonLabels.create,
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
      if (isStepEditingDisabled) {
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
    [isStepEditingDisabled, setSelectedStepId]
  );

  const handleStepDragEnd = useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  const handleStepDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();

      if (isStepEditingDisabled) {
        clearDragState();
        return;
      }

      clearDragState();
    },
    [clearDragState, isStepEditingDisabled]
  );

  const handleStepDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>, overStepId: string) => {
      event.preventDefault();

      if (isStepEditingDisabled) {
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
    [isStepEditingDisabled]
  );

  const handleStepListDragOverEnd = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      if (isStepEditingDisabled) {
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
    [isStepEditingDisabled]
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

  const fallbackDiagram = useMemo(
    () => (
      <ProcessDiagram
        steps={steps}
        departments={departments}
        areDepartmentsVisible={areDepartmentsVisible}
        defaultDepartmentName={defaultDepartmentName}
        defaultRoleName={defaultRoleName}
        getStepDisplayLabel={getStepDisplayLabel}
      />
    ),
    [
      areDepartmentsVisible,
      defaultDepartmentName,
      defaultRoleName,
      departments,
      getStepDisplayLabel,
      steps
    ]
  );

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

  const sendIaMessage = useCallback(
    (message: string) => {
      if (!isProcessInitialized) {
        return { ok: false } as const;
      }

      return iaChat.sendMessage(message);
    },
    [iaChat, isProcessInitialized]
  );

  const isSaveDisabled = isStepEditingDisabled || isSaving || !isDirty || iaChat.isLoading;

  const handleSave = useCallback(() => {
    if (isSaveDisabled || !currentProcessId) {
      return;
    }

    void (async () => {
      let editedDepartmentValues: DepartmentCascadeForm | null = null;

      if (editingDepartmentId) {
        const isValid = await departmentEditForm.trigger();
        if (!isValid) {
          return;
        }

        const parsed = departmentCascadeFormSchema.safeParse(departmentEditForm.getValues());
        if (!parsed.success) {
          return;
        }

        editedDepartmentValues = parsed.data;
      }

      const stagedDepartmentsInput = draftDepartments.map((department) => {
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
          } satisfies DepartmentDraft;
        }

        return {
          id: department.id,
          name: department.name,
          color: department.color,
          roles: department.roles.map((role) => ({ id: role.id, name: role.name, color: role.color }))
        } satisfies DepartmentDraft;
      });

      const parsedDepartments = departmentDraftListSchema.safeParse(stagedDepartmentsInput);
      if (!parsedDepartments.success) {
        console.error(parsedDepartments.error.flatten());
        return;
      }

      const payloadSteps = steps.map((step) => normalizeStep({ ...step, label: step.label.trim() }));
      const payload: ProcessPayload = processPayloadSchema.parse({
        id: currentProcessId,
        title: normalizeProcessTitle(processTitle),
        steps: payloadSteps
      });
      saveMutation.mutate({ process: payload, departments: parsedDepartments.data });
    })();
  }, [
    currentProcessId,
    departmentEditForm,
    draftDepartments,
    editingDepartmentId,
    isSaveDisabled,
    processTitle,
    saveMutation,
    steps
  ]);

  const addStep = (type: Extract<StepType, 'action' | 'decision'>) => {
    if (isStepEditingDisabled) {
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
    if (isStepEditingDisabled) {
      return;
    }

    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, label } : step)));
  };

  const updateStepDepartment = (id: string, departmentId: string | null) => {
    if (isStepEditingDisabled) {
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
    if (isStepEditingDisabled) {
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
    if (isStepEditingDisabled) {
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
    if (isStepEditingDisabled) {
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
      onSend={sendIaMessage}
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
      disabled={isStepEditingDisabled}
      footerAction={iaPanelSaveButton}
    />
  );

  const primaryPanelContent = (
    <PrimaryPanel
      processTitle={processTitle}
      primaryPanel={primaryPanel}
      iaPanel={iaPanelContent}
      isProcessInitialized={isProcessInitialized}
      onCreateProcess={handleCreateProcess}
      isCreatingProcess={isCreating}
      createLabel={saveButtonLabels.create}
      createPrompt={statusMessages.createPrompt}
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
      draftBadgeLabel={secondaryPanel.departments.draftBadge}
      roleDraftBadgeLabel={secondaryPanel.departments.roleDraftBadge}
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
      handleSave={handleSave}
      handleDeleteDepartment={handleDeleteDepartment}
      isSaving={isSaving}
      isSaveDisabled={isSaveDisabled}
      saveError={saveMutation.isError ? saveMutation.error?.message ?? null : null}
      departmentRoleFields={departmentRoleFields}
      isAddingDepartmentRole={isAddingDepartmentRole}
      handleAddRole={handleAddRole}
      createDepartmentRoleMutation={createDepartmentRoleMutation}
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
