export type Locale = 'en' | 'fr';

export type Dictionary = {
  formatting: {
    dateTime: Intl.DateTimeFormatOptions;
  };
  metadata: {
    title: string;
    description: string;
  };
    landing: {
      defaults: {
        departmentName: string;
        roleName: string;
      };
      actions: {
        createLabel: string;
      };
      secondaryPanel: {
        title: {
          processes: string;
          departments: string;
        };
        description: {
          processes: string;
          departments: {
            demo: string;
            standard: string;
          };
        };
        toggleLabel: string;
        tabs: {
          ariaLabel: string;
          processes: string;
          departments: string;
        };
        processes: {
          loading: string;
          listAriaLabel: string;
          updatedLabel: string;
          rename: {
            save: string;
            cancel: string;
            ariaLabel: string;
          };
          deleteAriaLabel: string;
        };
        departments: {
          demoNotice: string;
          loading: string;
          errorFallback: string;
          listAriaLabel: string;
          colorLabel: string;
          colorValueLabel: string;
          updatedLabel: string;
          deleteAriaLabel: string;
          empty: {
            demo: string;
            standard: string;
          };
          addRole: string;
          save: string;
          roles: {
            empty: string;
            removeAriaLabel: string;
            removeTitleSaved: string;
            removeTitleUnsaved: string;
          };
        };
      };
      errors: {
        authRequired: string;
        process: {
          fetchFailed: string;
          listFailed: string;
          createFailed: string;
          renameFailed: string;
          deleteFailed: string;
        };
        mermaid: {
          browserOnly: string;
          missingAfterLoad: string;
          scriptLoadFailed: string;
        };
    };
    status: {
      unauthorized: {
        prompt: string;
        createAccount: string;
        saveRequirement: string;
        signIn: string;
      };
      readerRestriction: string;
      creating: string;
      createPrompt: string;
      loading: string;
      unsavedChanges: string;
      lastSavedLabel: string;
      noSavedYet: string;
      saveErrorFallback: string;
    };
    saveButton: {
      authRequired: string;
      readOnly: string;
      create: string;
      creating: string;
      saving: string;
      save: string;
      upToDate: string;
    };
  };
  header: {
    localeToggle: {
      label: string;
      options: Record<Locale, string>;
    };
    authenticatedLabel: string;
    unauthenticatedLabel: string;
    profileFallback: string;
    guestLabel: string;
    signOut: string;
    createAccount: string;
    signIn: string;
  };
  auth: {
    signIn: {
      metadata: {
        title: string;
        description: string;
      };
      heading: string;
      description: string;
      cta: {
        prompt: string;
        action: string;
      };
      backHome: string;
    };
    signUp: {
      metadata: {
        title: string;
        description: string;
      };
      heading: string;
      description: string;
      cta: {
        prompt: string;
        action: string;
      };
      backHome: string;
    };
    resetPassword: {
      metadata: {
        title: string;
        description: string;
      };
      heading: string;
      description: string;
      invalidLink: {
        title: string;
        description: string;
        cta: string;
      };
    };
    forms: {
      common: {
        emailLabel: string;
        emailPlaceholder: string;
        passwordLabel: string;
        passwordPlaceholder: string;
        confirmPasswordLabel: string;
        confirmPasswordPlaceholder: string;
      };
      signIn: {
        submitLabel: string;
        submittingLabel: string;
        successMessage: string;
        errorMessage: string;
        validation: {
          emailRequired: string;
          emailInvalid: string;
          passwordRequired: string;
        };
      };
      signUp: {
        submitLabel: string;
        submittingLabel: string;
        successMessage: string;
        needsVerificationMessage: string;
        unexpectedResponseMessage: string;
        errorMessage: string;
        validation: {
          emailRequired: string;
          emailInvalid: string;
          passwordMin: string;
          confirmPasswordRequired: string;
          passwordMismatch: string;
        };
      };
      passwordResetRequest: {
        title: string;
        description: string;
        submitLabel: string;
        submittingLabel: string;
        successMessage: string;
        errorMessage: string;
        validation: {
          emailRequired: string;
          emailInvalid: string;
        };
      };
      resetPassword: {
        newPasswordLabel: string;
        confirmNewPasswordLabel: string;
        submitLabel: string;
        submittingLabel: string;
        successMessage: string;
        errorMessage: string;
        validation: {
          passwordMin: string;
          confirmPasswordRequired: string;
          passwordMismatch: string;
        };
      };
    };
  };
};

