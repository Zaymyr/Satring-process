'use client';

import { useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ListChecks,
  PanelsTopLeft,
  Sparkles,
  Workflow
} from 'lucide-react';

import { cn } from '@/lib/utils/cn';

const highlightStats: ReadonlyArray<{
  id: string;
  label: string;
  value: string;
  description: string;
  tone: 'emerald' | 'amber' | 'sky';
}> = [
  {
    id: 'validated-steps',
    label: 'Étapes validées',
    value: '4 / 6',
    description: 'Les blocs principaux sont prêts pour export.',
    tone: 'emerald'
  },
  {
    id: 'decisions-open',
    label: 'Décisions ouvertes',
    value: '2',
    description: 'Analyse UX et validation produit en attente.',
    tone: 'amber'
  },
  {
    id: 'owners',
    label: 'Responsables mobilisés',
    value: '3 équipes',
    description: 'Opérations, Produit et Ingénierie collaborent.',
    tone: 'sky'
  }
];

const outlineSteps: ReadonlyArray<{
  id: string;
  title: string;
  owner: string;
  description: string;
  status: 'termine' | 'en-cours' | 'bloque';
}> = [
  {
    id: 'S1',
    title: 'Collecte du contexte',
    owner: 'Opérations',
    description: 'Cartographier les acteurs, périmètre et déclencheurs du flux.',
    status: 'termine'
  },
  {
    id: 'S2',
    title: 'Validation des parcours',
    owner: 'Produit',
    description: 'Confirmer que chaque persona suit une trajectoire explicite.',
    status: 'en-cours'
  },
  {
    id: 'S3',
    title: 'Prototype Mermaid',
    owner: 'Ingénierie',
    description: 'Assembler le diagramme et préparer la démo interne.',
    status: 'bloque'
  }
];

const panelFocusItems: ReadonlyArray<{
  id: string;
  label: string;
  value: string;
  icon: typeof Sparkles;
}> = [
  {
    id: 'mode',
    label: 'Mode de travail',
    value: 'Atelier collaboratif',
    icon: PanelsTopLeft
  },
  {
    id: 'next-review',
    label: 'Prochaine revue',
    value: 'Vendredi · 10h00',
    icon: CalendarDays
  },
  {
    id: 'export',
    label: 'Export Mermaid',
    value: 'Synchronisé il y a 2 jours',
    icon: Sparkles
  }
];

const panelChecklist: ReadonlyArray<{
  id: string;
  label: string;
  completed: boolean;
}> = [
  {
    id: 'inputs',
    label: 'Lister les points d’entrée et de sortie du flux',
    completed: true
  },
  {
    id: 'owners',
    label: 'Attribuer un propriétaire à chaque décision critique',
    completed: false
  },
  {
    id: 'communication',
    label: 'Préparer la note de partage pour l’équipe projet élargie',
    completed: false
  }
];

