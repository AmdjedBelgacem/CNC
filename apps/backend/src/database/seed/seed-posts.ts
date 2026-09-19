import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema';

export async function seedPosts(db: PostgresJsDatabase<typeof schema>, userId: string, tenantId: string) {
  await db.insert(schema.posts).values([
    {
      userId, tenantId,
      content: 'Just completed the CNC Milling Fundamentals course! The hands-on projects were incredible. Highly recommend to anyone starting out.',
      tags: ['course', 'cnc-milling'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'Check out this 5-axis machining setup we did today. The surface finish was within 0.0002"! Absolutely incredible what modern machines can do.',
      tags: ['5-axis', 'machining'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'New TITAN TV video: Tormach 1100M full build timelapse. Link in bio! Go check it out.',
      tags: ['titan-tv', 'machine-build'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'Does anyone have recommendations for workholding solutions for thin-wall aluminum parts? I\'m getting too much vibration on my current setup.',
      tags: ['workholding', 'aluminum'], isPublic: true,
    },
  ]);
  console.log('Seeded 4 posts');
}
