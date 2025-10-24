import type { ProcessPayload, ProcessStep } from '@/lib/validation/process';

export const DEFAULT_PROCESS_TITLE = 'Étapes du processus';

export const DEFAULT_PROCESS_STEPS: readonly ProcessStep[] = [
  { id: 'start', label: 'Commencer', type: 'start' },
  { id: 'finish', label: 'Terminer', type: 'finish' }
];

export function createDefaultProcessPayload(title: string = DEFAULT_PROCESS_TITLE): ProcessPayload {
  return {
    title,
    steps: DEFAULT_PROCESS_STEPS.map((step) => ({ ...step }))
  };
}
