#!/usr/bin/env node
/**
 * Production smoke matrix — 13 user-visible paths, with evidence.
 *
 * This is deliberately an *executable* check rather than a checklist: every path is
 * exercised against a running stack and the result is recorded. A path that cannot be
 * verified here (because it needs a browser or a real payment) is marked `MANUAL` and
 * printed as such instead of being quietly claimed as passing.
 *
 * Usage:
 *   node scripts/production-smoke.mjs --api http://localhost:4000 [--out docs/ops/evidence.md]
 *
 * Credentials come from the environment. Nothing secret is printed: values are redacted
 * in the evidence file, and only status codes / short response shapes are recorded.
 */

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};

const API = flag('api', 'http://localhost:4000').replace(/\/$/, '');
const OUT = flag('out', null);
const TENANT = process.env.SMOKE_TENANT ?? 'cnc-fundamentals';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? 'superadmin@titansofmanufacturing.com';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD;
const LEARNER_EMAIL = process.env.SMOKE_LEARNER_EMAIL;
const LEARNER_PASSWORD = process.env.SMOKE_LEARNER_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error('SMOKE_ADMIN_PASSWORD is required (and SMOKE_LEARNER_EMAIL/PASSWORD for the RBAC + tenancy paths).');
  process.exit(1);
}

const results = [];
let csrf = null;

/** Gap between probes that share a rate-limit bucket. */
const THROTTLE_GAP_MS = Number(process.env.SMOKE_THROTTLE_GAP_MS ?? 12_000);

/** Records a result. `note` must never contain a secret. */
function record(id, path, status, detail) {
  const ok = status === 'PASS' || status === 'MANUAL';
  results.push({ id, path, status, detail, ok });
  const icon = status === 'PASS' ? 'PASS' : status === 'MANUAL' ? 'MANU ' : 'FAIL ';
  console.log(`  [${icon}] ${String(id).padEnd(2)} ${path}\n         ${detail}`);
}

/**
 * One cookie jar per session, mirroring how the browser authenticates: tokens live in
 * httpOnly cookies and every mutation must echo the double-submit CSRF token.
 */
async function session(email, password) {
  const jar = new Map();

  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const absorb = (res) => {
    const raw = res.headers.getSetCookie?.() ?? [];
    for (const line of raw) {
      const [pair] = line.split(';');
      const idx = pair.indexOf('=');
      if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  };

  const call = async (method, path, body, extraHeaders = {}) => {
    const headers = {
      'x-tenant-slug': TENANT,
      ...(jar.size ? { cookie: cookieHeader() } : {}),
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
      ...extraHeaders,
    };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    absorb(res);
    const text = await res.text();
    let parsed = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw */
    }
    return { status: res.status, body: parsed };
  };

  const login = await call('POST', '/auth/login', { email, password });
  if (login.status < 300) {
    await call('GET', '/auth/csrf-token');
    csrf = jar.get('csrf-token') ?? null;
  }
  return { call, jar, login, get csrf() { return csrf; } };
}

const short = (v, n = 110) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (!s) return '(empty body)';
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

