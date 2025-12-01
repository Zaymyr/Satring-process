import type { FormEvent } from 'react';
import { useState } from 'react';
import { Loader2, MessageSquare, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { IaChatMessage } from '@/lib/process/use-process-ia-chat';
import { cn } from '@/lib/utils/cn';

type ProcessIaChatProps = {
  messages: IaChatMessage[];
  onSend: (message: string) => { ok: boolean };
  isLoading: boolean;
  inputError: string | null;
  errorMessage: string | null;
  followUpContent: string;
  labels: {
    title: string;
    placeholder: string;
    send: string;
    loading: string;
    helper: string;
    errorLabel: string;
    followUpNote: string;
  };
  disabled: boolean;
};

export function ProcessIaChat({
  messages,
  onSend,
  isLoading,
  inputError,
  errorMessage,
  followUpContent,
  labels,
  disabled
}: ProcessIaChatProps) {
  const [draft, setDraft] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = onSend(draft);
    if (result.ok) {
      setDraft('');
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-inner">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>{labels.title}</span>
        </div>
        {followUpContent ? (
          <div className="rounded-xl bg-slate-900/5 p-3 text-xs leading-relaxed text-slate-800">
            <p className="mb-1 font-semibold text-slate-900">{labels.followUpNote}</p>
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-slate-700">{followUpContent}</pre>
          </div>
        ) : null}
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2" aria-live="polite">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-500">{labels.helper}</p>
          ) : (
            messages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <Card
                  key={message.id}
                  className={cn(
                    'border-slate-200 shadow-sm',
                    isUser ? 'bg-white' : 'bg-slate-900 text-white'
                  )}
                >
                  <CardContent className="flex items-start gap-2 p-3 text-sm leading-relaxed">
                    <MessageSquare
                      className={cn('mt-0.5 h-4 w-4', isUser ? 'text-slate-500' : 'text-amber-200')}
                      aria-hidden="true"
                    />
                    <p className={cn('whitespace-pre-wrap', isUser ? 'text-slate-800' : 'text-amber-50')}>{message.content}</p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={labels.placeholder}
          disabled={disabled || isLoading}
          className="min-h-[110px] resize-none"
        />
        {inputError ? <p className="text-xs text-red-600">{inputError}</p> : null}
        {errorMessage ? (
          <p className="text-xs text-red-600">{`${labels.errorLabel}: ${errorMessage}`}</p>
        ) : null}
        <div className="flex items-center justify-end gap-2">
          {isLoading ? (
            <div className="flex items-center gap-1 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>{labels.loading}</span>
            </div>
          ) : null}
          <Button type="submit" disabled={disabled || isLoading} className="bg-slate-900 text-white hover:bg-slate-800">
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
            {labels.send}
          </Button>
        </div>
      </form>
      <p className="text-xs text-slate-500">{labels.helper}</p>
    </div>
  );
}
