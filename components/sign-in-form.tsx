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

const createSignInSchema = (dictionary: Dictionary) =>
  z.object({
    email: z
      .string()
      .min(1, dictionary.auth.forms.signIn.validation.emailRequired)
      .email(dictionary.auth.forms.signIn.validation.emailInvalid),
    password: z.string().min(1, dictionary.auth.forms.signIn.validation.passwordRequired)
  });

type SignInSchema = z.infer<ReturnType<typeof createSignInSchema>>;

export function SignInForm() {
  const { dictionary } = useI18n();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const signInSchema = useMemo(() => createSignInSchema(dictionary), [dictionary]);
  const {
    handleSubmit,
    register,
    resetField,
    formState: { errors, isSubmitting }
  } = useForm<SignInSchema>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' }
  });

  const onSubmit = async (data: SignInSchema) => {
    setStatus('idle');
    setError(null);
    const response = await fetch('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as unknown;
      let message = dictionary.auth.forms.signIn.errorMessage;

      if (payload && typeof payload === 'object' && 'error' in payload) {
        const errorValue = (payload as { error: unknown }).error;

        if (typeof errorValue === 'string') {
          message = errorValue;
        } else if (
          errorValue &&
          typeof errorValue === 'object' &&
          'formErrors' in errorValue &&
          Array.isArray((errorValue as { formErrors?: unknown }).formErrors) &&
          (errorValue as { formErrors: unknown[] }).formErrors.length > 0 &&
          typeof (errorValue as { formErrors: unknown[] }).formErrors[0] === 'string'
        ) {
          message = (errorValue as { formErrors: string[] }).formErrors[0];
        } else if (
          errorValue &&
          typeof errorValue === 'object' &&
          'fieldErrors' in errorValue &&
          (errorValue as { fieldErrors?: unknown }).fieldErrors &&
          typeof (errorValue as { fieldErrors?: unknown }).fieldErrors === 'object'
        ) {
          const fieldErrors = (errorValue as { fieldErrors: Record<string, unknown> }).fieldErrors;

          for (const value of Object.values(fieldErrors)) {
            if (typeof value === 'string') {
              message = value;
              break;
            }

            if (Array.isArray(value)) {
              const nestedError = value.find((item): item is string => typeof item === 'string');

              if (nestedError) {
                message = nestedError;
                break;
              }
            }
          }
        }
      }

      setError(message);
      setStatus('error');
      resetField('password');
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
          placeholder={dictionary.auth.forms.common.emailPlaceholder}
          autoComplete="email"
          {...register('email')}
        />
        {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
      </div>
      <div className="space-y-2 text-left">
        <Label htmlFor="password">{dictionary.auth.forms.common.passwordLabel}</Label>
        <Input
          id="password"
          type="password"
          placeholder={dictionary.auth.forms.common.passwordPlaceholder}
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting || status === 'success'}>
        {isSubmitting ? dictionary.auth.forms.signIn.submittingLabel : dictionary.auth.forms.signIn.submitLabel}
      </Button>
      {status === 'success' && (
        <p className="text-sm text-emerald-600">{dictionary.auth.forms.signIn.successMessage}</p>
      )}
      {status === 'error' && error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
