import type { CollectionConfig } from 'payload';

export const Certifications: CollectionConfig = {
  slug: 'certifications',
  admin: {
    useAsTitle: 'certificateNumber',
    defaultColumns: ['certificateNumber', 'user', 'course', 'issuedAt'],
    group: 'Academy',
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'course', type: 'relationship', relationTo: 'courses', required: true },
    { name: 'template', type: 'relationship', relationTo: 'cert-templates' },
    { name: 'certificateNumber', type: 'text', required: true, unique: true },
    { name: 'issuedAt', type: 'date', defaultValue: () => new Date() },
    { name: 'expiresAt', type: 'date' },
    { name: 'pdfUrl', type: 'text' },
    { name: 'digitalSignature', type: 'textarea' },
  ],
};