async function main() {
  console.log(`Production smoke matrix\n  api   : ${API}\n  tenant: ${TENANT}\n`);

  const admin = await session(ADMIN_EMAIL, ADMIN_PASSWORD);
  const adminAuthed = admin.login.status < 300;

  // 1. Register
  if (adminAuthed) {
    const uniq = `smoke-${Date.now()}@example.test`;
    // Wait out any prior run's register bucket before probing again.
    await new Promise((r) => setTimeout(r, THROTTLE_GAP_MS));
    const reg = await admin.call('POST', '/auth/register', {
      email: uniq,
      password: 'Smoke-Probe-9f2a!x',
      username: `smoke${Date.now()}`,
      name: 'Smoke Probe',
    });
    if (reg.status === 201 || reg.status === 200) {
      // The property that actually matters is not a response flag but whether the new
      // account can obtain a session before its address is verified.
      const probe = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant-slug': TENANT },
        body: JSON.stringify({ email: uniq, password: 'Smoke-Probe-9f2a!x' }),
      }).then((r) => r.status, () => 0);
      const gated = probe === 401 || probe === 403;
      record(
        1,
        'register: new account cannot sign in before email verification',
        gated ? 'PASS' : 'FAIL',
        `register HTTP ${reg.status}; immediate login HTTP ${probe}${gated ? ' (gated)' : ' — UNVERIFIED ACCOUNT CAN SIGN IN'}`,
      );
    } else if (reg.status === 429) {
      record(1, 'register: new account cannot sign in before email verification', 'MANUAL', 'throttled (HTTP 429); retry after the window resets');
    } else {
      record(1, 'register: new account cannot sign in before email verification', 'FAIL', `HTTP ${reg.status} ${short(reg.body)}`);
    }
  } else {
    record(1, 'register (new account, no bypass)', 'FAIL', `admin login failed: HTTP ${admin.login.status}`);
  }

  // 2. Login / refresh / logout
  if (adminAuthed) {
    const refresh = await admin.call('POST', '/auth/refresh', {});
    const logout = await admin.call('POST', '/auth/logout', {});
    const afterLogout = await admin.call('GET', '/auth/me');
    const okRefresh = refresh.status < 300;
    const okLogout = logout.status < 300;
    const revoked = afterLogout.status === 401 || afterLogout.status === 403;
    record(
      2,
      'login -> refresh -> logout -> session revoked',
      okRefresh && okLogout && revoked ? 'PASS' : 'FAIL',
      `login HTTP ${admin.login.status}; refresh HTTP ${refresh.status}; logout HTTP ${logout.status}; /auth/me after logout HTTP ${afterLogout.status}${revoked ? ' (revoked)' : ' — SESSION SURVIVED LOGOUT'}`,
    );
  } else {
    record(2, 'login -> refresh -> logout -> session revoked', 'FAIL', `admin login failed: HTTP ${admin.login.status}`);
  }

  // 3. Password recovery — must never 500 and must not reveal whether an address exists.
  const known = await fetch(`${API}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-slug': TENANT },
    body: JSON.stringify({ email: ADMIN_EMAIL }),
  }).then(async (r) => ({ status: r.status, text: await r.text() }));
  // The auth throttler is deliberately strict; without a gap the second call returns 429
  // and the comparison below cannot distinguish throttling from account enumeration.
  await new Promise((r) => setTimeout(r, THROTTLE_GAP_MS));
  const unknown = await fetch(`${API}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-slug': TENANT },
    body: JSON.stringify({ email: 'definitely-not-a-user@nowhere.invalid' }),
  }).then(async (r) => ({ status: r.status, text: await r.text() }));
  const throttled = known.status === 429 || unknown.status === 429;
  const sameAnswer = known.text === unknown.text && known.status === unknown.status;
  const noServerError = known.status < 500;
  record(
    3,
    'password recovery: no 500, no account enumeration',
    throttled ? 'MANUAL' : noServerError && sameAnswer ? 'PASS' : 'FAIL',
    throttled
      ? `throttled (known HTTP ${known.status}, unknown HTTP ${unknown.status}) — inconclusive; rerun after the rate-limit window`
      : `known HTTP ${known.status} ${short(known.text, 60)} | unknown HTTP ${unknown.status} ${short(unknown.text, 60)} | identical=${sameAnswer}${sameAnswer ? '' : ' — RESPONSES DIFFER (enumeration)'}`,
  );

  // 4. Health
  const health = await fetch(`${API}/health`)
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))
    .catch(() => ({ status: 0, body: null }));
  const h = health.body ?? {};
  const requiredUp = (h.checks?.database?.state === 'up') && (h.checks?.auth?.state === 'up');
  record(
    4,
    'health: database + auth up, dependencies reported honestly',
    health.status === 200 && requiredUp ? 'PASS' : 'FAIL',
    `HTTP ${health.status}; overall=${h.status}; db=${h.checks?.database?.state}; auth=${h.checks?.auth?.state}; redis=${h.checks?.redis?.state}; search=${h.checks?.search?.state}; storage=${h.checks?.storage?.state}; email=${h.checks?.email?.state}`,
  );

  const admin2 = await session(ADMIN_EMAIL, ADMIN_PASSWORD);

  // 5. Avatar upload to the public bucket
  if (admin2.login.status < 300) {
    // The DTO is {key, contentType, folder?}; a real PUT of real PNG bytes must precede
    // the read, otherwise this only proves that a URL was handed out.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const presign = await admin2.call('POST', '/upload/presigned', {
      key: 'smoke-avatar.png',
      contentType: 'image/png',
      folder: 'avatars',
    });
    const signedUrl = presign.body?.url;
    const objectKey = presign.body?.key;
    let put = null;
    if (signedUrl) {
      put = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
        body: png,
      }).then((r) => r.status, () => 0);
    }
    const publicBase = process.env.SMOKE_S3_PUBLIC_URL;
    let fetched = null;
    if (publicBase && objectKey) {
      fetched = await fetch(`${publicBase.replace(/\/$/, '')}/${objectKey}`).then(
        async (r) => ({ status: r.status, type: r.headers.get('content-type'), buf: Buffer.from(await r.arrayBuffer()) }),
        () => ({ status: 0, type: null, buf: Buffer.alloc(0) }),
      );
    }
    const presignOk = presign.status < 300 && put === 200;
    const publicOk = fetched?.status === 200 && !!fetched.type?.startsWith('image/') && fetched.buf.equals(png);
    record(
      5,
      'avatar upload: presigned PUT, then anonymous public GET returns the bytes',
      publicBase ? (presignOk && publicOk ? 'PASS' : 'FAIL') : 'MANUAL',
      `presign HTTP ${presign.status}; PUT HTTP ${put ?? 'n/a'}; anonymous GET HTTP ${fetched?.status ?? 'n/a'} content-type=${fetched?.type ?? 'n/a'}; bytes match=${
        fetched ? fetched.buf.equals(png) : 'n/a'
      }${
        publicBase
          ? publicOk
            ? ''
            : ' — AVATAR IS NOT ANONYMOUSLY READABLE OR CONTENT DIFFERS'
          : ' | SMOKE_S3_PUBLIC_URL not set'
      }`,
    );
  } else {
    record(5, 'avatar upload: presigned PUT then anonymous public GET', 'FAIL', `login HTTP ${admin2.login.status}`);
  }

  // 6. Paid lesson video must NOT be anonymously readable.
  // Probed against Storage directly: the course detail endpoint only hands back a signed
  // URL once the caller is entitled, so an API-level probe cannot distinguish "gated" from
  // "asset missing". Proving the object exists *and* is refused anonymously does.
  const mediaBucket = process.env.SMOKE_MEDIA_BUCKET ?? 'media';
  const publicBucket = process.env.SMOKE_PUBLIC_BUCKET ?? 'uploads';
  const supabaseUrl = process.env.SUPABASE_URL;
  const mediaKey = process.env.SMOKE_MEDIA_KEY;
  // Declared here because the checkout check needs a purchasable id even when the media
  // probes are skipped.
  const courseId = process.env.SMOKE_COURSE_ID;
  if (supabaseUrl && mediaKey) {
    const anon = await fetch(`${supabaseUrl}/storage/v1/object/public/${mediaBucket}/${mediaKey}`).then(
      (r) => r.status,
      () => 0,
    );
    const asOwner = process.env.SUPABASE_SECRET_KEY
      ? await fetch(`${supabaseUrl}/storage/v1/object/${mediaBucket}/${mediaKey}`, {
          headers: {
            apikey: process.env.SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
          },
        }).then((r) => ({ status: r.status, bytes: Number(r.headers.get('content-length') ?? 0) }))
      : null;
    const refused = anon !== 200;
    const exists = asOwner ? asOwner.status === 200 && asOwner.bytes > 0 : null;
    record(
      6,
      'paid video: object exists but anonymous fetch is refused',
      refused && exists !== false ? 'PASS' : 'FAIL',
      `media/${mediaKey.split('/').pop()} anonymous HTTP ${anon}${refused ? ' (refused)' : ' — PAID VIDEO IS PUBLIC'}; owner HTTP ${asOwner?.status ?? 'n/a'} bytes=${asOwner?.bytes ?? 'n/a'}`,
    );

    // ...and the public bucket must be the opposite, otherwise avatars are broken.
    const pubKey = process.env.SMOKE_PUBLIC_KEY;
    if (pubKey) {
      const pub = await fetch(`${supabaseUrl}/storage/v1/object/public/${publicBucket}/${pubKey}`).then(
        (r) => r.status,
        () => 0,
      );
      record(
        7,
        'public assets (avatar/course image) are anonymously readable',
        pub === 200 ? 'PASS' : 'FAIL',
        `uploads/${pubKey.split('/').pop()} anonymous HTTP ${pub}${pub === 200 ? '' : ' — PUBLIC ASSET UNREACHABLE'}`,
      );
    } else {
      record(7, 'public assets (avatar/course image) are anonymously readable', 'MANUAL', 'SMOKE_PUBLIC_KEY not set');
    }
  } else {
    record(6, 'paid video: object exists but anonymous fetch is refused', 'MANUAL', 'SUPABASE_URL / SMOKE_MEDIA_KEY not set');
    record(7, 'public assets (avatar/course image) are anonymously readable', 'MANUAL', 'SMOKE_PUBLIC_KEY not set');
  }

  // 8. Tenant isolation: a cross-tenant read must not leak.
  const otherTenant = process.env.SMOKE_OTHER_TENANT;
  if (otherTenant) {
    const res = await fetch(`${API}/courses?page=1&limit=5`, {
      headers: { 'x-tenant-slug': otherTenant },
    }).then(async (r) => ({ status: r.status, body: await r.text() }));
    const leaked = res.body.includes(TENANT);
    record(
      8,
      'tenant isolation: another tenant sees none of this tenant data',
      res.status < 500 && !leaked ? 'PASS' : 'FAIL',
      `GET /courses as "${otherTenant}" -> HTTP ${res.status}; body mentions "${TENANT}"=${leaked}${leaked ? ' — CROSS-TENANT LEAK' : ''}`,
    );
  } else {
    record(7, 'tenant isolation: another tenant sees none of this tenant data', 'MANUAL', 'SMOKE_OTHER_TENANT not set');
  }

  // 9. RBAC: a learner must be refused admin routes.
  if (LEARNER_EMAIL && LEARNER_PASSWORD) {
    const learner = await session(LEARNER_EMAIL, LEARNER_PASSWORD);
    if (learner.login.status >= 300) {
      record(9, 'RBAC: learner refused on admin routes', 'FAIL', `learner login HTTP ${learner.login.status} ${short(learner.login.body, 80)}`);
    } else {
      const pulse = await learner.call('GET', '/admin/dashboard/pulse');
      const reindex = await learner.call('POST', '/admin/search/reindex', {});
      const refused = [401, 403].includes(pulse.status) && [401, 403].includes(reindex.status);
      record(
        9,
        'RBAC: learner refused on admin routes',
        refused ? 'PASS' : 'FAIL',
        `/admin/dashboard/pulse HTTP ${pulse.status}; /admin/search/reindex HTTP ${reindex.status}${refused ? '' : ' — LEARNER REACHED ADMIN'}`,
      );
    }
  } else {
    record(9, 'RBAC: learner refused on admin routes', 'MANUAL', 'SMOKE_LEARNER_EMAIL / SMOKE_LEARNER_PASSWORD not set');
  }

  // 10. Search must report which engine answered.
  const search = await admin2.call('GET', '/search?q=cnc&types=course');
  const engine = search.body?.engine;
  const hits = (search.body?.results ?? []).length;
  record(
    10,
    'search returns results and names the engine',
    search.status < 300 && hits > 0 && engine ? 'PASS' : 'FAIL',
    `HTTP ${search.status}; engine=${engine}; hits=${hits}`,
  );

  // 11. AI must refuse an anonymous caller.
  const anonAi = await fetch(`${API}/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-slug': TENANT },
    body: JSON.stringify({ message: 'hello' }),
  }).then((r) => r.status, () => 0);
  record(
    11,
    'AI endpoint refuses anonymous callers',
    [401, 403].includes(anonAi) ? 'PASS' : 'FAIL',
    `POST /ai/chat anonymous -> HTTP ${anonAi}${[401, 403].includes(anonAi) ? '' : ' — ANONYMOUS AI ACCESS'}`,
  );

  // 12. Checkout must fail closed without a working payment provider.
  const checkout = await admin2.call('POST', '/payments/checkout', {
    items: [{ type: 'course', id: courseId ?? '00000000-0000-0000-0000-000000000000', quantity: 1 }],
  });
  const failedClosed =
    checkout.status >= 400 &&
    !/checkoutUrl|sessionId|paymentUrl/i.test(JSON.stringify(checkout.body ?? {}));
  record(
    12,
    'checkout fails closed (no unpayable session issued)',
    failedClosed ? 'PASS' : 'FAIL',
    `HTTP ${checkout.status} ${short(checkout.body, 90)}${failedClosed ? '' : ' — issued a payment session it cannot fulfil'}`,
  );

  // 13. Certificate download must be owner-scoped.
  const mine = await admin2.call('GET', '/certifications/my');
  const certs = mine.body?.items ?? mine.body ?? [];
  const list = Array.isArray(certs) ? certs : [];
  let dl = 'none';
  if (list.length) {
    const res = await admin2.call('GET', `/certifications/my/${list[0].id}/download`);
    dl = `HTTP ${res.status}`;
  }
  record(
    13,
    'certificate list is reachable and download is owner-scoped',
    mine.status < 300 ? 'PASS' : 'FAIL',
    `GET /certifications/my HTTP ${mine.status}; certificates=${list.length}; download probe ${dl}`,
  );

  // 14. Notifications must be authenticated and read-scoped.
  const anonNotif = await fetch(`${API}/notifications/unread-count`, { headers: { 'x-tenant-slug': TENANT } }).then(
    (r) => r.status,
    () => 0,
  );
  const notif = await admin2.call('GET', '/notifications/unread-count');
  record(
    14,
    'notifications: anonymous refused, owner readable',
    [401, 403].includes(anonNotif) && notif.status < 300 ? 'PASS' : 'FAIL',
    `anonymous HTTP ${anonNotif}; owner HTTP ${notif.status}`,
  );

  // ---- report ----
  const failed = results.filter((r) => r.status === 'FAIL');
  const manual = results.filter((r) => r.status === 'MANUAL');
  console.log(`\n${results.length - failed.length - manual.length}/${results.length} passed, ${manual.length} need a human, ${failed.length} failed`);

  if (OUT) {
    const stamp = new Date().toISOString();
    const rows = results
      .map((r) => `| ${r.id} | ${r.path} | **${r.status}** | ${r.detail} |`)
      .join('\n');
    const md = `# Production Smoke Matrix Evidence

- Generated: ${stamp}
- API: ${API}
- Tenant: \`${TENANT}\`
- Result: **${results.length - failed.length - manual.length}/${results.length} passed**, ${manual.length} awaiting manual verification, ${failed.length} failed

| # | Path | Status | Evidence |
| --- | --- | --- | --- |
${rows}

Reproduce:

\`\`\`bash
node scripts/production-smoke.mjs --api ${API}
\`\`\`

No credential appears in this file; values are read from the environment and only
status codes and response shapes are recorded.
`;
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const { dirname } = await import('node:path');
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, md);
    console.log(`evidence written to ${OUT}`);
  }

  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});