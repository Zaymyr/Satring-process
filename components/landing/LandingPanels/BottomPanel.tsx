import type { Dispatch, SetStateAction } from 'react';
import { ArrowLeftRight, ArrowUpDown, Eye, EyeOff } from 'lucide-react';

import { type Dictionary } from '@/lib/i18n/dictionaries';
import { cn } from '@/lib/utils/cn';

type BottomPanelProps = {
  diagramControls: Dictionary['landing']['diagramControls'];
  diagramDirection: 'TD' | 'LR';
  setDiagramDirection: Dispatch<SetStateAction<'TD' | 'LR'>>;
  areDepartmentsVisible: boolean;
  setAreDepartmentsVisible: Dispatch<SetStateAction<boolean>>;
  diagramControlsContentId: string;
  isCollapsed: boolean;
};

export function BottomPanel({
  diagramControls,
  diagramDirection,
  setDiagramDirection,
  areDepartmentsVisible,
  setAreDepartmentsVisible,
  diagramControlsContentId,
  isCollapsed
}: BottomPanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-900">{diagramControls.title}</h2>
      </div>
      <div
        id={diagramControlsContentId}
        role="group"
        aria-label={diagramControls.orientationAriaLabel}
        className={cn(
          'flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white/70 p-1 shadow-inner sm:flex-none',
          isCollapsed && 'hidden'
        )}
      >
        <button
          type="button"
          onClick={() => setDiagramDirection('TD')}
          aria-pressed={diagramDirection === 'TD'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
            diagramDirection === 'TD'
              ? 'bg-slate-900 text-white shadow'
              : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {diagramControls.directions.topToBottom}
        </button>
        <button
          type="button"
          onClick={() => setDiagramDirection('LR')}
          aria-pressed={diagramDirection === 'LR'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
            diagramDirection === 'LR'
              ? 'bg-slate-900 text-white shadow'
              : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          {diagramControls.directions.leftToRight}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setAreDepartmentsVisible((previous) => !previous)}
        aria-pressed={areDepartmentsVisible}
        aria-label={
          areDepartmentsVisible ? diagramControls.hideDepartments : diagramControls.showDepartments
        }
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-inner transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 hover:bg-slate-100',
          isCollapsed && 'hidden'
        )}
      >
        {areDepartmentsVisible ? (
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span className="sr-only">
          {areDepartmentsVisible ? diagramControls.hideDepartments : diagramControls.showDepartments}
        </span>
      </button>
    </div>
  );
}
