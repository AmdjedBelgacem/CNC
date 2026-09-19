import type { CollectionConfig } from 'payload';

export const Comments: CollectionConfig = {
  slug: 'comments',
  admin: {
    useAsTitle: 'content',
    defaultColumns: ['user', 'post', 'createdAt'],
    group: 'Social',
  },
  fields: [
    { name: 'post', type: 'relationship', relationTo: 'posts', required: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'content', type: 'textarea', required: true },
  ],
};
