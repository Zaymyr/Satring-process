'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  GitBranch,
  ListChecks,
  PlayCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  type LucideIcon
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type StepType = 'start' | 'action' | 'decision' | 'finish';

type Step = {
  id: string;
  label: string;
  type: StepType;
};

const STEP_TYPE_LABELS: Record<StepType, string> = {
  start: 'Départ',
  action: 'Action',
  decision: 'Décision',
  finish: 'Arrivée'
};

const STEP_TYPE_ICONS: Record<StepType, LucideIcon> = {
  start: PlayCircle,
  action: ListChecks,
  decision: GitBranch,
  finish: Flag
};

function generateStepId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `step-${Math.random().toString(36).slice(2, 10)}`;
}

type LandingPanelsProps = {
  highlights: readonly Highlight[];
};

export function LandingPanels({ highlights }: LandingPanelsProps) {
  const [isPrimaryCollapsed, setIsPrimaryCollapsed] = useState(false);
  const [isSecondaryCollapsed, setIsSecondaryCollapsed] = useState(false);
  const [steps, setSteps] = useState<Step[]>(() => [
    { id: 'start', label: 'Commencer', type: 'start' },
    { id: 'finish', label: 'Terminer', type: 'finish' }
  ]);

  const addStep = (type: Extract<StepType, 'action' | 'decision'>) => {
    const label = type === 'action' ? 'Nouvelle action' : 'Nouvelle décision';
    setSteps((prev) => {
      const finishIndex = prev.findIndex((step) => step.type === 'finish');
      const nextStep: Step = { id: generateStepId(), label, type };

      if (finishIndex === -1) {
        return [...prev, nextStep];
      }

      return [...prev.slice(0, finishIndex), nextStep, ...prev.slice(finishIndex)];
    });
  };

  const updateStepLabel = (id: string, label: string) => {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, label } : step)));
  };

  const updateStepType = (id: string, type: Extract<StepType, 'action' | 'decision'>) => {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, type } : step)));
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== id));
  };

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
              'flex h-full w-full flex-col gap-12 rounded-3xl border border-slate-200 bg-white/85 px-10 py-14 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.35)] backdrop-blur transition-all duration-300 ease-out sm:px-12',
              isPrimaryCollapsed
                ? 'pointer-events-none opacity-0 lg:translate-x-[-110%]'
                : 'pointer-events-auto opacity-100 lg:translate-x-0'
            )}
          >
            <div className="space-y-5">
              <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-1 text-xs uppercase tracking-[0.2em] text-slate-500 shadow-sm backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Bâtissez votre flux
              </p>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
                  Décrivez chaque étape de votre processus.
                </h1>
                <p className="text-base text-slate-600">
                  Ajoutez des étapes d’action ou de décision entre un départ immuable et une arrivée certaine. Ajustez-les à la volée : tout est prêt pour documenter vos futurs parcours.
                </p>
              </div>
            </div>
            <div className="space-y-8 rounded-2xl border border-slate-200 bg-white/75 p-6 shadow-inner">
              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={() => addStep('action')} className="bg-slate-900 text-white hover:bg-slate-800">
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter une action
                </Button>
                <Button type="button" variant="outline" onClick={() => addStep('decision')} className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50">
                  <GitBranch className="mr-2 h-4 w-4" />
                  Ajouter une décision
                </Button>
              </div>
              <div className="space-y-4">
                {steps.map((step, index) => {
                  const Icon = STEP_TYPE_ICONS[step.type];
                  const isConfigurable = step.type === 'action' || step.type === 'decision';
                  const stepPosition = index + 1;

                  return (
                    <Card key={step.id} className="border-slate-200 bg-white/90 shadow-sm">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 text-slate-600">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                              {stepPosition}
                            </span>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-slate-500" />
                              <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                                {STEP_TYPE_LABELS[step.type]}
                              </span>
                            </div>
                          </div>
                          {isConfigurable ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeStep(step.id)}
                              className="h-8 w-8 text-slate-400 hover:text-slate-900"
                              aria-label="Supprimer l’étape"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`step-${step.id}-label`} className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            Intitulé
                          </Label>
                          <Input
                            id={`step-${step.id}-label`}
                            value={step.label}
                            onChange={(event) => updateStepLabel(step.id, event.target.value)}
                            className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50"
                          />
                        </div>
                        {isConfigurable ? (
                          <div className="space-y-2">
                            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Type d’étape</span>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant={step.type === 'action' ? 'default' : 'outline'}
                                onClick={() => updateStepType(step.id, 'action')}
                                className={cn(
                                  'flex-1 border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
                                  step.type === 'action' && 'border-transparent bg-slate-900 text-white hover:bg-slate-800'
                                )}
                              >
                                <ListChecks className="mr-2 h-4 w-4" />
                                Action
                              </Button>
                              <Button
                                type="button"
                                variant={step.type === 'decision' ? 'default' : 'outline'}
                                onClick={() => updateStepType(step.id, 'decision')}
                                className={cn(
                                  'flex-1 border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
                                  step.type === 'decision' && 'border-transparent bg-slate-900 text-white hover:bg-slate-800'
                                )}
                              >
                                <GitBranch className="mr-2 h-4 w-4" />
                                Décision
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
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
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Aperçu du parcours</h2>
              <p className="text-sm text-slate-600">
                Visualisez la progression de votre process pendant que vous le façonnez. Chaque étape reste synchronisée avec vos ajustements dans le panneau principal.
              </p>
            </div>
            <div className="space-y-5 rounded-2xl border border-slate-200 bg-white/80 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Chronologie</h3>
              <ol className="space-y-4">
                {steps.map((step, index) => {
                  const Icon = STEP_TYPE_ICONS[step.type];

                  return (
                    <li key={step.id} className="flex items-start gap-3">
                      <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/10 text-xs font-semibold text-slate-700">
                        {index + 1}
                      </span>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-slate-900">
                          <Icon className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-medium">{step.label}</span>
                        </div>
                        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{STEP_TYPE_LABELS[step.type]}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
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
          </aside>
        </div>
      </div>
    </div>
  );
}
