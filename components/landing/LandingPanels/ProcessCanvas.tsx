'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';
import { loadMermaid, type MermaidAPI, type MermaidErrorMessages } from '@/lib/mermaid';
import { type DiagramDragState } from '@/lib/process/types';

type ProcessCanvasProps = {
  diagramDefinition: string;
  fallbackDiagram: ReactNode;
  mermaidErrorMessages: MermaidErrorMessages;
  diagramDirection: 'TD' | 'LR';
  diagramElementId: string;
};

const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const DIAGRAM_SCALE_MIN = 0.35;
const DIAGRAM_SCALE_MAX = 5;

export function ProcessCanvas({
  diagramDefinition,
  fallbackDiagram,
  mermaidErrorMessages,
  diagramDirection,
  diagramElementId
}: ProcessCanvasProps) {
  const [diagramSvg, setDiagramSvg] = useState('');
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [diagramUserOffset, setDiagramUserOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [diagramScale, setDiagramScale] = useState(1);
  const [isDiagramDragging, setIsDiagramDragging] = useState(false);
  const diagramDragStateRef = useRef<DiagramDragState | null>(null);
  const diagramViewportRef = useRef<HTMLDivElement | null>(null);
  const [isMermaidReady, setIsMermaidReady] = useState(false);
  const mermaidAPIRef = useRef<MermaidAPI | null>(null);

  useEffect(() => {
    setDiagramUserOffset((previous) => (previous.x === 0 && previous.y === 0 ? previous : { x: 0, y: 0 }));
    setDiagramScale((previous) => (previous === 1 ? previous : 1));
  }, [diagramDirection]);

  const applyDiagramWheelZoom = useCallback((event: WheelEvent, viewportRect: DOMRect) => {
    event.preventDefault();

    const rect = viewportRect ?? diagramViewportRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const pointerX = event.clientX - rect.left - rect.width / 2 + diagramUserOffset.x;
    const pointerY = event.clientY - rect.top - rect.height / 2 + diagramUserOffset.y;

    const normalizedDeltaY = clampValue(event.deltaY, -2000, 2000);
    const limitedDelta = clampValue(normalizedDeltaY, -480, 480);

    if (Math.abs(limitedDelta) < 0.01) {
      return;
    }

    const direction = Math.sign(limitedDelta) || 1;
    const distance = Math.min(Math.abs(limitedDelta), 480);
    const baseStep = event.ctrlKey || event.metaKey ? 0.35 : 0.22;
    const magnitude = Math.max(distance / 160, 0.2);
    const scaleStep = 1 + baseStep * magnitude;

    if (!Number.isFinite(scaleStep) || scaleStep <= 0) {
      return;
    }

    setDiagramScale((previousScale) => {
      const proposedScale = direction < 0 ? previousScale * scaleStep : previousScale / scaleStep;

      const nextScale = clampValue(proposedScale, DIAGRAM_SCALE_MIN, DIAGRAM_SCALE_MAX);

      if (nextScale === previousScale) {
        return previousScale;
      }

      setDiagramUserOffset((previousOffset) => {
        const scaleRatio = nextScale / previousScale;
        return {
          x: pointerX - scaleRatio * (pointerX - previousOffset.x),
          y: pointerY - scaleRatio * (pointerY - previousOffset.y)
        };
      });

      return nextScale;
    });
  }, [diagramUserOffset.x, diagramUserOffset.y]);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const viewport = diagramViewportRef.current;

      if (!viewport) {
        return;
      }

      const composedPath = typeof event.composedPath === 'function' ? event.composedPath() : [];
      const eventTarget = (event.target as Node | null) ?? null;
      const isEventWithinViewport =
        (Array.isArray(composedPath) && composedPath.includes(viewport)) ||
        (eventTarget ? viewport.contains(eventTarget) : false);

      if (!isEventWithinViewport) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const isWithinHorizontalBounds = event.clientX >= rect.left && event.clientX <= rect.right;
      const isWithinVerticalBounds = event.clientY >= rect.top && event.clientY <= rect.bottom;

      if (!isWithinHorizontalBounds || !isWithinVerticalBounds) {
        return;
      }

      applyDiagramWheelZoom(event, rect);
    };

    const listenerOptions: AddEventListenerOptions = { passive: false, capture: true };
    window.addEventListener('wheel', handleWheel, listenerOptions);

    return () => {
      window.removeEventListener('wheel', handleWheel, listenerOptions);
    };
  }, [applyDiagramWheelZoom]);

  const updateDiagramDrag = useCallback((pointerId: number, clientX: number, clientY: number) => {
    const dragState = diagramDragStateRef.current;

    if (!dragState || dragState.pointerId !== pointerId) {
      return;
    }

    const deltaX = clientX - dragState.startX;
    const deltaY = clientY - dragState.startY;

    setDiagramUserOffset({
      x: dragState.originX + deltaX,
      y: dragState.originY + deltaY
    });
  }, []);

  const endDiagramDrag = useCallback((pointerId: number) => {
    const dragState = diagramDragStateRef.current;

    if (!dragState || dragState.pointerId !== pointerId) {
      return;
    }

    if (dragState.hasCapture && dragState.target?.hasPointerCapture?.(pointerId)) {
      try {
        dragState.target.releasePointerCapture(pointerId);
      } catch {
        // ignore pointer capture release errors
      }
    }

    diagramDragStateRef.current = null;
    setIsDiagramDragging(false);
  }, []);

  const handleDiagramPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      updateDiagramDrag(event.pointerId, event.clientX, event.clientY);
    },
    [updateDiagramDrag]
  );

  const handleDiagramPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      endDiagramDrag(event.pointerId);
    },
    [endDiagramDrag]
  );

  useEffect(() => {
    if (!isDiagramDragging) {
      return;
    }

    const dragState = diagramDragStateRef.current;

    if (!dragState || dragState.hasCapture) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (diagramDragStateRef.current?.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      updateDiagramDrag(event.pointerId, event.clientX, event.clientY);
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.type === 'pointerout' && event.relatedTarget) {
        return;
      }

      if (diagramDragStateRef.current?.pointerId !== event.pointerId) {
        return;
      }

      endDiagramDrag(event.pointerId);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('pointerout', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('pointerout', handlePointerEnd);
    };
  }, [endDiagramDrag, isDiagramDragging, updateDiagramDrag]);

  const handleDiagramPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.pointerType !== 'touch') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const target = event.currentTarget;
      let hasCapture = false;

      try {
        target.setPointerCapture(event.pointerId);
        hasCapture = target.hasPointerCapture?.(event.pointerId) ?? false;
      } catch {
        // ignore pointer capture errors on unsupported browsers
      }

      diagramDragStateRef.current = {
        pointerId: event.pointerId,
        originX: diagramUserOffset.x,
        originY: diagramUserOffset.y,
        startX: event.clientX,
        startY: event.clientY,
        target,
        hasCapture
      };

      setIsDiagramDragging(true);
    },
    [diagramUserOffset.x, diagramUserOffset.y]
  );

  useEffect(() => {
    let isActive = true;

    loadMermaid(mermaidErrorMessages)
      .then((mermaid) => {
        if (!isActive) {
          return;
        }
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'neutral',
          themeVariables: {
            fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
  }, [mermaidErrorMessages]);

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

  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center overflow-visible">
      <div
        ref={diagramViewportRef}
        className={cn(
          'pointer-events-auto relative flex h-full w-full select-none touch-none items-center justify-center',
          isDiagramDragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onPointerDown={handleDiagramPointerDown}
        onPointerMove={handleDiagramPointerMove}
        onPointerUp={handleDiagramPointerEnd}
        onPointerCancel={handleDiagramPointerEnd}
        onLostPointerCapture={handleDiagramPointerEnd}
      >
        <div
          className={cn(
            'pointer-events-auto absolute left-1/2 top-1/2 h-auto w-auto max-h-none max-w-none opacity-90 transition-transform [filter:drop-shadow(0_25px_65px_rgba(15,23,42,0.22))] [&_svg]:h-auto [&_svg]:max-h-none [&_svg]:max-w-none [&_.node rect]:stroke-slate-900 [&_.node rect]:stroke-[1.5px] [&_.node polygon]:stroke-slate-900 [&_.node polygon]:stroke-[1.5px] [&_.node circle]:stroke-slate-900 [&_.node circle]:stroke-[1.5px] [&_.node ellipse]:stroke-slate-900 [&_.node ellipse]:stroke-[1.5px] [&_.edgePath path]:stroke-slate-900 [&_.edgePath path]:stroke-[1.5px] [&_.edgeLabel]:text-slate-900'
          )}
          style={{
            transform: `translate(-50%, -50%) translate3d(${diagramUserOffset.x}px, ${diagramUserOffset.y}px, 0) scale(${diagramScale})`,
            transformOrigin: 'center center',
            willChange: 'transform'
          }}
        >
          {diagramSvg ? (
            <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: diagramSvg }} />
          ) : (
            fallbackDiagram
          )}
        </div>
      </div>
      {diagramError ? (
        <span role="status" aria-live="polite" className="sr-only">
          {diagramError}
        </span>
      ) : null}
    </div>
  );
}
