import type { ProcessPayload, ProcessStep } from '@/lib/validation/process';

export const DEFAULT_PROCESS_TITLE = 'Étapes du processus';

export const DEFAULT_PROCESS_STEPS: readonly ProcessStep[] = [
  {
    id: 'start',
    label: 'Commencer',
    type: 'start',
    departmentId: null,
    yesTargetId: null,
    noTargetId: null,
    nextStepId: null,
    assignee: null,
    description: null
  },
  {
    id: 'finish',
    label: 'Terminer',
    type: 'finish',
    departmentId: null,
    yesTargetId: null,
    noTargetId: null,
    nextStepId: null,
    assignee: null,
    description: null
  }
];

export function createDefaultProcessPayload(title: string = DEFAULT_PROCESS_TITLE): ProcessPayload {
  return {
    title,
    steps: DEFAULT_PROCESS_STEPS.map((step) => ({ ...step }))
  };
}
