'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const passwordResetRequestSchema = z.object({
  email: z
    .string({ required_error: "Adresse e-mail obligatoire" })
    .min(1, "Adresse e-mail obligatoire")
    .email("Adresse e-mail invalide")
});

type PasswordResetRequestSchema = z.infer<typeof passwordResetRequestSchema>;

export function PasswordResetRequestForm() {
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
      const message = typeof payload.error === 'string' ? payload.error : "Impossible d'envoyer le lien.";
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
        <h2 className="text-sm font-semibold text-slate-900">Mot de passe oublié ?</h2>
        <p className="text-xs text-slate-600">
          Recevez un e-mail sécurisé pour définir un nouveau mot de passe et retrouver votre accès.
        </p>
      </div>
      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="reset-email" className="text-xs">
            Adresse e-mail
          </Label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            placeholder="vous@example.com"
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>
        <Button type="submit" className="w-full" variant="secondary" disabled={isSubmitting || status === 'success'}>
          {isSubmitting ? 'Envoi en cours…' : 'Recevoir un lien de réinitialisation'}
        </Button>
        {status === 'success' && (
          <p className="text-xs text-emerald-600">
            Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé.
          </p>
        )}
        {status === 'error' && error && <p className="text-xs text-red-500">{error}</p>}
      </form>
    </div>
  );
}
