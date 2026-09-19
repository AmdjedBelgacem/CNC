import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema';

export async function seedEvents(db: PostgresJsDatabase<typeof schema>, tenantId: string) {
  await db.insert(schema.events).values([
    {
      tenantId, slug: 'cnc-workshop-2026',
      title: 'TITANS CNC Workshop 2026',
      description: 'Three-day hands-on CNC machining workshop covering setup, programming, and advanced techniques.',
      eventType: 'workshop',
      location: { venue: 'Austin Convention Center', address: '500 E Cesar Chavez St', city: 'Austin', state: 'TX', lat: 30.2634, lng: -97.7406 },
      startDate: new Date('2026-06-15T09:00:00Z'), endDate: new Date('2026-06-17T17:00:00Z'),
      maxAttendees: 200, isPublished: true,
    },
    {
      tenantId, slug: 'aerospace-symposium-2026',
      title: 'Aerospace Machining Symposium',
      description: 'Industry leaders share best practices for AS9100-compliant aerospace machining.',
      eventType: 'conference',
      location: { venue: 'Washington State Convention Center', address: '705 Pike St', city: 'Seattle', state: 'WA', lat: 47.6116, lng: -122.3327 },
      startDate: new Date('2026-08-10T09:00:00Z'), endDate: new Date('2026-08-11T17:00:00Z'),
      maxAttendees: 150, isPublished: true,
    },
    {
      tenantId, slug: 'swiss-masterclass-2026',
      title: 'Swiss Machining Masterclass',
      description: 'Intensive five-day course on Swiss-type lathe programming, tooling, and setup.',
      eventType: 'course',
      location: { venue: 'Providence Marriott', address: '1 Orms St', city: 'Providence', state: 'RI', lat: 41.8240, lng: -71.4128 },
      startDate: new Date('2026-09-21T09:00:00Z'), endDate: new Date('2026-09-25T17:00:00Z'),
      maxAttendees: 30, isPublished: true,
    },
    {
      tenantId, slug: 'west-coast-meetup-2026',
      title: 'Community Meetup: West Coast',
      description: 'One-day networking event for CNC professionals and hobbyists.',
      eventType: 'meetup',
      location: { venue: 'Los Angeles Convention Center', address: '1201 S Figueroa St', city: 'Los Angeles', state: 'CA', lat: 34.0400, lng: -118.2700 },
      startDate: new Date('2026-10-12T10:00:00Z'), endDate: new Date('2026-10-12T18:00:00Z'),
      maxAttendees: 100, isPublished: true,
    },
    {
      tenantId, slug: 'manufacturing-summit-2026',
      title: 'Year-End Manufacturing Summit',
      description: 'Annual summit reviewing industry trends, new technologies, and community achievements.',
      eventType: 'conference',
      location: { venue: 'McCormick Place', address: '2301 S King Dr', city: 'Chicago', state: 'IL', lat: 41.8526, lng: -87.6160 },
      startDate: new Date('2026-12-03T09:00:00Z'), endDate: new Date('2026-12-04T17:00:00Z'),
      maxAttendees: 300, isPublished: true,
    },
  ]);
  console.log('Seeded 5 events');
}
