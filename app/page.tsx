import type { Metadata } from 'next';
import { ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Satring — Process clarity made simple',
  description:
    'Unifiez votre processus dans une interface épurée : un espace, deux panneaux, zéro distraction.'
};

const highlights = [
  {
    title: 'Structure limpide',
    description: "Une colonne pour la vision, l'autre pour l'action. Rien de plus, rien de moins.",
    icon: Sparkles
  },
  {
    title: 'Sécurité intégrée',
    description: 'Supabase, RLS et Drizzle sont prêts pour vos prochaines étapes.',
    icon: ShieldCheck
  }
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-16 lg:flex-row lg:items-stretch">
        <section className="flex flex-1 flex-col justify-between gap-12">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-1 text-xs uppercase tracking-[0.2em] text-slate-500 shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4" />
              Nouveau départ
            </p>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                Une base nette pour vos processus.
              </h1>
              <p className="max-w-xl text-base text-slate-600">
                Démarrez avec un canevas Next.js épuré. Deux panneaux, une vision claire, le tout prêt pour vos données et vos flux Supabase.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="group bg-slate-900 text-white hover:bg-slate-800">
                Commencer maintenant
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="outline" className="border-slate-300 bg-white/70 text-slate-900 hover:bg-white">
                Voir la documentation
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {highlights.map((item) => (
              <Card key={item.title} className="border-slate-200 bg-white/90 shadow-sm">
                <CardContent className="flex flex-col gap-2 p-5">
                  <item.icon className="h-5 w-5 text-slate-500" />
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-600">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
        <aside className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900">Espace secondaire</h2>
            <p className="text-sm text-slate-600">
              Utilisez ce panneau pour collecter des idées, afficher des actions rapides ou intégrer un formulaire shadcn/ui.
            </p>
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-5">
              <h3 className="text-sm font-medium text-slate-900">Prochaines étapes</h3>
              <ul className="space-y-3 text-sm text-slate-600">
                <li>• Connectez vos tables Drizzle et vos migrations Supabase.</li>
                <li>• Configurez vos formulaires avec react-hook-form et zod.</li>
                <li>• Alimentez ce panneau avec TanStack Query.</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-100 to-slate-200 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Bon à savoir</p>
              <p className="mt-3 text-sm text-slate-700">
                Toutes les couches de sécurité — RLS, RPC et en-têtes stricts — sont prêtes pour vos futures fonctionnalités.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
