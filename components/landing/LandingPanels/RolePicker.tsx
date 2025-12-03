import type { ChangeEvent } from 'react';

import type { RoleLookupEntry } from '@/lib/process/types';
import type { ProcessStep } from '@/lib/validation/process';

export type RolePickerMessages = {
  addRole: string;
  noDepartmentRoles: string;
  chooseRoleForDepartment: string;
};

type RolePickerProps = {
  step: ProcessStep;
  hasRoles: boolean;
  roleEntries: RoleLookupEntry[];
  messages: RolePickerMessages;
  disabled: boolean;
  onChange: (roleId: string | null) => void;
  helperText?: string | null;
  draftBadgeLabel: string;
};

export function RolePicker({
  step,
  hasRoles,
  roleEntries,
  messages,
  disabled,
  onChange,
  helperText: helperTextOverride,
  draftBadgeLabel
}: RolePickerProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    onChange(value.length > 0 ? value : null);
  };

  const helperText = helperTextOverride ?? (() => {
    if (!hasRoles) {
      return messages.addRole;
    }

    if (step.departmentId && roleEntries.length === 0) {
      return messages.noDepartmentRoles;
    }

    if (!step.departmentId && hasRoles) {
      return messages.chooseRoleForDepartment;
    }

    return null;
  })();

  return (
    <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      <span title={messages.chooseRoleForDepartment}>Role</span>
      <select
        value={step.roleId ?? ''}
        onChange={handleChange}
        disabled={disabled}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 transition focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >
        <option value="">No role</option>
        {roleEntries.map((entry) => {
          const optionLabel =
            entry.isDraft || entry.departmentIsDraft
              ? `${entry.role.name} · ${draftBadgeLabel}`
              : entry.role.name;

          return (
            <option key={entry.role.id} value={entry.role.id}>
              {optionLabel}
            </option>
          );
        })}
      </select>
      {!step.roleId && step.draftRoleName ? (
        <span className="text-[0.6rem] font-normal normal-case tracking-normal text-slate-500">
          Suggested: {step.draftRoleName}
        </span>
      ) : null}
      {helperText ? (
        <span className="text-[0.6rem] font-normal normal-case tracking-normal text-slate-500">{helperText}</span>
      ) : null}
    </label>
  );
}
