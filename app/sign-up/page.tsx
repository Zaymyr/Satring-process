import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignUpForm } from '@/components/sign-up-form';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Création de compte — Satring',
  description: 'Créez un compte pour sauvegarder et gérer vos process.'
};

export default async function SignUpPage() {
  const supabase = createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl">
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Créer un compte</h1>
          <p className="text-sm text-slate-600">
            Inscrivez-vous pour enregistrer vos process, les retrouver et les mettre à jour en toute sécurité.
          </p>
        </div>
        <SignUpForm />
        <div className="space-y-1 text-center text-xs text-slate-500">
          <p>
            Déjà un compte ?{' '}
            <Link href="/sign-in" className="font-medium text-slate-700 hover:underline">
              Se connecter
            </Link>
          </p>
          <p>
            <Link href="/" className="font-medium text-slate-700 hover:underline">
              Retour à l’accueil
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
