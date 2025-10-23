'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

type MermaidAPI = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, definition: string) => Promise<{ svg: string }>;
};

declare global {
  interface Window {
    mermaid?: MermaidAPI;
  }
}

let mermaidLoader: Promise<MermaidAPI> | null = null;

function loadMermaid(): Promise<MermaidAPI> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Mermaid nécessite un environnement navigateur.'));
  }

  if (window.mermaid) {
    return Promise.resolve(window.mermaid);
  }

  if (!mermaidLoader) {
    mermaidLoader = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-mermaid]');

      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (window.mermaid) {
            resolve(window.mermaid);
          } else {
            mermaidLoader = null;
            reject(new Error('Mermaid est introuvable après le chargement du script.'));
          }
        });
        existingScript.addEventListener('error', () => {
          mermaidLoader = null;
          reject(new Error('Impossible de charger le script Mermaid.'));
        });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.mermaid = 'true';
      script.addEventListener('load', () => {
        if (window.mermaid) {
          resolve(window.mermaid);
        } else {
          mermaidLoader = null;
          reject(new Error('Mermaid est introuvable après le chargement du script.'));
        }
      });
      script.addEventListener('error', () => {
        mermaidLoader = null;
        reject(new Error('Impossible de charger le script Mermaid.'));
      });
      document.head.appendChild(script);
    });
  }

  return mermaidLoader;
}

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
  const [diagramSvg, setDiagramSvg] = useState('');
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [isMermaidReady, setIsMermaidReady] = useState(false);
  const mermaidAPIRef = useRef<MermaidAPI | null>(null);
  const diagramElementId = useMemo(() => `process-diagram-${generateStepId()}`, []);

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const wrapStepLabel = (value: string) => {
    const normalized = value.trim();
    const source = normalized.length > 0 ? normalized : 'Étape';
    const maxCharsPerLine = 18;
    const words = source.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const tentative = currentLine ? `${currentLine} ${word}` : word;
      if (tentative.length <= maxCharsPerLine) {
        currentLine = tentative;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        if (word.length > maxCharsPerLine) {
          const segments = word.match(new RegExp(`.{1,${maxCharsPerLine}}`, 'g')) ?? [word];
          lines.push(...segments.slice(0, -1));
          currentLine = segments.at(-1) ?? '';
        } else {
          currentLine = word;
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  };

  const diagramDefinition = useMemo(() => {
    if (steps.length === 0) {
      return 'graph TD';
    }

    const classAssignments: string[] = [];
    const nodes = steps.map((step, index) => {
      const nodeId = `S${index}`;
      const baseLabel = step.label.trim() || STEP_TYPE_LABELS[step.type];
      const lines = wrapStepLabel(baseLabel);
      const label = lines.map((line) => escapeHtml(line)).join('<br/>');

      if (step.type === 'action') {
        classAssignments.push(`class ${nodeId} action;`);
        return `${nodeId}["${label}"]`;
      }

      if (step.type === 'decision') {
        classAssignments.push(`class ${nodeId} decision;`);
        return `${nodeId}{"${label}"}`;
      }

      classAssignments.push(`class ${nodeId} terminal;`);
      return `${nodeId}(("${label}"))`;
    });

    const connections = steps
      .slice(0, -1)
      .map((_, index) => `S${index} --> S${index + 1}`);

    const classDefinitions = [
      'classDef terminal fill:#f8fafc,stroke:#0f172a,color:#0f172a,stroke-width:2px;',
      'classDef action fill:#ffffff,stroke:#0f172a,color:#0f172a,stroke-width:2px;',
      'classDef decision fill:#ffffff,stroke:#0f172a,color:#0f172a,stroke-width:2px;'
    ];

    return ['flowchart TD', ...classDefinitions, ...nodes, ...connections, ...classAssignments].join('\n');
  }, [steps]);

  const fallbackDiagram = useMemo(() => {
    if (steps.length === 0) {
      return null;
    }

    const centerX = 450;
    const canvasWidth = 900;
    const horizontalPadding = 64;
    const verticalPadding = 120;
    const stackSpacing = 80;
    const charWidth = 9;
    const lineHeight = 26;
    const maxWidth = 320;
    const minWidth = 180;
    const minActionHeight = 88;
    const minDecisionHeight = 120;
    const minTerminalHeight = 96;
    const contentPaddingY = 36;

    const nodes = steps.reduce<
      Array<{
        step: Step;
        centerY: number;
        halfHeight: number;
        lines: string[];
        width: number;
        height: number;
      }>
    >((acc, step) => {
      const baseLabel = step.label.trim() || STEP_TYPE_LABELS[step.type];
      const lines = wrapStepLabel(baseLabel);
      const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
      const rawWidth = longestLine * charWidth + horizontalPadding;
      const width = Math.min(maxWidth, Math.max(minWidth, rawWidth));
      const contentHeight = Math.max(lines.length, 1) * lineHeight;
      let height = contentHeight + contentPaddingY;

      if (step.type === 'action') {
        height = Math.max(height, minActionHeight);
      } else if (step.type === 'decision') {
        height = Math.max(height, minDecisionHeight);
      } else {
        height = Math.max(height, minTerminalHeight);
      }

      const halfHeight = height / 2;
      const previous = acc.at(-1);
      const centerY = previous
        ? previous.centerY + previous.halfHeight + stackSpacing + halfHeight
        : verticalPadding + halfHeight;

      acc.push({ step, centerY, halfHeight, lines, width, height });
      return acc;
    }, []);

    const canvasHeight =
      (nodes.at(-1)?.centerY ?? verticalPadding) + (nodes.at(-1)?.halfHeight ?? 0) + verticalPadding;

    const diamondPoints = (centerY: number, width: number, height: number) =>
      [
        `${centerX},${centerY - height / 2}`,
        `${centerX + width / 2},${centerY}`,
        `${centerX},${centerY + height / 2}`,
        `${centerX - width / 2},${centerY}`
      ].join(' ');

    return (
      <svg
        role="presentation"
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        className="max-h-full w-full max-w-6xl opacity-90"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="process-arrow"
            viewBox="0 0 12 12"
            refX="6"
            refY="6"
            markerWidth="10"
            markerHeight="10"
            orient="auto"
          >
            <path d="M0 0L12 6L0 12Z" fill="#0f172a" />
          </marker>
          <filter id="process-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="rgba(15,23,42,0.18)" />
          </filter>
        </defs>
        {nodes.slice(0, -1).map((node, index) => {
          const nextNode = nodes[index + 1];
          const startY = node.centerY + node.halfHeight;
          const endY = nextNode.centerY - nextNode.halfHeight;

          return (
            <path
              key={`edge-${node.step.id}-${nextNode.step.id}`}
              d={`M ${centerX} ${startY} C ${centerX} ${startY + 48} ${centerX} ${endY - 48} ${centerX} ${endY}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth={2}
              markerEnd="url(#process-arrow)"
              opacity={0.7}
            />
          );
        })}
        {nodes.map((node) => {
          const { step, centerY, lines, width, height } = node;
          const isTerminal = step.type === 'start' || step.type === 'finish';
          const isDecision = step.type === 'decision';
          const isAction = step.type === 'action';
          const primaryFill = isTerminal ? '#f8fafc' : '#ffffff';
          const strokeColor = '#0f172a';
          const blockOffset = ((lines.length - 1) * 24) / 2;

          return (
            <g key={step.id} filter="url(#process-shadow)">
              {isTerminal ? (
                <ellipse
                  cx={centerX}
                  cy={centerY}
                  rx={width / 2}
                  ry={height / 2}
                  fill={primaryFill}
                  stroke={strokeColor}
                  strokeWidth={2}
                />
              ) : null}
              {isAction ? (
                <rect
                  x={centerX - width / 2}
                  y={centerY - height / 2}
                  width={width}
                  height={height}
                  rx={24}
                  fill={primaryFill}
                  stroke={strokeColor}
                  strokeWidth={2}
                />
              ) : null}
              {isDecision ? (
                <polygon
                  points={diamondPoints(centerY, width, height)}
                  fill={primaryFill}
                  stroke={strokeColor}
                  strokeWidth={2}
                />
              ) : null}
              <text
                x={centerX}
                y={centerY}
                textAnchor="middle"
                fontSize={20}
                fontWeight={600}
                fill="#0f172a"
                dominantBaseline="middle"
              >
                {lines.map((line, lineIndex) => {
                  const dy = lineIndex === 0 ? (lines.length > 1 ? -blockOffset : 0) : 24;

                  return (
                    <tspan key={`${step.id}-line-${lineIndex}`} x={centerX} dy={dy}>
                      {line}
                    </tspan>
                  );
                })}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }, [steps]);

  useEffect(() => {
    let isActive = true;

    loadMermaid()
      .then((mermaid) => {
        if (!isActive) {
          return;
        }
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'neutral',
          themeVariables: {
            fontFamily:
              'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            primaryColor: '#ffffff',
            primaryTextColor: '#0f172a',
            primaryBorderColor: '#0f172a',
            lineColor: '#0f172a',
            tertiaryColor: '#e2e8f0',
            clusterBkg: '#f8fafc',
            clusterBorder: '#94a3b8'
          }
        });
        mermaidAPIRef.current = mermaid;
        setDiagramError(null);
        setIsMermaidReady(true);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }
        console.error('Erreur lors du chargement de Mermaid', error);
        setDiagramError('Impossible de charger le diagramme.');
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const mermaid = mermaidAPIRef.current;
    if (!isMermaidReady || !mermaid) {
      return;
    }

    let isCurrent = true;

    const renderDiagram = async () => {
      try {
        const { svg } = await mermaid.render(diagramElementId, diagramDefinition);
        if (!isCurrent) {
          return;
        }
        setDiagramError(null);
        setDiagramSvg(svg);
      } catch (error) {
        if (!isCurrent) {
          return;
        }
        console.error('Erreur lors du rendu Mermaid', error);
        setDiagramSvg('');
        setDiagramError("Impossible de générer le diagramme pour l'instant.");
      }
    };

    setDiagramSvg('');
    setDiagramError(null);
    void renderDiagram();

    return () => {
      isCurrent = false;
    };
  }, [diagramDefinition, diagramElementId, isMermaidReady]);

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

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== id));
  };

  const primaryWidth = isPrimaryCollapsed ? '3.5rem' : 'clamp(18rem, 28vw, 34rem)';
  const secondaryWidth = isSecondaryCollapsed ? '3.5rem' : 'clamp(16rem, 22vw, 26rem)';

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900">
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden px-6 py-10 sm:px-10">
        {diagramSvg ? (
          <div
            className="max-h-full w-full max-w-6xl opacity-90 [filter:drop-shadow(0_25px_65px_rgba(15,23,42,0.22))] [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-h-full [&_.node rect]:stroke-slate-900 [&_.node rect]:stroke-[1.5px] [&_.node polygon]:stroke-slate-900 [&_.node polygon]:stroke-[1.5px] [&_.node circle]:stroke-slate-900 [&_.node circle]:stroke-[1.5px] [&_.node ellipse]:stroke-slate-900 [&_.node ellipse]:stroke-[1.5px] [&_.edgePath path]:stroke-slate-900 [&_.edgePath path]:stroke-[1.5px] [&_.edgeLabel]:text-slate-900"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: diagramSvg }}
          />
        ) : (
          fallbackDiagram
        )}
        {diagramError ? (
          <span role="status" aria-live="polite" className="sr-only">
            {diagramError}
          </span>
        ) : null}
      </div>
      <div className="relative z-10 flex min-h-screen w-full flex-col gap-6 px-4 py-8 lg:flex-row lg:items-stretch lg:gap-0 lg:justify-between lg:px-8 lg:py-12 xl:px-12">
        <div
          className="relative flex shrink-0 items-stretch overflow-hidden transition-[width] duration-300 ease-out max-h-[calc(100vh-6rem)] lg:order-1 lg:mr-auto lg:max-h-[calc(100vh-8rem)]"
          style={{ width: primaryWidth }}
        >
          <button
            type="button"
            onClick={() => setIsPrimaryCollapsed((prev) => !prev)}
            aria-expanded={!isPrimaryCollapsed}
            aria-controls="primary-panel"
            className={cn(
              'absolute right-2 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white',
              'lg:right-3'
            )}
          >
            {isPrimaryCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            <span className="sr-only">Basculer le panneau principal</span>
          </button>
          <div
            id="primary-panel"
            className={cn(
              'flex h-full w-full flex-col gap-8 overflow-hidden rounded-3xl border border-slate-200 bg-white/85 px-8 py-10 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.35)] backdrop-blur transition-all duration-300 ease-out sm:px-10',
              isPrimaryCollapsed
                ? 'pointer-events-none opacity-0 lg:-translate-x-[110%]'
                : 'pointer-events-auto opacity-100 lg:translate-x-0'
            )}
          >
            <div className="space-y-4">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-3 py-[0.35rem] text-[0.65rem] uppercase tracking-[0.24em] text-slate-500 shadow-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Bâtissez votre flux
              </p>
              <div className="space-y-2.5">
                <h1 className="text-2xl font-semibold leading-snug text-slate-900 sm:text-3xl">
                  Décrivez chaque étape de votre processus.
                </h1>
                <p className="text-sm text-slate-600">
                  Ajoutez des étapes d’action ou de décision entre un départ immuable et une arrivée certaine. Ajustez-les à la volée : tout est prêt pour documenter vos futurs parcours.
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="h-full space-y-6 overflow-y-auto rounded-2xl border border-slate-200 bg-white/75 p-5 pr-2 shadow-inner sm:pr-3">
                <div className="flex flex-wrap gap-2.5">
                  <Button type="button" onClick={() => addStep('action')} className="h-9 rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800">
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Ajouter une action
                  </Button>
                  <Button type="button" variant="outline" onClick={() => addStep('decision')} className="h-9 rounded-md border-slate-300 bg-white px-3 text-sm text-slate-900 hover:bg-slate-50">
                    <GitBranch className="mr-2 h-3.5 w-3.5" />
                    Ajouter une décision
                  </Button>
                </div>
                <div className="space-y-3.5">
                  {steps.map((step, index) => {
                    const Icon = STEP_TYPE_ICONS[step.type];
                    const isRemovable = step.type === 'action' || step.type === 'decision';
                    const stepPosition = index + 1;

                    return (
                      <Card key={step.id} className="border-slate-200 bg-white/90 shadow-sm">
                        <CardContent className="flex items-center gap-3 p-3.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[0.65rem] font-semibold text-slate-600">
                            {stepPosition}
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Icon className="h-3.5 w-3.5" />
                              <span className="text-[0.6rem] font-medium uppercase tracking-[0.24em]">
                                {STEP_TYPE_LABELS[step.type]}
                              </span>
                            </div>
                            <Input
                              id={`step-${step.id}-label`}
                              value={step.label}
                              onChange={(event) => updateStepLabel(step.id, event.target.value)}
                              placeholder="Intitulé de l’étape"
                              className="h-8 w-full border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50"
                            />
                          </div>
                          {isRemovable ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeStep(step.id)}
                              className="h-7 w-7 shrink-0 text-slate-400 hover:text-slate-900"
                              aria-label="Supprimer l’étape"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          className="relative flex shrink-0 items-stretch overflow-hidden transition-[width] duration-300 ease-out max-h-[calc(100vh-6rem)] lg:order-2 lg:ml-auto lg:max-h-[calc(100vh-8rem)]"
          style={{ width: secondaryWidth }}
        >
          <button
            type="button"
            onClick={() => setIsSecondaryCollapsed((prev) => !prev)}
            aria-expanded={!isSecondaryCollapsed}
            aria-controls="secondary-panel"
            className={cn(
              'absolute left-2 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white',
              'lg:left-3'
            )}
          >
            {isSecondaryCollapsed ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            <span className="sr-only">Basculer le panneau secondaire</span>
          </button>
          <aside
            id="secondary-panel"
            className={cn(
              'flex h-full w-full flex-col gap-5 overflow-hidden rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.35)] backdrop-blur transition-all duration-300 ease-out',
              isSecondaryCollapsed
                ? 'pointer-events-none opacity-0 lg:translate-x-[110%]'
                : 'pointer-events-auto opacity-100 lg:translate-x-0'
            )}
          >
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Aperçu du parcours</h2>
              <p className="text-xs text-slate-600">
                Visualisez la progression de votre process pendant que vous le façonnez. Chaque étape reste synchronisée avec vos ajustements dans le panneau principal.
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="flex h-full flex-col gap-4 overflow-y-auto pr-2">
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Chronologie</h3>
                  <ol className="mt-3 space-y-3">
                    {steps.map((step, index) => {
                      const Icon = STEP_TYPE_ICONS[step.type];

                      return (
                        <li key={step.id} className="flex items-start gap-2.5">
                          <span className="mt-[0.15rem] flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/10 text-[0.65rem] font-semibold text-slate-700">
                            {index + 1}
                          </span>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 text-slate-900">
                              <Icon className="h-3.5 w-3.5 text-slate-500" />
                              <span className="text-xs font-medium leading-tight">{step.label}</span>
                            </div>
                            <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">{STEP_TYPE_LABELS[step.type]}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {highlights.map((item) => {
                    const Icon = highlightIcons[item.icon];

                    return (
                      <Card key={item.title} className="border-slate-200 bg-white/90 shadow-sm">
                        <CardContent className="flex flex-col gap-1.5 p-4">
                          <Icon className="h-4 w-4 text-slate-500" />
                          <p className="text-xs font-medium text-slate-900">{item.title}</p>
                          <p className="text-xs text-slate-600">{item.description}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
