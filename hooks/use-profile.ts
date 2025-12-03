import { useQuery } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/errors';
import { profileResponseSchema, type ProfileResponse } from '@/lib/validation/profile';

export const profileQueryKeys = {
  self: ['profile', 'self'] as const
};

const fetchProfile = async (): Promise<ProfileResponse> => {
  const response = await fetch('/api/profile', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  const json = await response.json().catch(() => null);

  if (response.status === 401) {
    throw new ApiError('Authentification requise', 401);
  }

  if (!response.ok || !json) {
    const message = json && typeof json.error === 'string'
      ? json.error
      : 'Impossible de charger votre profil.';
    throw new ApiError(message, response.status);
  }

  return profileResponseSchema.parse(json);
};

export const useProfile = () => {
  const profileQuery = useQuery<ProfileResponse, ApiError>({
    queryKey: profileQueryKeys.self,
    queryFn: fetchProfile,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      return failureCount < 2;
    }
  });

  return { profileQuery };
};

export { fetchProfile };
