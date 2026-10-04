import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema';

export async function seedStudyGroups(
  db: PostgresJsDatabase<typeof schema>,
  hostId: string,
) {
  const now = new Date();

  await db.insert(schema.studyGroups).values([
    {
      hostId, name: 'Bay Area CNC Meetup',
      description: 'Regular meetup for CNC enthusiasts in the San Francisco Bay Area. All skill levels welcome.',
      academy: 'cnc', city: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194,
      meetingSchedule: 'First Saturday of each month', maxMembers: 30, memberCount: 18, isActive: true, createdAt: now,
    },
    {
      hostId, name: 'Aerospace Machinists of Seattle',
      description: 'A group for aerospace machinists and engineers to share knowledge and network.',
      academy: 'aerospace', city: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321,
      meetingSchedule: 'Every other Wednesday', maxMembers: 25, memberCount: 22, isActive: true, createdAt: now,
    },
    {
      hostId, name: 'SoCal Grinding Guild',
      description: 'Specialized group focused on precision grinding techniques and tooling.',
      academy: 'grinding', city: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437,
      meetingSchedule: 'Third Thursday monthly', maxMembers: 20, memberCount: 14, isActive: true, createdAt: now,
    },
    {
      hostId, name: 'Swiss Precision Network',
      description: 'Network of Swiss-type machining professionals sharing best practices.',
      academy: 'swiss', city: 'Providence', state: 'RI', lat: 41.8240, lng: -71.4128,
      meetingSchedule: 'Bi-weekly on Fridays', maxMembers: 20, memberCount: 11, isActive: true, createdAt: now,
    },
    {
      hostId, name: 'Texas CNC Collective',
      description: 'A growing community of CNC machinists across the Dallas-Fort Worth metroplex.',
      academy: 'cnc', city: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970,
      meetingSchedule: 'Second Tuesday of each month', maxMembers: 35, memberCount: 27, isActive: true, createdAt: now,
    },
    {
      hostId, name: 'Midwest Manufacturing Hub',
      description: 'Connect with manufacturers and machinists across the greater Chicago area.',
      academy: 'cnc', city: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298,
      meetingSchedule: 'Weekly on Saturdays', maxMembers: 40, memberCount: 33, isActive: true, createdAt: now,
    },
    {
      hostId, name: 'Detroit Auto Machinists',
      description: 'Automotive machining specialists — engine blocks, heads, and drivetrain components.',
      academy: 'automotive', city: 'Detroit', state: 'MI', lat: 42.3314, lng: -83.0458,
      meetingSchedule: 'First and third Tuesdays', maxMembers: 30, memberCount: 24, isActive: true, createdAt: now,
    },
    {
      hostId, name: 'Florida Maker Guild',
      description: 'Makers and machinists across Florida sharing projects and knowledge.',
      academy: 'cnc', city: 'Orlando', state: 'FL', lat: 28.5383, lng: -81.3792,
      meetingSchedule: 'Monthly on the 15th', maxMembers: 25, memberCount: 16, isActive: true, createdAt: now,
    },
    {
      hostId, name: 'Northeast Toolmakers Association',
      description: 'Professional toolmakers and die makers in the New England area.',
      academy: 'toolmaking', city: 'Hartford', state: 'CT', lat: 41.7658, lng: -72.6734,
      meetingSchedule: 'Second Saturday monthly', maxMembers: 20, memberCount: 13, isActive: true, createdAt: now,
    },
    {
      hostId, name: 'Rocky Mountain CNC Users',
      description: 'CNC users group covering Colorado, Utah, and Wyoming.',
      academy: 'cnc', city: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903,
      meetingSchedule: 'Third Wednesday monthly', maxMembers: 30, memberCount: 19, isActive: true, createdAt: now,
    },
    {
      hostId, name: 'Pacific Northwest Welding & Machining',
      description: 'Combined welding and machining group for the PNW community.',
      academy: 'welding', city: 'Portland', state: 'OR', lat: 45.5155, lng: -122.6789,
      meetingSchedule: 'First Friday monthly', maxMembers: 25, memberCount: 17, isActive: true, createdAt: now,
    },
    {
      hostId, name: 'Southeast Composites & Machining',
      description: 'CNC machining of composite materials — carbon fiber, G10, and more.',
      academy: 'composites', city: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431,
      meetingSchedule: 'Bi-monthly', maxMembers: 20, memberCount: 9, isActive: true, createdAt: now,
    },
  ]);

  console.log('Seeded 12 study groups');
}
