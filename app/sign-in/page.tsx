import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignInForm } from '@/components/sign-in-form';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Connexion — Satring',
  description: 'Recevez un lien sécurisé pour modifier votre process.'
};

export default async function SignInPage() {
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
          <h1 className="text-xl font-semibold text-slate-900">Connexion</h1>
          <p className="text-sm text-slate-600">
            Connectez-vous avec vos identifiants pour modifier et sauvegarder vos process.
          </p>
        </div>
        <SignInForm />
        <div className="space-y-1 text-center text-xs text-slate-500">
          <p>
            Pas encore de compte ?{' '}
            <Link href="/sign-up" className="font-medium text-slate-700 hover:underline">
              Créer un compte
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
