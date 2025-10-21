import { Metadata } from 'next';
import { SignInForm } from '@/components/sign-in-form';

export const metadata: Metadata = {
  title: 'Connexion — Visualiseur de processus Mermaid'
};

export default function SignInPage() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
      <div className="mb-6 space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Se connecter</h1>
        <p className="text-sm text-slate-600">Recevez un lien magique pour accéder à votre espace de travail.</p>
      </div>
      <SignInForm />
    </div>
  );
}
