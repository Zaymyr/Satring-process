'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const signInSchema = z.object({
  email: z.string().min(1, 'Adresse e-mail obligatoire').email("Adresse e-mail invalide")
});

type SignInSchema = z.infer<typeof signInSchema>;

export function SignInForm() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting }
  } = useForm<SignInSchema>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '' }
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
      setError(payload.error ?? 'Impossible d\'envoyer le lien de connexion.');
      setStatus('error');
      return;
    }
    setStatus('sent');
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2 text-left">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" type="email" placeholder="vous@example.com" autoComplete="email" {...register('email')} />
        {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting || status === 'sent'}>
        {isSubmitting ? 'Envoi en cours…' : status === 'sent' ? 'Lien envoyé !' : 'Recevoir un lien magique'}
      </Button>
      {status === 'sent' && (
        <p className="text-sm text-slate-600">Vérifiez votre boîte mail pour accéder à votre espace.</p>
      )}
      {status === 'error' && error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
