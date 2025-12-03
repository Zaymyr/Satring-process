import type { Dispatch, DragEvent, ReactNode, SetStateAction } from 'react';
import { useId, useState } from 'react';
import { GitBranch, GripVertical, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ProcessControls } from '@/components/landing/LandingPanels/ProcessControls';
import { RolePicker, type RolePickerMessages } from '@/components/landing/LandingPanels/RolePicker';
import { cn } from '@/lib/utils/cn';
import type { RoleLookupEntry, Step } from '@/lib/process/types';
import type { ProcessStep, StepType } from '@/lib/validation/process';
import type { Department } from '@/lib/validation/department';

type PrimaryPanelLabels = {
  addAction: string;
  addDecision: string;
  iaDescription: string;
  tabs: {
    ariaLabel: string;
    ia: string;
    manual: string;
  };
};

type TooltipLabels = {
  type: string;
  department: string;
  role: string;
};

type PrimaryPanelProps = {
  processTitle: string;
  primaryPanel: PrimaryPanelLabels;
  iaPanel: ReactNode;
  addStep: (type: Extract<StepType, 'action' | 'decision'>) => void;
  isProcessEditorReadOnly: boolean;
  steps: ProcessStep[];
  draggedStepId: string | null;
  selectedStepId: string | null;
  setSelectedStepId: Dispatch<SetStateAction<string | null>>;
  getStepDisplayLabel: (step: Step) => string;
  getStepDepartmentLabel: (step: Step) => string;
  getStepRoleLabel: (step: Step) => string;
  roleLookup: {
    byId: Map<string, RoleLookupEntry>;
    byDepartment: Map<string, RoleLookupEntry[]>;
    all: RoleLookupEntry[];
  };
  tooltipLabels: TooltipLabels;
  stepTypeLabels: Record<StepType, string>;
  hasRoles: boolean;
  rolePickerMessages: RolePickerMessages;
  hasDepartments: boolean;
  departments: Department[];
  updateStepLabel: (id: string, label: string) => void;
  updateStepDepartment: (id: string, departmentId: string | null) => void;
  updateStepRole: (id: string, roleId: string | null) => void;
  stepPositions: Map<string, number>;
  updateDecisionBranch: (id: string, branch: 'yes' | 'no', targetId: string | null) => void;
  handleStepDragOver: (event: DragEvent<HTMLElement>, overStepId: string) => void;
  handleStepDrop: (event: DragEvent<HTMLElement>) => void;
  handleStepDragStart: (event: DragEvent<HTMLButtonElement>, stepId: string) => void;
  handleStepDragEnd: () => void;
  handleStepListDragOverEnd: (event: DragEvent<HTMLDivElement>) => void;
  removeStep: (id: string) => void;
  handleSave: () => void;
  isSaveDisabled: boolean;
  saveButtonLabel: string;
  statusToneClass: string;
  statusMessage: ReactNode;
  missingAssignments: {
    departmentsLabel: string;
    rolesLabel: string;
    departments: string[];
    roles: string[];
  };
  isDirty: boolean;
};

