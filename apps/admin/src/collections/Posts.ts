import type { CollectionConfig } from 'payload';

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'content',
    defaultColumns: ['user', 'tenant', 'isPublic', 'likeCount', 'createdAt'],
    group: 'Social',
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants' },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'content', type: 'textarea', required: true },
    { name: 'media', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'tags', type: 'text', hasMany: true },
    { name: 'isPublic', type: 'checkbox', defaultValue: true },
    { name: 'likeCount', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    { name: 'commentCount', type: 'number', defaultValue: 0, admin: { readOnly: true } },
  ],
};
