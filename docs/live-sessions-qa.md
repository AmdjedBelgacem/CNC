# Live sessions (Google Meet) — QA checklist

Live course sessions run on Google Meet; recorded video stays on Mux. The Meet
URL is the only credential: it is stored per session, validated against the
`https://meet.google.com/...` allowlist, and released only by the join endpoint
to enrolled learners inside the join window (startsAt − 15 min through
endsAt + 30 min, server clock only).

## Data & migration

- [ ] `pnpm --filter @titan/backend db:migrate` applies `043_live_sessions` (table + the two indexes: `(tenant_id, course_id, starts_at)`, `(tenant_id, status, starts_at)`).
- [ ] `db:seed` is idempotent and adds two sample sessions (one upcoming scheduled, one completed) to the first seeded course.

## Admin / instructor

- [ ] Course Studio → **Live sessions** step: create a session with a valid Meet URL; it appears as `draft`.
- [ ] Creating/updating a session that overlaps another scheduled session in the same course saves fine but shows an overlap warning toast (soft, non-blocking).
- [ ] Saving `http://meet.google.com/...`, a non-Google URL, or a URL with a query string is rejected with a validation message.
- [ ] Publishing a draft without a Meet URL is blocked with "Add a Google Meet URL before publishing".
- [ ] Publishing a draft → `scheduled`; enrolled learners receive a notification (in-app; email when the user's learning email preference is on).
- [ ] Cancel a scheduled session → status `cancelled`; the learner card shows "Cancelled" and Join is disabled.
- [ ] Deleting a session removes it from both admin list and learner list. Create/cancel/publish/delete are written to `audit_logs` (`live_session.*` actions).
- [ ] Times entered in the studio are interpreted in the admin's local timezone; the card shows the session's stored timezone.

## Learner

- [ ] Course page shows an "Upcoming live sessions" section only when visible sessions exist (drafts are never exposed).
- [ ] Not enrolled → button reads "Enroll to join" and is disabled.
- [ ] Enrolled, more than 15 min before start → "Opens 15 minutes before", disabled.
- [ ] Enrolled, inside the window → "Join live" opens the Meet URL in a new tab.
- [ ] More than 30 min past the end → "Session ended", disabled.
- [ ] Direct `GET /live-sessions/:id/join` while outside the window/unenrolled returns 403 with `reason` (`not_enrolled`, `not_started`, `ended`, `cancelled`, `no_meet_url`) — never the URL.
- [ ] The learner list response never contains `meetUrl` (check the network payload).
- [ ] Account → My learning shows a "Next live session" card across all enrollments, linking to the course page.
- [ ] Tenant isolation: a session from tenant A is not visible/joinable with tenant B context (404/403).

## Not implemented (do not demo as existing)

- Attendance tracking, Meet recording control, and roster/roll-call are **not** implemented.
- Calendar auto-provisioning (`provision-meet`) is a v2 flag — returns a clear error until Google OAuth env vars are set (see `docs/google-integrations.md`).
- Reschedule re-notification is not sent (publish notification only, keyed per start time so a reschedule + re-publish notifies once per schedule).
