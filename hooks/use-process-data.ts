import { useQuery } from '@tanstack/react-query';

import { ApiError, readErrorMessage } from '@/lib/api/errors';
import { processSummariesSchema } from '@/lib/process/schema';
import { processResponseSchema, type ProcessResponse, type ProcessSummary } from '@/lib/validation/process';
import { type ProcessErrorMessages } from '@/lib/process/types';

export const processQueryKeys = {
  summaries: ['processes'] as const,
  detail: (processId: string | null) => ['process', processId] as const
};

const fetchProcess = async (
  processId: string,
  messages: ProcessErrorMessages
): Promise<ProcessResponse> => {
  const response = await fetch(`/api/process?id=${encodeURIComponent(processId)}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store'
  });

  if (response.status === 401) {
    throw new ApiError(messages.authRequired, 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, messages.process.fetchFailed);
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return processResponseSchema.parse(json);
};

const fetchProcessSummaries = async (
  messages: ProcessErrorMessages
): Promise<ProcessSummary[]> => {
  const response = await fetch('/api/processes', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store'
  });

  if (response.status === 401) {
    throw new ApiError(messages.authRequired, 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, messages.process.listFailed);
    throw new ApiError(message, response.status);
  }

  const json = await response.json();
  return processSummariesSchema.parse(json);
};

type UseProcessDataOptions = {
  processId: string | null;
  messages: ProcessErrorMessages;
};

export const useProcessData = ({ processId, messages }: UseProcessDataOptions) => {
  const processSummariesQuery = useQuery<ProcessSummary[], ApiError>({
    queryKey: processQueryKeys.summaries,
    queryFn: () => fetchProcessSummaries(messages),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      return failureCount < 2;
    }
  });

  const processQuery = useQuery<ProcessResponse, ApiError>({
    queryKey: processQueryKeys.detail(processId),
    queryFn: () => fetchProcess(processId as string, messages),
    enabled: typeof processId === 'string',
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      return failureCount < 2;
    }
  });

  return { processSummariesQuery, processQuery };
};

export { fetchProcess, fetchProcessSummaries };
