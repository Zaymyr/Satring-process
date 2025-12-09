import { PartyPopper } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export type OnboardingCompletionDialogProps = {
  open: boolean;
  title: string;
  description: string;
  closeLabel: string;
  newProcessLabel: string;
  isCreatingProcess: boolean;
  onClose: () => void;
  onCreateProcess: () => void;
};

export function OnboardingCompletionDialog({
  open,
  title,
  description,
  closeLabel,
  newProcessLabel,
  isCreatingProcess,
  onClose,
  onCreateProcess
}: OnboardingCompletionDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <Card className="w-full max-w-lg bg-white text-slate-900 shadow-2xl ring-1 ring-slate-200/80 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800">
        <CardContent className="p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
              <PartyPopper aria-hidden className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{description}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-2">
            <Button variant="outline" onClick={onClose} type="button">
              {closeLabel}
            </Button>
            <Button onClick={onCreateProcess} disabled={isCreatingProcess} type="button">
              {newProcessLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
