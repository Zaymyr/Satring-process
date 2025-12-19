export const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } as const;

export const normalizeTimestamp = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(value as string);

  if (Number.isNaN(date.getTime())) {
    console.error('Horodatage de produit invalide', value);
    return new Date().toISOString();
  }

  return date.toISOString();
};

export const normalizeProductRecord = (item: {
  id: unknown;
  name: unknown;
  created_at: unknown;
  updated_at: unknown;
  created_by?: unknown;
}) => ({
  id: String(item.id),
  name:
    typeof item.name === 'string' && item.name.trim().length > 0
      ? item.name.trim()
      : 'Produit',
  createdAt: normalizeTimestamp(item.created_at),
  updatedAt: normalizeTimestamp(item.updated_at),
  createdBy: typeof item.created_by === 'string' ? item.created_by : null
});

const isRlsDeniedError = (error: { message?: string; details?: string | null; hint?: string | null }) => {
  const normalizedSegments = [error.message, error.details, error.hint]
    .map((segment) => (typeof segment === 'string' ? segment.toLowerCase().replace(/[-_]+/g, ' ') : ''))
    .filter((segment) => segment.length > 0);

  return normalizedSegments.some((segment) =>
    segment.includes('row level security') || segment.includes('permission denied for table')
  );
};

export const mapProductWriteError = (error: {
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
      body: { error: 'Un produit portant ce nom existe déjà.' }
    } as const;
  }

  if (code === '23514' || code === '23502') {
    return {
      status: 400,
      body: { error: 'Les données fournies pour le produit sont invalides.' }
    } as const;
  }

  if (code === '42501' || isRlsDeniedError(error)) {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de modifier les produits." }
    } as const;
  }

  return { status: 500, body: { error: 'Impossible de traiter le produit.' } } as const;
};

export const mapSelectionWriteError = (error: {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}) => {
  const code = error.code?.toUpperCase();

  if (code === '28000') {
    return { status: 401, body: { error: 'Authentification requise.' } } as const;
  }

  if (code === '23503') {
    return {
      status: 400,
      body: { error: 'Certains produits sélectionnés sont introuvables.' }
    } as const;
  }

  if (code === '23505' || code === '23514' || code === '23502') {
    return {
      status: 400,
      body: { error: 'La sélection de produits est invalide.' }
    } as const;
  }

  if (code === '42501' || isRlsDeniedError(error)) {
    return {
      status: 403,
      body: { error: "Vous n'avez pas l'autorisation de modifier vos produits sélectionnés." }
    } as const;
  }

  return { status: 500, body: { error: 'Impossible de mettre à jour la sélection de produits.' } } as const;
};
