import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { Building2, FolderTree, Loader2, Plus, Trash2 } from 'lucide-react';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { type UseFieldArrayReturn, type UseFormReturn } from 'react-hook-form';

import { HighlightsGrid, type Highlight } from './HighlightsGrid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import type { ApiError } from '@/lib/api/errors';
import type { DepartmentWithDraftStatus } from './LandingPanelsShell';
import type { Department, DepartmentCascadeForm } from '@/lib/validation/department';
import type { ProcessSummary } from '@/lib/validation/process';
import type { Role } from '@/lib/validation/role';
import { ProcessListPanel } from '@/components/landing/LandingPanels/ProcessListPanel';
import { DepartmentEditor } from '@/components/landing/LandingPanels/DepartmentEditor';

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
    draftBadge: string;
    roleDraftBadge: string;
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
  createDepartmentMutation: UseMutationResult<Department, ApiError, void>;
  departmentsQuery: UseQueryResult<Department[], Error>;
  departments: DepartmentWithDraftStatus[];
  editingDepartmentId: string | null;
  isDeletingDepartment: boolean;
  deleteDepartmentId: string | null;
  formatDateTime: (date: string | number | Date | null | undefined) => string | null;
  departmentEditForm: UseFormReturn<DepartmentCascadeForm>;
  handleDeleteDepartment: (departmentId: string) => void;
  isSaving: boolean;
  saveError: string | null;
  departmentRoleFields: UseFieldArrayReturn<DepartmentCascadeForm, 'roles', 'id'>;
  isAddingDepartmentRole: boolean;
  handleAddRole: () => void;
  createDepartmentRoleMutation: UseMutationResult<Role, ApiError, { departmentId: string }>;
  deleteDepartmentMutation: UseMutationResult<void, ApiError, { id: string }>;
  startEditingDepartment: (department: DepartmentWithDraftStatus) => void;
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
  handleDeleteDepartment,
  isSaving,
  saveError,
  departmentRoleFields,
  isAddingDepartmentRole,
  handleAddRole,
  createDepartmentRoleMutation,
  deleteDepartmentMutation,
  startEditingDepartment,
  formatTemplateText
}: SecondaryPanelProps) {
  const processListErrorMessage =
    processSummariesQuery.isError && !isProcessListUnauthorized
      ? processSummariesQuery.error instanceof Error
        ? processSummariesQuery.error.message
        : landingErrorMessages.process.listFailed
      : isProcessListUnauthorized
        ? landingErrorMessages.authRequired
        : null;
  const isProcessListLoading = processSummariesQuery.isLoading;

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
              <ProcessListPanel
                isUnauthorized={isProcessListUnauthorized}
                isLoading={isProcessListLoading}
                errorMessage={processListErrorMessage}
                hasProcesses={hasProcesses}
                processes={processSummaries}
                currentProcessId={currentProcessId}
                editingProcessId={editingProcessId}
                isProcessEditorReadOnly={isProcessEditorReadOnly}
                renameInputRef={renameInputRef}
                renameDraft={renameDraft}
                onRenameDraftChange={setRenameDraft}
                onSelectProcess={setSelectedProcessId}
                onStartEditing={startEditingProcess}
                onConfirmRename={confirmRenameProcess}
                onCancelEditing={cancelEditingProcess}
                onDeleteProcess={handleDeleteProcess}
                deleteProcessMutation={deleteProcessMutation}
                labels={secondaryPanel.processes}
                statusMessages={statusMessages}
                isProcessManagementRestricted={isProcessManagementRestricted}
              />
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
                              'bg-white/90 shadow-sm transition focus-within:ring-2 focus-within:ring-slate-900/20',
                              department.isDraft ? 'border-dashed border-slate-300' : 'border-slate-200',
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
                                <DepartmentEditor
                                  colorInputId={colorInputId}
                                  labels={secondaryPanel.departments}
                                  draftBadgeLabel={secondaryPanel.departments.draftBadge}
                                  roleDraftBadgeLabel={secondaryPanel.departments.roleDraftBadge}
                                  roleDraftLookup={new Map(
                                    department.roles.map((role) => [
                                      role.id,
                                      Boolean((role as Role & { isDraft?: boolean }).isDraft)
                                    ])
                                  )}
                                  isDraft={department.isDraft}
                                  departmentEditForm={departmentEditForm}
                                  departmentRoleFields={departmentRoleFields}
                                  isSaving={isSaving}
                                  isActionsDisabled={isDepartmentActionsDisabled || !editingDepartmentId}
                                  isAddingRole={isAddingDepartmentRole}
                                  isDeleting={isDeletingCurrent}
                                  onDelete={() => handleDeleteDepartment(department.id)}
                                  onAddRole={handleAddRole}
                                />
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
                                      <div className="flex items-center gap-2">
                                        <p className="truncate text-sm font-medium text-slate-900">
                                          {department.name}
                                        </p>
                                        {department.isDraft ? (
                                          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                            {secondaryPanel.departments.draftBadge}
                                          </span>
                                        ) : null}
                                      </div>
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
              <div className="mt-4 flex flex-col items-end gap-2 border-t border-slate-200 pt-4">
                <div className="space-y-1 text-right">
                  {createDepartmentRoleMutation.isError ? (
                    <p className="text-xs text-red-600">{createDepartmentRoleMutation.error?.message}</p>
                  ) : null}
                  {saveError ? (
                    <p className="text-xs text-red-600">{saveError}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <HighlightsGrid items={highlights} />
    </>
  );
}