export function DiagramWorkspace() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  return (
    <div className="relative isolate flex min-h-[calc(100vh-12rem)] flex-col gap-6 rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 shadow-sm backdrop-blur lg:flex-row lg:p-10">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl">
        <div className="absolute -top-32 left-12 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl" aria-hidden />
        <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" aria-hidden />
      </div>

      <div className="flex flex-1 flex-col gap-6">
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Atelier en cours
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 lg:text-3xl">
                Construisez votre diagramme Mermaid étape par étape
              </h2>
              <p className="text-sm text-slate-600">
                Ordonnez les blocs, validez les décisions et suivez la progression pour garder votre documentation synchronisée.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {highlightStats.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-left shadow-sm backdrop-blur',
                    item.tone === 'emerald' && 'border-emerald-200/70 bg-emerald-50/70',
                    item.tone === 'amber' && 'border-amber-200/70 bg-amber-50/70',
                    item.tone === 'sky' && 'border-sky-200/70 bg-sky-50/70'
                  )}
                >
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{item.value}</p>
                  <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid flex-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-slate-500 shadow-inner">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Aperçu du diagramme</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Connectez les étapes pour générer un aperçu en direct du rendu Mermaid.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                  <Workflow className="h-4 w-4 text-sky-500" />
                  Flux vertical TD
                </span>
              </div>
              <div className="pointer-events-none mt-8 hidden rounded-2xl border border-slate-900/80 bg-slate-950/95 p-6 text-left text-[11px] leading-relaxed text-slate-200 shadow-xl lg:block">
                <pre>{`flowchart TD
  Start([Début]) --> A[Collecte du contexte]
  A --> B{Validation des parcours}
  B -->|Valide| C[Prototype Mermaid]
  B -->|À revoir| D[Itération Produit]
  C --> E[Présentation client]
  E --> End([Mise en production])`}</pre>
              </div>
              <p className="mt-6 text-xs text-slate-500">
                Astuce : ajoutez des identifiants cohérents pour réutiliser facilement le diagramme dans Notion ou vos slides.
              </p>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Étapes structurantes</h3>
                  <p className="text-sm text-slate-600">Synchronisez la narration du processus avant de lancer l’export.</p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                >
                  <ClipboardList className="h-4 w-4" />
                  Réordonner
                </button>
              </div>
              <div className="mt-6 space-y-4">
                {outlineSteps.map((step) => (
                  <article
                    key={step.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                          {step.id}
                        </span>
                        <StatusBadge status={step.status} />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900">{step.title}</h4>
                      <p className="text-xs text-slate-600">{step.description}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Sparkles className="h-4 w-4 text-sky-500" />
                      {step.owner}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <FloatingPanel isOpen={isPanelOpen} onToggle={() => setIsPanelOpen((prev) => !prev)} />
        </div>
      </div>
    </div>
  );
}

type StatusBadgeProps = {
  status: 'termine' | 'en-cours' | 'bloque';
};

function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case 'termine':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Terminé
        </span>
      );
    case 'en-cours':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
          <Workflow className="h-3.5 w-3.5" /> En cours
        </span>
      );
    case 'bloque':
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          <ListChecks className="h-3.5 w-3.5" /> À débloquer
        </span>
      );
  }
}

type FloatingPanelProps = {
  isOpen: boolean;
  onToggle: () => void;
};

function FloatingPanel({ isOpen, onToggle }: FloatingPanelProps) {
  return (
    <aside
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 shadow-2xl backdrop-blur transition-all duration-300 ease-out',
        'max-lg:order-last max-lg:w-full',
        isOpen ? 'lg:w-80' : 'lg:w-16'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="absolute -left-4 top-6 hidden h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-lg transition hover:border-slate-300 hover:text-slate-900 lg:flex"
        aria-label={isOpen ? 'Réduire le panneau latéral' : 'Déployer le panneau latéral'}
      >
        {isOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 lg:hidden">
        <span className="text-sm font-semibold text-slate-900">Synthèse</span>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
        >
          {isOpen ? 'Masquer' : 'Afficher'}
        </button>
      </div>

      {isOpen ? (
        <div className="flex flex-1 flex-col gap-6 px-6 py-6">
          <header className="hidden border-b border-slate-200/80 pb-5 lg:block">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Panneau latéral</p>
            <h3 className="mt-2 text-base font-semibold text-slate-900">Synthèse & actions</h3>
            <p className="mt-1 text-xs text-slate-600">
              Ajustez les éléments clés sans quitter votre aperçu de diagramme.
            </p>
          </header>

          <section className="space-y-4">
            {panelFocusItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm"
              >
                <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <item.icon className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">Checklist de l’atelier</h4>
            <ul className="space-y-2 text-xs text-slate-600">
              {panelChecklist.map((item) => (
                <li key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200/70 bg-white/95 p-3 shadow-sm">
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border',
                      item.completed
                        ? 'border-emerald-300 bg-emerald-100 text-emerald-600'
                        : 'border-slate-200 bg-white text-slate-400'
                    )}
                    aria-hidden
                  >
                    {item.completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="leading-relaxed">{item.label}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-2 py-6 text-slate-400">
          <PanelsTopLeft className="h-5 w-5" />
          <p className="rotate-180 text-xs [writing-mode:vertical-rl]">Synthèse</p>
        </div>
      )}
    </aside>
  );
}
