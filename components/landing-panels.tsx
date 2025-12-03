'use client';

import { ApiError } from '@/lib/api/errors';

import {
  LandingPanelsShell,
  type DepartmentWithDraftStatus,
  type LandingPanelsShellProps
} from './landing/LandingPanels/LandingPanelsShell';

export type LandingPanelsProps = LandingPanelsShellProps;

export function LandingPanels(props: LandingPanelsProps) {
  return <LandingPanelsShell {...props} />;
}

export type { DepartmentWithDraftStatus };
export { ApiError };
