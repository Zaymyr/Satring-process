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
      primaryPanel: {
        toggleLabel: string;
        addAction: string;
        addDecision: string;
        iaDescription: string;
        tabs: {
          ariaLabel: string;
          ia: string;
          manual: string;
        };
        stepLabels: {
          start: string;
          action: string;
          decision: string;
          finish: string;
        };
        rolePicker: {
          addRole: string;
          noDepartmentRoles: string;
          chooseRoleForDepartment: string;
        };
      };
      secondaryPanel: {
        title: {
          processes: string;
          departments: string;
          ia: string;
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
          tooltip: string;
          processes: string;
          departments: string;
          ia: string;
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
          draftBadge: string;
          roleDraftBadge: string;
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
      diagramControls: {
        toggleLabel: string;
        title: string;
        orientationAriaLabel: string;
        directions: {
          topToBottom: string;
          leftToRight: string;
        };
        hideDepartments: string;
        showDepartments: string;
        collapseLabel: string;
      };
      ia: {
        title: string;
        placeholder: string;
        send: string;
        loading: string;
        helper: string;
        errorLabel: string;
        followUpNote: string;
        intro: string;
        followUpHeading: string;
        missingDepartmentsHeading: string;
        missingRolesHeading: string;
        languageInstruction: string;
        modelInstruction: string;
        missingProcess: string;
        validation: string;
        responseTitle: string;
        applyNotice: string;
      };
      onboardingCompletion: {
        title: string;
        description: string;
        close: string;
        newProcess: string;
      };
  };
  raci: {
    metadata: {
      title: string;
      description: string;
    };
    definitions: Record<
      'R' | 'A' | 'C' | 'I',
      { short: string; description: string; tooltip: string }
    >;
    departments: {
      title: string;
      loading: string;
      authRequired: string;
      ariaLabel: string;
      empty: string;
      noRoles: string;
      roleCount: { singular: string; plural: string };
    };
    builder: {
      counts: {
        roles: { singular: string; plural: string };
        actions: { singular: string; plural: string };
      };
      exports: {
        csv: { download: string; copy: string; copied: string };
        markdown: { copy: string; copied: string };
        pdf: string;
        fileName: string;
        headers: { action: string };
        departmentFallbackSlug: string;
        documentTitle: string;
      };
      processes: {
        expandAll: string;
        collapseAll: string;
        showSteps: string;
        hideSteps: string;
      };
      mobile: {
        loading: string;
        authError: string;
        empty: string;
      };
      table: {
        heading: string;
        loading: string;
        authError: string;
        empty: string;
        unassigned: string;
      };
      badges: {
        imported: string;
        manual: string;
      };
      summary: {
        title: string;
        unassigned: string;
      };
      emptySelection: string;
      methodology: {
        title: string;
        description: string;
      };
    };
    errors: {
      authRequired: string;
      listDepartmentsFailed: string;
      listRoleActionsFailed: string;
    };
  };
  jobDescriptions: {
    explorer: {
      sidebar: {
        title: string;
        description: string;
      };
      actions: {
        refresh: string;
        refreshing: string;
        downloadDoc: string;
        downloadPdf: string;
        preparing: string;
      };
    };
  };
  header: {
    localeToggle: {
      label: string;
      options: Record<Locale, string>;
    };
    navigation: {
      menuLabel: string;
      ariaLabel: string;
      openLabel: string;
      closeLabel: string;
      links: {
        home: string;
        raci: string;
        jobDescriptions: string;
        administration: string;
      };
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
      title: 'PI — Process Intelligence',
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
      primaryPanel: {
        toggleLabel: 'Toggle primary panel',
        addAction: 'Action',
        addDecision: 'Decision',
        iaDescription: 'Use the conversational IA assistant to build processes collaboratively.',
        tabs: {
          ariaLabel: 'Primary panel modes',
          ia: 'IA',
          manual: 'Manual'
        },
        stepLabels: {
          start: 'Start',
          action: 'Action',
          decision: 'Decision',
          finish: 'Finish'
        },
        rolePicker: {
          addRole: 'Add a role to associate it with this step.',
          noDepartmentRoles: 'No roles are available for this department.',
          chooseRoleForDepartment: 'Choose a role to automatically populate the department.'
        }
      },
      secondaryPanel: {
        title: {
          processes: 'My processes',
          departments: 'My departments',
          ia: 'IA assistant'
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
          tooltip: 'Select a tab to display the related content below.',
          processes: 'Processes',
          departments: 'Departments',
          ia: 'IA'
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
          draftBadge: 'Draft',
          roleDraftBadge: 'Draft role',
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
      },
      diagramControls: {
        toggleLabel: 'Toggle the diagram options panel',
        title: 'Diagram options',
        orientationAriaLabel: 'Diagram orientation',
        directions: {
          topToBottom: 'Top-bottom',
          leftToRight: 'Left-right'
        },
        hideDepartments: 'Hide departments',
        showDepartments: 'Show departments',
        collapseLabel: 'Collapse diagram options'
      },
      ia: {
        title: 'AI copilot',
        placeholder: 'Ask the assistant to improve or rewrite this process…',
        send: 'Send',
        loading: 'Generating with GPT-5-mini…',
        helper: 'The assistant can rebuild the process from the current diagram and fill in missing roles or departments.',
        errorLabel: 'AI generation failed',
        followUpNote: 'Share details for the missing roles/departments:',
        intro: 'Describe what should change or which gaps to address in the process.',
        followUpHeading: 'Ask these follow-ups about missing details:',
        missingDepartmentsHeading: 'Steps without a department:',
        missingRolesHeading: 'Steps without a role:',
        languageInstruction: 'Respond in English and keep the tone concise.',
        modelInstruction: 'Use GPT-5-mini and return a valid process JSON only.',
        missingProcess: 'Select or create a process before using the assistant.',
        validation: 'Write a message before sending.',
        responseTitle: 'AI suggestion',
        applyNotice: 'Steps updated in the editor. Review and save to persist.'
      },
      onboardingCompletion: {
        title: 'Congratulations! 🎉',
        description:
          'You created your first process. Improve it manually or with the IA tab on the left, or start a new one right away.',
        close: 'Continue improving',
        newProcess: 'Create another process'
      }
    },
    raci: {
      metadata: {
        title: 'Department RACI matrices — PI',
        description:
          'Quickly create RACI matrices for each department: define roles, actions, and clarify responsibilities.'
      },
      definitions: {
        R: {
          short: 'Responsible',
          description: 'Executes the task and reports on progress.',
          tooltip: 'Responsible – executes the task'
        },
        A: {
          short: 'Accountable',
          description: 'Holds final authority to validate or decide.',
          tooltip: 'Accountable – validates / decides'
        },
        C: {
          short: 'Consulted',
          description: 'Provides expertise and must be consulted before decisions.',
          tooltip: 'Consulted – provides expertise'
        },
        I: {
          short: 'Informed',
          description: 'Should be kept up to date on progress and decisions.',
          tooltip: 'Informed – must be kept up to date'
        }
      },
      departments: {
        title: 'Departments',
        loading: 'Loading departments…',
        authRequired: 'Sign in to access your departments.',
        ariaLabel: 'Available departments',
        empty: 'No departments available. Create departments from the home page to start.',
        noRoles: 'No roles are linked to this department.',
        roleCount: { singular: 'role', plural: 'roles' }
      },
      builder: {
        counts: {
          roles: { singular: 'role', plural: 'roles' },
          actions: { singular: 'action', plural: 'actions' }
        },
        exports: {
          csv: { download: 'Export CSV', copy: 'Copy CSV', copied: 'CSV copied!' },
          markdown: { copy: 'Copy Markdown', copied: 'Markdown copied!' },
          pdf: 'Export PDF/Print',
          fileName: 'raci-matrix',
          headers: { action: 'Action' },
          departmentFallbackSlug: 'department',
          documentTitle: 'RACI matrix — {department}'
        },
        processes: {
          expandAll: 'Expand all',
          collapseAll: 'Collapse all',
          showSteps: 'Show process steps',
          hideSteps: 'Hide process steps'
        },
        mobile: {
          loading: 'Analyzing actions…',
          authError: 'Sign in to view actions assigned to your roles.',
          empty: 'Add actions or import processes to generate the department RACI matrix.'
        },
        table: {
          heading: 'Actions',
          loading: 'Analyzing actions…',
          authError: 'Sign in to view actions assigned to your roles.',
          empty: 'No actions are available for this department yet.',
          unassigned: 'Unassigned'
        },
        badges: {
          imported: 'Imported action',
          manual: 'Manual action'
        },
        summary: {
          title: 'Action summary',
          unassigned: 'Unassigned'
        },
        emptySelection: 'Select a department to generate its RACI matrix.',
        methodology: {
          title: 'RACI methodology',
          description: 'Hover a role or a cell to see a quick reminder of responsibilities.'
        }
      },
      errors: {
        authRequired: 'Authentication required',
        listDepartmentsFailed: 'Unable to list your departments.',
        listRoleActionsFailed: 'Unable to retrieve the role actions.'
      }
    },
    jobDescriptions: {
      explorer: {
        sidebar: {
          title: 'Departments & roles',
          description: 'Select a role to view its automatically generated job description.'
        },
        actions: {
          refresh: 'Refresh job description',
          refreshing: 'Generating…',
          downloadDoc: 'Download (Word)',
          downloadPdf: 'Download (PDF)',
          preparing: 'Preparing…'
        }
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
      navigation: {
        menuLabel: 'Menu',
        ariaLabel: 'Main navigation',
        openLabel: 'Open navigation',
        closeLabel: 'Close navigation',
        links: {
          home: 'Home',
          raci: 'RACI matrices',
          jobDescriptions: 'Job descriptions',
          administration: 'Administration'
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
          title: 'Sign in — PI',
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
          title: 'Create account — PI',
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
          title: 'Reset password — PI',
          description: 'Set a new password to secure your account.'
        },
        heading: 'Reset password',
        description: 'Choose a new password to secure your PI account.',
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
      title: 'PI — Intelligence des processus',
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
      primaryPanel: {
        toggleLabel: 'Basculer le panneau principal',
        addAction: 'Action',
        addDecision: 'Décision',
        iaDescription: "Utilisez l’assistant conversationnel IA pour construire vos process ensemble.",
        tabs: {
          ariaLabel: 'Modes du panneau principal',
          ia: 'IA',
          manual: 'Manuel'
        },
        stepLabels: {
          start: 'Début',
          action: 'Action',
          decision: 'Décision',
          finish: 'Fin'
        },
        rolePicker: {
          addRole: 'Ajoutez un rôle pour l’associer à cette étape.',
          noDepartmentRoles: 'Aucun rôle disponible pour ce département.',
          chooseRoleForDepartment: 'Choisissez un rôle pour renseigner automatiquement le département.'
        }
      },
      secondaryPanel: {
        title: {
          processes: 'Mes process',
          departments: 'Mes départements',
          ia: 'Assistant IA'
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
          tooltip: 'Sélectionnez un onglet pour afficher le contenu associé juste en dessous.',
          processes: 'Process',
          departments: 'Départements',
          ia: 'IA'
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
          draftBadge: 'Brouillon',
          roleDraftBadge: 'Rôle brouillon',
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
        save: 'Sauvegarder',
        upToDate: 'Process à jour'
      },
      diagramControls: {
        toggleLabel: 'Basculer le panneau des options du diagramme',
        title: 'Options du diagramme',
        orientationAriaLabel: 'Orientation du diagramme',
        directions: {
          topToBottom: 'Haut-bas',
          leftToRight: 'Gauche-droite'
        },
        hideDepartments: 'Masquer les départements',
        showDepartments: 'Afficher les départements',
        collapseLabel: 'Replier les options du diagramme'
      },
      ia: {
        title: 'Copilote IA',
        placeholder: 'Demandez à l’assistant d’améliorer ou de réécrire ce process…',
        send: 'Envoyer',
        loading: 'Génération avec GPT-5-mini…',
        helper:
          'L’assistant peut reconstruire le process à partir du diagramme actuel et combler les rôles ou départements manquants.',
        errorLabel: 'La génération IA a échoué',
        followUpNote: 'Précisez les rôles/départements manquants :',
        intro: 'Expliquez ce qui doit changer ou être complété dans le process.',
        followUpHeading: 'Pose ces questions complémentaires avant de proposer le flux :',
        missingDepartmentsHeading: 'Étapes sans département :',
        missingRolesHeading: 'Étapes sans rôle :',
        languageInstruction: 'Réponds en français avec un ton concis.',
        modelInstruction: 'Utilise GPT-5-mini et retourne uniquement le JSON valide du process.',
        missingProcess: 'Sélectionnez ou créez un process avant d’utiliser l’assistant.',
        validation: 'Saisissez un message avant d’envoyer.',
        responseTitle: 'Proposition IA',
        applyNotice: 'Étapes mises à jour dans l’éditeur. Relisez puis sauvegardez pour conserver.'
      },
      onboardingCompletion: {
        title: 'Félicitations ! 🎉',
        description:
          'Vous avez créé votre premier process. Améliorez-le manuellement ou via l’onglet IA à gauche, ou lancez-en un nouveau immédiatement.',
        close: 'Continuer à améliorer',
        newProcess: 'Créer un autre process'
      }
    },
    raci: {
      metadata: {
        title: 'Matrices RACI par département — PI',
        description:
          'Créez rapidement des matrices RACI pour chaque département : définissez les rôles, les actions et clarifiez les responsabilités.'
      },
      definitions: {
        R: {
          short: 'Responsable',
          description: "Ce rôle exécute la tâche et rend compte de l’avancement.",
          tooltip: 'Responsable – exécute la tâche'
        },
        A: {
          short: 'Autorité',
          description: 'Détient l’autorité finale pour valider ou trancher.',
          tooltip: 'Autorité – valide / tranche'
        },
        C: {
          short: 'Consulté',
          description: 'Apporte son expertise et doit être consulté avant la décision.',
          tooltip: 'Consulté – apporte son expertise'
        },
        I: {
          short: 'Informé',
          description: 'Doit être tenu au courant de l’avancement et des décisions.',
          tooltip: 'Informé – doit être tenu au courant'
        }
      },
      departments: {
        title: 'Départements',
        loading: 'Chargement des départements…',
        authRequired: 'Connectez-vous pour accéder à vos départements.',
        ariaLabel: 'Départements disponibles',
        empty: 'Aucun département disponible. Créez vos départements depuis l’accueil pour commencer.',
        noRoles: 'Aucun rôle n’est associé à ce département.',
        roleCount: { singular: 'rôle', plural: 'rôles' }
      },
      builder: {
        counts: {
          roles: { singular: 'rôle', plural: 'rôles' },
          actions: { singular: 'action', plural: 'actions' }
        },
        exports: {
          csv: { download: 'Exporter en CSV', copy: 'Copier CSV', copied: 'CSV copié !' },
          markdown: { copy: 'Copier en Markdown', copied: 'Markdown copié !' },
          pdf: 'Export PDF/Impression',
          fileName: 'matrice-raci',
          headers: { action: 'Action' },
          departmentFallbackSlug: 'departement',
          documentTitle: 'Matrice RACI — {department}'
        },
        processes: {
          expandAll: 'Tout développer',
          collapseAll: 'Tout réduire',
          showSteps: 'Afficher les étapes du processus',
          hideSteps: 'Masquer les étapes du processus'
        },
        mobile: {
          loading: 'Analyse des actions en cours…',
          authError: 'Connectez-vous pour consulter les actions assignées à vos rôles.',
          empty: 'Ajoutez des actions ou importez des processus pour générer la matrice RACI du département.'
        },
        table: {
          heading: 'Actions',
          loading: 'Analyse des actions en cours…',
          authError: 'Connectez-vous pour consulter les actions assignées à vos rôles.',
          empty: 'Aucune action n’est disponible pour ce département pour le moment.',
          unassigned: 'Non attribué'
        },
        badges: {
          imported: 'Action importée',
          manual: 'Action manuelle'
        },
        summary: {
          title: 'Synthèse par action',
          unassigned: 'Non attribué'
        },
        emptySelection: 'Sélectionnez un département pour générer sa matrice RACI.',
        methodology: {
          title: 'Méthodologie RACI',
          description: 'Survolez un rôle ou une cellule pour afficher un rappel rapide des responsabilités.'
        }
      },
      errors: {
        authRequired: 'Authentification requise',
        listDepartmentsFailed: 'Impossible de lister vos départements.',
        listRoleActionsFailed: 'Impossible de récupérer les actions des rôles.'
      }
    },
    jobDescriptions: {
      explorer: {
        sidebar: {
          title: 'Départements & rôles',
          description: 'Sélectionnez un rôle pour afficher sa fiche de poste générée automatiquement.'
        },
        actions: {
          refresh: 'Rafraîchir la fiche',
          refreshing: 'Génération…',
          downloadDoc: 'Télécharger (Word)',
          downloadPdf: 'Télécharger (PDF)',
          preparing: 'Préparation…'
        }
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
      navigation: {
        menuLabel: 'Menu',
        ariaLabel: 'Navigation principale',
        openLabel: 'Ouvrir la navigation',
        closeLabel: 'Fermer la navigation',
        links: {
          home: 'Accueil',
          raci: 'Matrices RACI',
          jobDescriptions: 'Fiches de poste',
          administration: 'Administration'
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
          title: 'Connexion — PI',
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
          title: 'Création de compte — PI',
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
          title: 'Réinitialisation du mot de passe — PI',
          description: 'Définissez un nouveau mot de passe pour sécuriser votre compte.'
        },
        heading: 'Réinitialiser le mot de passe',
        description: 'Choisissez un nouveau mot de passe pour sécuriser votre compte PI.',
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
