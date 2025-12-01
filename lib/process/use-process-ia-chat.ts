'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';
import type { Locale } from '@/lib/i18n/dictionaries';
import { processPayloadSchema, type ProcessPayload } from '@/lib/validation/process';

export type IaChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type UseProcessIaChatOptions = {
  processId: string | null;
  locale: Locale;
  processTitle: string;
  mermaidJson: string;
  missingDepartments: string[];
  missingRoles: string[];
  copy: {
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
  onProcessUpdate: (payload: ProcessPayload) => void;
};

type SendResult = { ok: boolean };

const userMessageSchema = z.object({ message: z.string().trim().min(1) });

const buildId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36));

export function useProcessIaChat({
  processId,
  locale,
  processTitle,
  mermaidJson,
  missingDepartments,
  missingRoles,
  copy,
  onProcessUpdate
}: UseProcessIaChatOptions) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<IaChatMessage[]>([{
    id: buildId(),
    role: 'assistant',
    content: copy.intro
  }]);
  const [inputError, setInputError] = useState<string | null>(null);

  const followUpContent = useMemo(() => {
    const sections: string[] = [];

    if (missingDepartments.length > 0) {
      sections.push(
        [copy.missingDepartmentsHeading, ...missingDepartments.map((item, index) => `${index + 1}. ${item}`)].join('\n')
      );
    }

    if (missingRoles.length > 0) {
      sections.push([copy.missingRolesHeading, ...missingRoles.map((item, index) => `${index + 1}. ${item}`)].join('\n'));
    }

    if (sections.length === 0) {
      return '';
    }

    return [copy.followUpHeading, ...sections].join('\n\n');
  }, [copy.followUpHeading, copy.missingDepartmentsHeading, copy.missingRolesHeading, missingDepartments, missingRoles]);

  const buildPrompt = useCallback(
    (userMessage: string) =>
      [copy.languageInstruction, copy.modelInstruction, followUpContent, userMessage]
        .filter((value) => value && value.trim().length > 0)
        .join('\n\n'),
    [copy.languageInstruction, copy.modelInstruction, followUpContent]
  );

  const buildContext = useCallback(() => {
    const header = locale === 'fr' ? 'Diagramme Mermaid actuel :' : 'Current Mermaid diagram:';
    const normalizedTitle = processTitle.trim() || DEFAULT_PROCESS_TITLE;
    return [header, `Titre : ${normalizedTitle}`, mermaidJson, followUpContent]
      .filter((value) => value && value.trim().length > 0)
      .join('\n\n');
  }, [followUpContent, locale, mermaidJson, processTitle]);

  const mutation = useMutation<ProcessPayload, Error, string>({
    mutationFn: async (userMessage) => {
      const parsed = userMessageSchema.safeParse({ message: userMessage });
      if (!parsed.success) {
        throw new Error(copy.validation);
      }

      if (!processId) {
        throw new Error(copy.missingProcess);
      }

      const response = await fetch('/api/processes/ai', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processId,
          prompt: buildPrompt(parsed.data.message),
          context: buildContext()
        })
      });

      if (!response.ok) {
        const fallback = locale === 'fr' ? 'La génération a échoué.' : 'Generation failed.';
        try {
          const payload = (await response.json()) as { error?: string };
          throw new Error(typeof payload.error === 'string' && payload.error.trim().length > 0 ? payload.error : fallback);
        } catch (error) {
          if (error instanceof Error && error.message !== '[object Object]') {
            throw error;
          }
          throw new Error(fallback);
        }
      }

      const json = await response.json();
      return processPayloadSchema.parse(json);
    },
    onSuccess: (payload) => {
      const normalizedTitle = payload.title?.trim() || DEFAULT_PROCESS_TITLE;
      const formattedContent = `${copy.responseTitle}\n\n${JSON.stringify({
        title: normalizedTitle,
        steps: payload.steps
      }, null, 2)}\n\n${copy.applyNotice}`;

      setMessages((previous) => [
        ...previous,
        {
          id: buildId(),
          role: 'assistant',
          content: formattedContent
        }
      ]);

      onProcessUpdate(payload);
      queryClient.invalidateQueries({ queryKey: ['process', payload.id], refetchType: 'inactive' });
      queryClient.invalidateQueries({ queryKey: ['processes'], refetchType: 'inactive' });
    },
    onError: (error) => {
      setMessages((previous) => [
        ...previous,
        {
          id: buildId(),
          role: 'assistant',
          content: error.message || copy.validation
        }
      ]);
    }
  });

  const sendMessage = useCallback(
    (rawMessage: string): SendResult => {
      const parsed = userMessageSchema.safeParse({ message: rawMessage });
      if (!parsed.success) {
        setInputError(copy.validation);
        return { ok: false };
      }

      if (!processId) {
        setInputError(copy.missingProcess);
        return { ok: false };
      }

      const message = parsed.data.message;
      setInputError(null);
      setMessages((previous) => [
        ...previous,
        {
          id: buildId(),
          role: 'user',
          content: message
        }
      ]);
      mutation.mutate(message);
      return { ok: true };
    },
    [copy.missingProcess, copy.validation, mutation, processId]
  );

  return {
    messages,
    sendMessage,
    isLoading: mutation.isPending,
    inputError,
    errorMessage: mutation.isError ? mutation.error.message : null,
    followUpContent
  };
}
