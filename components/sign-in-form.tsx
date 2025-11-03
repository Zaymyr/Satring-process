'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const signInSchema = z.object({
  email: z.string().min(1, 'Adresse e-mail obligatoire').email("Adresse e-mail invalide"),
  password: z.string().min(1, 'Mot de passe obligatoire')
});

type SignInSchema = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
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
      let message = 'Impossible de se connecter.';

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
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" type="email" placeholder="vous@example.com" autoComplete="email" {...register('email')} />
        {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
      </div>
      <div className="space-y-2 text-left">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting || status === 'success'}>
        {isSubmitting ? 'Connexion en cours…' : 'Se connecter'}
      </Button>
      {status === 'success' && <p className="text-sm text-emerald-600">Connexion réussie. Redirection…</p>}
      {status === 'error' && error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
