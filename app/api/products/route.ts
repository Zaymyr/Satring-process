import { NextResponse } from 'next/server';

import { NO_STORE_HEADERS, mapProductWriteError, normalizeProductRecord } from '@/app/api/products/helpers';
import { createServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/auth';
import { productCreateInputSchema, productSchema, productSelectionResponseSchema } from '@/lib/validation/product';

export async function GET() {
  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const [productsResponse, selectionResponse] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, created_at, updated_at, created_by')
      .order('name', { ascending: true }),
    supabase
      .from('user_product_selections')
      .select('product_id')
      .eq('user_id', user.id)
      .order('position', { ascending: true })
  ]);

  if (productsResponse.error) {
    console.error('Erreur lors de la récupération des produits', productsResponse.error);
    return NextResponse.json(
      { error: 'Impossible de récupérer la liste des produits.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (selectionResponse.error) {
    console.error('Erreur lors de la récupération des produits sélectionnés', selectionResponse.error);
    return NextResponse.json(
      { error: 'Impossible de récupérer votre sélection de produits.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const products = (productsResponse.data ?? []).map(normalizeProductRecord);
  const selectedProductIds = (selectionResponse.data ?? [])
    .map((row) => (typeof row.product_id === 'string' ? row.product_id : null))
    .filter((value): value is string => Boolean(value));

  const parsedPayload = productSelectionResponseSchema.safeParse({
    products,
    selectedProductIds
  });

  if (!parsedPayload.success) {
    console.error('Payload de produits invalide', parsedPayload.error);
    return NextResponse.json(
      { error: 'Les données produits sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsedPayload.data, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsedBody = productCreateInputSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Le nom du produit est invalide.', details: parsedBody.error.flatten() },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      name: parsedBody.data.name,
      created_by: user.id
    })
    .select('id, name, created_at, updated_at, created_by')
    .single();

  if (error) {
    console.error('Erreur lors de la création du produit', error);
    const mapped = mapProductWriteError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Réponse vide lors de la création du produit.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const normalized = normalizeProductRecord(data);
  const parsedProduct = productSchema.safeParse(normalized);

  if (!parsedProduct.success) {
    console.error('Produit créé invalide', parsedProduct.error);
    return NextResponse.json(
      { error: 'Les données du produit créé sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsedProduct.data, { status: 201, headers: NO_STORE_HEADERS });
}
