import { z } from 'zod';

export const ONBOARDING_STEPS = [
  'createDepartment',
  'nameDepartment',
  'createRole',
  'nameRole',
  'openProcessTab',
  'createProcess',
  'saveProcess',
  'addStep',
  'assignStep'
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number];

export const onboardingStepKeySchema = z.enum(ONBOARDING_STEPS);

export const buildDefaultOnboardingStepState = (): Record<OnboardingStepKey, boolean> =>
  ONBOARDING_STEPS.reduce(
    (accumulator, step) => ({
      ...accumulator,
      [step]: false
    }),
    {} as Record<OnboardingStepKey, boolean>
  );

export const ONBOARDING_STEP_CONTENT: Record<OnboardingStepKey, { targetId: string; title: string; description: string }> = {
  createDepartment: {
    targetId: 'onboarding-create-department',
    title: 'Créez un département',
    description: 'Ajoutez votre première équipe pour organiser les rôles du processus.'
  },
  nameDepartment: {
    targetId: 'onboarding-department-name',
    title: 'Nommez le département',
    description: 'Donnez un nom clair à ce département pour l’identifier facilement.'
  },
  createRole: {
    targetId: 'onboarding-add-role',
    title: 'Ajoutez un rôle',
    description: 'Ajoutez un rôle dans le département actif pour préparer les affectations.'
  },
  nameRole: {
    targetId: 'onboarding-role-name',
    title: 'Nommez le rôle',
    description: 'Choisissez un intitulé précis afin de faciliter les affectations.'
  },
  openProcessTab: {
    targetId: 'processes-tab',
    title: 'Ouvrez les processus',
    description: 'Passez à l’onglet Processus pour créer et organiser vos étapes.'
  },
  createProcess: {
    targetId: 'onboarding-create-process',
    title: 'Créez un processus',
    description: 'Créez un nouveau processus puis renommez-le avant d’ajouter vos étapes.'
  },
  saveProcess: {
    targetId: 'onboarding-save-process',
    title: 'Sauvegardez le processus',
    description: 'Enregistrez vos changements pour confirmer le nom du processus.'
  },
  addStep: {
    targetId: 'onboarding-add-step',
    title: 'Ajoutez une étape',
    description: "Insérez une action ou une décision pour décrire le parcours de votre processus."
  },
  assignStep: {
    targetId: 'onboarding-step-assignment',
    title: 'Assignez l’étape',
    description: 'Sélectionnez un département ou un rôle pour l’étape courante.'
  }
};
