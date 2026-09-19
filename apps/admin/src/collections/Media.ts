import type { CollectionConfig } from 'payload';

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'System',
  },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*', 'application/pdf', 'application/dxf', 'application/x-step', 'application/x-iges'],
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300, fit: 'cover' },
      { name: 'card', width: 800, height: 600, fit: 'cover' },
      { name: 'hero', width: 1920, height: 1080, fit: 'cover' },
    ],
  },
  fields: [
    { name: 'alt', type: 'text' },
    { name: 'description', type: 'textarea' },
  ],
};
