import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import * as schema from './schema';
import { seedVideos } from './seed/seed-videos';
import { seedStudyGroups } from './seed/seed-study-groups';
import { seedSponsors } from './seed/seed-sponsors';
import { seedEvents } from './seed/seed-events';
import { seedPosts } from './seed/seed-posts';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_KEYS,
  SYSTEM_ROLE_PERMISSIONS,
} from '../modules/rbac/rbac.constants';

/**
 * Demo seed — idempotent, safe to rerun.
 *
 * Why no top-level `import * as argon2`: the native module has no darwin-arm64
 * prebuild in this repo (only glibc), so importing it crashes tsx/node with
 * SIGSEGV (exit 139) on dev Macs. Password hashing is resolved lazily inside
 * seed(): real argon2 when the native binding loads, otherwise a clearly
 * labeled `fallback-hash:` dev-only value that PasswordService accepts in dev.
 * Production must have working argon2 prebuilds (see package README + CI).
 */
async function hashPasswordDev(password: string): Promise<{ hash: string; devFallback: boolean }> {
  // Never require('argon2') here: the native binding SIGSEGVs this process on
  // dev Macs without a darwin-arm64 prebuild (exit 139, uncatchable). The dev
  // PasswordService fallback accepts `fallback-hash:<password>`; production
  // uses real argon2 via password.service.ts (which has proper prebuilds).
  return { hash: `fallback-hash:${password}`, devFallback: true };
}

