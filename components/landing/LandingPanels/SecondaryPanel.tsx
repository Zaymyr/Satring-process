import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { Building2, FolderTree, Loader2, Pencil, Plus, Save, Trash2, UserRound } from 'lucide-react';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { Controller, type UseFieldArrayReturn, type UseFormReturn } from 'react-hook-form';

import { HighlightsGrid, type Highlight } from './HighlightsGrid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import type { Department, DepartmentCascadeForm } from '@/lib/validation/department';
import type { ProcessSummary } from '@/lib/validation/process';
import { DEFAULT_ROLE_COLOR, type Role } from '@/lib/validation/role';

export type SecondaryPanelLabels = {
  title: { processes: string; departments: string };
  tabs: { ariaLabel: string; tooltip: string; processes: string; departments: string };
  processes: {
    loading: string;
    listAriaLabel: string;
    deleteAriaLabel: string;
    rename: { save: string; cancel: string; ariaLabel: string };
  };
  departments: {
    demoNotice: string;
    loading: string;
    errorFallback: string;
    listAriaLabel: string;
    colorLabel: string;
    deleteAriaLabel: string;
    updatedLabel: string;
    colorValueLabel: string;
    addRole: string;
    save: string;
    empty: { demo: string; standard: string };
    roles: {
      removeTitleSaved: string;
      removeTitleUnsaved: string;
      removeAriaLabel: string;
      empty: string;
    };
  };
};

export type LandingErrorMessages = {
  authRequired: string;
  process: { listFailed: string };
};

export type StatusMessages = {
  readerRestriction: string;
  createPrompt: string;
};

type SecondaryPanelProps = {
  highlights: readonly Highlight[];
  secondaryPanelTitle: string;
  isProcessesTabActive: boolean;
  isDepartmentsTabActive: boolean;
  createLabel: string;
  handleCreateProcess: () => void;
  handleCreateDepartment: () => void;
  isProcessEditorReadOnly: boolean;
  isCreating: boolean;
  isDepartmentActionsDisabled: boolean;
  isCreatingDepartment: boolean;
  isProcessManagementRestricted: boolean;
  statusMessages: StatusMessages;
  secondaryPanel: SecondaryPanelLabels;
  setActiveSecondaryTab: Dispatch<SetStateAction<'processes' | 'departments'>>;
  isProcessListUnauthorized: boolean;
  landingErrorMessages: LandingErrorMessages;
  processSummariesQuery: UseQueryResult<ProcessSummary[], Error>;
  hasProcesses: boolean;
  processSummaries: ProcessSummary[];
  currentProcessId: string | null;
  editingProcessId: string | null;
  setSelectedProcessId: Dispatch<SetStateAction<string | null>>;
  startEditingProcess: (process: ProcessSummary) => void;
  renameInputRef: MutableRefObject<HTMLInputElement | null>;
  renameDraft: string;
  setRenameDraft: Dispatch<SetStateAction<string>>;
  confirmRenameProcess: (processId: string) => void;
  cancelEditingProcess: () => void;
  deleteProcessMutation: UseMutationResult<void, Error, string>;
  handleDeleteProcess: (processId: string) => void;
  shouldUseDepartmentDemo: boolean;
  createDepartmentMutation: UseMutationResult<Department, Error, void>;
  departmentsQuery: UseQueryResult<Department[], Error>;
  departments: Department[];
  editingDepartmentId: string | null;
  isDeletingDepartment: boolean;
  deleteDepartmentId: string | null;
  formatDateTime: (date: string | number | Date | null | undefined) => string | null;
  departmentEditForm: UseFormReturn<DepartmentCascadeForm>;
  handleSaveDepartment: (values: DepartmentCascadeForm) => void;
  handleDeleteDepartment: (departmentId: string) => void;
  isSavingDepartment: boolean;
  departmentRoleFields: UseFieldArrayReturn<DepartmentCascadeForm, 'roles', 'id'>;
  isAddingDepartmentRole: boolean;
  handleAddRole: () => void;
  createDepartmentRoleMutation: UseMutationResult<Role, Error, { departmentId: string }>;
  saveDepartmentMutation: UseMutationResult<
    Department,
    Error,
    { departmentId: string; values: DepartmentCascadeForm }
  >;
  deleteDepartmentMutation: UseMutationResult<void, Error, { id: string }>;
  startEditingDepartment: (department: Department) => void;
  formatTemplateText: (template: string, value: string | null, token?: string) => string | null;
};

