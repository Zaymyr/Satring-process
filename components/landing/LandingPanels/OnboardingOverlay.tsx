'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/cn';
import { ONBOARDING_STEP_CONTENT, type OnboardingStepKey } from '@/lib/onboarding/steps';

type Spotlight = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type OnboardingOverlayProps = {
  activeStep: OnboardingStepKey | null;
};

const useSpotlight = (targetId: string | null) => {
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);

  useEffect(() => {
    if (!targetId) {
      setSpotlight(null);
      return;
    }

    const target = document.getElementById(targetId);

    if (!target) {
      setSpotlight(null);
      return;
    }

    const update = () => {
      const rect = target.getBoundingClientRect();
      setSpotlight({
        x: rect.x - 12,
        y: rect.y - 12,
        width: rect.width + 24,
        height: rect.height + 24
      });
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(target);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [targetId]);

  useEffect(() => {
    if (!targetId || !spotlight) {
      return;
    }

    const target = document.getElementById(targetId);

    const handleBlockedEvent = (event: Event) => {
      if (!target || target.contains(event.target as Node)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('pointerdown', handleBlockedEvent, true);
    document.addEventListener('pointerup', handleBlockedEvent, true);
    document.addEventListener('click', handleBlockedEvent, true);

    return () => {
      document.removeEventListener('pointerdown', handleBlockedEvent, true);
      document.removeEventListener('pointerup', handleBlockedEvent, true);
      document.removeEventListener('click', handleBlockedEvent, true);
    };
  }, [spotlight, targetId]);

  return spotlight;
};

export function OnboardingOverlay({ activeStep }: OnboardingOverlayProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const content = isClient && activeStep ? ONBOARDING_STEP_CONTENT[activeStep] : null;
  const targetId = isClient && content ? content.targetId : null;
  const spotlight = useSpotlight(targetId);

  const maskStyle = useMemo(() => {
    if (!spotlight) {
      return undefined;
    }

    const { x, y, width, height } = spotlight;
    return {
      ['--spot-x' as string]: `${x}px`,
      ['--spot-y' as string]: `${y}px`,
      ['--spot-w' as string]: `${width}px`,
      ['--spot-h' as string]: `${height}px`
    };
  }, [spotlight]);

  if (!isClient || !content || !spotlight) {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[200] select-none" aria-hidden>
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <mask id="overlay-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={(maskStyle?.['--spot-x' as string] as string | undefined) ?? '0px'}
              y={(maskStyle?.['--spot-y' as string] as string | undefined) ?? '0px'}
              width={(maskStyle?.['--spot-w' as string] as string | undefined) ?? '0px'}
              height={(maskStyle?.['--spot-h' as string] as string | undefined) ?? '0px'}
              rx="14"
              ry="14"
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(15,23,42,0.55)" mask="url(#overlay-mask)" />
      </svg>
      <div
        className="absolute rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl ring-1 ring-slate-900/5"
        style={{
          left: spotlight.x,
          top: spotlight.y + spotlight.height + 12,
          maxWidth:
            typeof window !== 'undefined'
              ? Math.min(380, window.innerWidth - spotlight.x - 24)
              : 380
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{content.title}</p>
        <p className="text-sm text-slate-800">{content.description}</p>
      </div>
      <div
        className={cn(
          'pointer-events-none absolute rounded-xl ring-2 ring-white ring-offset-2 ring-offset-slate-900/60 transition-all',
          spotlight ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          left: spotlight.x,
          top: spotlight.y,
          width: spotlight.width,
          height: spotlight.height
        }}
      />
    </div>,
    document.body
  );
}
