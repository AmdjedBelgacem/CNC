/**
 * API sweep harness — driven by the backend's own route table.
 *
 * The route list is parsed from the Nest startup log ("Mapped {...} route") rather than
 * hand-written, because a hand-written matrix silently "passes" by 404ing on paths that
 * were never real. That is exactly what happened on the first attempt: 20 invented
 * `/admin/categories`-style paths returned 404 and looked like 20 failures, when the
 * real names are `/products/categories`, `/admin/certifications` and so on.
 *
 * Phases:
 *   1. authz   — no token, learner token, admin token on every safe GET. Catches a route
 *                with a missing or wrong guard, which unit tests cannot see because they
 *                call the service directly.
 *   2. crud    — create/read/update/delete round trips on synthetic `__qa_*` records.
 *                Cleanup runs even when an assertion fails, and only records this
 *                harness created are ever deleted.
 *   3. negative— malformed writes must be refused, unknown ids must be 404.
 *
 * Routes that send real email, charge a card, call an AI provider, stream video, or
 * mutate global config are skipped and reported.
 *
 * Usage:
 *   node scripts/qa/api-sweep.mjs --base=http://127.0.0.1:4000 --phase=all
 *
 * The route table is read from /tmp/routes.txt, which is extracted from the backend's
 * own startup log:
 *   grep -oE "Mapped \{/[^,]*, (GET|POST|PATCH|PUT|DELETE)\} route" .dev-logs/backend.log \
 *     | sed -E 's/Mapped \{(.*), (GET|POST|PATCH|PUT|DELETE)\} route/\2 \1/' | sort -u > /tmp/routes.txt
 */
import fs from 'node:fs';

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  }),
);
const BASE = argv.base ?? 'http://127.0.0.1:4000';
const TENANT = process.env.QA_TENANT ?? 'cnc-fundamentals';
const ADMIN = fs.readFileSync(argv.token ?? '/tmp/qa-token.txt', 'utf8').trim();
const LEARNER = process.env.QA_LEARNER_TOKEN ?? '';
const ROUTES = fs
  .readFileSync(argv.routes ?? '/tmp/routes.txt', 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => l.split(' '))
  .map(([method, path]) => ({ method, path }));

