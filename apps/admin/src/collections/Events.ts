import type { CollectionConfig } from 'payload';

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'eventType', 'startDate', 'isPublished'],
    group: 'Events',
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true },
    { name: 'description', type: 'richText' },
    { name: 'eventType', type: 'select', options: ['workshop', 'webinar', 'conference', 'meetup', 'competition'], defaultValue: 'workshop' },
    { name: 'startDate', type: 'date', required: true },
    { name: 'endDate', type: 'date' },
    { name: 'isVirtual', type: 'checkbox', defaultValue: false },
    { name: 'maxAttendees', type: 'number' },
    { name: 'price', type: 'number' },
    { name: 'thumbnail', type: 'upload', relationTo: 'media' },
    { name: 'isPublished', type: 'checkbox', defaultValue: false },
    {
      name: 'location',
      type: 'group',
      fields: [
        { name: 'venue', type: 'text' },
        { name: 'address', type: 'textarea' },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
      ],
    },
  ],
};
