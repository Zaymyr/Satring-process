import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

type MissingAssignments = {
  departmentsLabel: string;
  rolesLabel: string;
  departments: string[];
  roles: string[];
};

type ProcessControlsProps = {
  onSave: () => void;
  isSaveDisabled: boolean;
  saveButtonLabel: string;
  statusToneClass: string;
  statusMessage: ReactNode;
  missingAssignments: MissingAssignments;
  isDirty: boolean;
};

export function ProcessControls({
  onSave,
  isSaveDisabled,
  saveButtonLabel,
  statusToneClass,
  statusMessage,
  missingAssignments,
  isDirty
}: ProcessControlsProps) {
  void onSave;
  void isSaveDisabled;
  void saveButtonLabel;

  const hasMissingAssignments =
    isDirty && (missingAssignments.departments.length > 0 || missingAssignments.roles.length > 0);

  return (
    <div className="space-y-2 pt-2">
      <p className={cn('text-[11px] leading-5', statusToneClass)} aria-live="polite">
        {statusMessage}
      </p>
      {hasMissingAssignments ? (
        <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-950 shadow-inner">
          {missingAssignments.departments.length > 0 ? (
            <div className="flex flex-wrap items-start gap-2">
              <span className="font-semibold">{missingAssignments.departmentsLabel}</span>
              <div className="flex flex-wrap gap-1.5">
                {missingAssignments.departments.map((label, index) => (
                  <span
                    key={`${label}-department-${index}`}
                    className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium shadow-sm"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {missingAssignments.roles.length > 0 ? (
            <div className="flex flex-wrap items-start gap-2">
              <span className="font-semibold">{missingAssignments.rolesLabel}</span>
              <div className="flex flex-wrap gap-1.5">
                {missingAssignments.roles.map((label, index) => (
                  <span
                    key={`${label}-role-${index}`}
                    className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium shadow-sm"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
