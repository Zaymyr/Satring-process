import { z } from 'zod';

export const ONBOARDING_STEPS = [
  'createDepartment',
  'createRole',
  'createProcess',
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
  createRole: {
    targetId: 'onboarding-add-role',
    title: 'Ajoutez un rôle',
    description: 'Ajoutez un rôle dans le département actif pour préparer les affectations.'
  },
  createProcess: {
    targetId: 'onboarding-create-process',
    title: 'Créez un processus',
    description: 'Initialisez un processus afin de pouvoir ajouter des étapes.'
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
