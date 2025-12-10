import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  ONBOARDING_STEPS,
  type OnboardingStepKey,
  buildDefaultOnboardingStepState
} from '@/lib/onboarding/steps';
import {
  type OnboardingOverlayProgress,
  type OnboardingOverlayState
} from '@/lib/validation/profile';
import { useOnboardingOverlay } from './use-onboarding-overlay';

const normalizeProgress = (
  state: OnboardingOverlayState,
  forceEnable: boolean,
  isEnabled: boolean
): { progress: OnboardingOverlayProgress; isActive: boolean; activeStep: OnboardingStepKey | null } => {
  const baseCompleted = buildDefaultOnboardingStepState();

  if (!isEnabled) {
    return {
      progress: { completedSteps: baseCompleted, dismissed: true },
      isActive: false,
      activeStep: null
    };
  }

  if (state && typeof state === 'object' && 'completedSteps' in state) {
    Object.entries(state.completedSteps ?? {}).forEach(([key, value]) => {
      if (key in baseCompleted && typeof value === 'boolean') {
        baseCompleted[key as OnboardingStepKey] = value;
      }
    });
  }

  const progress: OnboardingOverlayProgress = {
    completedSteps: baseCompleted,
    dismissed: state === true ? true : Boolean((state as { dismissed?: boolean } | null)?.dismissed),
    completionSeen: state === true ? true : Boolean((state as { completionSeen?: boolean } | null)?.completionSeen)
  };

  const allCompleted = ONBOARDING_STEPS.every((step) => progress.completedSteps[step]);
  const isActive = forceEnable ? true : !progress.dismissed && !allCompleted;
  const activeStep = isActive ? ONBOARDING_STEPS.find((step) => !progress.completedSteps[step]) ?? null : null;

  return { progress, isActive, activeStep };
};

export const useLandingOnboardingOverlay = (forceEnable = false, isEnabled = true) => {
  const { overlayState, updateOverlayState } = useOnboardingOverlay();
  const debugHasResetRef = useRef(false);

  const { progress, isActive, activeStep } = useMemo(
    () => normalizeProgress(overlayState, forceEnable, isEnabled),
    [forceEnable, isEnabled, overlayState]
  );

  const persistProgress = useCallback(
    async (nextProgress: OnboardingOverlayProgress) => {
      if (!isEnabled) {
        return;
      }
      await updateOverlayState(nextProgress);
    },
    [isEnabled, updateOverlayState]
  );

  const resetProgress = useCallback(async () => {
    const resetState: OnboardingOverlayProgress = {
      completedSteps: buildDefaultOnboardingStepState(),
      dismissed: false,
      completionSeen: false
    };
    await persistProgress(resetState);
  }, [persistProgress]);

  useEffect(() => {
    if (!forceEnable || debugHasResetRef.current) {
      return;
    }
    debugHasResetRef.current = true;
    void resetProgress();
  }, [forceEnable, resetProgress]);

  const markStepCompleted = useCallback(
    async (step: OnboardingStepKey) => {
      if (!isEnabled) {
        return;
      }
      if (!forceEnable && progress.dismissed) {
        return;
      }
      if (progress.completedSteps[step]) {
        return;
      }

      const nextCompleted = { ...progress.completedSteps, [step]: true };
      const allCompleted = ONBOARDING_STEPS.every((key) => nextCompleted[key]);
      const nextProgress: OnboardingOverlayProgress = {
        completedSteps: nextCompleted,
        dismissed: allCompleted,
        completionSeen: progress.completionSeen
      };

      await persistProgress(nextProgress);
    },
    [forceEnable, isEnabled, persistProgress, progress.completedSteps, progress.dismissed]
  );

  return {
    completedSteps: progress.completedSteps,
    activeStep,
    isActive,
    markStepCompleted,
    resetProgress,
    completionSeen: Boolean(progress.completionSeen),
    markCompletionSeen: useCallback(async () => {
      if (!isEnabled || forceEnable) {
        return;
      }

      const nextProgress: OnboardingOverlayProgress = {
        completedSteps: { ...progress.completedSteps },
        dismissed: progress.dismissed,
        completionSeen: true
      };

      await persistProgress(nextProgress);
    }, [forceEnable, isEnabled, persistProgress, progress.completedSteps, progress.dismissed])
  } as const;
};
