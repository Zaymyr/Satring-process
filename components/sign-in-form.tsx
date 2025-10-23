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
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Impossible de se connecter.");
      setStatus('error');
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
