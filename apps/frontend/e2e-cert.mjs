/**
 * End-to-end proof: learner completes every lesson in a course, the
 * auto-issue path fires, a real PDF is produced and downloadable, and a repeat
 * completion does not duplicate the award.
 */
import pg from 'pg';

const API = 'http://localhost:4000';
const TENANT = 'cnc-fundamentals';
const DB = process.env.DATABASE_URL;

const db = new pg.Client({ connectionString: DB });
await db.connect();

const q = async (sql, params = []) => (await db.query(sql, params)).rows;

console.log('=== 1. Seed state: templates by scope ===');
const templates = await q(
  `SELECT scope_type, name, (fields IS NOT NULL AND jsonb_array_length(fields) > 0) AS has_fields
   FROM cert_templates WHERE tenant_id = (SELECT id FROM tenants WHERE slug = $1)
   ORDER BY scope_type`,
  [TENANT],
);
for (const t of templates) console.log(`  ${t.scope_type.padEnd(8)} ${t.name}  fields=${t.has_fields}`);

// A learner + a course inside an academy, with lessons.
const [tenant] = await q(`SELECT id FROM tenants WHERE slug = $1`, [TENANT]);
const [learner] = await q(
  `INSERT INTO users (tenant_id, email, name, password_hash)
   VALUES ($1, $2, $3, 'x') RETURNING id, name, email`,
  [tenant.id, `e2e-cert-${Date.now()}@example.com`, 'Layla Ahmed'],
);
const [academy] = await q(`SELECT id, title FROM academies WHERE tenant_id = $1 LIMIT 1`, [tenant.id]);
const [course] = await q(
  `INSERT INTO courses (tenant_id, title, slug, academy_id, is_published, auto_issue_certificate)
   VALUES ($1, $2, $3, $4, true, true) RETURNING id, title`,
  [tenant.id, 'E2E Certificate Course', `e2e-cert-course-${Date.now()}`, academy.id],
);
const [series] = await q(
  `INSERT INTO series (tenant_id, course_id, slug, title) VALUES ($1,$2,$3,$4) RETURNING id`,
  [tenant.id, course.id, `e2e-cert-series-${Date.now()}`, 'Section 1'],
);
const lessonIds = [];
for (let i = 1; i <= 3; i++) {
  const [l] = await q(
    `INSERT INTO lessons (tenant_id, series_id, title, slug, sort_order)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [tenant.id, series.id, `Lesson ${i}`, `e2e-cert-lesson-${Date.now()}-${i}`, i],
  );
  lessonIds.push(l.id);
}
await q(
  `INSERT INTO enrollments (tenant_id, user_id, course_id, status) VALUES ($1,$2,$3,'active')`,
  [tenant.id, learner.id, course.id],
);
console.log(`\n=== 2. Course under "${academy.title}" (academy-scoped template will resolve) ===`);

console.log('\n=== 3. Simulate the learner completing each lesson ===');
for (const lessonId of lessonIds) {
  // This is what the frontend calls; the backend completion handler is what
  // invokes tryAutoIssue.
  const res = await fetch(`${API}/lessons/${lessonId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-slug': TENANT },
    body: JSON.stringify({ userId: learner.id }),
  });
  console.log(`  complete ${lessonId.slice(0, 8)}… -> HTTP ${res.status}`);
}

console.log('\n=== 4. Certificate row ===');
const certs = await q(
  `SELECT id, certificate_number, source, academy_id, template_id, pdf_storage_key, pdf_url,
          payload->>'usedDefaultLayout' AS default_layout,
          payload->'variables'->>'learnerName' AS learner,
          payload->'variables'->>'courseTitle' AS course_on_cert
   FROM certifications WHERE user_id = $1`,
  [learner.id],
);
if (certs.length === 0) {
  console.log('  ✗ NO CERTIFICATE ISSUED');
} else {
  for (const c of certs) {
    console.log(`  number    : ${c.certificate_number}`);
    console.log(`  source    : ${c.source}`);
    console.log(`  academyId : ${c.academy_id ? 'set' : 'null'}`);
    console.log(`  templateId: ${c.template_id ? 'set' : 'null'}`);
    console.log(`  pdfKey    : ${c.pdf_storage_key ?? 'NULL'}`);
    console.log(`  pdfUrl    : ${c.pdf_url ? c.pdf_url.slice(0, 60) + '…' : 'NULL'}`);
    console.log(`  learner on cert: ${c.learner}`);
    console.log(`  course on cert : ${c.course_on_cert}`);
    console.log(`  used default layout: ${c.default_layout}`);
  }
}

console.log('\n=== 5. Repeat the final lesson (idempotency) ===');
const res2 = await fetch(`${API}/lessons/${lessonIds.at(-1)}/complete`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-tenant-slug': TENANT },
  body: JSON.stringify({ userId: learner.id }),
});
console.log(`  re-complete -> HTTP ${res2.status}`);
const after = await q(`SELECT count(*)::int n FROM certifications WHERE user_id = $1`, [learner.id]);
console.log(`  certificates after repeat: ${after[0].n} (must be 1)`);

console.log('\n=== 6. Public verify leaks nothing ===');
const verify = await fetch(`${API}/certifications/verify/${encodeURIComponent(certs[0]?.certificate_number ?? 'x')}`);
const body = await verify.text();
console.log(`  HTTP ${verify.status}`);
console.log(`  body: ${body.slice(0, 240)}`);
console.log(`  contains learner email? ${body.includes(learner.email)}`);

console.log('\n=== 7. Cleanup ===');
await q(`DELETE FROM certifications WHERE user_id = $1`, [learner.id]);
await q(`DELETE FROM lesson_progress WHERE user_id = $1`, [learner.id]);
await q(`DELETE FROM enrollments WHERE user_id = $1`, [learner.id]);
await q(`DELETE FROM lessons WHERE series_id = $1`, [series.id]);
await q(`DELETE FROM series WHERE id = $1`, [series.id]);
await q(`DELETE FROM courses WHERE id = $1`, [course.id]);
await q(`DELETE FROM users WHERE id = $1`, [learner.id]);
console.log('  cleaned up');
await db.end();
