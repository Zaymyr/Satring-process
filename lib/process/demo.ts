import { getInviteDemoDepartments } from '@/lib/department/demo';
import { DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import type { ProcessResponse, ProcessStep, ProcessSummary } from '@/lib/validation/process';

const INVITE_DEMO_UPDATED_AT = '2024-01-01T12:00:00.000Z';

export const INVITE_DEMO_PROCESS_ID = '2cf00590-5c6d-4b62-a71d-4b5a1a0d6f0e';

const cloneStep = (step: ProcessStep): ProcessStep => ({
  ...step,
  yesTargetId: step.yesTargetId,
  noTargetId: step.noTargetId
});

const buildInviteDemoSteps = (): ProcessStep[] => {
  const departments = getInviteDemoDepartments();

  const operations = departments.find((department) => department.name === 'Opérations');
  const support = departments.find((department) => department.name === 'Support client');

  const projectManager = operations?.roles.find((role) => role.name === 'Chef de projet');
  const qualityAnalyst = operations?.roles.find((role) => role.name === 'Analyste qualité');
  const supportAdvisor = support?.roles.find((role) => role.name === 'Conseiller support');
  const supportLead = support?.roles.find((role) => role.name === 'Lead support');

  return [
    {
      id: 'start',
      label: 'Commencer',
      type: 'start',
      departmentId: null,
      draftDepartmentName: null,
      roleId: null,
      draftRoleName: null,
      yesTargetId: 'qualifier',
      noTargetId: null
    },
    {
      id: 'qualifier',
      label: 'Qualifier la demande',
      type: 'action',
      departmentId: support?.id ?? null,
      draftDepartmentName: null,
      roleId: supportAdvisor?.id ?? null,
      draftRoleName: null,
      yesTargetId: 'prioriser',
      noTargetId: null
    },
    {
      id: 'prioriser',
      label: 'Escalade nécessaire ?',
      type: 'decision',
      departmentId: support?.id ?? null,
      draftDepartmentName: null,
      roleId: supportLead?.id ?? null,
      draftRoleName: null,
      yesTargetId: 'planifier',
      noTargetId: 'resoudre'
    },
    {
      id: 'planifier',
      label: 'Planifier l’intervention',
      type: 'action',
      departmentId: operations?.id ?? null,
      draftDepartmentName: null,
      roleId: projectManager?.id ?? null,
      draftRoleName: null,
      yesTargetId: 'suivi_qualite',
      noTargetId: null
    },
    {
      id: 'resoudre',
      label: 'Résoudre la demande',
      type: 'action',
      departmentId: support?.id ?? null,
      draftDepartmentName: null,
      roleId: supportAdvisor?.id ?? null,
      draftRoleName: null,
      yesTargetId: 'suivi_qualite',
      noTargetId: null
    },
    {
      id: 'suivi_qualite',
      label: 'Suivi qualité',
      type: 'action',
      departmentId: operations?.id ?? null,
      draftDepartmentName: null,
      roleId: qualityAnalyst?.id ?? null,
      draftRoleName: null,
      yesTargetId: 'cloturer',
      noTargetId: null
    },
    {
      id: 'cloturer',
      label: 'Clôturer le ticket',
      type: 'finish',
      departmentId: support?.id ?? null,
      draftDepartmentName: null,
      roleId: supportLead?.id ?? null,
      draftRoleName: null,
      yesTargetId: null,
      noTargetId: null
    }
  ];
};

const INVITE_DEMO_PROCESS: ProcessResponse = {
  id: INVITE_DEMO_PROCESS_ID,
  title: `${DEFAULT_PROCESS_TITLE} — Exemple`,
  steps: buildInviteDemoSteps(),
  updatedAt: INVITE_DEMO_UPDATED_AT
};

export const getInviteDemoProcess = (): ProcessResponse => ({
  ...INVITE_DEMO_PROCESS,
  steps: INVITE_DEMO_PROCESS.steps.map(cloneStep)
});

export const getInviteDemoProcessSummaries = (): ProcessSummary[] => [
  {
    id: INVITE_DEMO_PROCESS_ID,
    title: INVITE_DEMO_PROCESS.title,
    updatedAt: INVITE_DEMO_UPDATED_AT
  }
];

export const getInviteDemoProcessById = (processId: string): ProcessResponse | null => {
  if (processId !== INVITE_DEMO_PROCESS_ID) {
    return null;
  }

  return getInviteDemoProcess();
};