export function SecondaryPanel({
  highlights,
  secondaryPanelTitle,
  isProcessesTabActive,
  isDepartmentsTabActive,
  createLabel,
  handleCreateProcess,
  handleCreateDepartment,
  isProcessEditorReadOnly,
  isCreating,
  isDepartmentActionsDisabled,
  isCreatingDepartment,
  isProcessManagementRestricted,
  statusMessages,
  secondaryPanel,
  setActiveSecondaryTab,
  isProcessListUnauthorized,
  landingErrorMessages,
  processSummariesQuery,
  hasProcesses,
  processSummaries,
  currentProcessId,
  editingProcessId,
  setSelectedProcessId,
  startEditingProcess,
  renameInputRef,
  renameDraft,
  setRenameDraft,
  confirmRenameProcess,
  cancelEditingProcess,
  deleteProcessMutation,
  handleDeleteProcess,
  shouldUseDepartmentDemo,
  createDepartmentMutation,
  departmentsQuery,
  departments,
  editingDepartmentId,
  isDeletingDepartment,
  deleteDepartmentId,
  formatDateTime,
  departmentEditForm,
  handleSaveDepartment,
  handleDeleteDepartment,
  isSavingDepartment,
  departmentRoleFields,
  isAddingDepartmentRole,
  handleAddRole,
  createDepartmentRoleMutation,
  saveDepartmentMutation,
  deleteDepartmentMutation,
  startEditingDepartment,
  formatTemplateText
}: SecondaryPanelProps) {
  return (
    <>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{secondaryPanelTitle}</h2>
          </div>
          {isProcessesTabActive ? (
            <Button
              type="button"
              size="sm"
              onClick={handleCreateProcess}
              disabled={isProcessEditorReadOnly || isCreating}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {createLabel}
            </Button>
          ) : isDepartmentsTabActive ? (
            <Button
              type="button"
              size="sm"
              onClick={handleCreateDepartment}
              disabled={isDepartmentActionsDisabled || isCreatingDepartment}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              {isCreatingDepartment ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {createLabel}
            </Button>
          ) : null}
        </div>
        {isProcessesTabActive && isProcessManagementRestricted ? (
          <p className="text-xs text-slate-500">{statusMessages.readerRestriction}</p>
        ) : null}
        <div className="flex flex-col gap-2" aria-live="polite">
          <div
            className="flex items-center gap-1.5 rounded-2xl bg-slate-100 p-1.5 shadow-inner ring-1 ring-inset ring-slate-200"
            role="tablist"
            aria-label={secondaryPanel.tabs.ariaLabel}
          >
            <button
              type="button"
              id="processes-tab"
              role="tab"
              aria-selected={isProcessesTabActive}
              aria-controls="processes-panel"
              onClick={() => setActiveSecondaryTab('processes')}
              title={secondaryPanel.tabs.tooltip}
              className={cn(
                'group relative flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
                isProcessesTabActive
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200'
                  : 'text-slate-600 hover:bg-white/70'
              )}
            >
              <FolderTree className="h-3.5 w-3.5" />
              {secondaryPanel.tabs.processes}
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-slate-900 transition-opacity',
                  isProcessesTabActive ? 'opacity-100' : 'opacity-0'
                )}
              />
            </button>
            <button
              type="button"
              id="departments-tab"
              role="tab"
              aria-selected={isDepartmentsTabActive}
              aria-controls="departments-panel"
              onClick={() => setActiveSecondaryTab('departments')}
              title={secondaryPanel.tabs.tooltip}
              className={cn(
                'group relative flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
                isDepartmentsTabActive
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200'
                  : 'text-slate-600 hover:bg-white/70'
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              {secondaryPanel.tabs.departments}
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-slate-900 transition-opacity',
                  isDepartmentsTabActive ? 'opacity-100' : 'opacity-0'
                )}
              />
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <div
              role="tabpanel"
              id="processes-panel"
              aria-labelledby="processes-tab"
              hidden={!isProcessesTabActive}
              className={cn('h-full', !isProcessesTabActive && 'hidden')}
            >
              {isProcessListUnauthorized ? (
                <p className="text-sm text-slate-600">{landingErrorMessages.authRequired}</p>
              ) : processSummariesQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {secondaryPanel.processes.loading}
                </div>
              ) : processSummariesQuery.isError ? (
                <p className="text-sm text-red-600">
                  {processSummariesQuery.error instanceof Error
                    ? processSummariesQuery.error.message
                    : landingErrorMessages.process.listFailed}
                </p>
              ) : hasProcesses ? (
                <ul role="tree" aria-label={secondaryPanel.processes.listAriaLabel} className="space-y-2">
                  {processSummaries.map((summary) => {
                    const isSelected = summary.id === currentProcessId;
                    const isEditing = editingProcessId === summary.id;
                    return (
                      <li key={summary.id} role="treeitem" aria-selected={isSelected} className="focus:outline-none">
                        <div
                          role={isEditing ? undefined : 'button'}
                          tabIndex={isEditing ? undefined : 0}
                          onClick={
                            isEditing
                              ? undefined
                              : () => {
                                  setSelectedProcessId(summary.id);
                                }
                          }
                          onDoubleClick={
                            isEditing || isProcessEditorReadOnly
                              ? undefined
                              : () => startEditingProcess(summary)
                          }
                          onKeyDown={
                            isEditing
                              ? undefined
                              : (event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    setSelectedProcessId(summary.id);
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
                                      ref={renameInputRef}
                                      value={renameDraft}
                                      onChange={(event) => setRenameDraft(event.target.value)}
                                      className="h-8 w-40 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                                    />
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => confirmRenameProcess(summary.id)}
                                        className="inline-flex h-8 items-center justify-center rounded-md bg-slate-900 px-2 text-xs font-medium text-white hover:bg-slate-800"
                                      >
                                        {secondaryPanel.processes.rename.save}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEditingProcess}
                                        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                      >
                                        {secondaryPanel.processes.rename.cancel}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-sm font-medium text-slate-900 leading-snug break-words overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                                      {summary.title}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                            {!isEditing ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEditingProcess(summary)}
                                  disabled={isProcessEditorReadOnly}
                                  className={cn(
                                    'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900',
                                    isProcessEditorReadOnly && 'cursor-not-allowed opacity-40 hover:border-transparent hover:bg-transparent'
                                  )}
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">{secondaryPanel.processes.rename.ariaLabel}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProcess(summary.id)}
                                  disabled={
                                    isProcessEditorReadOnly ||
                                    (deleteProcessMutation.isPending && deleteProcessMutation.variables === summary.id)
                                  }
                                  className={cn(
                                    'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-red-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60',
                                    isProcessEditorReadOnly && 'cursor-not-allowed opacity-40 hover:border-transparent hover:bg-transparent hover:text-red-500'
                                  )}
                                >
                                  {deleteProcessMutation.isPending && deleteProcessMutation.variables === summary.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                  <span className="sr-only">{secondaryPanel.processes.deleteAriaLabel}</span>
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">
                  {isProcessManagementRestricted ? statusMessages.readerRestriction : statusMessages.createPrompt}
                </p>
              )}
            </div>
            <div
              role="tabpanel"
              id="departments-panel"
              aria-labelledby="departments-tab"
              hidden={!isDepartmentsTabActive}
              className={cn('h-full', !isDepartmentsTabActive && 'hidden')}
            >
              <div className="space-y-4">
                {shouldUseDepartmentDemo ? (
                  <p className="text-sm text-slate-600">{secondaryPanel.departments.demoNotice}</p>
                ) : null}
                {!shouldUseDepartmentDemo && createDepartmentMutation.isError ? (
                  <p className="text-xs text-red-600">{createDepartmentMutation.error?.message}</p>
                ) : null}
                {!shouldUseDepartmentDemo && departmentsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {secondaryPanel.departments.loading}
                  </div>
                ) : !shouldUseDepartmentDemo && departmentsQuery.isError ? (
                  <p className="text-sm text-red-600">
                    {departmentsQuery.error instanceof Error
                      ? departmentsQuery.error.message
                      : secondaryPanel.departments.errorFallback}
                  </p>
                ) : departments.length > 0 ? (
                  <ul role="tree" aria-label={secondaryPanel.departments.listAriaLabel} className="department-tree flex flex-col gap-3">
                    {departments.map((department) => {
                      const isEditingDepartment = editingDepartmentId === department.id;
                      const isDeletingCurrent = isDeletingDepartment && deleteDepartmentId === department.id;
                      const isExpanded = isEditingDepartment;
                      const isCollapsed = !isExpanded;
                      const updatedLabel = formatDateTime(department.updatedAt);
                      const colorInputId = `department-color-${department.id}`;
                      return (
                        <li
                          key={department.id}
                          role="treeitem"
                          aria-expanded={isExpanded}
                          aria-selected={isEditingDepartment}
                          className="department-node"
                          data-collapsed={isCollapsed ? 'true' : 'false'}
                        >
                          <Card
                            className={cn(
                              'border-slate-200 bg-white/90 shadow-sm transition focus-within:ring-2 focus-within:ring-slate-900/20',
                              isEditingDepartment ? 'border-slate-900 ring-2 ring-slate-900/20' : 'hover:border-slate-300'
                            )}
                          >
                            <CardContent
                              className={cn(
                                'flex gap-3 transition',
                                isEditingDepartment ? 'flex-col p-3.5' : 'items-center p-2.5'
                              )}
                            >
                              {isEditingDepartment ? (
                                <form
                                  onSubmit={departmentEditForm.handleSubmit(handleSaveDepartment)}
                                  className="flex w-full flex-col gap-3"
                                  data-entity-type="department"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center">
                                      <label htmlFor={colorInputId} className="sr-only">
                                        {secondaryPanel.departments.colorLabel}
                                      </label>
                                      <input
                                        id={colorInputId}
                                        type="color"
                                        {...departmentEditForm.register('color')}
                                        disabled={isSavingDepartment}
                                        className="h-9 w-9 cursor-pointer rounded-md border border-slate-300 bg-white p-1 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                                        aria-describedby={
                                          departmentEditForm.formState.errors.color
                                            ? `${colorInputId}-error`
                                            : undefined
                                        }
                                      />
                                    </div>
                                    <Input
                                      {...departmentEditForm.register('name')}
                                      autoFocus
                                      disabled={isSavingDepartment}
                                      className="h-9 min-w-[12rem] flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                                    />
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleDeleteDepartment(department.id)}
                                      disabled={isDepartmentActionsDisabled || isDeletingCurrent || isSavingDepartment}
                                      className="ml-auto h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                                    >
                                      {isDeletingCurrent ? (
                                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                                      )}
                                      <span className="sr-only">{secondaryPanel.departments.deleteAriaLabel}</span>
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
                                            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
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
                                                      onChange={(event) =>
                                                        roleColorControl.onChange(event.target.value.toUpperCase())
                                                      }
                                                      onBlur={roleColorControl.onBlur}
                                                      ref={roleColorControl.ref}
                                                      disabled={isSavingDepartment}
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
                                                      disabled={isSavingDepartment}
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
                                                disabled={isSavingDepartment || isAddingDepartmentRole}
                                                className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                                                title={
                                                  field.roleId
                                                    ? secondaryPanel.departments.roles.removeTitleSaved
                                                    : secondaryPanel.departments.roles.removeTitleUnsaved
                                                }
                                              >
                                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                                                <span className="sr-only">{secondaryPanel.departments.roles.removeAriaLabel}</span>
                                              </Button>
                                            </div>
                                            {roleNameError ? (
                                              <p className="text-xs text-red-600">{roleNameError.message}</p>
                                            ) : null}
                                            {roleColorError ? (
                                              <p id={`${roleColorInputId}-error`} className="text-xs text-red-600">
                                                {roleColorError.message}
                                              </p>
                                            ) : null}
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <p className="text-xs text-slate-500">{secondaryPanel.departments.roles.empty}</p>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddRole}
                                        disabled={
                                          isSavingDepartment ||
                                          isAddingDepartmentRole ||
                                          !editingDepartmentId ||
                                          isDepartmentActionsDisabled
                                        }
                                        className="inline-flex h-8 items-center gap-1 rounded-md border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                      >
                                        {isAddingDepartmentRole ? (
                                          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Plus className="h-3.5 w-3.5" />
                                        )}
                                        {secondaryPanel.departments.addRole}
                                      </Button>
                                      <Button
                                        type="submit"
                                        size="sm"
                                        disabled={isSavingDepartment || isAddingDepartmentRole}
                                        className="inline-flex h-8 items-center gap-1 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                                      >
                                        {isSavingDepartment ? (
                                          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Save aria-hidden="true" className="h-3.5 w-3.5" />
                                        )}
                                        {secondaryPanel.departments.save}
                                      </Button>
                                    </div>
                                    <div className="space-y-1">
                                      {createDepartmentRoleMutation.isError ? (
                                        <p className="text-xs text-red-600">{createDepartmentRoleMutation.error?.message}</p>
                                      ) : null}
                                      {saveDepartmentMutation.isError ? (
                                        <p className="text-xs text-red-600">{saveDepartmentMutation.error?.message}</p>
                                      ) : null}
                                    </div>
                                  </div>
                                </form>
                              ) : (
                                <div
                                  className={cn(
                                    'flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-transparent px-1 py-1 transition',
                                    !(isDepartmentActionsDisabled || isDeletingCurrent) &&
                                      'cursor-pointer hover:border-slate-300 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400'
                                  )}
                                  role="button"
                                  tabIndex={isDepartmentActionsDisabled || isDeletingCurrent ? -1 : 0}
                                  aria-disabled={isDepartmentActionsDisabled || isDeletingCurrent}
                                  onClick={() => {
                                    if (isDepartmentActionsDisabled || isDeletingCurrent) {
                                      return;
                                    }
                                    startEditingDepartment(department);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      if (isDepartmentActionsDisabled || isDeletingCurrent) {
                                        return;
                                      }
                                      startEditingDepartment(department);
                                    }
                                  }}
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <span
                                      className="inline-flex h-8 w-8 shrink-0 rounded-md border border-slate-200 shadow-inner"
                                      style={{ backgroundColor: department.color }}
                                      aria-hidden="true"
                                    />
                                    <span className="sr-only">
                                      {formatTemplateText(
                                        secondaryPanel.departments.colorValueLabel,
                                        department.color,
                                        '{color}'
                                      )}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-slate-900">{department.name}</p>
                                      {updatedLabel ? (
                                        <p className="text-xs text-slate-500">
                                          {formatTemplateText(
                                            secondaryPanel.departments.updatedLabel,
                                            updatedLabel
                                          )}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              )}
                              {!isEditingDepartment ? (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeleteDepartment(department.id);
                                  }}
                                  disabled={isDepartmentActionsDisabled || isDeletingCurrent}
                                  className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                                >
                                  {isDeletingCurrent ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                  <span className="sr-only">{secondaryPanel.departments.deleteAriaLabel}</span>
                                </Button>
                              ) : null}
                            </CardContent>
                          </Card>
                          {deleteDepartmentMutation.isError && deleteDepartmentId === department.id ? (
                            <p className="mt-2 text-xs text-red-600">{deleteDepartmentMutation.error?.message}</p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : shouldUseDepartmentDemo ? (
                  <p className="text-sm text-slate-600">{secondaryPanel.departments.empty.demo}</p>
                ) : (
                  <p className="text-sm text-slate-600">{secondaryPanel.departments.empty.standard}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <HighlightsGrid items={highlights} />
    </>
  );
}
