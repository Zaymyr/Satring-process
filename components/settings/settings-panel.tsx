'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Info, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { useI18n } from '@/components/providers/i18n-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';
import {
  productCreateInputSchema,
  productSchema,
  productSelectionInputSchema,
  productSelectionResponseSchema,
  type Product,
  type ProductCreateInput,
  type ProductSelectionResponse
} from '@/lib/validation/product';

const MAX_SELECTION = 3;

type ErrorShape = { error?: unknown };

const extractErrorMessage = (value: ErrorShape, fallback: string) => {
  if (value && typeof value.error === 'string' && value.error.trim().length > 0) {
    return value.error;
  }

  return fallback;
};

export function SettingsPanel() {
  const queryClient = useQueryClient();
  const { dictionary, locale } = useI18n();
  const copy = dictionary.settings;

  const [selectionDraft, setSelectionDraft] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectionSuccess, setSelectionSuccess] = useState<string | null>(null);
  const [creationSuccess, setCreationSuccess] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);

  const settingsQuery = useQuery<ProductSelectionResponse>({
    queryKey: ['products', 'settings'],
    queryFn: async () => {
      const response = await fetch('/api/products', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json) {
        const message = extractErrorMessage(json ?? {}, copy.products.loadError);
        throw new Error(message);
      }

      return productSelectionResponseSchema.parse(json);
    }
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSelectionDraft(settingsQuery.data.selectedProductIds);
    }
  }, [settingsQuery.data]);

  const form = useForm<ProductCreateInput>({
    resolver: zodResolver(productCreateInputSchema),
    defaultValues: { name: '' }
  });

  const creationMutation = useMutation<Product, Error, ProductCreateInput>({
    mutationFn: async (values) => {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values)
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json) {
        const message = extractErrorMessage(json ?? {}, copy.creation.error);
        throw new Error(message);
      }

      return productSchema.parse(json);
    },
    onSuccess: (product) => {
      setCreationError(null);
      setCreationSuccess(copy.creation.success);
      queryClient.setQueryData<ProductSelectionResponse>(['products', 'settings'], (previous) => {
        if (!previous) {
          return { products: [product], selectedProductIds: [] };
        }

        const sortedProducts = [...previous.products, product].sort((left, right) =>
          left.name.localeCompare(right.name, locale, { sensitivity: 'base' })
        );

        return {
          ...previous,
          products: sortedProducts
        };
      });
      form.reset({ name: '' });
    },
    onError: (error) => {
      setCreationSuccess(null);
      setCreationError(error instanceof Error ? error.message : copy.creation.error);
    }
  });

  const selectionMutation = useMutation<ProductSelectionResponse, Error, string[]>({
    mutationFn: async (productIds) => {
      const parsedSelection = productSelectionInputSchema.safeParse({ productIds });

      if (!parsedSelection.success) {
        throw new Error(copy.products.limitReached);
      }

      const normalizedSelection = parsedSelection.data.productIds;

      const response = await fetch('/api/products/selection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ productIds: normalizedSelection })
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json) {
        const message = extractErrorMessage(json ?? {}, copy.products.saveError);
        throw new Error(message);
      }

      return productSelectionResponseSchema.parse(json);
    },
    onSuccess: (data) => {
      setSelectionError(null);
      setSelectionSuccess(copy.products.saved);
      setSelectionDraft(data.selectedProductIds);
      queryClient.setQueryData(['products', 'settings'], data);
    },
    onError: (error) => {
      setSelectionSuccess(null);
      setSelectionError(error instanceof Error ? error.message : copy.products.saveError);
    }
  });

  const toggleProduct = (productId: string) => {
    setSelectionError(null);
    setSelectionSuccess(null);
    setSelectionDraft((previous) => {
      if (previous.includes(productId)) {
        return previous.filter((id) => id !== productId);
      }

      if (previous.length >= MAX_SELECTION) {
        setSelectionError(copy.products.limitReached);
        return previous;
      }

      return [...previous, productId];
    });
  };

  const selectionCountLabel = useMemo(
    () =>
      copy.products.selectionCountLabel
        .replace('{count}', selectionDraft.length.toString())
        .replace('{max}', MAX_SELECTION.toString()),
    [copy.products.selectionCountLabel, selectionDraft.length]
  );

  const isLoading = settingsQuery.isLoading;
  const products = settingsQuery.data?.products ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:px-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">{copy.heading}</h1>
        <p className="text-slate-600">{copy.description}</p>
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <Info className="mt-0.5 h-4 w-4 text-slate-500" aria-hidden="true" />
          <p>{copy.sharedNotice}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="border-slate-200 bg-white text-slate-900">
          <CardHeader className="space-y-2 border-slate-200">
            <CardTitle>{copy.products.title}</CardTitle>
            <CardDescription className="text-slate-600">{copy.products.helper}</CardDescription>
            <div className="flex items-center justify-between text-sm text-slate-700">
              <span>{selectionCountLabel}</span>
              {selectionMutation.isPending ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>{copy.products.saving}</span>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {settingsQuery.isError ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
                {settingsQuery.error instanceof Error
                  ? settingsQuery.error.message
                  : copy.products.loadError}
              </p>
            ) : null}

            {selectionError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {selectionError}
              </p>
            ) : null}

            {selectionSuccess ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
                {selectionSuccess}
              </p>
            ) : null}

            {isLoading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                <span>{copy.products.loading}</span>
              </div>
            ) : null}

            {!isLoading && products.length === 0 ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {copy.products.empty}
              </p>
            ) : null}

            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {products.map((product) => {
                const selected = selectionDraft.includes(product.id);
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => toggleProduct(product.id)}
                      aria-pressed={selected}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                        selected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <span className="text-sm font-medium">{product.name}</span>
                      <span
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded border',
                          selected ? 'border-white bg-white/10' : 'border-slate-300 bg-white'
                        )}
                        aria-hidden="true"
                      >
                        {selected ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">{copy.products.limitReached}</p>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    setSelectionError(null);
                    setSelectionSuccess(null);
                    selectionMutation.mutate(selectionDraft);
                  }}
                  variant="secondary"
                  disabled={selectionMutation.isPending || isLoading}
                >
                  {selectionMutation.isPending ? copy.products.saving : copy.products.save}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white text-slate-900">
          <CardHeader className="space-y-2 border-slate-200">
            <CardTitle>{copy.creation.title}</CardTitle>
            <CardDescription className="text-slate-600">{copy.creation.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {creationError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {creationError}
              </p>
            ) : null}

            {creationSuccess ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
                {creationSuccess}
              </p>
            ) : null}

            <form
              className="space-y-3"
              onSubmit={form.handleSubmit((values) => {
                setCreationError(null);
                setCreationSuccess(null);
                creationMutation.mutate(values);
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="product-name">{copy.creation.nameLabel}</Label>
                <Input
                  id="product-name"
                  placeholder={copy.creation.placeholder}
                  autoComplete="off"
                  disabled={creationMutation.isPending}
                  {...form.register('name')}
                />
                {form.formState.errors.name ? (
                  <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
                ) : null}
              </div>

              <Button type="submit" className="w-full" disabled={creationMutation.isPending}>
                {creationMutation.isPending ? copy.creation.submitting : copy.creation.submit}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