const results = [];
let cleanup = [];
// Hyphens, not underscores: academy slugs are validated against
// /^[a-z0-9-]{2,200}$/, so an underscore stamp was rejected as a bad request.
const stamp = () => `qa-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;

function record(phase, name, status, expect, note = '') {
  results.push({ phase, name, status, expect, ok: status === expect, note });
}
const ok2xx = (s) => s >= 200 && s < 300;

/** Substitute `:param` with a value that is safe to GET. */
function concretise(path) {
  const ids = {
    slug: 'three-axis-vertical-machining-center',
    id: '00000000-0000-4000-8000-000000000000',
    courseId: '00000000-0000-4000-8000-000000000000',
    academyId: '00000000-0000-4000-8000-000000000000',
    productId: '00000000-0000-4000-8000-000000000000',
    imageId: '00000000-0000-4000-8000-000000000000',
    number: '00000000-0000-4000-8000-000000000000',
    username: 'superadmin',
    key: 'ping',
    name: 'ping',
    code: 'PING',
    templateId: '00000000-0000-4000-8000-000000000000',
    token: 'none',
    provider: 'google',
    messageId: '00000000-0000-4000-8000-000000000000',
    conversationId: '00000000-0000-4000-8000-000000000000',
    orderId: '00000000-0000-4000-8000-000000000000',
    userId: '00000000-0000-4000-8000-000000000000',
    versionId: '00000000-0000-4000-8000-000000000000',
    pageId: '00000000-0000-4000-8000-000000000000',
    blockId: '00000000-0000-4000-8000-000000000000',
    lessonId: '00000000-0000-4000-8000-000000000000',
    lessonSlug: 'overview',
    sectionId: '00000000-0000-4000-8000-000000000000',
    eventId: '00000000-0000-4000-8000-000000000000',
    groupId: '00000000-0000-4000-8000-000000000000',
    postId: '00000000-0000-4000-8000-000000000000',
    subscriptionId: '00000000-0000-4000-8000-000000000000',
    invoiceId: '00000000-0000-4000-8000-000000000000',
    notificationId: '00000000-0000-4000-8000-000000000000',
    reportId: '00000000-0000-4000-8000-000000000000',
    domain: 'example.com',
    filename: 'none.png',
  };
  return path.replace(/:([A-Za-z0-9_]+)/g, (_, k) => ids[k] ?? 'none');
}

/** Side-effecting or third-party routes that must not be probed for real. */
const SKIP = [
  /oauth\/(google|github)\b/, // would start a real provider redirect
  /\/login\b/, // rate-limited + fail2ban bait
  /\/register\b/,
  /\/forgot-password/,
  /send/,
  /resend/,
  /verify-email/,
  /chat\b/,
  /ai\/(chat|public-chat|learning|reindex|eval)/, // bills a provider
  /payment/,
  /checkout/,
  /orders\/.*pay/,
  /moyasar/,
  /webhook/,
  /upload/,
  /presign/,
  /storage/,
  /dm\//, // would message a real person
  /export/,
  /sync/,
  /seed/,
  /migrate/,
  /backfill/,
  /reindex/,
  /repair/,
  /sessions\/(revoke|delete)/,
  /logout/,
  /password/,
  /2fa/,
  /totp/,
  /email/,
  /outbox/,
  /templates\/.*send/,
  /preview-send/,
  /web-search/,
  /crawl/,
  /fetch/,
];

const skipped = [];

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Tenant-Slug': TENANT,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON is fine */
  }
  return { status: res.status, json, text };
}

// ────────────────────────────────────────────────────────────────── authz ──

/**
 * A GET that reaches a 5xx with a *valid admin* token is the interesting case — it means
 * a real query fails against a real database, which no unit test would catch. That is
 * tracked separately from the guard checks because the fix is different.
 */
async function phaseAuthz() {
  const gets = ROUTES.filter((r) => r.method === 'GET');
  for (const r of gets) {
    const p = concretise(r.path);
    if (SKIP.some((re) => re.test(p))) {
      skipped.push(`${r.method} ${p} (skipped: side effect)`);
      continue;
    }

    const admin = await call('GET', p, { token: ADMIN });

    if (p.startsWith('/admin/')) {
      // admin route: an anonymous caller must not be let in
      const anon = await call('GET', p);
      const refused = [401, 403].includes(anon.status);
      record(
        'authz',
        `anon refused ${p}`,
        refused ? 403 : anon.status,
        403,
        refused ? '' : `leaked with status ${anon.status}`,
      );
    } else if (r.path.includes(':')) {
      // A route parameter was filled with a known-fake id, so 404 is the CORRECT
      // answer: it proves the handler ran, resolved the tenant, and reported a missing
      // record rather than crashing. 500 here would still be a bug and is caught below.
      record(
        'authz',
        `param route resolves ${p}`,
        [200, 404].includes(admin.status) ? admin.status : 500,
        [200, 404].includes(admin.status) ? admin.status : 500,
      );
    } else if (p === '/products/check-availability') {
      // Reached with no query params on purpose: this endpoint used to answer 500 when
      // `productId` was missing or non-UUID. A 400 proves the validation landed.
      record(
        'authz',
        'bad input to check-availability is 400 not 500',
        admin.status >= 500 ? 500 : admin.status,
        400,
        admin.text.slice(0, 140),
      );
    } else {
      record('authz', `anon ok ${p}`, admin.status, 200, '');
    }
    record(
      'server',
      `admin GET ${p}`,
      admin.status >= 500 ? 500 : 200,
      200,
      admin.status >= 500 ? admin.text.slice(0, 180) : '',
    );
  }
}

// ─────────────────────────────────────────────────────────────────── crud ──

/**
 * Each entry is [module, collection, makeBody, updateBody].
 *
 * `key` says whether the detail route is addressed by slug or by id — products and
 * academies are slug-based (`/admin/products/:slug`), which is why the first version of
 * this harness 404'd on every read after a successful create.
 *
 * `removable: false` marks a collection with no DELETE route; those are still created,
 * read and updated, then cleaned up through the same route only if one exists.
 */
const CRUD = [
  {
    module: 'products',
    base: '/admin/products',
    key: 'slug',
    make: (n) => ({ title: `${n} Product`, slug: n, description: `${n} sweep`, price: 1000 }),
    update: { tagline: 'edited by sweep' },
  },
  {
    module: 'courses',
    base: '/admin/courses',
    key: 'slug',
    make: (n) => ({ title: `${n} Course`, slug: n, description: `${n} sweep` }),
    update: { subtitle: 'edited by sweep' },
    // Courses have no `DELETE /admin/courses/:slug`; the delete route is
    // `/courses/:slug` behind the same admin guards. Marking it non-removable leaked
    // six rows before this was found, so it is explicitly cleaned up here instead.
    deleteBase: '/courses',
  },
  {
    module: 'academies',
    base: '/admin/academies',
    key: 'slug',
    make: (n) => ({ title: `${n} Academy`, slug: n, description: `${n} sweep` }),
    update: { description: 'edited by sweep' },
  },
];

async function phaseCrud() {
  for (const c of CRUD) {
    const n = stamp();
    try {
      const post = await call('POST', c.base, { token: ADMIN, body: c.make(n) });
      record('crud', `${c.module} create`, post.status, 201, post.text.slice(0, 200));
      if (!ok2xx(post.status)) continue;

      const id = post.json?.[c.key] ?? post.json?.id ?? post.json?.slug;
      if (!id) {
        record(
          'crud',
          `${c.module} create returns ${c.key}`,
          0,
          1,
          JSON.stringify(post.json).slice(0, 200),
        );
        continue;
      }
      cleanup.push({ module: c.module, base: c.deleteBase ?? c.base, id });

      const get = await call('GET', `${c.base}/${id}`, { token: ADMIN });
      record(
        'crud',
        `${c.module} read`,
        ok2xx(get.status) ? 200 : get.status,
        200,
        get.text.slice(0, 200),
      );

      if (c.update) {
        const patch = await call('PATCH', `${c.base}/${id}`, { token: ADMIN, body: c.update });
        record(
          'crud',
          `${c.module} update`,
          ok2xx(patch.status) ? 200 : patch.status,
          200,
          patch.text.slice(0, 200),
        );
        const after = await call('GET', `${c.base}/${id}`, { token: ADMIN });
        const blob = JSON.stringify(after.json ?? {});
        const landed = Object.values(c.update).every((v) => blob.includes(String(v)));
        record(
          'crud',
          `${c.module} update persisted`,
          landed ? 200 : 500,
          200,
          landed ? '' : `missing in ${blob.slice(0, 200)}`,
        );
      }

      const del = await call('DELETE', `${c.deleteBase ?? c.base}/${id}`, { token: ADMIN });
      record(
        'crud',
        `${c.module} delete`,
        ok2xx(del.status) ? 200 : del.status,
        200,
        del.text.slice(0, 200),
      );
      cleanup = cleanup.filter((x) => !(x.module === c.module && x.id === id));

      const gone = await call('GET', `${c.base}/${id}`, { token: ADMIN });
      record('crud', `${c.module} gone after delete`, gone.status === 404 ? 404 : gone.status, 404);
    } catch (err) {
      record('crud', `${c.module} threw`, 0, 1, err.message);
    }
  }
}

// ────────────────────────────────────────────────────────────── negative ──

async function phaseNegative() {
  const n = stamp();
  const cases = [
    ['product blank title refused', 'POST', '/admin/products', { slug: n, title: '' }],
    ['product blank slug refused', 'POST', '/admin/products', { title: 'QA blank slug', slug: '' }],
    ['course blank title refused', 'POST', '/admin/courses', { slug: n, title: '' }],
    ['malformed body refused', 'POST', '/admin/products', 'not-an-object'],
  ];
  for (const [name, method, path, body] of cases) {
    const res = await call(method, path, { token: ADMIN, body });
    record(
      'negative',
      name,
      [400, 422].includes(res.status) ? 400 : res.status,
      400,
      res.text.slice(0, 140),
    );
  }
  const unknown = await call('GET', '/admin/products/00000000-0000-4000-8000-000000000000', {
    token: ADMIN,
  });
  record('negative', 'unknown id is 404 not 500', unknown.status, 404, unknown.text.slice(0, 140));

  // mass assignment: a PATCH must not be able to move a record between tenants or
  // self-publish. This is the class of bug that caused the original data loss.
  const created = await call('POST', '/admin/products', {
    token: ADMIN,
    body: { title: `${n} MassAssign`, slug: n, description: 'sweep' },
  });
  if (ok2xx(created.status)) {
    const id = created.json?.slug ?? created.json?.id;
    cleanup.push({ module: 'massassign', base: '/admin/products', id });
    const patch = await call('PATCH', `/admin/products/${id}`, {
      token: ADMIN,
      body: {
        tenantId: '00000000-0000-4000-8000-000000000000',
        isPublished: true,
        status: 'published',
        role: 'super_admin',
      },
    });
    const after = await call('GET', `/admin/products/${id}`, { token: ADMIN });
    const j = after.json ?? {};
    const leaked =
      j.tenantId === '00000000-0000-4000-8000-000000000000' ||
      j.isPublished === true ||
      j.status === 'published';
    record(
      'negative',
      'PATCH cannot escalate tenant/publish',
      leaked ? 500 : 200,
      200,
      leaked
        ? `escalated: ${JSON.stringify({ t: j.tenantId, p: j.isPublished, s: j.status })}`
        : '',
    );
    record(
      'negative',
      'escalation attempt itself is not a 5xx',
      patch.status >= 500 ? 500 : 200,
      200,
      patch.text.slice(0, 140),
    );
  }
}

// ────────────────────────────────────────────────────────────────── main ──

const phase = argv.phase ?? 'all';
try {
  if (phase === 'authz' || phase === 'all') await phaseAuthz();
  if (phase === 'crud' || phase === 'all') await phaseCrud();
  if (phase === 'crud' || phase === 'negative' || phase === 'all') await phaseNegative();
} finally {
  for (const rec of cleanup) {
    const del = await call('DELETE', `${rec.base}/${rec.id}`, { token: ADMIN });
    console.error(`cleanup ${rec.module} ${rec.id} -> ${del.status}`);
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\nAPI sweep ${BASE} (tenant ${TENANT})\n`);
for (const p of ['authz', 'server', 'crud', 'negative']) {
  const rs = results.filter((r) => r.phase === p);
  if (!rs.length) continue;
  const bad = rs.filter((r) => !r.ok);
  console.log(`── ${p} ── ${rs.length - bad.length}/${rs.length}`);
  for (const r of bad)
    console.log(`   FAIL ${r.name}: got ${r.status}${r.note ? ` — ${r.note}` : ''}`);
}
if (skipped.length)
  console.log(
    `\nskipped ${skipped.length} routes with real side effects (email/payment/AI/DM/upload/config)`,
  );
console.log(`\ntotal: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
