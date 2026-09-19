import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema';

export async function seedSponsors(db: PostgresJsDatabase<typeof schema>, tenantId: string) {
  await db.insert(schema.sponsors).values([
    { tenantId, name: 'Haas Automation', description: 'Leading CNC machine tool builder', tier: 'Platinum', sortOrder: 1, isActive: true },
    { tenantId, name: 'Sandvik Coromant', description: 'World leader in metal cutting tools', tier: 'Platinum', sortOrder: 2, isActive: true },
    { tenantId, name: 'Mazak', description: 'Global CNC machine tool manufacturer', tier: 'Platinum', sortOrder: 3, isActive: true },
    { tenantId, name: 'Tormach', description: 'Personal CNC machines for every shop', tier: 'Gold', sortOrder: 4, isActive: true },
    { tenantId, name: 'Kennametal', description: 'Advanced tooling solutions', tier: 'Gold', sortOrder: 5, isActive: true },
    { tenantId, name: 'Okuma', description: 'CNC machine tools and controls', tier: 'Gold', sortOrder: 6, isActive: true },
    { tenantId, name: 'MSC Industrial Supply', description: 'Metalworking and MRO supplies', tier: 'Silver', sortOrder: 7, isActive: true },
    { tenantId, name: 'Mastercam', description: 'CAD/CAM software solutions', tier: 'Silver', sortOrder: 8, isActive: true },
    { tenantId, name: 'Fusion 360', description: 'Cloud-based CAD/CAM platform', tier: 'Silver', sortOrder: 9, isActive: true },
    { tenantId, name: 'Maritool', description: 'Premium cutting tools and holders', tier: 'General', sortOrder: 10, isActive: true },
  ]);
  console.log('Seeded 10 sponsors');
}
