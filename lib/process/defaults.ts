import type { ProcessPayload, ProcessStep } from '@/lib/validation/process';

export const DEFAULT_PROCESS_TITLE = 'Étapes du processus';

export const DEFAULT_PROCESS_STEPS: readonly ProcessStep[] = [
  {
    id: 'start',
    label: 'Commencer',
    type: 'start',
    departmentId: null,
    draftDepartmentName: null,
    roleId: null,
    draftRoleName: null,
    yesTargetId: null,
    noTargetId: null
  },
  {
    id: 'finish',
    label: 'Terminer',
    type: 'finish',
    departmentId: null,
    draftDepartmentName: null,
    roleId: null,
    draftRoleName: null,
    yesTargetId: null,
    noTargetId: null
  }
];

export function createDefaultProcessPayload(title: string = DEFAULT_PROCESS_TITLE): ProcessPayload {
  return {
    title,
    steps: DEFAULT_PROCESS_STEPS.map((step) => ({ ...step }))
  };
}
