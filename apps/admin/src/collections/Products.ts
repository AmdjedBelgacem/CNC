import type { CollectionConfig } from 'payload';

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'price', 'inventory', 'isPublished'],
    group: 'Store',
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
    { name: 'medusaId', type: 'text' },
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true },
    { name: 'description', type: 'richText' },
    { name: 'thumbnail', type: 'upload', relationTo: 'media' },
    { name: 'price', type: 'number', required: true, min: 0 },
    { name: 'compareAtPrice', type: 'number' },
    { name: 'currency', type: 'text', defaultValue: 'USD' },
    { name: 'inventory', type: 'number', defaultValue: 0 },
    { name: 'isDigital', type: 'checkbox', defaultValue: false },
    { name: 'isPublished', type: 'checkbox', defaultValue: false },
    {
      name: 'metadata',
      type: 'group',
      fields: [
        { name: 'sku', type: 'text' },
        { name: 'category', type: 'text' },
        { name: 'brand', type: 'text' },
        { name: 'weight', type: 'number' },
      ],
    },
  ],
};
