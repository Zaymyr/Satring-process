import type { ProcessResponse, ProcessStep } from '@/lib/validation/process';

export const DEFAULT_PROCESS_TITLE = 'Étapes du processus';

export const DEFAULT_PROCESS_STEPS: readonly ProcessStep[] = [
  { id: 'start', label: 'Commencer', type: 'start' },
  { id: 'finish', label: 'Terminer', type: 'finish' }
];

export function createDefaultProcessResponse(): ProcessResponse {
  return {
    title: DEFAULT_PROCESS_TITLE,
    steps: DEFAULT_PROCESS_STEPS.map((step) => ({ ...step })),
    updatedAt: null
  };
}
