import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/errors';
import {
  onboardingOverlayStateSchema,
  profileResponseSchema,
  type OnboardingOverlayState,
  type ProfileResponse
} from '@/lib/validation/profile';
import { profileQueryKeys, useProfile } from './use-profile';

const updateOverlayState = async (state: OnboardingOverlayState): Promise<ProfileResponse> => {
  const response = await fetch('/api/profile', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ onboardingOverlayState: state })
  });

  const json = await response.json().catch(() => null);

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok || !json) {
    const message = json && typeof json.error === 'string' ? json.error : 'Impossible de mettre à jour le tutoriel.';
    throw new ApiError(message, response.status);
  }

  return profileResponseSchema.parse(json);
};

export const useOnboardingOverlay = () => {
  const queryClient = useQueryClient();
  const { profileQuery } = useProfile();

  const mutation = useMutation<ProfileResponse, ApiError, OnboardingOverlayState>({
    mutationFn: updateOverlayState,
    onSuccess: (data) => {
      queryClient.setQueryData(profileQueryKeys.self, data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.self }).catch(() => {
        /* noop */
      });
    }
  });

  return {
    overlayState: profileQuery.data?.onboardingOverlayState ?? null,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    refresh: profileQuery.refetch,
    updateOverlayState: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    validation: onboardingOverlayStateSchema
  };
};
