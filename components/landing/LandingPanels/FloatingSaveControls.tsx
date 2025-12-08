import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

type FloatingSaveControlsProps = {
  onSave: () => void;
  isSaveDisabled: boolean;
  saveButtonLabel: string;
  statusToneClass: string;
  statusMessage: ReactNode;
  isBottomCollapsed: boolean;
};

export function FloatingSaveControls({
  onSave,
  isSaveDisabled,
  saveButtonLabel,
  statusToneClass,
  statusMessage,
  isBottomCollapsed
}: FloatingSaveControlsProps) {
  return (
    <div
      className={cn(
        'pointer-events-auto flex w-max min-w-[14rem] max-w-[20rem] flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-center shadow-[0_20px_80px_-50px_rgba(15,23,42,0.4)] backdrop-blur transition-all duration-200',
        isBottomCollapsed
          ? 'fixed bottom-20 left-1/2 -translate-x-1/2'
          : 'absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[140%]'
      )}
    >
      <button
        type="button"
        id="onboarding-save-process"
        onClick={onSave}
        disabled={isSaveDisabled}
        className={cn(
          'inline-flex h-10 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-slate-300',
          'dark:focus-visible:ring-offset-slate-900'
        )}
      >
        {saveButtonLabel}
      </button>
      <p className={cn('text-[11px] leading-5 text-slate-700', statusToneClass)} aria-live="polite">
        {statusMessage}
      </p>
    </div>
  );
}
