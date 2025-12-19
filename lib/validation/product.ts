import { z } from 'zod';

export const productNameSchema = z
  .string({ required_error: 'Le nom du produit est requis.' })
  .trim()
  .min(1, 'Le nom du produit doit contenir au moins un caractère.')
  .max(180, 'Le nom du produit ne peut pas dépasser 180 caractères.');

export const productSchema = z.object({
  id: z.string().uuid('Identifiant de produit invalide.'),
  name: productNameSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  createdBy: z.string().uuid('Identifiant de créateur invalide.').nullable().optional()
});

export const productListSchema = productSchema.array();

export const productCreateInputSchema = z.object({
  name: productNameSchema
});

export const productSelectionInputSchema = z.object({
  productIds: z
    .array(z.string().uuid('Identifiant de produit invalide.'))
    .max(3, 'Vous pouvez sélectionner jusqu’à 3 produits.')
    .transform((ids) => Array.from(new Set(ids)))
    .refine((ids) => ids.length <= 3, {
      message: 'Vous pouvez sélectionner jusqu’à 3 produits.'
    })
});

export const productSelectionResponseSchema = z.object({
  products: productListSchema,
  selectedProductIds: z.array(z.string().uuid('Identifiant de produit invalide.')).max(3)
});

export type Product = z.infer<typeof productSchema>;
export type ProductCreateInput = z.infer<typeof productCreateInputSchema>;
export type ProductSelectionInput = z.infer<typeof productSelectionInputSchema>;
export type ProductSelectionResponse = z.infer<typeof productSelectionResponseSchema>;
