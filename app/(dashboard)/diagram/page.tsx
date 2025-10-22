import { Metadata } from 'next';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Palette,
  Sparkles,
  Workflow
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Diagramme — Visualiseur de processus Mermaid'
};

const diagramPreferences: ReadonlyArray<{
  id: string;
  title: string;
  status: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: 'departments',
    title: 'Départements',
    status: 'Visible',
    description: 'Affiche les regroupements colorés pour situer les responsabilités.',
    icon: Layers
  },
  {
    id: 'roles',
    title: 'Rôles et couleurs',
    status: 'Alignés',
    description: 'Superpose les rôles clés pour clarifier les intervenants.',
    icon: Palette
  },
  {
    id: 'orientation',
    title: 'Orientation',
    status: 'Verticale (TD)',
    description: 'Inversez le sens pour adapter le diagramme à votre présentation.',
    icon: ArrowUpDown
  }
];

const departmentTree: ReadonlyArray<{
  name: string;
  summary: string;
  color: string;
  roles: ReadonlyArray<string>;
}> = [
  {
    name: 'Opérations',
    summary: 'Pilote la collecte initiale et le cadrage des besoins.',
    color: '#38bdf8',
    roles: ['Chef de projet', 'Analyste métier']
  },
  {
    name: 'Produit',
    summary: 'Valide les hypothèses et mesure l’impact client.',
    color: '#a855f7',
    roles: ['Product manager', 'UX designer']
  },
  {
    name: 'Ingénierie',
    summary: 'Sécurise la mise en production et l’automatisation.',
    color: '#10b981',
    roles: ['Tech lead', 'DevOps']
  }
];

const processSteps: ReadonlyArray<{
  id: string;
  label: string;
  type: 'process' | 'decision';
  description: string;
  owner: string;
}> = [
  {
    id: 'S1',
    label: 'Collecte du contexte',
    type: 'process',
    description: 'Réunir les parties prenantes et cadrer les attentes avant le premier atelier.',
    owner: 'Opérations'
  },
  {
    id: 'S2',
    label: 'Analyse des personas',
    type: 'decision',
    description: 'Identifier si les parcours existants couvrent tous les profils visés.',
    owner: 'Produit'
  },
  {
    id: 'S3',
    label: 'Prototype Mermaid',
    type: 'process',
    description: 'Assembler les étapes validées et préparer la démonstration client.',
    owner: 'Ingénierie'
  }
];

