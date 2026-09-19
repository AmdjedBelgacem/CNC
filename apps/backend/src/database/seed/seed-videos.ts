import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema';

export async function seedVideos(
  db: PostgresJsDatabase<typeof schema>,
  tenantId: string,
) {
  const now = new Date();

  const series1 = await db
    .insert(schema.videoSeries)
    .values({
      tenantId,
      title: 'CNC Machine Builds',
      slug: 'cnc-machine-builds',
      description: 'Watch complete CNC machine builds from start to finish.',
      category: 'machine-builds',
      sortOrder: 1,
      createdAt: now,
    })
    .returning();

  const series2 = await db
    .insert(schema.videoSeries)
    .values({
      tenantId,
      title: 'Tooling & Workholding',
      slug: 'tooling-workholding',
      description: 'Master the art of tooling selection and workholding setups.',
      category: 'tooling',
      sortOrder: 2,
      createdAt: now,
    })
    .returning();

  const series3 = await db
    .insert(schema.videoSeries)
    .values({
      tenantId,
      title: 'Shop Tips',
      slug: 'shop-tips',
      description: 'Practical shop tips to improve your machining workflow.',
      category: 'shop-tips',
      sortOrder: 3,
      createdAt: now,
    })
    .returning();

  const s1 = series1[0]; const s2 = series2[0]; const s3 = series3[0];
  if (s1 && s2 && s3) {
    await db.insert(schema.videos).values([
      { seriesId: s1.id, title: 'Tormach 1100M Build', duration: 900, sortOrder: 1, createdAt: now },
      { seriesId: s1.id, title: 'Haas VF-2 Setup', duration: 1200, sortOrder: 2, createdAt: now },
      { seriesId: s1.id, title: 'Okuma Multus Calibration', duration: 600, sortOrder: 3, createdAt: now },
      { seriesId: s1.id, title: 'DMG Mori NTX Installation', duration: 1050, sortOrder: 4, createdAt: now },
      { seriesId: s2.id, title: 'Vise Setup', duration: 480, sortOrder: 1, createdAt: now },
      { seriesId: s2.id, title: 'Tool Holder Basics', duration: 540, sortOrder: 2, createdAt: now },
      { seriesId: s2.id, title: 'Workholding for 5-Axis', duration: 720, sortOrder: 3, createdAt: now },
      { seriesId: s3.id, title: 'Speeds & Feeds', duration: 360, sortOrder: 1, createdAt: now },
      { seriesId: s3.id, title: 'Coolant Management', duration: 420, sortOrder: 2, createdAt: now },
      { seriesId: s3.id, title: 'Chip Control', duration: 300, sortOrder: 3, createdAt: now },
    ]);
  }

  console.log('Seeded video series and videos');
}
