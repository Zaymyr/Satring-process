import { DEFAULT_DEPARTMENT_COLOR, type Department } from '@/lib/validation/department';
import { DEFAULT_ROLE_COLOR } from '@/lib/validation/role';
import type { ProcessStep } from '@/lib/validation/process';

import {
  normalizeBranchTarget,
  normalizeDepartmentId,
  normalizeDraftName,
  normalizeNameKey,
  normalizeRoleId
} from './normalizers';

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

const generateStepId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `step-${Math.random().toString(36).slice(2, 10)}`;
};

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
      const hasRole = roleKey ? department.roles.some((role) => normalizeNameKey(role.name) === roleKey) : false;

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

export {
  areStepsEqual,
  cloneSteps,
  generateClientUuid,
  generateStepId,
  mergeDraftEntitiesFromSteps,
  normalizeStep
};
