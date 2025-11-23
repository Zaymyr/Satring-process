'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { useI18n } from './providers/i18n-provider';

const createResetPasswordSchema = (dictionary: Dictionary) =>
  z
    .object({
      password: z.string().min(8, dictionary.auth.forms.resetPassword.validation.passwordMin),
      confirmPassword: z
        .string()
        .min(8, dictionary.auth.forms.resetPassword.validation.confirmPasswordRequired)
    })
    .refine((value) => value.password === value.confirmPassword, {
      message: dictionary.auth.forms.resetPassword.validation.passwordMismatch,
      path: ['confirmPassword']
    });

type ResetPasswordSchema = z.infer<ReturnType<typeof createResetPasswordSchema>>;

export function ResetPasswordForm() {
  const { dictionary } = useI18n();
  const router = useRouter();
  const resetPasswordSchema = useMemo(() => createResetPasswordSchema(dictionary), [dictionary]);
  const {
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' }
  });

  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: ResetPasswordSchema) => {
    setStatus('idle');
    setError(null);

    const response = await fetch('/api/auth/reset-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: data.password })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message =
        typeof payload.error === 'string'
          ? payload.error
          : dictionary.auth.forms.resetPassword.errorMessage;
      setError(message);
      setStatus('error');
      return;
    }

    reset({ password: '', confirmPassword: '' });
    setStatus('success');
    router.replace('/');
    router.refresh();
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2 text-left">
        <Label htmlFor="new-password">{dictionary.auth.forms.resetPassword.newPasswordLabel}</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          placeholder={dictionary.auth.forms.common.passwordPlaceholder}
          {...register('password')}
        />
        {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
      </div>
      <div className="space-y-2 text-left">
        <Label htmlFor="confirm-new-password">{dictionary.auth.forms.resetPassword.confirmNewPasswordLabel}</Label>
        <Input
          id="confirm-new-password"
          type="password"
          autoComplete="new-password"
          placeholder={dictionary.auth.forms.common.confirmPasswordPlaceholder}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting || status === 'success'}>
        {isSubmitting
          ? dictionary.auth.forms.resetPassword.submittingLabel
          : dictionary.auth.forms.resetPassword.submitLabel}
      </Button>
      {status === 'success' && (
        <p className="text-sm text-emerald-600">{dictionary.auth.forms.resetPassword.successMessage}</p>
      )}
      {status === 'error' && error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
