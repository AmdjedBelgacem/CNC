import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq } from 'drizzle-orm';
import * as schema from '../schema';

/**
 * Demo live sessions on the first seeded course — idempotent, safe to rerun.
 *
 * One session in the future (joinable inside the join window) and one already
 * finished, so the student UI has both "Upcoming live sessions" and a past
 * entry to render out of the box.
 */
export async function seedLiveSessions(db: PostgresJsDatabase<typeof schema>, tenantId: string, courseId: string) {
  const now = Date.now();
  const samples = [
    {
      title: 'Live Q&A: Shop Setup & First Cuts',
      description: 'Bring your questions about machine setup, workholding, and running your first part. Recorded for enrolled learners afterwards.',
      startsAt: new Date(now + 3 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now + 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
      status: 'scheduled' as const,
    },
    {
      title: 'Live Walkthrough: Tool Offsets & Work Coordinates',
      description: 'A past session from the milling fundamentals cohort.',
      startsAt: new Date(now - 7 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now - 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      status: 'completed' as const,
    },
  ];

  for (const sample of samples) {
    const existing = await db.query.liveSessions.findFirst({
      where: and(eq(schema.liveSessions.tenantId, tenantId), eq(schema.liveSessions.courseId, courseId), eq(schema.liveSessions.title, sample.title)),
    });
    if (existing) {
      console.log(`Live session exists: ${sample.title}`);
      continue;
    }
    await db.insert(schema.liveSessions).values({
      tenantId,
      courseId,
      title: sample.title,
      description: sample.description,
      startsAt: sample.startsAt,
      endsAt: sample.endsAt,
      timezone: 'UTC',
      meetUrl: 'https://meet.google.com/demo-cnc-live',
      status: sample.status,
      capacity: 100,
    });
    console.log(`Seeded live session: ${sample.title}`);
  }
}
