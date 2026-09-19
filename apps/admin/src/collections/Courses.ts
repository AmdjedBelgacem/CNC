import type { CollectionConfig } from 'payload';

export const Courses: CollectionConfig = {
  slug: 'courses',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'tenant', 'difficulty', 'isPublished'],
    group: 'Academy',
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
    { name: 'slug', type: 'text', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'subtitle', type: 'text' },
    { name: 'description', type: 'richText' },
    { name: 'thumbnail', type: 'upload', relationTo: 'media' },
    {
      name: 'difficulty',
      type: 'select',
      options: [
        { label: 'Beginner', value: '1' },
        { label: 'Intermediate', value: '2' },
        { label: 'Advanced', value: '3' },
        { label: 'Expert', value: '4' },
        { label: 'Master', value: '5' },
      ],
    },
    { name: 'estimatedHours', type: 'number' },
    { name: 'isPublished', type: 'checkbox', defaultValue: false },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
    {
      name: 'series',
      type: 'relationship',
      relationTo: 'series',
      hasMany: true,
    },
    {
      name: 'relatedProducts',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
    },
    {
      name: 'sponsors',
      type: 'relationship',
      relationTo: 'sponsors',
      hasMany: true,
    },
  ],
};
