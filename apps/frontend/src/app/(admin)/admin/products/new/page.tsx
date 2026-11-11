'use client';
import { CreateEntityPage } from '@/components/admin/editor/create-entity';

/**
 * `/admin/products/new` — kept for bookmarks and links. Creating asks only for what
 * defines a product, makes a draft and opens the editor, the same as the New dialog
 * on the products list.
 */
export default function NewProductPage() {
  return <CreateEntityPage kind="product" backHref="/admin/products" />;
}
