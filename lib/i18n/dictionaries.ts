export type Locale = 'en' | 'fr';

export type Dictionary = {
  metadata: {
    title: string;
    description: string;
  };
  header: {
    authenticatedLabel: string;
    unauthenticatedLabel: string;
    profileFallback: string;
    guestLabel: string;
    signOut: string;
    createAccount: string;
    signIn: string;
  };
};

export const DEFAULT_LOCALE: Locale = 'en';

const dictionaries: Record<Locale, Dictionary> = {
  en: {
    metadata: {
      title: 'Satring — Process clarity made simple',
      description: 'Unify your process in a clean interface: one workspace, two panels, zero distraction.'
    },
    header: {
      authenticatedLabel: 'Signed in:',
      unauthenticatedLabel: 'Not signed in',
      profileFallback: 'Profile',
      guestLabel: 'Guest',
      signOut: 'Sign out',
      createAccount: 'Create account',
      signIn: 'Sign in'
    }
  },
  fr: {
    metadata: {
      title: 'Satring — Process clarity made simple',
      description:
        'Unifiez votre processus dans une interface épurée : un espace, deux panneaux, zéro distraction.'
    },
    header: {
      authenticatedLabel: 'Connecté :',
      unauthenticatedLabel: 'Non connecté',
      profileFallback: 'Profil',
      guestLabel: 'Invité',
      signOut: 'Se déconnecter',
      createAccount: 'Créer un compte',
      signIn: 'Se connecter'
    }
  }
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}
