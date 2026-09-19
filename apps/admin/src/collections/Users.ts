import type { CollectionConfig } from 'payload';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role', 'tenant', 'isActive'],
    group: 'System',
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
    { name: 'name', type: 'text' },
    { name: 'role', type: 'select', options: ['student', 'instructor', 'admin', 'superadmin'], defaultValue: 'student' },
    { name: 'avatar', type: 'upload', relationTo: 'media' },
    { name: 'isActive', type: 'checkbox', defaultValue: true },
    {
      name: 'metadata',
      type: 'group',
      fields: [
        { name: 'bio', type: 'textarea' },
        { name: 'title', type: 'text' },
        { name: 'company', type: 'text' },
        { name: 'location', type: 'text' },
        { name: 'website', type: 'text' },
      ],
    },
  ],
};
