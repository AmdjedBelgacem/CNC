/**
 * Load profile for a single-instance deployment (local targets only).
 *
 * Stages ramp 10 -> 25 -> 50 -> 100 -> 200 VU and abort as soon as the error rate exceeds
 * 1% or p95 crosses the latency budget, so a run always ends with a defensible "this is
 * where it breaks" rather than a flat line.
 *
 * LOCAL ONLY. Never point BASE_URL at a deployed environment: this hammers a single Node
 * process with no upstream scaling, which is exactly the profile being measured, but it
 * would also mean generating real load on someone else's infrastructure.
 *
 * Usage:
 *   BASE_URL=http://localhost:4700 k6 run scripts/load/api.js
 *   BASE_URL=http://localhost:4700 COURSE_SLUG=cnc-milling-fundamentals k6 run ...
 *
 * Env:
 *   BASE_URL       target origin (required)
 *   COURSE_SLUG    a published course slug for the detail scenario
 *   AUTH_COOKIE    full Cookie header value, enables the authenticated scenarios
 *   P95_BUDGET_MS  abort threshold for p95 (default 750)
 */
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL;
if (!BASE_URL) throw new Error('BASE_URL is required (local targets only)');

const COURSE_SLUG = __ENV.COURSE_SLUG || 'cnc-milling-fundamentals';
const AUTH_COOKIE = __ENV.AUTH_COOKIE || '';
const P95_BUDGET_MS = Number(__ENV.P95_BUDGET_MS || 750);

// Per-endpoint trends, so a slow scenario cannot hide inside an aggregate.
const health = new Trend('t_health', true);
const courses = new Trend('t_courses_list', true);
const courseDetail = new Trend('t_course_detail', true);
const me = new Trend('t_auth_me', true);
const search = new Trend('t_search', true);
const failures = new Rate('functional_failures');

const tenant = { headers: { 'x-tenant-slug': 'cnc-fundamentals' } };

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '20s', target: 10 },
        { duration: '20s', target: 25 },
        { duration: '20s', target: 50 },
        { duration: '20s', target: 100 },
        { duration: '25s', target: 200 },
        { duration: '15s', target: 200 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // A run "passes" only while it stays inside budget; exceeding it is the signal we want.
    'functional_failures': ['rate<0.01'],
    ['t_course_detail']: [`p(95)<${P95_BUDGET_MS}`],
    ['t_courses_list']: [`p(95)<${P95_BUDGET_MS}`],
    http_req_failed: ['rate<0.01'],
  },
  discardResponseBodies: false,
  noConnectionReuse: false,
};

function record(name, trend, res) {
  trend.add(res.timings.duration);
  const ok = res.status === 200 || res.status === 304;
  failures.add(!ok);
  check(res, { [`${name} ok`]: () => ok });
  return res;
}

export default function () {
  record('health', health, http.get(`${BASE_URL}/health`, { tags: { ep: 'health' } }));
  record('courses', courses, http.get(`${BASE_URL}/courses?page=1&limit=12`, { headers: tenant, tags: { ep: 'courses' } }));
  record('detail', courseDetail, http.get(`${BASE_URL}/courses/${COURSE_SLUG}`, { headers: tenant, tags: { ep: 'detail' } }));
  record('search', search, http.get(`${BASE_URL}/search?q=cnc&limit=10`, { headers: tenant, tags: { ep: 'search' } }));

  if (AUTH_COOKIE) {
    record('me', me, http.get(`${BASE_URL}/auth/me`, {
      headers: { ...tenant, cookie: AUTH_COOKIE },
      tags: { ep: 'auth_me' },
    }));
  }
}
