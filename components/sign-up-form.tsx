'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { useI18n } from './providers/i18n-provider';

const createSignUpSchema = (dictionary: Dictionary) =>
  z
    .object({
      email: z
        .string()
        .min(1, dictionary.auth.forms.signUp.validation.emailRequired)
        .email(dictionary.auth.forms.signUp.validation.emailInvalid),
      password: z.string().min(8, dictionary.auth.forms.signUp.validation.passwordMin),
      confirmPassword: z.string().min(8, dictionary.auth.forms.signUp.validation.confirmPasswordRequired)
    })
    .refine((value) => value.password === value.confirmPassword, {
      message: dictionary.auth.forms.signUp.validation.passwordMismatch,
      path: ['confirmPassword']
    });

type SignUpSchema = z.infer<ReturnType<typeof createSignUpSchema>>;

export function SignUpForm() {
  const { dictionary } = useI18n();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'success' | 'needsVerification' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const signUpSchema = useMemo(() => createSignUpSchema(dictionary), [dictionary]);

  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting }
  } = useForm<SignUpSchema>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' }
  });

  const onSubmit = async (data: SignUpSchema) => {
    setStatus('idle');
    setError(null);

    const response = await fetch('/api/auth/sign-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.email, password: data.password })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload.error === 'string' ? payload.error : dictionary.auth.forms.signUp.errorMessage;
      setError(message);
      setStatus('error');
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | { ok: true; requiresEmailVerification: boolean }
      | null;

    if (!payload) {
      setError(dictionary.auth.forms.signUp.unexpectedResponseMessage);
      setStatus('error');
      return;
    }

    if (payload.requiresEmailVerification) {
      setStatus('needsVerification');
      return;
    }

    setStatus('success');
    router.replace('/');
    router.refresh();
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2 text-left">
        <Label htmlFor="email">{dictionary.auth.forms.common.emailLabel}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder={dictionary.auth.forms.common.emailPlaceholder}
          {...register('email')}
        />
        {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
      </div>
      <div className="space-y-2 text-left">
        <Label htmlFor="password">{dictionary.auth.forms.common.passwordLabel}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder={dictionary.auth.forms.common.passwordPlaceholder}
          {...register('password')}
        />
        {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
      </div>
      <div className="space-y-2 text-left">
        <Label htmlFor="confirmPassword">{dictionary.auth.forms.common.confirmPasswordLabel}</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder={dictionary.auth.forms.common.confirmPasswordPlaceholder}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting || status === 'success'}>
        {isSubmitting ? dictionary.auth.forms.signUp.submittingLabel : dictionary.auth.forms.signUp.submitLabel}
      </Button>
      {status === 'needsVerification' && (
        <p className="text-sm text-slate-600">{dictionary.auth.forms.signUp.needsVerificationMessage}</p>
      )}
      {status === 'success' && (
        <p className="text-sm text-emerald-600">{dictionary.auth.forms.signUp.successMessage}</p>
      )}
      {status === 'error' && error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
