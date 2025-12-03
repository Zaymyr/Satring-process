import { DEFAULT_PROCESS_TITLE } from '@/lib/process/defaults';

const ROLE_ID_REGEX = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

const normalizeNameKey = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.toLowerCase();
};

const normalizeBranchTarget = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeDepartmentId = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeDraftName = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeRoleId = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  return ROLE_ID_REGEX.test(trimmed) ? trimmed : null;
};

const normalizeProcessTitle = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return DEFAULT_PROCESS_TITLE;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_PROCESS_TITLE;
};

export {
  ROLE_ID_REGEX,
  normalizeBranchTarget,
  normalizeDepartmentId,
  normalizeDraftName,
  normalizeNameKey,
  normalizeProcessTitle,
  normalizeRoleId
};