export const DEFAULT_LOCALE: Locale = 'en';

const dictionaries: Record<Locale, Dictionary> = {
  en: {
    formatting: {
      dateTime: { dateStyle: 'short', timeStyle: 'short' }
    },
    metadata: {
      title: 'Satring — Process clarity made simple',
      description: 'Unify your process in a clean interface: one workspace, two panels, zero distraction.'
    },
    landing: {
      defaults: {
        departmentName: 'New department',
        roleName: 'New role'
      },
      actions: {
        createLabel: 'New'
      },
      secondaryPanel: {
        title: {
          processes: 'My processes',
          departments: 'My departments'
        },
        description: {
          processes: 'Manage your saved journeys and rename them directly from this list.',
          departments: {
            demo: 'Read-only preview of example departments.',
            standard: 'Organize your departments and rename them to structure your team.'
          }
        },
        toggleLabel: 'Toggle the secondary panel',
        tabs: {
          ariaLabel: 'List navigation',
          processes: 'Processes',
          departments: 'Departments'
        },
        processes: {
          loading: 'Loading processes…',
          listAriaLabel: 'Saved processes',
          updatedLabel: 'Updated {timestamp}',
          rename: {
            save: 'Save',
            cancel: 'Cancel',
            ariaLabel: 'Rename process'
          },
          deleteAriaLabel: 'Delete process'
        },
        departments: {
          demoNotice: 'You are exploring read-only sample departments. Sign in to manage your own.',
          loading: 'Loading departments…',
          errorFallback: 'Unable to retrieve the list of departments.',
          listAriaLabel: 'Departments',
          colorLabel: 'Department color',
          colorValueLabel: 'Color: {color}',
          updatedLabel: 'Updated {timestamp}',
          deleteAriaLabel: 'Delete department',
          empty: {
            demo: 'No sample departments are available right now.',
            standard: 'No departments saved yet.'
          },
          addRole: 'Add role',
          save: 'Save',
          roles: {
            empty: 'No roles for this department yet.',
            removeAriaLabel: 'Remove role',
            removeTitleSaved: 'This role will be removed when you save',
            removeTitleUnsaved: 'Remove this role'
          }
        }
      },
      errors: {
        authRequired: 'Authentication required',
        process: {
          fetchFailed: 'Unable to retrieve the process.',
          listFailed: 'Unable to list your processes.',
          createFailed: 'Unable to create a new process.',
          renameFailed: 'Unable to rename the process.',
          deleteFailed: 'Unable to delete the process.'
        },
        mermaid: {
          browserOnly: 'Mermaid requires a browser environment.',
          missingAfterLoad: 'Mermaid could not be found after loading the script.',
          scriptLoadFailed: 'Unable to load the Mermaid script.'
        }
      },
      status: {
        unauthorized: {
          prompt: 'Sign in or ',
          createAccount: 'create an account',
          saveRequirement: ' to save your process.',
          signIn: 'Sign in'
        },
        readerRestriction: 'Your Reader role only allows you to view saved processes.',
        creating: 'Creating the process…',
        createPrompt: 'Create a process to get started.',
        loading: 'Loading process…',
        unsavedChanges: 'You have unsaved changes.',
        lastSavedLabel: 'Last saved',
        noSavedYet: 'No saves yet.',
        saveErrorFallback: 'Unable to save the process.'
      },
      saveButton: {
        authRequired: 'Sign-in required',
        readOnly: 'Read only',
        create: 'Create a process',
        creating: 'Creating…',
        saving: 'Saving…',
        save: 'Save process',
        upToDate: 'Process is up to date'
      }
    },
    header: {
      localeToggle: {
        label: 'Language',
        options: {
          en: 'English',
          fr: 'French'
        }
      },
      authenticatedLabel: 'Signed in:',
      unauthenticatedLabel: 'Not signed in',
      profileFallback: 'Profile',
      guestLabel: 'Guest',
      signOut: 'Sign out',
      createAccount: 'Create account',
      signIn: 'Sign in'
    },
    auth: {
      signIn: {
        metadata: {
          title: 'Sign in — Satring',
          description: 'Receive a secure link to edit your process.'
        },
        heading: 'Sign in',
        description: 'Sign in with your credentials to edit and save your processes.',
        cta: {
          prompt: "Don't have an account?",
          action: 'Create an account'
        },
        backHome: 'Back to home'
      },
      signUp: {
        metadata: {
          title: 'Create account — Satring',
          description: 'Create an account to save and manage your processes.'
        },
        heading: 'Create an account',
        description: 'Sign up to save your processes, find them, and update them securely.',
        cta: {
          prompt: 'Already have an account?',
          action: 'Sign in'
        },
        backHome: 'Back to home'
      },
      resetPassword: {
        metadata: {
          title: 'Reset password — Satring',
          description: 'Set a new password to secure your account.'
        },
        heading: 'Reset password',
        description: 'Choose a new password to secure your Satring account.',
        invalidLink: {
          title: 'The reset link is invalid or has expired.',
          description: 'Return to the sign-in page to request a new link.',
          cta: 'Back to sign in'
        }
      },
      forms: {
        common: {
          emailLabel: 'Email address',
          emailPlaceholder: 'you@example.com',
          passwordLabel: 'Password',
          passwordPlaceholder: '••••••••',
          confirmPasswordLabel: 'Confirm password',
          confirmPasswordPlaceholder: '••••••••'
        },
        signIn: {
          submitLabel: 'Sign in',
          submittingLabel: 'Signing in…',
          successMessage: 'Signed in successfully. Redirecting…',
          errorMessage: 'Unable to sign in.',
          validation: {
            emailRequired: 'Email is required',
            emailInvalid: 'Invalid email address',
            passwordRequired: 'Password is required'
          }
        },
        signUp: {
          submitLabel: 'Create account',
          submittingLabel: 'Creating account…',
          successMessage: 'Account created successfully. Redirecting…',
          needsVerificationMessage: 'Your account was created. Check your email to activate access.',
          unexpectedResponseMessage: 'Unexpected server response.',
          errorMessage: 'Unable to create the account.',
          validation: {
            emailRequired: 'Email is required',
            emailInvalid: 'Invalid email address',
            passwordMin: 'Password must be at least 8 characters long.',
            confirmPasswordRequired: 'Please confirm your password.',
            passwordMismatch: 'Passwords do not match.'
          }
        },
        passwordResetRequest: {
          title: 'Forgot password?',
          description: 'Receive a secure email to set a new password and regain access.',
          submitLabel: 'Send reset link',
          submittingLabel: 'Sending…',
          successMessage: 'If an account exists for this email, a reset email has been sent.',
          errorMessage: 'Unable to send the link.',
          validation: {
            emailRequired: 'Email is required',
            emailInvalid: 'Invalid email address'
          }
        },
        resetPassword: {
          newPasswordLabel: 'New password',
          confirmNewPasswordLabel: 'Confirm password',
          submitLabel: 'Save new password',
          submittingLabel: 'Updating…',
          successMessage: 'Password updated. You will be redirected.',
          errorMessage: 'Unable to update the password.',
          validation: {
            passwordMin: 'Password must be at least 8 characters long.',
            confirmPasswordRequired: 'Please confirm your password.',
            passwordMismatch: 'Passwords do not match.'
          }
        }
      }
    }
  },
  fr: {
    formatting: {
      dateTime: { dateStyle: 'short', timeStyle: 'short' }
    },
    metadata: {
      title: 'Satring — Process clarity made simple',
      description:
        'Unifiez votre processus dans une interface épurée : un espace, deux panneaux, zéro distraction.'
    },
    landing: {
      defaults: {
        departmentName: 'Nouveau département',
        roleName: 'Nouveau rôle'
      },
      actions: {
        createLabel: 'Nouveau'
      },
      secondaryPanel: {
        title: {
          processes: 'Mes process',
          departments: 'Mes départements'
        },
        description: {
          processes: 'Gérez vos parcours enregistrés et renommez-les directement depuis cette liste.',
          departments: {
            demo: 'Aperçu en lecture seule de départements d’exemple.',
            standard: 'Organisez vos départements et renommez-les pour structurer votre équipe.'
          }
        },
        toggleLabel: 'Basculer le panneau secondaire',
        tabs: {
          ariaLabel: 'Navigation des listes',
          processes: 'Process',
          departments: 'Départements'
        },
        processes: {
          loading: 'Chargement des process…',
          listAriaLabel: 'Process sauvegardés',
          updatedLabel: 'Mis à jour {timestamp}',
          rename: {
            save: 'Enregistrer',
            cancel: 'Annuler',
            ariaLabel: 'Renommer le process'
          },
          deleteAriaLabel: 'Supprimer le process'
        },
        departments: {
          demoNotice: 'Vous explorez des départements d’exemple en lecture seule. Connectez-vous pour gérer les vôtres.',
          loading: 'Chargement des départements…',
          errorFallback: 'Impossible de récupérer la liste des départements.',
          listAriaLabel: 'Départements',
          colorLabel: 'Couleur du département',
          colorValueLabel: 'Couleur : {color}',
          updatedLabel: 'Mis à jour {timestamp}',
          deleteAriaLabel: 'Supprimer le département',
          empty: {
            demo: 'Aucun département d’exemple n’est disponible pour le moment.',
            standard: 'Aucun département enregistré pour le moment.'
          },
          addRole: 'Ajouter un rôle',
          save: 'Enregistrer',
          roles: {
            empty: 'Aucun rôle pour ce département.',
            removeAriaLabel: 'Retirer le rôle',
            removeTitleSaved: 'Ce rôle sera supprimé lors de l’enregistrement',
            removeTitleUnsaved: 'Retirer ce rôle'
          }
        }
      },
      errors: {
        authRequired: 'Authentification requise',
        process: {
          fetchFailed: 'Impossible de récupérer le process.',
          listFailed: 'Impossible de lister vos process.',
          createFailed: 'Impossible de créer un nouveau process.',
          renameFailed: 'Impossible de renommer le process.',
          deleteFailed: 'Impossible de supprimer le process.'
        },
        mermaid: {
          browserOnly: 'Mermaid nécessite un environnement navigateur.',
          missingAfterLoad: 'Mermaid est introuvable après le chargement du script.',
          scriptLoadFailed: 'Impossible de charger le script Mermaid.'
        }
      },
      status: {
        unauthorized: {
          prompt: 'Connectez-vous ou ',
          createAccount: 'créez un compte',
          saveRequirement: ' pour sauvegarder votre process.',
          signIn: 'Se connecter'
        },
        readerRestriction: 'Votre rôle Lecteur vous permet uniquement de consulter les process sauvegardés.',
        creating: 'Création du process en cours…',
        createPrompt: 'Créez un process pour commencer.',
        loading: 'Chargement du process en cours…',
        unsavedChanges: 'Des modifications non sauvegardées sont en attente.',
        lastSavedLabel: 'Dernière sauvegarde',
        noSavedYet: 'Aucune sauvegarde enregistrée pour le moment.',
        saveErrorFallback: 'Impossible de sauvegarder le process.'
      },
      saveButton: {
        authRequired: 'Connexion requise',
        readOnly: 'Lecture seule',
        create: 'Créer un process',
        creating: 'Création…',
        saving: 'Sauvegarde…',
        save: 'Sauvegarder le process',
        upToDate: 'Process à jour'
      }
    },
    header: {
      localeToggle: {
        label: 'Langue',
        options: {
          en: 'Anglais',
          fr: 'Français'
        }
      },
      authenticatedLabel: 'Connecté :',
      unauthenticatedLabel: 'Non connecté',
      profileFallback: 'Profil',
      guestLabel: 'Invité',
      signOut: 'Se déconnecter',
      createAccount: 'Créer un compte',
      signIn: 'Se connecter'
    },
    auth: {
      signIn: {
        metadata: {
          title: 'Connexion — Satring',
          description: 'Recevez un lien sécurisé pour modifier votre process.'
        },
        heading: 'Connexion',
        description: 'Connectez-vous avec vos identifiants pour modifier et sauvegarder vos process.',
        cta: {
          prompt: 'Pas encore de compte ?',
          action: 'Créer un compte'
        },
        backHome: "Retour à l’accueil"
      },
      signUp: {
        metadata: {
          title: 'Création de compte — Satring',
          description: 'Créez un compte pour sauvegarder et gérer vos process.'
        },
        heading: 'Créer un compte',
        description: 'Inscrivez-vous pour enregistrer vos process, les retrouver et les mettre à jour en toute sécurité.',
        cta: {
          prompt: 'Déjà un compte ?',
          action: 'Se connecter'
        },
        backHome: "Retour à l’accueil"
      },
      resetPassword: {
        metadata: {
          title: 'Réinitialisation du mot de passe — Satring',
          description: 'Définissez un nouveau mot de passe pour sécuriser votre compte.'
        },
        heading: 'Réinitialiser le mot de passe',
        description: 'Choisissez un nouveau mot de passe pour sécuriser votre compte Satring.',
        invalidLink: {
          title: 'Le lien de réinitialisation est invalide ou a expiré.',
          description: 'Retournez à la page de connexion pour demander un nouveau lien.',
          cta: 'Retour à la connexion'
        }
      },
      forms: {
        common: {
          emailLabel: 'Adresse e-mail',
          emailPlaceholder: 'vous@example.com',
          passwordLabel: 'Mot de passe',
          passwordPlaceholder: '••••••••',
          confirmPasswordLabel: 'Confirmer le mot de passe',
          confirmPasswordPlaceholder: '••••••••'
        },
        signIn: {
          submitLabel: 'Se connecter',
          submittingLabel: 'Connexion en cours…',
          successMessage: 'Connexion réussie. Redirection…',
          errorMessage: 'Impossible de se connecter.',
          validation: {
            emailRequired: 'Adresse e-mail obligatoire',
            emailInvalid: 'Adresse e-mail invalide',
            passwordRequired: 'Mot de passe obligatoire'
          }
        },
        signUp: {
          submitLabel: 'Créer un compte',
          submittingLabel: 'Création en cours…',
          successMessage: 'Compte créé avec succès. Redirection en cours…',
          needsVerificationMessage: 'Votre compte a été créé. Vérifiez votre boîte mail pour activer votre accès.',
          unexpectedResponseMessage: 'Réponse inattendue du serveur.',
          errorMessage: 'Impossible de créer le compte.',
          validation: {
            emailRequired: 'Adresse e-mail obligatoire',
            emailInvalid: 'Adresse e-mail invalide',
            passwordMin: 'Le mot de passe doit contenir au moins 8 caractères.',
            confirmPasswordRequired: 'Veuillez confirmer votre mot de passe.',
            passwordMismatch: 'Les mots de passe ne correspondent pas.'
          }
        },
        passwordResetRequest: {
          title: 'Mot de passe oublié ?',
          description: 'Recevez un e-mail sécurisé pour définir un nouveau mot de passe et retrouver votre accès.',
          submitLabel: 'Recevoir un lien de réinitialisation',
          submittingLabel: 'Envoi en cours…',
          successMessage: 'Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé.',
          errorMessage: "Impossible d'envoyer le lien.",
          validation: {
            emailRequired: 'Adresse e-mail obligatoire',
            emailInvalid: 'Adresse e-mail invalide'
          }
        },
        resetPassword: {
          newPasswordLabel: 'Nouveau mot de passe',
          confirmNewPasswordLabel: 'Confirmer le mot de passe',
          submitLabel: 'Enregistrer le nouveau mot de passe',
          submittingLabel: 'Mise à jour…',
          successMessage: 'Mot de passe mis à jour. Vous allez être redirigé.',
          errorMessage: 'Impossible de mettre à jour le mot de passe.',
          validation: {
            passwordMin: 'Le mot de passe doit contenir au moins 8 caractères.',
            confirmPasswordRequired: 'Veuillez confirmer votre mot de passe.',
            passwordMismatch: 'Les mots de passe ne correspondent pas.'
          }
        }
      }
    }
  }
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}
