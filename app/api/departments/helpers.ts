import { z } from 'zod';

export const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } as const;

export const normalizeTimestamp = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(value as string);

  if (Number.isNaN(date.getTime())) {
    console.error('Horodatage de département invalide', value);
    return new Date().toISOString();
  }

  return date.toISOString();
};

export const normalizeDepartmentRecord = (item: {
  id: unknown;
  name: unknown;
  created_at: unknown;
  updated_at: unknown;
}) => ({
  id: String(item.id),
  name:
    typeof item.name === 'string' && item.name.trim().length > 0
      ? item.name.trim()
      : 'Département',
  createdAt: normalizeTimestamp(item.created_at),
  updatedAt: normalizeTimestamp(item.updated_at)
});

const isRlsDeniedError = (error: { message?: string; details?: string | null; hint?: string | null }) => {
  const normalizedSegments = [error.message, error.details, error.hint]
    .map((segment) => (typeof segment === 'string' ? segment.toLowerCase().replace(/[-_]+/g, ' ') : ''))
    .filter((segment) => segment.length > 0);

  return normalizedSegments.some((segment) =>
    segment.includes('row level security') || segment.includes('permission denied for table')
  );
};

export const mapDepartmentWriteError = (error: {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}) => {
  const code = error.code?.toUpperCase();

  if (code === '28000') {
    return { status: 401, body: { error: 'Authentification requise.' } } as const;
  }

  if (code === '23505') {
    return {
      status: 409,
      body: { error: 'Un département portant ce nom existe déjà.' }
    } as const;
  }

  if (code === '23514' || code === '23502') {
    return {
      status: 400,
      body: { error: 'Les données fournies pour le département sont invalides.' }
    } as const;
  }

  if (code === '42501' || isRlsDeniedError(error)) {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de modifier ce département." }
    } as const;
  }

  return { status: 500, body: { error: 'Impossible de traiter le département.' } } as const;
};

export const departmentIdParamSchema = z.object({
  departmentId: z.string().uuid('Identifiant de département invalide.')
});
