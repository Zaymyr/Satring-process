import type { FormEvent, ReactNode } from 'react';
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
  labels: {
    title: string;
    placeholder: string;
    send: string;
    loading: string;
    errorLabel: string;
  };
  disabled: boolean;
  footerAction?: ReactNode;
};

export function ProcessIaChat({
  messages,
  onSend,
  isLoading,
  inputError,
  errorMessage,
  labels,
  disabled,
  footerAction
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
      <div className="flex flex-1 min-h-0 flex-col space-y-2 rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-inner">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>{labels.title}</span>
        </div>
        <div className="flex-1 min-h-0 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2" aria-live="polite">
          {messages.length === 0 ? null : (
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
        <div
          className={cn(
            'flex flex-wrap items-center gap-2',
            footerAction ? 'justify-between' : 'justify-end'
          )}
        >
          {footerAction ? <div className="flex items-center gap-2">{footerAction}</div> : null}
          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="flex items-center gap-1 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>{labels.loading}</span>
              </div>
            ) : null}
            <Button
              type="submit"
              disabled={disabled || isLoading}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              {labels.send}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
