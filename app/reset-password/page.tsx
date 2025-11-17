import type { Metadata } from 'next';
import Link from 'next/link';

import { ResetPasswordForm } from '@/components/reset-password-form';
import { ResetPasswordTokenHandler } from '@/components/reset-password-token-handler';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Réinitialisation du mot de passe — Satring',
  description: 'Définissez un nouveau mot de passe pour sécuriser votre compte.'
};

export default async function ResetPasswordPage() {
  const supabase = createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl">
        <ResetPasswordTokenHandler />
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Réinitialiser le mot de passe</h1>
          <p className="text-sm text-slate-600">
            Choisissez un nouveau mot de passe pour sécuriser votre compte Satring.
          </p>
        </div>
        {user ? (
          <ResetPasswordForm />
        ) : (
          <div className="space-y-4 text-center text-sm text-slate-600">
            <p>Le lien de réinitialisation est invalide ou a expiré.</p>
            <p>Retournez à la page de connexion pour demander un nouveau lien.</p>
            <Link href="/sign-in" className="text-sm font-medium text-slate-700 hover:underline">
              Retour à la connexion
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
