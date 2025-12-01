import { type Dictionary } from '@/lib/i18n/dictionaries';
import { type Role } from '@/lib/validation/role';
import { type ProcessStep } from '@/lib/validation/process';

export type Step = ProcessStep;

export type RoleLookupEntry = {
  role: Role;
  departmentId: string;
  departmentName: string;
};

export type DiagramDragState = {
  pointerId: number;
  originX: number;
  originY: number;
  startX: number;
  startY: number;
  target: HTMLDivElement | null;
  hasCapture: boolean;
};

export type ProcessErrorMessages = Dictionary['landing']['errors'];
