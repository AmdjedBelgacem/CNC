import type { CollectionConfig } from 'payload';

export const Themes: CollectionConfig = {
  slug: 'themes',
  admin: {
    useAsTitle: 'tenant',
    defaultColumns: ['tenant', 'isDark', 'fontFamily'],
    group: 'System',
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, unique: true },
    { name: 'isDark', type: 'checkbox', defaultValue: true },
    {
      name: 'cssVariables',
      type: 'group',
      fields: [
        { name: 'background', type: 'text' },
        { name: 'foreground', type: 'text' },
        { name: 'card', type: 'text' },
        { name: 'cardForeground', type: 'text' },
        { name: 'muted', type: 'text' },
        { name: 'mutedForeground', type: 'text' },
        { name: 'border', type: 'text' },
        { name: 'ring', type: 'text' },
      ],
    },
    { name: 'fontFamily', type: 'text' },
    { name: 'borderRadius', type: 'text', defaultValue: '0.5rem' },
  ],
};
