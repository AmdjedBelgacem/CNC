import type { CollectionConfig } from 'payload';

export const Lessons: CollectionConfig = {
  slug: 'lessons',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'series', 'difficulty', 'isPublished', 'freePreview'],
    group: 'Academy',
  },
  fields: [
    { name: 'series', type: 'relationship', relationTo: 'series', required: true },
    { name: 'slug', type: 'text', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'videoUrl', type: 'text' },
    { name: 'videoDuration', type: 'number' },
    { name: 'content', type: 'richText' },
    {
      name: 'attachments',
      type: 'array',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'type', type: 'select', options: ['cad', 'dxf', 'pdf', 'spreadsheet', 'image', 'other'] },
        { name: 'file', type: 'upload', relationTo: 'media', required: true },
        { name: 'description', type: 'textarea' },
      ],
    },
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
    { name: 'isPublished', type: 'checkbox', defaultValue: false },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
    { name: 'freePreview', type: 'checkbox', defaultValue: false },
  ],
};
