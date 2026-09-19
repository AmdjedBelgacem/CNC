import type { CollectionConfig } from 'payload';

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'isActive', 'domain'],
    group: 'System',
  },
  access: {
    read: () => true,
    create: ({ req }) => req.user?.role === 'superadmin',
    update: ({ req }) => req.user?.role === 'superadmin',
    delete: ({ req }) => req.user?.role === 'superadmin',
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'favicon', type: 'upload', relationTo: 'media' },
    { name: 'primaryColor', type: 'text', defaultValue: '#00ff88' },
    { name: 'secondaryColor', type: 'text', defaultValue: '#0a1628' },
    { name: 'accentColor', type: 'text', defaultValue: '#ff6b35' },
    { name: 'fontFamily', type: 'text' },
    { name: 'isActive', type: 'checkbox', defaultValue: true },
    { name: 'domain', type: 'text' },
    {
      name: 'settings',
      type: 'group',
      fields: [
        { name: 'allowRegistration', type: 'checkbox', defaultValue: true },
        { name: 'socialEnabled', type: 'checkbox', defaultValue: true },
        { name: 'storeEnabled', type: 'checkbox', defaultValue: true },
        { name: 'eventsEnabled', type: 'checkbox', defaultValue: true },
        { name: 'certificationEnabled', type: 'checkbox', defaultValue: true },
      ],
    },
  ],
};