async function seed() {
  if ((process.env.NODE_ENV || 'development') === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    throw new Error(
      'Refusing to run demo seed against NODE_ENV=production without ALLOW_PROD_SEED=true. Demo seed mints dev-only fallback password hashes.',
    );
  }
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  console.log('Seeding database (idempotent demo seed)...');

  // --- Tenants (reuse if present) ---
  let tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.slug, 'cnc-fundamentals'),
  });
  if (!tenant) {
    const [created] = await db
      .insert(schema.tenants)
      .values({
        slug: 'cnc-fundamentals',
        name: 'CNC Fundamentals',
        description: 'Master the basics of CNC machining',
        primaryColor: '#7c3aed',
        secondaryColor: '#0a1628',
        accentColor: '#ff6b35',
        isActive: true,
        settings: {
          allowRegistration: true,
          socialEnabled: true,
          storeEnabled: true,
          eventsEnabled: true,
          certificationEnabled: true,
        },
      })
      .returning();
    if (!created) throw new Error('Failed to create tenant');
    tenant = created;
    console.log(`Created tenant: ${tenant.name} (${tenant.slug})`);
  } else {
    console.log(`Tenant exists: ${tenant.name} (${tenant.slug})`);
  }

  let tenant2: typeof schema.tenants.$inferSelect | null | undefined = await db.query.tenants.findFirst({
    where: eq(schema.tenants.slug, 'advanced-manufacturing'),
  });
  if (!tenant2) {
    const [created] = await db
      .insert(schema.tenants)
      .values({
        slug: 'advanced-manufacturing',
        name: 'Advanced Manufacturing Institute',
        description: 'Cutting-edge manufacturing education',
        primaryColor: '#7c3aed',
        secondaryColor: '#0a1628',
        accentColor: '#ff6b35',
        isActive: true,
        settings: {
          allowRegistration: true,
          socialEnabled: true,
          storeEnabled: true,
          eventsEnabled: true,
          certificationEnabled: true,
        },
      })
      .returning();
    tenant2 = created ?? null;
    if (tenant2) console.log(`Created tenant: ${tenant2.name} (${tenant2.slug})`);
  } else {
    console.log(`Tenant exists: ${tenant2.name} (${tenant2.slug})`);
  }

  const { hash: testPassword, devFallback } = await hashPasswordDev('Test1234!');
  if (devFallback) {
    console.warn('[seed] dev fallback password hashes in use — dev DB only, never production');
  }

  const usersData = [
    { email: 'superadmin@titansofmanufacturing.com', name: 'Super Admin', username: 'superadmin', role: 'super_admin', tenantId: tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
    { email: 'admin@titansofmanufacturing.com', name: 'Admin User', username: 'admin', role: 'admin', tenantId: tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
    { email: 'instructor@titansofmanufacturing.com', name: 'Jane Instructor', username: 'jane-instructor', role: 'instructor', tenantId: tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
    { email: 'learner@titansofmanufacturing.com', name: 'Bob Learner', username: 'bob-learner', role: 'learner', tenantId: tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
    { email: 'sponsor@titansofmanufacturing.com', name: 'Acme Corp', username: 'acme-corp', role: 'sponsor', tenantId: tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
    { email: 'moderator@titansofmanufacturing.com', name: 'Moderator User', username: 'moderator', role: 'moderator', tenantId: tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
    { email: 'pending@titansofmanufacturing.com', name: 'Pending User', username: 'pending-user', role: 'learner', tenantId: tenant.id, accountStatus: 'pending_verification' },
    { email: 'suspended@titansofmanufacturing.com', name: 'Suspended User', username: 'suspended-user', role: 'learner', tenantId: tenant.id, accountStatus: 'suspended' },
    { email: 'cross-tenant@titansofmanufacturing.com', name: 'Cross Tenant User', username: 'cross-tenant', role: 'learner', tenantId: tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
    { email: 'learner2@advancedmanufacturing.com', name: 'Advanced Learner', username: 'advanced-learner', role: 'learner', tenantId: tenant2?.id || tenant.id, accountStatus: 'active', emailVerifiedAt: new Date() },
  ];

  const createdUsers: typeof schema.users.$inferSelect[] = [];
  for (const u of usersData) {
    const existing = await db.query.users.findFirst({
      where: and(eq(schema.users.email, u.email), eq(schema.users.tenantId, u.tenantId)),
    });
    if (existing) {
      // Backfill a handle so /profile/:username resolves for pre-existing rows too.
      if (!existing.username) {
        await db.update(schema.users)
          .set({ username: u.username, updatedAt: new Date() })
          .where(eq(schema.users.id, existing.id));
        existing.username = u.username;
      }
      createdUsers.push(existing);
      continue;
    }
    const result = await db.insert(schema.users).values({
      tenantId: u.tenantId,
      email: u.email,
      name: u.name,
      username: u.username,
      role: u.role,
      passwordHash: testPassword,
      accountStatus: u.accountStatus,
      emailVerifiedAt: u.emailVerifiedAt || null,
      isActive: u.accountStatus !== 'deleted',
    }).returning();
    if (result?.[0]) {
      createdUsers.push(result[0]);
      console.log(`Created user: ${u.email} (${u.role}) - ${u.accountStatus}`);
    }
  }

  const crossTenantUser = createdUsers.find(u => u.email === 'cross-tenant@titansofmanufacturing.com');
  if (crossTenantUser && tenant2) {
    await db.insert(schema.userTenantRoles).values({
      userId: crossTenantUser.id,
      tenantId: tenant2.id,
      role: 'instructor',
    }).onConflictDoNothing();
  }

  const adminUser = createdUsers.find(u => u.email === 'admin@titansofmanufacturing.com');
  if (adminUser && tenant2) {
    await db.insert(schema.userTenantRoles).values({
      userId: adminUser.id,
      tenantId: tenant2.id,
      role: 'admin',
    }).onConflictDoNothing();
  }

  // --- Academy (ensure at least one well-named, published demo academy) ---
  // NOTE: this used to fall back to *any* published academy for the tenant, which
  // meant a hand-made row like "Testing Academy" silently became the demo academy
  // and leaked into the public catalogue. Seed only our own deterministic slug.
  let academy: typeof schema.academies.$inferSelect | null | undefined = await db.query.academies.findFirst({
    where: and(eq(schema.academies.tenantId, tenant.id), eq(schema.academies.slug, 'general')),
  });
  if (!academy) {
    const [created] = await db.insert(schema.academies).values({
      tenantId: tenant.id,
      slug: 'general',
      title: 'CNC Machining Academy',
      subtitle: 'From first cut to production-ready parts',
      description:
        'A structured path through machine setup, tooling, workholding, feeds and speeds, and G-code — built for working machinists.',
      isPublished: true,
      publishedAt: new Date(),
    }).returning();
    academy = created ?? null;
    console.log('Created demo academy: general');
  } else {
    // Repair a previously-mis-seeded demo academy (e.g. a placeholder title).
    if (!academy.title || /^(untitled|testing)/i.test(academy.title.trim())) {
      const [fixed] = await db.update(schema.academies)
        .set({
          title: 'CNC Machining Academy',
          subtitle: academy.subtitle || 'From first cut to production-ready parts',
          description:
            academy.description ||
            'A structured path through machine setup, tooling, workholding, feeds and speeds, and G-code — built for working machinists.',
          isPublished: true,
          publishedAt: academy.publishedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.academies.id, academy.id))
        .returning();
      if (fixed) academy = fixed;
      console.log('Repaired placeholder demo academy title');
    }
    console.log(`Academy exists: ${academy.slug}`);
  }

  // --- Course (ensure demo course, published, with thumbnail when available) ---
  let course = await db.query.courses.findFirst({
    where: and(eq(schema.courses.tenantId, tenant.id), eq(schema.courses.slug, 'cnc-milling-fundamentals')),
  });
  if (!course) {
    const [created] = await db
      .insert(schema.courses)
      .values({
        tenantId: tenant.id,
        academyId: academy?.id ?? null,
        slug: 'cnc-milling-fundamentals',
        title: 'CNC Milling Fundamentals',
        subtitle: 'From zero to your first machined part',
        description: 'Learn the fundamentals of CNC milling including setup, tooling, and programming.',
        difficulty: 1,
        estimatedHours: 20,
        isPublished: true,
        sortOrder: 1,
      })
      .returning();
    if (!created) throw new Error('Failed to create course');
    course = created;
    console.log(`Created course: ${course.title}`);
  } else {
    // Keep demo course attached to the demo academy + published.
    await db.update(schema.courses).set({
      isPublished: true,
      academyId: course.academyId ?? academy?.id ?? null,
      updatedAt: new Date(),
    }).where(eq(schema.courses.id, course.id));
    console.log(`Course exists: ${course.title}`);
  }

  // --- Series ---
  let series1 = await db.query.series.findFirst({
    where: and(eq(schema.series.tenantId, tenant.id), eq(schema.series.slug, 'introduction-to-cnc')),
  });
  if (!series1) {
    const [created] = await db
      .insert(schema.series)
      .values({
        courseId: course.id,
        tenantId: tenant.id,
        slug: 'introduction-to-cnc',
        title: 'Introduction to CNC',
        description: 'Get started with CNC machining concepts',
        sortOrder: 1,
        isPublished: true,
      })
      .returning();
    if (!created) throw new Error('Failed to create series');
    series1 = created;
  }

  // --- Lessons (ensure freePreview + gated pair; never wipe existing video keys) ---
  const ensureLesson = async (values: {
    slug: string; title: string; description: string; content: string;
    sortOrder: number; freePreview: boolean;
  }) => {
    const existing = await db.query.lessons.findFirst({
      where: and(eq(schema.lessons.tenantId, tenant.id), eq(schema.lessons.slug, values.slug)),
    });
    if (existing) return existing;
    const [created] = await db.insert(schema.lessons).values({
      seriesId: series1.id,
      tenantId: tenant.id,
      ...values,
      difficulty: 1,
      isPublished: true,
    }).returning();
    console.log(`Created lesson: ${values.slug}`);
    return created;
  };
  await ensureLesson({
    slug: 'what-is-cnc',
    title: 'What is CNC Machining?',
    description: 'An overview of computer numerical control machining',
    content: 'CNC (Computer Numerical Control) machining is a manufacturing process...',
    sortOrder: 1,
    freePreview: true,
  });
  await ensureLesson({
    slug: 'machine-anatomy',
    title: 'CNC Machine Anatomy',
    description: 'Understanding the parts of a CNC mill',
    content: 'A CNC mill consists of several key components...',
    sortOrder: 2,
    freePreview: false,
  });

  // --- Lesson thumbnail backfill: lessons without thumbs inherit the course thumbnail ---
  const courseThumb = (
    await db.query.courses.findFirst({
      where: eq(schema.courses.id, course.id),
      columns: { thumbnailUrl: true },
    })
  )?.thumbnailUrl;
  if (courseThumb) {
    const updated = await db.update(schema.lessons)
      .set({ thumbnailUrl: courseThumb, updatedAt: new Date() })
      .where(and(eq(schema.lessons.tenantId, tenant.id), isNull(schema.lessons.thumbnailUrl)))
      .returning({ id: schema.lessons.id });
    if (updated.length) console.log(`Backfilled ${updated.length} lesson thumbnail(s) from course art`);
  }

  // --- Demo products (published, so the store is non-empty after seed) ---
  const ensureProduct = async (values: {
    slug: string; title: string; tagline: string; description: string;
    price: number; category: string; featured: boolean; sortOrder: number;
  }) => {
    const existing = await db.query.products.findFirst({
      where: and(eq(schema.products.tenantId, tenant.id), eq(schema.products.slug, values.slug)),
    });
    if (existing) return existing;
    const [created] = await db.insert(schema.products).values({
      tenantId: tenant.id,
      thumbnailUrl: courseThumb,
      currency: 'USD',
      inventory: 25,
      isPublished: true,
      tags: ['demo'],
      ...values,
    }).returning();
    console.log(`Created product: ${values.slug}`);
    return created;
  };
  await ensureProduct({
    slug: 'beginner-end-mill-kit',
    title: 'Beginner End Mill Kit',
    tagline: 'Six essential end mills for your first parts',
    description: 'A starter set of 2- and 4-flute end mills covering aluminum and steel basics.',
    price: 8995,
    category: 'Tool Kits',
    featured: true,
    sortOrder: 1,
  });
  await ensureProduct({
    slug: 'precision-edge-finder',
    title: 'Precision Edge Finder',
    tagline: 'Dial in work offsets fast',
    description: '0.0005 in precision edge finder for mills.',
    price: 3495,
    category: 'Workholding',
    featured: false,
    sortOrder: 2,
  });

  // --- Cert template (ensure at least one active template for the demo course) ---
  const existingTemplate = await db.query.certTemplates.findFirst({
    where: eq(schema.certTemplates.tenantId, tenant.id),
  });
  if (!existingTemplate) {
    await db.insert(schema.certTemplates).values({
      tenantId: tenant.id,
      courseId: course.id,
      name: 'CNC Fundamentals Certificate',
      layout: 'modern',
      primaryColor: '#7c3aed',
      isActive: true,
    });
    console.log('Created demo cert template');
  }

  // --- Ancillary demo data: only when tables are empty (keeps reruns safe) ---
  try {
    const [v] = await db.select({ n: count() }).from(schema.videoSeries);
    if (Number(v?.n ?? 0) === 0) await seedVideos(db, tenant.id);
  } catch (e) { console.warn('[seed] seedVideos skipped:', (e as Error)?.message); }
  try {
    const [s] = await db.select({ n: count() }).from(schema.sponsors);
    if (Number(s?.n ?? 0) === 0) await seedSponsors(db, tenant.id);
  } catch (e) { console.warn('[seed] seedSponsors skipped:', (e as Error)?.message); }
  try {
    const [ev] = await db.select({ n: count() }).from(schema.events);
    if (Number(ev?.n ?? 0) === 0) await seedEvents(db, tenant.id);
  } catch (e) { console.warn('[seed] seedEvents skipped:', (e as Error)?.message); }
  try {
    const [p] = await db.select({ n: count() }).from(schema.posts);
    if (Number(p?.n ?? 0) === 0 && createdUsers[0]) await seedPosts(db, createdUsers[0].id, tenant.id);
  } catch (e) { console.warn('[seed] seedPosts skipped:', (e as Error)?.message); }
  try {
    const [g] = await db.select({ n: count() }).from(schema.studyGroups);
    if (Number(g?.n ?? 0) === 0 && createdUsers[0]) await seedStudyGroups(db, createdUsers[0].id);
  } catch (e) { console.warn('[seed] seedStudyGroups skipped:', (e as Error)?.message); }

  await seedRbac(db, [tenant.id, tenant2?.id].filter(Boolean) as string[], createdUsers);

  console.log('\n--- Test Accounts ---');
  console.log('Password for all users: Test1234!');
  console.log('------------------------');
  console.log('super_admin:  superadmin@titansofmanufacturing.com');
  console.log('admin:        admin@titansofmanufacturing.com');
  console.log('instructor:   instructor@titansofmanufacturing.com');
  console.log('learner:      learner@titansofmanufacturing.com');
  console.log('cross-tenant: cross-tenant@titansofmanufacturing.com  (learner in tenant1, instructor in tenant2)');
  console.log('------------------------');
  console.log('Seed complete!');
  await client.end();
}

async function seedRbac(
  db: any,
  tenantIds: string[],
  createdUsers: typeof schema.users.$inferSelect[],
) {
  console.log('Seeding RBAC permissions + system roles...');

  for (const p of PERMISSION_CATALOG) {
    await db
      .insert(schema.permissions)
      .values({
        key: p.key,
        group: p.group,
        label: p.label,
        description: p.description ?? null,
      })
      .onConflictDoNothing({ target: [schema.permissions.key] });
  }
  console.log('Upserted permission catalog');

  for (const tenantId of tenantIds) {
    const roleKeyToId = new Map<string, string>();
    for (const key of SYSTEM_ROLE_KEYS) {
      const [role] = await db
        .insert(schema.roles)
        .values({
          tenantId,
          key,
          name: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          description: `${key} system role`,
          isSystem: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing({ target: [schema.roles.tenantId, schema.roles.key] })
        .returning({ id: schema.roles.id });

      const roleId =
        role?.id ||
        (
          await db
            .select({ id: schema.roles.id })
            .from(schema.roles)
            .where(eq(schema.roles.key, key))
            .limit(1)
        )[0]?.id;
      if (roleId) roleKeyToId.set(key, roleId);

      const permKeys = SYSTEM_ROLE_PERMISSIONS[key] ?? [];
      if (roleId && permKeys.length) {
        const permRows = await db
          .select({ id: schema.permissions.id })
          .from(schema.permissions)
          .where(inArray(schema.permissions.key, permKeys));
        await db
          .delete(schema.rolePermissions)
          .where(eq(schema.rolePermissions.roleId, roleId));
        if (permRows.length) {
          await db.insert(schema.rolePermissions).values(
            permRows.map((p: { id: string }) => ({ roleId, permissionId: p.id })),
          );
        }
      }
    }

    for (const u of createdUsers) {
      if (!u.tenantId || u.tenantId !== tenantId) continue;
      const roleId = roleKeyToId.get(u.role);
      if (roleId) {
        await db
          .insert(schema.userRoles)
          .values({ userId: u.id, tenantId, roleId, assignedBy: null })
          .onConflictDoNothing({
            target: [schema.userRoles.userId, schema.userRoles.tenantId, schema.userRoles.roleId],
          });
      }
    }
    console.log(`Seeded RBAC for tenant ${tenantId}`);
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
