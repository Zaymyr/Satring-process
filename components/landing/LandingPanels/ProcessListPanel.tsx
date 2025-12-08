import type { MutableRefObject } from 'react';
import { Loader2, Pencil, Save, Trash2 } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import type { ProcessSummary } from '@/lib/validation/process';
import type { SecondaryPanelLabels, StatusMessages } from './SecondaryPanel';

type ProcessListPanelProps = {
  isUnauthorized: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  hasProcesses: boolean;
  processes: ProcessSummary[];
  currentProcessId: string | null;
  editingProcessId: string | null;
  isProcessEditorReadOnly: boolean;
  onboardingRenameTargetId?: string | null;
  renameInputRef: MutableRefObject<HTMLInputElement | null>;
  renameDraft: string;
  onRenameDraftChange: (value: string) => void;
  onSelectProcess: (processId: string) => void;
  onStartEditing: (process: ProcessSummary) => void;
  onConfirmRename: (processId: string) => void;
  onCancelEditing: () => void;
  onDeleteProcess: (processId: string) => void;
  deleteProcessMutation: UseMutationResult<void, Error, string>;
  labels: SecondaryPanelLabels['processes'];
  statusMessages: StatusMessages;
  isProcessManagementRestricted: boolean;
};

export function ProcessListPanel({
  isUnauthorized,
  isLoading,
  errorMessage,
  hasProcesses,
  processes,
  currentProcessId,
  editingProcessId,
  isProcessEditorReadOnly,
  onboardingRenameTargetId,
  renameInputRef,
  renameDraft,
  onRenameDraftChange,
  onSelectProcess,
  onStartEditing,
  onConfirmRename,
  onCancelEditing,
  onDeleteProcess,
  deleteProcessMutation,
  labels,
  statusMessages,
  isProcessManagementRestricted
}: ProcessListPanelProps) {
  if (isUnauthorized) {
    return <p className="text-sm text-slate-600">{errorMessage}</p>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {labels.loading}
      </div>
    );
  }

  if (errorMessage) {
    return <p className="text-sm text-red-600">{errorMessage}</p>;
  }

  if (!hasProcesses) {
    return (
      <p className="text-sm text-slate-600">
        {isProcessManagementRestricted ? statusMessages.readerRestriction : statusMessages.createPrompt}
      </p>
    );
  }

  return (
    <ul role="tree" aria-label={labels.listAriaLabel} className="space-y-2">
      {processes.map((summary) => {
        const isSelected = summary.id === currentProcessId;
        const isEditing = editingProcessId === summary.id;
        const isDeleting = deleteProcessMutation.isPending && deleteProcessMutation.variables === summary.id;

        return (
          <li key={summary.id} role="treeitem" aria-selected={isSelected} className="focus:outline-none">
            <div
              role={isEditing ? undefined : 'button'}
              tabIndex={isEditing ? undefined : 0}
              onClick={
                isEditing
                  ? undefined
                  : () => {
                      onSelectProcess(summary.id);
                    }
              }
              onDoubleClick={
                isEditing || isProcessEditorReadOnly
                  ? undefined
                  : () => onStartEditing(summary)
              }
              onKeyDown={
                isEditing
                  ? undefined
                  : (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectProcess(summary.id);
                      }
                    }
              }
              className={cn(
                'group flex flex-col gap-1 rounded-lg border border-transparent px-2 py-2 transition focus:outline-none',
                isSelected
                  ? 'border-slate-900/30 bg-slate-900/5 shadow-inner'
                  : 'hover:border-slate-300 hover:bg-slate-100',
                isEditing
                  ? undefined
                  : 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          id={isEditing && onboardingRenameTargetId ? onboardingRenameTargetId : undefined}
                          ref={renameInputRef}
                          value={renameDraft}
                          onChange={(event) => onRenameDraftChange(event.target.value)}
                          className="h-8 w-40 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            id="onboarding-save-process"
                            onClick={() => onConfirmRename(summary.id)}
                            className="inline-flex h-8 items-center justify-center rounded-md bg-slate-900 px-2 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            {labels.rename.save}
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEditing}
                            className="inline-flex h-8 items-center justify-center rounded-md bg-slate-100 px-2 text-xs font-medium text-slate-800 hover:bg-slate-200"
                          >
                            {labels.rename.cancel}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{summary.title}</p>
                        <p className="text-xs text-slate-500">{summary.updatedAt}</p>
                      </div>
                    )}
                  </div>
                </div>
                {!isEditing ? (
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onStartEditing(summary)}
                      disabled={isProcessEditorReadOnly}
                      className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">{labels.rename.ariaLabel}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteProcess(summary.id)}
                      disabled={isProcessEditorReadOnly || isDeleting}
                      className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      <span className="sr-only">{labels.deleteAriaLabel}</span>
                    </Button>
                  </div>
                ) : null}
              </div>
              {isEditing ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Save className="h-3.5 w-3.5" />
                  <span>{labels.rename.ariaLabel}</span>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
