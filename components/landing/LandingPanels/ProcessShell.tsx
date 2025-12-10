'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';

import type { ProcessErrorMessages } from '@/lib/process/types';
import { cn } from '@/lib/utils/cn';

import { FloatingSaveControls } from './FloatingSaveControls';
import { ProcessCanvas } from './ProcessCanvas';

type ProcessShellProps = {
  diagramDefinition: string;
  fallbackDiagram: ReactNode;
  mermaidErrorMessages: ProcessErrorMessages['mermaid'];
  diagramDirection: 'TD' | 'LR';
  diagramElementId: string;
  primaryPanel: ReactNode;
  secondaryPanel: ReactNode;
  renderBottomPanel: (options: { isCollapsed: boolean }) => ReactNode;
  primaryToggleLabel: string;
  secondaryToggleLabel: string;
  bottomToggleLabel: string;
  handleSave: () => void;
  isSaveDisabled: boolean;
  saveButtonLabel: string;
  statusToneClass: string;
  statusMessage: ReactNode;
};

type PanelLayoutStyle = CSSProperties & {
  '--primary-width': string;
  '--secondary-width': string;
};

export function ProcessShell({
  diagramDefinition,
  fallbackDiagram,
  mermaidErrorMessages,
  diagramDirection,
  diagramElementId,
  primaryPanel,
  secondaryPanel,
  renderBottomPanel,
  primaryToggleLabel,
  secondaryToggleLabel,
  bottomToggleLabel,
  handleSave,
  isSaveDisabled,
  saveButtonLabel,
  statusToneClass,
  statusMessage
}: ProcessShellProps) {
  const [isPrimaryCollapsed, setIsPrimaryCollapsed] = useState(false);
  const [isSecondaryCollapsed, setIsSecondaryCollapsed] = useState(false);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);

  const primaryWidth = isPrimaryCollapsed ? 'min(3.5rem, 100%)' : 'min(100%, clamp(13.5rem, 21vw, 25.5rem))';
  const secondaryWidth = isSecondaryCollapsed ? 'min(3.5rem, 100%)' : 'min(100%, clamp(16rem, 22vw, 26rem))';
  const layoutStyle = useMemo<PanelLayoutStyle>(
    () => ({
      '--primary-width': primaryWidth,
      '--secondary-width': secondaryWidth
    }),
    [primaryWidth, secondaryWidth]
  );

  return (
    <div className="relative flex h-full flex-col overflow-x-visible overflow-y-hidden bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900">
      <ProcessCanvas
        diagramDefinition={diagramDefinition}
        fallbackDiagram={fallbackDiagram}
        mermaidErrorMessages={mermaidErrorMessages}
        diagramDirection={diagramDirection}
        diagramElementId={diagramElementId}
      />
      <div className="pointer-events-none relative z-10 flex h-full min-h-0 w-full flex-col gap-3 px-2.5 py-4 lg:px-5 lg:py-6 xl:px-6">
        <div
          className="pointer-events-none flex min-h-0 flex-1 flex-col gap-4 lg:grid lg:[grid-template-rows:minmax(0,1fr)_auto] lg:[grid-template-columns:var(--primary-width)_minmax(0,1fr)_var(--secondary-width)] lg:items-stretch lg:gap-0"
          style={layoutStyle}
        >
          <div
            className="pointer-events-auto relative flex h-full min-h-0 w-full shrink-0 items-stretch overflow-visible transition-[width] duration-300 ease-out lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:h-full lg:min-h-0 lg:w-[var(--primary-width)]"
          >
            <button
              type="button"
              onClick={() => setIsPrimaryCollapsed((prev) => !prev)}
              aria-expanded={!isPrimaryCollapsed}
              aria-controls="primary-panel"
              className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white lg:hidden"
            >
              {isPrimaryCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              <span className="sr-only">{primaryToggleLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPrimaryCollapsed((prev) => !prev)}
              aria-expanded={!isPrimaryCollapsed}
              aria-controls="primary-panel"
              className="absolute right-0 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white lg:flex"
            >
              {isPrimaryCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              <span className="sr-only">{primaryToggleLabel}</span>
            </button>
            <div
              id="primary-panel"
              className={cn(
                'flex h-full w-full flex-col gap-6 overflow-hidden rounded-3xl border border-slate-200 bg-white/85 px-5 py-6 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.35)] backdrop-blur transition-all duration-300 ease-out sm:px-6',
                isPrimaryCollapsed
                  ? 'pointer-events-none opacity-0 lg:-translate-x-[110%]'
                  : 'pointer-events-auto opacity-100 lg:translate-x-0'
              )}
            >
              {primaryPanel}
            </div>
          </div>
          <div
            className="pointer-events-auto relative flex h-full min-h-0 w-full shrink-0 items-stretch overflow-visible transition-[width] duration-300 ease-out lg:col-start-3 lg:row-start-1 lg:row-span-2 lg:h-full lg:min-h-0 lg:w-[var(--secondary-width)]"
          >
            <button
              type="button"
              onClick={() => setIsSecondaryCollapsed((prev) => !prev)}
              aria-expanded={!isSecondaryCollapsed}
              aria-controls="secondary-panel"
              className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white lg:hidden"
            >
              {isSecondaryCollapsed ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <span className="sr-only">{secondaryToggleLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSecondaryCollapsed((prev) => !prev)}
              aria-expanded={!isSecondaryCollapsed}
              aria-controls="secondary-panel"
              className="absolute left-0 top-1/2 z-20 hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white lg:flex"
            >
              {isSecondaryCollapsed ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <span className="sr-only">{secondaryToggleLabel}</span>
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
              {secondaryPanel}
            </aside>
          </div>
        </div>
        <div className="pointer-events-auto flex w-full justify-center lg:col-start-2 lg:row-start-2">
          <div className="relative w-full max-w-3xl pt-2 lg:max-w-2xl">
            <FloatingSaveControls
              onSave={handleSave}
              isSaveDisabled={isSaveDisabled}
              saveButtonLabel={saveButtonLabel}
              statusToneClass={statusToneClass}
              statusMessage={statusMessage}
              isBottomCollapsed={isBottomCollapsed}
            />
            <button
              type="button"
              onClick={() => setIsBottomCollapsed((previous) => !previous)}
              aria-expanded={!isBottomCollapsed}
              aria-controls="diagram-controls-panel"
              className={cn(
                'z-30 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white',
                isBottomCollapsed
                  ? 'fixed bottom-6 left-1/2 -translate-x-1/2'
                  : 'absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2'
              )}
            >
              {isBottomCollapsed ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              <span className="sr-only">{bottomToggleLabel}</span>
            </button>
            <section
              id="diagram-controls-panel"
              aria-hidden={isBottomCollapsed}
              className={cn(
                'w-full overflow-hidden rounded-2xl shadow-[0_24px_96px_-48px_rgba(15,23,42,0.3)] backdrop-blur transition-all duration-300 ease-out',
                isBottomCollapsed
                  ? 'pointer-events-none -translate-y-2 opacity-0 max-h-0 border border-transparent bg-white/0 p-0'
                  : 'pointer-events-auto translate-y-0 opacity-100 max-h-[70vh] border border-slate-200 bg-white/85 p-4 pt-6'
              )}
            >
              {renderBottomPanel({ isCollapsed: isBottomCollapsed })}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
