import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema';

export async function seedVideos(
  db: PostgresJsDatabase<typeof schema>,
  tenantId: string,
) {
  const now = new Date();

  const seriesData = [
    { title: 'CNC Machine Builds', slug: 'cnc-machine-builds', description: 'Watch complete CNC machine builds from start to finish.', category: 'machine-builds', sortOrder: 1 },
    { title: 'Tooling & Workholding', slug: 'tooling-workholding', description: 'Master the art of tooling selection and workholding setups.', category: 'tooling', sortOrder: 2 },
    { title: 'Shop Tips', slug: 'shop-tips', description: 'Practical shop tips to improve your machining workflow.', category: 'shop-tips', sortOrder: 3 },
    { title: 'Material Deep Dives', slug: 'material-deep-dives', description: 'In-depth looks at machining different materials.', category: 'materials', sortOrder: 4 },
    { title: 'CNC Programming', slug: 'cnc-programming', description: 'G-code, CAM programming, and control operation.', category: 'programming', sortOrder: 5 },
    { title: 'Machine Maintenance', slug: 'machine-maintenance', description: 'Keep your machines running at peak performance.', category: 'maintenance', sortOrder: 6 },
  ];

  const seriesRecords: typeof schema.videoSeries.$inferSelect[] = [];
  for (const s of seriesData) {
    const existing = await db.query.videoSeries.findFirst({
      where: (vs, { eq }) => eq(vs.slug, s.slug),
    });
    if (existing) { seriesRecords.push(existing); continue; }
    const [created] = await db.insert(schema.videoSeries).values({
      tenantId, ...s, createdAt: now,
    }).returning();
    if (created) seriesRecords.push(created);
  }

  const videosBySeries: Record<string, { title: string; duration: number; sortOrder: number }[]> = {
    'cnc-machine-builds': [
      { title: 'Tormach 1100M Full Build Timelapse', duration: 900, sortOrder: 1 },
      { title: 'Haas VF-2 Assembly & First Cuts', duration: 1200, sortOrder: 2 },
      { title: 'Okuma Multus Calibration Walkthrough', duration: 600, sortOrder: 3 },
      { title: 'DMG Mori NTX Install Day', duration: 1050, sortOrder: 4 },
      { title: 'Building a CNC Router from Scratch', duration: 1500, sortOrder: 5 },
      { title: 'Lathe Conversion to CNC', duration: 800, sortOrder: 6 },
    ],
    'tooling-workholding': [
      { title: 'Vise Setup & Parallel Alignment', duration: 480, sortOrder: 1 },
      { title: 'Tool Holder Types Explained', duration: 540, sortOrder: 2 },
      { title: 'Workholding for 5-Axis Parts', duration: 720, sortOrder: 3 },
      { title: 'Soft Jaws: When and How', duration: 400, sortOrder: 4 },
      { title: 'ER Collet vs Power Chuck', duration: 360, sortOrder: 5 },
      { title: 'Vakuum Workholding Basics', duration: 450, sortOrder: 6 },
    ],
    'shop-tips': [
      { title: 'Speeds & Feeds Cheat Sheet', duration: 360, sortOrder: 1 },
      { title: 'Coolant Management Tips', duration: 420, sortOrder: 2 },
      { title: 'Chip Control Strategies', duration: 300, sortOrder: 3 },
      { title: 'Tramming Your Mill in 5 Minutes', duration: 240, sortOrder: 4 },
      { title: 'Deburring Like a Pro', duration: 330, sortOrder: 5 },
      { title: 'Shop Organization Hacks', duration: 280, sortOrder: 6 },
      { title: 'Making Your Own Parallels', duration: 500, sortOrder: 7 },
    ],
    'material-deep-dives': [
      { title: 'Machining 6061 Aluminum', duration: 600, sortOrder: 1 },
      { title: 'Machining 304 Stainless Steel', duration: 720, sortOrder: 2 },
      { title: 'Machining Titanium Ti-6Al-4V', duration: 900, sortOrder: 3 },
      { title: 'Machining Inconel 718', duration: 850, sortOrder: 4 },
      { title: 'Machining Brass & Bronze', duration: 480, sortOrder: 5 },
      { title: 'Machining PEEK & Delrin', duration: 420, sortOrder: 6 },
    ],
    'cnc-programming': [
      { title: 'G-Code Basics for Beginners', duration: 600, sortOrder: 1 },
      { title: 'Canned Cycles Explained', duration: 540, sortOrder: 2 },
      { title: 'CAM Toolpath Strategies', duration: 780, sortOrder: 3 },
      { title: 'Subprograms & Macros', duration: 660, sortOrder: 4 },
      { title: 'Haas Control Deep Dive', duration: 900, sortOrder: 5 },
      { title: 'Fusion 360 CAM Walkthrough', duration: 840, sortOrder: 6 },
    ],
    'machine-maintenance': [
      { title: 'Spindle Maintenance Basics', duration: 400, sortOrder: 1 },
      { title: 'Way Cover & Bellows Care', duration: 300, sortOrder: 2 },
      { title: 'Ball Screw Inspection', duration: 450, sortOrder: 3 },
      { title: 'Electrical Cabinet Cleaning', duration: 280, sortOrder: 4 },
      { title: 'Lubrication System Maintenance', duration: 350, sortOrder: 5 },
      { title: 'Coolant System Flush Guide', duration: 500, sortOrder: 6 },
    ],
  };

  let totalVideos = 0;
  for (const s of seriesRecords) {
    const vids = videosBySeries[s.slug];
    if (!vids?.length) continue;
    const existingVids = await db.query.videos.findFirst({
      where: (v, { eq }) => eq(v.seriesId, s.id),
    });
    if (existingVids) continue;
    await db.insert(schema.videos).values(
      vids.map(v => ({ seriesId: s.id, tenantId, title: v.title, duration: v.duration, sortOrder: v.sortOrder, createdAt: now }))
    );
    totalVideos += vids.length;
  }

  console.log(`Seeded ${seriesRecords.length} video series and ${totalVideos} videos`);
}
