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
    { tenantId, name: 'DMG Mori', description: 'Global machine tool leader', tier: 'Platinum', sortOrder: 11, isActive: true },
    { tenantId, name: 'Hurco', description: 'CNC machining centers with WinMax control', tier: 'Gold', sortOrder: 12, isActive: true },
    { tenantId, name: 'Mitsubishi Materials', description: 'Advanced cutting tool solutions', tier: 'Gold', sortOrder: 13, isActive: true },
    { tenantId, name: 'YG-1', description: 'World-class cutting tools', tier: 'Silver', sortOrder: 14, isActive: true },
    { tenantId, name: 'Haimer GmbH', description: 'Precision tool holders and 3D sensors', tier: 'Silver', sortOrder: 15, isActive: true },
    { tenantId, name: 'Schunk', description: 'Clamping and gripping technology', tier: 'Gold', sortOrder: 16, isActive: true },
    { tenantId, name: 'Renishaw', description: 'Metrology and additive manufacturing', tier: 'Platinum', sortOrder: 17, isActive: true },
    { tenantId, name: 'Festo', description: 'Industrial automation and pneumatics', tier: 'Silver', sortOrder: 18, isActive: true },
    { tenantId, name: 'Blaser Swisslube', description: 'Premium metalworking fluids', tier: 'General', sortOrder: 19, isActive: true },
    { tenantId, name: 'Parlec', description: 'Tooling and presetting solutions', tier: 'General', sortOrder: 20, isActive: true },
    { tenantId, name: 'Lyndex-Nikken', description: 'Tool holders and rotary tables', tier: 'General', sortOrder: 21, isActive: true },
    { tenantId, name: 'Tsugami/Rem Sales', description: 'Swiss-type CNC lathes', tier: 'Gold', sortOrder: 22, isActive: true },
    { tenantId, name: 'Methods Machine Tools', description: 'Premium machine tool distributor', tier: 'Gold', sortOrder: 23, isActive: true },
    { tenantId, name: 'Ceratizit', description: 'Cutting tool inserts and solutions', tier: 'Silver', sortOrder: 24, isActive: true },
    { tenantId, name: 'Osg Tap & Die', description: 'Threading and cutting tools', tier: 'Silver', sortOrder: 25, isActive: true },
  ]);
  console.log('Seeded 25 sponsors');
}
