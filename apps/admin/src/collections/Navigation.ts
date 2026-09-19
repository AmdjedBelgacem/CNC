import type { CollectionConfig } from 'payload';

export const Navigation: CollectionConfig = {
  slug: 'navigation',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'href', 'tenant', 'sortOrder', 'isVisible'],
    group: 'System',
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
    { name: 'parent', type: 'relationship', relationTo: 'navigation' },
    { name: 'label', type: 'text', required: true },
    { name: 'href', type: 'text', required: true },
    { name: 'icon', type: 'text' },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
    { name: 'isVisible', type: 'checkbox', defaultValue: true },
    { name: 'requiresAuth', type: 'checkbox', defaultValue: false },
    { name: 'opensInNewTab', type: 'checkbox', defaultValue: false },
  ],
};
