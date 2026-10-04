/**
 * End-to-end certificate proof over real HTTP.
 *
 * Signs in as a genuine learner, completes every lesson through the real
 * progress endpoint (which is what invokes the auto-issue path), then lists and
 * downloads the certificate. Nothing is stubbed: no service is constructed by
 * hand and no row is written behind the API's back except the fixtures.
 */
import postgres from 'postgres';
import argon2 from 'argon2';

const API = 'http://localhost:4000';
const TENANT = 'cnc-fundamentals';
const PASSWORD = 'E2eCert!2026';
const db = postgres(process.env.DATABASE_URL);
const q = async (sql, params = []) => await db.unsafe(sql, params);
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => console.log(`  ✗ ${m}`);

console.log('=== 1. Templates currently in the tenant ===');
for (const t of await q(
  `SELECT scope_type, name, (fields IS NOT NULL AND jsonb_array_length(fields) > 0) AS has_fields
   FROM cert_templates WHERE tenant_id = (SELECT id FROM tenants WHERE slug = $1) ORDER BY scope_type`,
  [TENANT],
)) {
  console.log(`    ${String(t.scope_type).padEnd(8)} ${t.name}  fields=${t.has_fields}`);
}

// ---------- fixtures ----------
const [tenant] = await q(`SELECT id FROM tenants WHERE slug = $1`, [TENANT]);
const email = `e2e-cert-${Date.now()}@example.com`;
const [learner] = await q(
  `INSERT INTO users (tenant_id, email, name, password_hash, role, email_verified_at, account_status)
   VALUES ($1,$2,$3,$4,'learner', now(), 'active') RETURNING id, name, email`,
  [tenant.id, email, 'Layla Ahmed', await argon2.hash(PASSWORD)],
);
const [academy] = await q(`SELECT id, title FROM academies WHERE tenant_id = $1 LIMIT 1`, [tenant.id]);
const [course] = await q(
  `INSERT INTO courses (tenant_id, title, slug, academy_id, is_published, auto_issue_certificate, estimated_hours)
   VALUES ($1,$2,$3,$4,true,true,20) RETURNING id, title`,
  [tenant.id, 'E2E Certificate Course', `e2e-cert-${Date.now()}`, academy.id],
);
const [series] = await q(
  `INSERT INTO series (tenant_id, course_id, slug, title) VALUES ($1,$2,$3,'Section 1') RETURNING id`,
  [tenant.id, course.id, `e2e-s-${Date.now()}`],
);
const lessons = [];
for (let i = 1; i <= 3; i++) {
  const [l] = await q(
    `INSERT INTO lessons (tenant_id, series_id, title, slug, sort_order)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [tenant.id, series.id, `Lesson ${i}`, `e2e-l-${Date.now()}-${i}`, i],
  );
  lessons.push(l.id);
}
console.log(`\n=== 2. Fixtures ===`);
console.log(`    learner : ${learner.name} <${learner.email}>`);
console.log(`    course  : ${course.title} (academy: ${academy.title}, auto_issue_certificate = true)`);
console.log(`    lessons : ${lessons.length}`);

// ---------- sign in ----------
const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-tenant-slug': TENANT },
  body: JSON.stringify({ email, password: PASSWORD }),
});
const auth = await login.json();
if (!login.ok || !auth.accessToken) {
  console.log(`    login failed: HTTP ${login.status} ${JSON.stringify(auth).slice(0, 200)}`);
  process.exit(1);
}
const headers = {
  'Content-Type': 'application/json',
  'x-tenant-slug': TENANT,
  Authorization: `Bearer ${auth.accessToken}`,
};
console.log(`\n=== 3. Signed in as the learner (HTTP ${login.status}) ===`);

// ---------- complete every lesson ----------
console.log('\n=== 4. Learner completes each lesson (real POST /progress/lesson) ===');
for (const lessonId of lessons) {
  const res = await fetch(`${API}/progress/lesson`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ lessonId, completed: true, watchTimeSeconds: 60 }),
  });
  const body = await res.json();
  const pct = body?.percent ?? body?.progress?.percent;
  console.log(`    ${lessonId.slice(0, 8)}… -> HTTP ${res.status}${pct != null ? ` progress=${pct}%` : ''}`);
}

// ---------- the certificate ----------
console.log('\n=== 5. GET /certifications/my ===');
const mine = await (await fetch(`${API}/certifications/my`, { headers })).json();
if (!Array.isArray(mine) || mine.length === 0) {
  bad('no certificate was issued');
} else {
  const c = mine[0];
  ok(`issued: ${c.certificateNumber}`);
  console.log(`    source       : ${c.source}`);
  console.log(`    academyId    : ${c.academyId ?? 'null'}`);
  console.log(`    templateId   : ${c.templateId ?? 'null'}`);
  console.log(`    pdfStorageKey: ${c.pdfStorageKey ?? 'NULL'}`);
  console.log(`    usedDefault  : ${c.payload?.usedDefaultLayout}`);
  console.log(`    learner      : ${c.payload?.variables?.learnerName}`);
  console.log(`    course       : ${c.payload?.variables?.courseTitle}`);
  console.log(`    academy      : ${c.payload?.variables?.academyName}`);
  console.log(`    rendered     : ${(c.payload?.fields ?? []).map((f) => `${f.key}="${f.value}"`).join('  ')}`);

  console.log('\n=== 6. GET /certifications/my/:id/download (authorized) ===');
  const dl = await fetch(`${API}/certifications/my/${c.id}/download`, { headers });
  const bytes = Buffer.from(await dl.arrayBuffer());
  const type = dl.headers.get('content-type') ?? '';
  const disp = dl.headers.get('content-disposition') ?? '';
  console.log(`    HTTP ${dl.status}  content-type=${type}  bytes=${bytes.length}`);
  console.log(`    content-disposition=${disp}`);
  if (dl.ok && bytes.subarray(0, 5).toString('latin1') === '%PDF-') {
    ok(`real PDF: ${bytes.length} bytes, %PDF- header present, ends ${bytes.subarray(-6).toString('latin1').trim()}`);
    await import('node:fs').then((fs) => fs.writeFileSync('/tmp/cert-e2e.pdf', bytes));
    console.log('    saved to /tmp/cert-e2e.pdf');
  } else {
    bad(`not a PDF: ${bytes.subarray(0, 80).toString('latin1')}`);
  }

  console.log('\n=== 7. Download authorization ===');
  const noAuth = await fetch(`${API}/certifications/my/${c.id}/download`);
  console.log(`    unauthenticated -> HTTP ${noAuth.status} ${noAuth.status !== 200 ? '(refused ✓)' : '(LEAKED ✗)'}`);
  const otherLearner = '00000000-0000-4000-8000-000000000000';
  const badTok = { ...headers, Authorization: 'Bearer not-a-real-token' };
  console.log(`    bad token      -> HTTP ${(await fetch(`${API}/certifications/my/${c.id}/download`, { headers: badTok })).status} (401 expected)`);

  console.log('\n=== 8. Public verify leaks nothing ===');
  const v = await fetch(`${API}/certifications/verify/${encodeURIComponent(c.certificateNumber)}`);
  const vb = await v.text();
  console.log(`    HTTP ${v.status}: ${vb.slice(0, 220)}`);
  console.log(`    contains learner email? ${vb.includes(email) ? 'YES — LEAK' : 'no'}`);
  console.log(`    contains internal ids?  ${/payload|digitalSignature/.test(vb) ? 'YES — LEAK' : 'no'}`);

  console.log('\n=== 9. Idempotency: complete the last lesson again ===');
  await fetch(`${API}/progress/lesson`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ lessonId: lessons.at(-1), completed: true, watchTimeSeconds: 60 }),
  });
  const after = await (await fetch(`${API}/certifications/my`, { headers })).json();
  console.log(`    certificates for this learner: ${after.length} (must be 1)`);
  after.length === 1 ? ok('no duplicate award') : bad('DUPLICATED');
}

console.log('\n=== 10. Cleanup ===');
await q(`DELETE FROM certifications WHERE user_id = $1`, [learner.id]);
await q(`DELETE FROM lesson_progress WHERE user_id = $1`, [learner.id]);
await q(`DELETE FROM enrollments WHERE user_id = $1`, [learner.id]);
await q(`DELETE FROM notifications WHERE user_id = $1`, [learner.id]);
await q(`DELETE FROM lessons WHERE series_id = $1`, [series.id]);
await q(`DELETE FROM series WHERE id = $1`, [series.id]);
await q(`DELETE FROM courses WHERE id = $1`, [course.id]);
await q(`DELETE FROM users WHERE id = $1`, [learner.id]);
console.log('    done');
await db.end({ timeout: 5 });
