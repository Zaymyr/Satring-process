import { Controller, type UseFieldArrayReturn, type UseFormReturn } from 'react-hook-form';
import { Loader2, Plus, Trash2, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { DEFAULT_ROLE_COLOR } from '@/lib/validation/role';
import type { DepartmentCascadeForm } from '@/lib/validation/department';
import type { SecondaryPanelLabels } from './SecondaryPanel';

type DepartmentEditorProps = {
  colorInputId: string;
  labels: SecondaryPanelLabels['departments'];
  roleDraftLookup: Map<string, boolean>;
  departmentEditForm: UseFormReturn<DepartmentCascadeForm>;
  departmentRoleFields: UseFieldArrayReturn<DepartmentCascadeForm, 'roles', 'id'>;
  isSaving: boolean;
  isActionsDisabled: boolean;
  isAddingRole: boolean;
  isDeleting: boolean;
  onDelete: () => void;
  onAddRole: () => void;
};

export function DepartmentEditor({
  colorInputId,
  labels,
  roleDraftLookup,
  departmentEditForm,
  departmentRoleFields,
  isSaving,
  isActionsDisabled,
  isAddingRole,
  isDeleting,
  onDelete,
  onAddRole
}: DepartmentEditorProps) {
  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex w-full flex-col gap-3" data-entity-type="department">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center">
          <label htmlFor={colorInputId} className="sr-only">
            {labels.colorLabel}
          </label>
          <input
            id={colorInputId}
            type="color"
            {...departmentEditForm.register('color')}
            disabled={isSaving}
            className="h-9 w-9 cursor-pointer rounded-md border border-slate-300 bg-white p-1 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            aria-describedby={departmentEditForm.formState.errors.color ? `${colorInputId}-error` : undefined}
          />
        </div>
        <Input
          {...departmentEditForm.register('name')}
          autoFocus
          disabled={isSaving}
          className="h-9 min-w-[12rem] flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onDelete}
          disabled={isActionsDisabled || isDeleting || isSaving}
          className="ml-auto h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          {isDeleting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Trash2 aria-hidden="true" className="h-4 w-4" />}
          <span className="sr-only">{labels.deleteAriaLabel}</span>
        </Button>
      </div>
      {departmentEditForm.formState.errors.color ? (
        <p id={`${colorInputId}-error`} className="text-xs text-red-600">
          {departmentEditForm.formState.errors.color.message}
        </p>
      ) : null}
      {departmentEditForm.formState.errors.name ? (
        <p className="text-xs text-red-600">{departmentEditForm.formState.errors.name.message}</p>
      ) : null}
      <div className="flex flex-col gap-2">
        {departmentRoleFields.fields.length > 0 ? (
          departmentRoleFields.fields.map((field, index) => {
            const roleFieldErrors = departmentEditForm.formState.errors.roles?.[index];
            const roleNameError = roleFieldErrors?.name;
            const roleColorError = roleFieldErrors?.color;
            const roleNameField = `roles.${index}.name` as const;
            const roleIdField = `roles.${index}.roleId` as const;
            const roleColorField = `roles.${index}.color` as const;
            const roleColorInputId = `department-role-color-${field.id}`;
            const isRoleDraft = !field.roleId || roleDraftLookup.get(field.roleId) === true;

            return (
              <div key={field.id} className="space-y-1">
                <Controller
                  control={departmentEditForm.control}
                  name={roleIdField}
                  defaultValue={field.roleId ?? ''}
                  render={({ field: roleIdControl }) => (
                    <input type="hidden" {...roleIdControl} value={roleIdControl.value ?? ''} />
                  )}
                />
                <div
                  className={cn(
                    'flex flex-wrap items-center gap-2 rounded-lg border bg-white px-3 py-2.5 shadow-sm',
                    isRoleDraft ? 'border-dashed border-slate-300' : 'border-slate-200'
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Controller
                      control={departmentEditForm.control}
                      name={roleColorField}
                      defaultValue={field.color ?? DEFAULT_ROLE_COLOR}
                      render={({ field: roleColorControl }) => (
                        <input
                          id={roleColorInputId}
                          name={roleColorControl.name}
                          type="color"
                          value={roleColorControl.value ?? DEFAULT_ROLE_COLOR}
                          onChange={(event) => roleColorControl.onChange(event.target.value.toUpperCase())}
                          onBlur={roleColorControl.onBlur}
                          ref={roleColorControl.ref}
                          disabled={isSaving}
                          className="h-8 w-8 cursor-pointer rounded-md border border-slate-300 bg-white p-1 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                          aria-describedby={roleColorError ? `${roleColorInputId}-error` : undefined}
                        />
                      )}
                    />
                    <UserRound className="h-4 w-4 text-slate-500" />
                    <Controller
                      control={departmentEditForm.control}
                      name={roleNameField}
                      defaultValue={field.name}
                      render={({ field: roleNameControl }) => (
                        <Input
                          {...roleNameControl}
                          value={roleNameControl.value ?? ''}
                          disabled={isSaving}
                          className="h-8 min-w-[10rem] flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                        />
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => departmentRoleFields.remove(index)}
                    disabled={isSaving || isAddingRole}
                    className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                    title={field.roleId ? labels.roles.removeTitleSaved : labels.roles.removeTitleUnsaved}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    <span className="sr-only">{labels.roles.removeAriaLabel}</span>
                  </Button>
                </div>
                {roleNameError ? <p className="text-xs text-red-600">{roleNameError.message}</p> : null}
                {roleColorError ? (
                  <p id={`${roleColorInputId}-error`} className="text-xs text-red-600">
                    {roleColorError.message}
                  </p>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="text-xs text-slate-500">{labels.roles.empty}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            id="onboarding-add-role"
            onClick={onAddRole}
            disabled={isSaving || isAddingRole || isActionsDisabled}
            className="inline-flex h-8 items-center gap-1 rounded-md border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {isAddingRole ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} 
            {labels.addRole}
          </Button>
        </div>
      </div>
    </form>
  );
}