export default function DiagramPage() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-50/70 via-white to-indigo-50/80 shadow-xl">
      <div className="pointer-events-none absolute -top-20 left-16 h-64 w-64 rounded-full bg-sky-200/50 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-24 top-32 h-72 w-72 rounded-full bg-indigo-200/50 blur-3xl" aria-hidden />
      <div className="relative flex flex-col gap-10 p-6 lg:p-10">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Espace de travail</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 lg:text-3xl">
              Visualisez et orchestrez votre diagramme Mermaid
            </h2>
            <p className="mt-3 max-w-xl text-sm text-slate-600">
              Ajustez les départements, attribuez les rôles et suivez la progression du flux avant d’exporter le code Mermaid.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 text-sm text-slate-600 sm:flex-row sm:items-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 font-medium text-slate-700 shadow-sm">
              <Sparkles className="h-4 w-4 text-sky-500" />
              Diagramme prêt pour l’atelier
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-slate-500 shadow-sm">
              <Palette className="h-4 w-4 text-indigo-500" />
              4 départements actifs
            </span>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
          <aside className="relative flex flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/70 px-6 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Organisation</p>
                <h3 className="text-base font-semibold text-slate-900">Contexte de l’équipe</h3>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                aria-label="Réduire le panneau organisation"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-6 px-6 py-6">
              <p className="text-sm text-slate-600">
                Associez les départements aux rôles pour éclairer les interactions clés dans le diagramme.
              </p>
              <div className="space-y-4">
                {departmentTree.map((department) => (
                  <div
                    key={department.name}
                    className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{department.name}</p>
                        <p className="text-xs text-slate-500">{department.summary}</p>
                      </div>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                        <span
                          aria-hidden
                          className="h-6 w-6 rounded-full"
                          style={{ backgroundColor: department.color }}
                        />
                        <span className="sr-only">Couleur du département {department.name}</span>
                      </span>
                    </div>
                    <ul className="mt-4 space-y-2 text-xs text-slate-500">
                      {department.roles.map((role) => (
                        <li key={role} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden />
                          {role}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Conseil : imbriquez les rôles dans chaque département pour mettre en évidence les boucles de validation.
              </p>
            </div>
          </aside>

          <section className="flex flex-col gap-6">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-6 shadow-lg backdrop-blur">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="max-w-md space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-600">Étape de début</p>
                  <h3 className="text-xl font-semibold text-slate-900">Lancement</h3>
                  <p className="text-sm text-slate-600">
                    Validez la portée, consolidez les interlocuteurs et confirmez l’objectif du diagramme avec l’équipe.
                  </p>
                </div>
                <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-700">
                    <Sparkles className="h-4 w-4 text-sky-500" />
                    Flux de 6 étapes
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                    <Workflow className="h-4 w-4 text-emerald-500" />
                    Automatisation activée
                  </span>
                </div>
              </div>
              <div className="mt-6 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Description</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Documentez les actions clés et liez chaque étape à un responsable pour fluidifier la relecture en atelier.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Livrable</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Exporte un bloc Mermaid prêt à intégrer dans vos slides, Notion ou documentation technique.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 text-center text-slate-500 shadow-inner">
              <div className="pointer-events-none absolute inset-x-12 top-6 hidden rounded-2xl border border-slate-100 bg-slate-900/95 p-6 text-left text-xs leading-6 text-slate-300 shadow-xl sm:block">
                <pre className="whitespace-pre text-[11px]">
{`flowchart TD
  Start([Lancement]) --> A[Collecte du contexte]
  A --> B{Analyse des personas}
  B -->|Parcours aligné| C[Prototype Mermaid]
  B -->|Gaps détectés| D[Itération Produit]
  C --> E[Validation client]
  E --> End([Mise en production])`}
                </pre>
              </div>
              <p className="text-sm font-medium text-slate-600">Votre diagramme apparaîtra ici</p>
              <p className="mt-2 text-xs text-slate-500">
                Connectez vos étapes pour générer automatiquement le rendu Mermaid en temps réel.
              </p>
            </div>

            <div className="rounded-2xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Options du diagramme</h3>
                  <p className="text-sm text-slate-600">
                    Ajustez la visibilité des informations pour préparer vos exports Mermaid.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800"
                >
                  Masquer les options
                </button>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {diagramPreferences.map((preference) => (
                  <div
                    key={preference.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm"
                  >
                    <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                      <preference.icon className="h-5 w-5" />
                    </span>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{preference.title}</p>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                          {preference.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{preference.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="relative flex flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/70 px-6 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Créateur</p>
                <h3 className="text-base font-semibold text-slate-900">Étapes du processus</h3>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                aria-label="Réduire le panneau des étapes"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                >
                  Ajouter une étape
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 shadow-sm transition hover:border-amber-300 hover:text-amber-800"
                >
                  Ajouter une décision
                </button>
              </div>
              <div className="space-y-4">
                {processSteps.map((step) => {
                  const isDecision = step.type === 'decision';

                  return (
                    <article
                      key={step.id}
                      className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                isDecision
                                  ? 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700'
                                  : 'inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700'
                              }
                            >
                              {isDecision ? 'Décision' : 'Étape'}
                            </span>
                            <span className="text-xs text-slate-400">{step.id}</span>
                          </div>
                          <h4 className="text-sm font-semibold text-slate-900">{step.label}</h4>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-semibold text-sky-600 hover:text-sky-700"
                        >
                          Modifier
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{step.description}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                        <Workflow className="h-3.5 w-3.5 text-sky-500" />
                        {step.owner}
                      </div>
                    </article>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">
                Astuce : faites glisser les cartes pour réordonner le flux avant d’exporter le code Mermaid.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
