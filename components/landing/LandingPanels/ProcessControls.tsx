import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

type ProcessControlsProps = {
  onSave: () => void;
  isSaveDisabled: boolean;
  saveButtonLabel: string;
  statusToneClass: string;
  statusMessage: ReactNode;
};

export function ProcessControls({
  onSave,
  isSaveDisabled,
  saveButtonLabel,
  statusToneClass,
  statusMessage
}: ProcessControlsProps) {
  void onSave;
  void isSaveDisabled;
  void saveButtonLabel;

  if (!statusMessage) {
    return null;
  }

  return (
    <div className="space-y-2 pt-2">
      <p className={cn('text-[11px] leading-5', statusToneClass)} aria-live="polite">
        {statusMessage}
      </p>
    </div>
  );
}
