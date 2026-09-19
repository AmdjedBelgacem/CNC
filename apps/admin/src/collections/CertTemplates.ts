import type { CollectionConfig } from 'payload';

export const CertTemplates: CollectionConfig = {
  slug: 'cert-templates',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'layout', 'tenant'],
    group: 'Academy',
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'layout', type: 'select', options: ['modern', 'classic', 'minimal'], defaultValue: 'modern' },
    { name: 'primaryColor', type: 'text', defaultValue: '#00ff88' },
    { name: 'secondaryColor', type: 'text', defaultValue: '#0a1628' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'background', type: 'upload', relationTo: 'media' },
    { name: 'fontFamily', type: 'text', defaultValue: 'Inter' },
    {
      name: 'fields',
      type: 'array',
      fields: [
        { name: 'key', type: 'text', required: true },
        { name: 'label', type: 'text', required: true },
        { name: 'x', type: 'number', required: true },
        { name: 'y', type: 'number', required: true },
        { name: 'fontSize', type: 'number', required: true },
        { name: 'fontWeight', type: 'select', options: ['normal', 'bold'], defaultValue: 'normal' },
        { name: 'color', type: 'text', required: true },
      ],
    },
  ],
};
