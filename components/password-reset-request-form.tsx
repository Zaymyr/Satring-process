'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { useI18n } from './providers/i18n-provider';

const createPasswordResetRequestSchema = (dictionary: Dictionary) =>
  z.object({
    email: z
      .string({ required_error: dictionary.auth.forms.passwordResetRequest.validation.emailRequired })
      .min(1, dictionary.auth.forms.passwordResetRequest.validation.emailRequired)
      .email(dictionary.auth.forms.passwordResetRequest.validation.emailInvalid)
  });

type PasswordResetRequestSchema = z.infer<ReturnType<typeof createPasswordResetRequestSchema>>;

export function PasswordResetRequestForm() {
  const { dictionary } = useI18n();
  const passwordResetRequestSchema = useMemo(
    () => createPasswordResetRequestSchema(dictionary),
    [dictionary]
  );
  const {
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<PasswordResetRequestSchema>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: '' }
  });

  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: PasswordResetRequestSchema) => {
    setStatus('idle');
    setError(null);

    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message =
        typeof payload.error === 'string' ? payload.error : dictionary.auth.forms.passwordResetRequest.errorMessage;
      setError(message);
      setStatus('error');
      return;
    }

    reset({ email: '' });
    setStatus('success');
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-left">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-900">{dictionary.auth.forms.passwordResetRequest.title}</h2>
        <p className="text-xs text-slate-600">{dictionary.auth.forms.passwordResetRequest.description}</p>
      </div>
      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="reset-email" className="text-xs">
            {dictionary.auth.forms.common.emailLabel}
          </Label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            placeholder={dictionary.auth.forms.common.emailPlaceholder}
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>
        <Button type="submit" className="w-full" variant="secondary" disabled={isSubmitting || status === 'success'}>
          {isSubmitting
            ? dictionary.auth.forms.passwordResetRequest.submittingLabel
            : dictionary.auth.forms.passwordResetRequest.submitLabel}
        </Button>
        {status === 'success' && (
          <p className="text-xs text-emerald-600">{dictionary.auth.forms.passwordResetRequest.successMessage}</p>
        )}
        {status === 'error' && error && <p className="text-xs text-red-500">{error}</p>}
      </form>
    </div>
  );
}
