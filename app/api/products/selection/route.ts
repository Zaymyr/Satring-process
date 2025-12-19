import { NextResponse } from 'next/server';

import { NO_STORE_HEADERS, mapSelectionWriteError, normalizeProductRecord } from '@/app/api/products/helpers';
import { createServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/auth';
import { productSelectionInputSchema, productSelectionResponseSchema } from '@/lib/validation/product';

export async function PUT(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsedBody = productSelectionInputSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Sélection de produits invalide.', details: parsedBody.error.flatten() },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const supabase = createServerClient();
  const { user, error: authError } = await getServerUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const requestedProductIds = parsedBody.data.productIds;

  if (requestedProductIds.length > 0) {
    const { data: existingProducts, error: productError } = await supabase
      .from('products')
      .select('id')
      .in('id', requestedProductIds);

    if (productError) {
      console.error('Erreur lors de la validation des produits sélectionnés', productError);
      return NextResponse.json(
        { error: 'Impossible de valider les produits sélectionnés.' },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const existingIds = (existingProducts ?? [])
      .map((row) => (typeof row.id === 'string' ? row.id : null))
      .filter((value): value is string => Boolean(value));

    if (existingIds.length !== requestedProductIds.length) {
      return NextResponse.json(
        { error: 'Certains produits sélectionnés sont introuvables.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
  }

  const { error: deleteError } = await supabase
    .from('user_product_selections')
    .delete()
    .eq('user_id', user.id);

  if (deleteError) {
    console.error('Erreur lors de la réinitialisation de la sélection de produits', deleteError);
    const mapped = mapSelectionWriteError(deleteError);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
  }

  if (requestedProductIds.length > 0) {
    const rows = requestedProductIds.map((productId, index) => ({
      user_id: user.id,
      product_id: productId,
      position: index
    }));

    const { error: insertError } = await supabase.from('user_product_selections').insert(rows);

    if (insertError) {
      console.error('Erreur lors de la mise à jour de la sélection de produits', insertError);
      const mapped = mapSelectionWriteError(insertError);
      return NextResponse.json(mapped.body, { status: mapped.status, headers: NO_STORE_HEADERS });
    }
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
    console.error('Erreur lors du rafraîchissement des produits', productsResponse.error);
    return NextResponse.json(
      { error: 'Impossible de rafraîchir la liste des produits.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (selectionResponse.error) {
    console.error('Erreur lors du rafraîchissement de la sélection', selectionResponse.error);
    return NextResponse.json(
      { error: 'Impossible de rafraîchir votre sélection de produits.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const normalizedProducts = (productsResponse.data ?? []).map(normalizeProductRecord);
  const selectedProductIds = (selectionResponse.data ?? [])
    .map((row) => (typeof row.product_id === 'string' ? row.product_id : null))
    .filter((value): value is string => Boolean(value));

  const parsedPayload = productSelectionResponseSchema.safeParse({
    products: normalizedProducts,
    selectedProductIds
  });

  if (!parsedPayload.success) {
    console.error('Payload de sélection de produits invalide', parsedPayload.error);
    return NextResponse.json(
      { error: 'Les données de sélection sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(parsedPayload.data, { headers: NO_STORE_HEADERS });
}
