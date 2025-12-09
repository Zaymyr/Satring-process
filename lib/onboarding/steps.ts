import { z } from 'zod';

import type { Locale } from '@/lib/i18n/dictionaries';

export const ONBOARDING_STEPS = [
  'chooseLanguage',
  'createDepartment',
  'nameDepartment',
  'createRole',
  'nameRole',
  'openProcessTab',
  'createProcess',
  'saveProcess',
  'addStep',
  'assignStep',
  'assignRole'
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

type OnboardingStepContent = {
  targetId: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
};

export const ONBOARDING_STEP_CONTENT: Record<OnboardingStepKey, OnboardingStepContent> = {
  chooseLanguage: {
    targetId: 'language-selector-modal',
    title: {
      en: 'Choose your language',
      fr: 'Choisissez votre langue'
    },
    description: {
      en: 'Pick English or French to tailor the onboarding guidance.',
      fr: 'Sélectionnez l’anglais ou le français pour personnaliser le tutoriel.'
    }
  },
  createDepartment: {
    targetId: 'onboarding-create-department',
    title: {
      en: 'Create a department',
      fr: 'Créez un département'
    },
    description: {
      en: 'Add your first team to organize roles in the process.',
      fr: 'Ajoutez votre première équipe pour organiser les rôles du processus.'
    }
  },
  nameDepartment: {
    targetId: 'onboarding-department-name',
    title: {
      en: 'Name the department',
      fr: 'Nommez le département'
    },
    description: {
      en: 'Give this department a clear name so it is easy to identify.',
      fr: 'Donnez un nom clair à ce département pour l’identifier facilement.'
    }
  },
  createRole: {
    targetId: 'onboarding-add-role',
    title: {
      en: 'Add a role',
      fr: 'Ajoutez un rôle'
    },
    description: {
      en: 'Create a role in the active department to prepare assignments.',
      fr: 'Ajoutez un rôle dans le département actif pour préparer les affectations.'
    }
  },
  nameRole: {
    targetId: 'onboarding-role-name',
    title: {
      en: 'Name the role',
      fr: 'Nommez le rôle'
    },
    description: {
      en: 'Choose a precise title to make assignments easier.',
      fr: 'Choisissez un intitulé précis afin de faciliter les affectations.'
    }
  },
  openProcessTab: {
    targetId: 'processes-tab',
    title: {
      en: 'Open processes',
      fr: 'Ouvrez les processus'
    },
    description: {
      en: 'Switch to the Processes tab to create and organize your steps.',
      fr: 'Passez à l’onglet Processus pour créer et organiser vos étapes.'
    }
  },
  createProcess: {
    targetId: 'onboarding-create-process',
    title: {
      en: 'Create a process',
      fr: 'Créez un processus'
    },
    description: {
      en: 'Create a new process then rename it before adding your steps.',
      fr: 'Créez un nouveau processus puis renommez-le avant d’ajouter vos étapes.'
    }
  },
  saveProcess: {
    targetId: 'onboarding-save-process',
    title: {
      en: 'Save the process',
      fr: 'Sauvegardez le processus'
    },
    description: {
      en: 'Save your changes to confirm the process name.',
      fr: 'Enregistrez vos changements pour confirmer le nom du processus.'
    }
  },
  addStep: {
    targetId: 'onboarding-add-step',
    title: {
      en: 'Add a step',
      fr: 'Ajoutez une étape'
    },
    description: {
      en: 'Insert an action or decision to describe your process journey.',
      fr: "Insérez une action ou une décision pour décrire le parcours de votre processus."
    }
  },
  assignStep: {
    targetId: 'onboarding-step-assignment',
    title: {
      en: 'Assign the step',
      fr: 'Assignez l’étape'
    },
    description: {
      en: 'Select a department for the current step.',
      fr: "Sélectionnez un département pour l’étape courante."
    }
  },
  assignRole: {
    targetId: 'onboarding-step-role-assignment',
    title: {
      en: 'Assign a role',
      fr: 'Attribuez un rôle'
    },
    description: {
      en: 'Choose a role for the step to clarify ownership.',
      fr: "Choisissez un rôle pour l’étape afin de préciser le responsable."
    }
  }
};
