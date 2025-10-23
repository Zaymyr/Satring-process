'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const signUpSchema = z
  .object({
    email: z.string().min(1, "Adresse e-mail obligatoire").email("Adresse e-mail invalide"),
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
    confirmPassword: z.string().min(8, 'Veuillez confirmer votre mot de passe.')
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword']
  });

type SignUpSchema = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'success' | 'needsVerification' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

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
      const message = typeof payload.error === 'string' ? payload.error : 'Impossible de créer le compte.';
      setError(message);
      setStatus('error');
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | { ok: true; requiresEmailVerification: boolean }
      | null;

    if (!payload) {
      setError('Réponse inattendue du serveur.');
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
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="vous@example.com" {...register('email')} />
        {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
      </div>
      <div className="space-y-2 text-left">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          {...register('password')}
        />
        {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
      </div>
      <div className="space-y-2 text-left">
        <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting || status === 'success'}>
        {isSubmitting ? 'Création en cours…' : 'Créer un compte'}
      </Button>
      {status === 'needsVerification' && (
        <p className="text-sm text-slate-600">
          Votre compte a été créé. Vérifiez votre boîte mail pour activer votre accès.
        </p>
      )}
      {status === 'success' && (
        <p className="text-sm text-emerald-600">Compte créé avec succès. Redirection en cours…</p>
      )}
      {status === 'error' && error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