export function PrimaryPanel({
  processTitle,
  primaryPanel,
  addStep,
  isProcessEditorReadOnly,
  steps,
  draggedStepId,
  selectedStepId,
  setSelectedStepId,
  getStepDisplayLabel,
  getStepDepartmentLabel,
  getStepRoleLabel,
  roleLookup,
  tooltipLabels,
  stepTypeLabels,
  hasRoles,
  rolePickerMessages,
  hasDepartments,
  departments,
  updateStepLabel,
  updateStepDepartment,
  updateStepRole,
  stepPositions,
  updateDecisionBranch,
  handleStepDragOver,
  handleStepDrop,
  handleStepDragStart,
  handleStepDragEnd,
  handleStepListDragOverEnd,
  removeStep,
  handleSave,
  isSaveDisabled,
  saveButtonLabel,
  statusToneClass,
  statusMessage,
  missingAssignments,
  isDirty,
  iaPanel
}: PrimaryPanelProps) {
  const tabsListId = useId();
  const [activeTab, setActiveTab] = useState<'ia' | 'manual'>('manual');

  const manualPanelId = `${tabsListId}-manual-panel`;
  const iaPanelId = `${tabsListId}-ia-panel`;

  return (
    <div className="flex h-full flex-col gap-4">
      <div
        role="tablist"
        aria-label={primaryPanel.tabs.ariaLabel}
        className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white/80 p-1 text-sm font-medium text-slate-700"
      >
        <button
          id={`${tabsListId}-manual-tab`}
          role="tab"
          aria-selected={activeTab === 'manual'}
          aria-controls={manualPanelId}
          type="button"
          onClick={() => setActiveTab('manual')}
          className={cn(
            'flex items-center justify-center rounded-lg px-3 py-2 transition',
            activeTab === 'manual'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-700 hover:bg-slate-100'
          )}
        >
          {primaryPanel.tabs.manual}
        </button>
        <button
          id={`${tabsListId}-ia-tab`}
          role="tab"
          aria-selected={activeTab === 'ia'}
          aria-controls={iaPanelId}
          type="button"
          onClick={() => setActiveTab('ia')}
          className={cn(
            'flex items-center justify-center rounded-lg px-3 py-2 transition',
            activeTab === 'ia'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-700 hover:bg-slate-100'
          )}
        >
          {primaryPanel.tabs.ia}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <section
          id={manualPanelId}
          role="tabpanel"
          aria-labelledby={`${tabsListId}-manual-tab`}
          aria-hidden={activeTab !== 'manual'}
          className={cn('flex h-full flex-col gap-4', activeTab !== 'manual' && 'hidden')}
        >
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="col-span-2 row-span-2 flex items-center sm:col-span-1 sm:row-span-2">
              <h1 className="text-base font-semibold text-slate-900">{processTitle}</h1>
            </div>
            <Button
              type="button"
              onClick={() => addStep('action')}
              disabled={isProcessEditorReadOnly}
              className="h-10 w-full rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800"
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              {primaryPanel.addAction}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => addStep('decision')}
              disabled={isProcessEditorReadOnly}
              className="h-10 w-full rounded-md border-slate-300 bg-white px-3 text-sm text-slate-900 hover:bg-slate-50"
            >
              <GitBranch className="mr-2 h-3.5 w-3.5" />
              {primaryPanel.addDecision}
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white/75 p-3 pr-1 shadow-inner sm:pr-1.5">
              <div className="space-y-2.5">
                {steps.map((step, index) => {
                  const isRemovable = step.type === 'action' || step.type === 'decision';
                  const stepPosition = index + 1;
                  const availableTargets = steps.filter((candidate) => candidate.id !== step.id);
                  const isDragging = draggedStepId === step.id;
                  const isFixedStep = step.type === 'start' || step.type === 'finish';
                  const canReorderStep = !isFixedStep && !isProcessEditorReadOnly;
                  const isSelectedStep = selectedStepId === step.id;
                  const displayLabel = getStepDisplayLabel(step);
                  const departmentName = getStepDepartmentLabel(step);
                  const roleName = getStepRoleLabel(step);
                  const tooltipTitle = `${tooltipLabels.type}: ${stepTypeLabels[step.type]}\n${tooltipLabels.department}: ${departmentName}\n${tooltipLabels.role}: ${roleName}`;
                  const availableRoleEntries =
                    step.departmentId !== null
                      ? roleLookup.byDepartment.get(step.departmentId) ?? []
                      : roleLookup.all;
                  const roleHelperText = (() => {
                    if (!hasRoles) {
                      return rolePickerMessages.addRole;
                    }

                    if (step.departmentId && availableRoleEntries.length === 0) {
                      return rolePickerMessages.noDepartmentRoles;
                    }

                    if (!step.departmentId && hasRoles) {
                      return rolePickerMessages.chooseRoleForDepartment;
                    }

                    return null;
                  })();
                  const helperText =
                    roleHelperText &&
                    step.type !== 'start' &&
                    step.type !== 'finish' &&
                    roleHelperText !== rolePickerMessages.chooseRoleForDepartment
                      ? roleHelperText
                      : null;

                  return (
                    <Card
                      key={step.id}
                      title={tooltipTitle}
                      className={cn(
                        'border-slate-200 bg-white/90 shadow-sm transition',
                        isDragging
                          ? 'opacity-70 ring-2 ring-slate-300'
                          : isSelectedStep
                          ? 'border-slate-900 ring-2 ring-slate-900/20'
                          : 'hover:border-slate-300'
                      )}
                      onDragOver={(event) => handleStepDragOver(event, step.id)}
                      onDrop={handleStepDrop}
                      onClick={() => setSelectedStepId(step.id)}
                      onFocusCapture={() => setSelectedStepId(step.id)}
                      aria-selected={isSelectedStep}
                    >
                      <CardContent
                        className={cn(
                          'relative flex gap-2 p-2.5',
                          isSelectedStep ? 'items-start' : 'items-center gap-1.5 p-2'
                        )}
                      >
                        <div
                          className={cn(
                            'flex items-center',
                            isSelectedStep ? 'flex-col gap-2 pt-0.5' : 'flex-row gap-2'
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-full text-[0.65rem] font-semibold transition-colors',
                              isSelectedStep ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {stepPosition}
                          </span>
                          <button
                            type="button"
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-slate-100 text-slate-500 transition',
                              canReorderStep ? 'hover:border-slate-300 hover:bg-white' : 'cursor-not-allowed opacity-60'
                            )}
                            draggable={canReorderStep}
                            onDragStart={(event) => {
                              if (!canReorderStep) {
                                event.preventDefault();
                                return;
                              }
                              handleStepDragStart(event, step.id);
                            }}
                            onDragEnd={handleStepDragEnd}
                            aria-label={`Reorder ${getStepDisplayLabel(step)}`}
                            aria-grabbed={isDragging}
                            disabled={!canReorderStep}
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </button>
                          {isSelectedStep && isRemovable ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeStep(step.id)}
                              disabled={isProcessEditorReadOnly}
                              className="h-7 w-7 shrink-0 text-red-500 hover:text-red-600"
                              aria-label="Delete step"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                        {isSelectedStep ? (
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <Input
                              id={`step-${step.id}-label`}
                              value={step.label}
                              onChange={(event) => updateStepLabel(step.id, event.target.value)}
                              placeholder="Step label"
                              disabled={isProcessEditorReadOnly}
                              className="h-8 w-full border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50"
                            />
                            <div className="grid gap-1.5 sm:grid-cols-2">
                              <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                <span>Department</span>
                                <select
                                  value={step.departmentId ?? ''}
                                  onChange={(event) =>
                                    updateStepDepartment(
                                      step.id,
                                      event.target.value.length > 0 ? event.target.value : null
                                    )
                                  }
                                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 transition focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                  disabled={isProcessEditorReadOnly || !hasDepartments}
                                >
                                  <option value="">No department</option>
                                  {departments.map((department) => (
                                    <option key={department.id} value={department.id}>
                                      {department.name}
                                    </option>
                                  ))}
                                </select>
                                {!step.departmentId && step.draftDepartmentName ? (
                                  <span className="text-[0.6rem] font-normal normal-case tracking-normal text-slate-500">
                                    Suggested: {step.draftDepartmentName}
                                  </span>
                                ) : null}
                                {!hasDepartments ? (
                                  <span className="text-[0.6rem] font-normal normal-case tracking-normal text-slate-500">
                                    Add a department to assign it to this step.
                                  </span>
                                ) : null}
                              </label>
                              <RolePicker
                                step={step}
                                hasRoles={hasRoles}
                                roleEntries={availableRoleEntries}
                                messages={rolePickerMessages}
                                disabled={isProcessEditorReadOnly || !hasRoles}
                                onChange={(roleId) => updateStepRole(step.id, roleId)}
                                helperText={helperText}
                              />
                            </div>
                            {step.type === 'decision' ? (
                              <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                                <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                  <span>Yes branch</span>
                                  <select
                                    value={step.yesTargetId ?? ''}
                                    onChange={(event) =>
                                      updateDecisionBranch(step.id, 'yes', event.target.value || null)
                                    }
                                    disabled={isProcessEditorReadOnly}
                                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 transition focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                  >
                                    <option value="">Next step (default)</option>
                                    {availableTargets.map((candidate) => {
                                      const position = stepPositions.get(candidate.id);
                                      const optionLabel = position
                                        ? `${position}. ${getStepDisplayLabel(candidate)}`
                                        : getStepDisplayLabel(candidate);

                                      return (
                                        <option key={candidate.id} value={candidate.id}>
                                          {optionLabel}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </label>
                                <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                  <span>No branch</span>
                                  <select
                                    value={step.noTargetId ?? ''}
                                    onChange={(event) =>
                                      updateDecisionBranch(step.id, 'no', event.target.value || null)
                                    }
                                    disabled={isProcessEditorReadOnly}
                                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 transition focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                  >
                                    <option value="">Next step (default)</option>
                                    {availableTargets.map((candidate) => {
                                      const position = stepPositions.get(candidate.id);
                                      const optionLabel = position
                                        ? `${position}. ${getStepDisplayLabel(candidate)}`
                                        : getStepDisplayLabel(candidate);

                                      return (
                                        <option key={candidate.id} value={candidate.id}>
                                          {optionLabel}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </label>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="truncate text-sm font-medium text-slate-900" title={displayLabel}>
                              {displayLabel}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                                {departmentName}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                                {roleName}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                <div
                  role="presentation"
                  className={cn(
                    'h-4 rounded border border-dashed border-transparent transition',
                    draggedStepId ? 'border-slate-300 bg-white/60' : 'border-transparent'
                  )}
                  onDragOver={handleStepListDragOverEnd}
                  onDrop={handleStepDrop}
                >
                  {draggedStepId ? (
                    <span className="sr-only">Drop here to place the step at the end</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <ProcessControls
            onSave={handleSave}
            isSaveDisabled={isSaveDisabled}
            saveButtonLabel={saveButtonLabel}
            statusToneClass={statusToneClass}
            statusMessage={statusMessage}
            missingAssignments={missingAssignments}
            isDirty={isDirty}
          />
      </section>

        <section
          id={iaPanelId}
          role="tabpanel"
          aria-labelledby={`${tabsListId}-ia-tab`}
          aria-hidden={activeTab !== 'ia'}
          className={cn(
            'flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-inner',
            activeTab !== 'ia' && 'hidden'
          )}
        >
          <div className="flex-1 min-h-0">{iaPanel}</div>
        </section>
      </div>
    </div>
  );
}
