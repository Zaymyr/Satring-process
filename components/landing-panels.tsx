'use client';

import { useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  type LucideIcon
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

const highlightIcons = {
  sparkles: Sparkles,
  shield: ShieldCheck
} as const satisfies Record<string, LucideIcon>;

type Highlight = {
  title: string;
  description: string;
  icon: keyof typeof highlightIcons;
};

type LandingPanelsProps = {
  highlights: readonly Highlight[];
};

export function LandingPanels({ highlights }: LandingPanelsProps) {
  const [isPrimaryCollapsed, setIsPrimaryCollapsed] = useState(false);
  const [isSecondaryCollapsed, setIsSecondaryCollapsed] = useState(false);

  const primaryWidth = isPrimaryCollapsed ? '3.5rem' : 'min(40rem, 100%)';
  const secondaryWidth = isSecondaryCollapsed ? '3.5rem' : 'min(28rem, 100%)';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900">
      <div className="flex min-h-screen w-full flex-col gap-8 px-4 py-12 lg:flex-row lg:items-stretch lg:justify-between lg:gap-10 lg:px-10 lg:py-16">
        <div
          className="relative flex shrink-0 items-stretch overflow-hidden transition-[width] duration-300 ease-out"
          style={{ width: primaryWidth }}
        >
          <button
            type="button"
            onClick={() => setIsPrimaryCollapsed((prev) => !prev)}
            aria-expanded={!isPrimaryCollapsed}
            aria-controls="primary-panel"
            className="absolute left-2 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white lg:left-3"
          >
            {isPrimaryCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            <span className="sr-only">Basculer le panneau principal</span>
          </button>
          <div
            id="primary-panel"
            className={cn(
              'flex h-full w-full flex-col justify-between gap-12 rounded-3xl border border-slate-200 bg-white/80 px-12 py-16 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.35)] backdrop-blur transition-all duration-300 ease-out sm:px-14',
              isPrimaryCollapsed
                ? 'pointer-events-none opacity-0 lg:translate-x-[-110%]'
                : 'pointer-events-auto opacity-100 lg:translate-x-0'
            )}
          >
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
              {highlights.map((item) => {
                const Icon = highlightIcons[item.icon];

                return (
                  <Card key={item.title} className="border-slate-200 bg-white/90 shadow-sm">
                    <CardContent className="flex flex-col gap-2 p-5">
                      <Icon className="h-5 w-5 text-slate-500" />
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-600">{item.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
        <div
          className="relative flex shrink-0 items-stretch overflow-hidden transition-[width] duration-300 ease-out"
          style={{ width: secondaryWidth }}
        >
          <button
            type="button"
            onClick={() => setIsSecondaryCollapsed((prev) => !prev)}
            aria-expanded={!isSecondaryCollapsed}
            aria-controls="secondary-panel"
            className="absolute right-2 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white lg:right-3"
          >
            {isSecondaryCollapsed ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            <span className="sr-only">Basculer le panneau secondaire</span>
          </button>
          <aside
            id="secondary-panel"
            className={cn(
              'flex h-full w-full flex-col gap-6 rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.35)] backdrop-blur transition-all duration-300 ease-out',
              isSecondaryCollapsed
                ? 'pointer-events-none opacity-0 lg:translate-x-[110%]'
                : 'pointer-events-auto opacity-100 lg:translate-x-0'
            )}
          >
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-900">Espace secondaire</h2>
              <p className="text-sm text-slate-600">
                Utilisez ce panneau pour collecter des idées, afficher des actions rapides ou intégrer un formulaire shadcn/ui.
              </p>
            </div>
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
          </aside>
        </div>
      </div>
    </div>
  );
}
