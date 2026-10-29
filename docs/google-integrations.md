# Google integrations

Platform-level connections to Google Ads, Merchant Center, Tag Manager and Search
Console. These are **not** per tenant: one Google account authorises the platform,
and every tenant uses those shared credentials.

Because a single grant is shared across all tenants, these endpoints are
`super_admin` only at the controller level (`@Roles('super_admin')` +
`PermissionsGuard`) — tenant admins cannot read or change them.

## Scopes

| Service | Scope | Probe |
| --- | --- | --- |
| `google_ads` | `https://www.googleapis.com/auth/adwords` | accessible customers |
| `merchant_center` | `https://www.googleapis.com/auth/content` | linked accounts |
| `tag_manager` | `https://www.googleapis.com/auth/tagmanager.readonly` | container accounts |
| `search_console` | `https://www.googleapis.com/auth/webmasters.readonly` | sites |

The scope list is returned even when a service is not connected, so a super admin
can see what a connection would request before granting it.

## Environment

| Variable | Purpose |
| --- | --- |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth client for the platform |
| `GOOGLE_OAUTH_CLIENT_SECRET` | server only |
| `GOOGLE_OAUTH_REDIRECT_URI` | must be registered in the Google Cloud console |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | required for Google Ads only |

With any of these missing, the affected service reports `blocked` with the exact
variable names. Connect attempts are refused with `400` rather than producing a
connection that cannot work.

## Flow

1. `POST /admin/integrations/:service/connect?csrf=<token>` records a state row
   (hashed state, the initiating admin, the CSRF value, the redirect URI, a
   10-minute expiry) and returns a Google authorize URL.
2. The browser is sent to Google, then back to
   `GET /admin/integrations/oauth/callback/:service`.
3. The callback is inside the auth guard, so it must arrive as the same logged-in
   super admin. It then checks, **in this order, before any code is exchanged**:
   - the state row exists (`unknown_state`),
   - it has not been consumed (`state_already_used`),
   - it has not expired (`state_expired`),
   - it belongs to this service (`service_mismatch`),
   - it was started by this admin (`initiator_mismatch`),
   - the CSRF value round-tripped (`csrf_mismatch`).
4. The state is marked consumed, then the code is exchanged. If Google returns no
   refresh token the service is marked `revoked` with `no_refresh_token` and
   nothing is stored — a grant that cannot be refreshed is not a connection.
5. The refresh token is encrypted with AAD bound to `google:<service>` and probed
   against the real API. Only a successful probe yields `connected`.

The callback always redirects the browser to `/admin/integrations` with a
`result` parameter; a user who declines gets `denied`, a malformed callback gets
`invalid`.

## Statuses

`not_connected` → `connected` → `revoked`, plus `blocked` when the server lacks
credentials and `error` when a probe fails. A refresh that returns
`invalid_grant` marks the service `revoked` and clears the stored token.

`GET /admin/integrations` returns, per service: `status`, `connectedEmail`,
`externalAccountId`, `externalAccountIds`, `scopes`, `lastErrorCode`,
`lastErrorMessage`, `connectedAt`, `lastTestedAt`, `blockedReason`. It never
contains a refresh token or its ciphertext.

## Using a connection from a tenant

- **Tag Manager** — inject the container snippet site-wide, keyed by
  `externalAccountId`. The panel shows the id to use.
- **Merchant Center** — the account list comes from `externalAccountIds`; map
  products to it in a product sync hook.
- **Search Console** — `externalAccountIds` are the site URLs, which is the
  property set to query for impressions and clicks.
- **Google Ads** — `externalAccountId` is the manager account; customer accounts
  are discovered through the developer token.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/admin/integrations` | all services + platform readiness |
| `GET` | `/admin/integrations/:service` | one service |
| `POST` | `/admin/integrations/:service/connect` | `{ authorizeUrl }` |
| `GET` | `/admin/integrations/oauth/callback/:service` | browser redirect target |
| `POST` | `/admin/integrations/:service/test` | re-probe, refresh the token |
| `POST` | `/admin/integrations/:service/disconnect` | clears the token |

## Live sessions: Google Meet provisioning (v2, feature-flagged)

Live course sessions (`live_sessions` table) run on Google Meet. v1 requires the
instructor to paste the Meet URL — validated at save time against the
`https://meet.google.com/...` allowlist — and the learner join endpoint
(`GET /live-sessions/:id/join`) releases it only to enrolled learners inside the
join window (startsAt − 15 min through endsAt + 30 min, computed server-side).

The optional v2 path provisions the Meet room from the backend: creating a Google
Calendar event with `conferenceData` (requestId + `hangoutsMeet` conference
solution) and persisting `meetUrl` + `calendarEventId` on the session. The
endpoint is `POST /admin/courses/:courseId/live-sessions/:sessionId/provision-meet`
and responds `403` with the missing variable names until the environment below is
configured.

### Environment

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth client authorised for `https://www.googleapis.com/auth/calendar.events` |
| `GOOGLE_CLIENT_SECRET` | server only |
| `GOOGLE_REFRESH_TOKEN` | long-lived refresh token minted from the offline-access consent |

While any of these is unset the endpoint refuses with a clear message and the
Course Studio only offers the paste-a-link flow — the flag is discoverable, not
silent. Implementation notes for whoever builds it:

- The calendar must be the one whose automatically-created Meet rooms the tenant
  recognises; a service account cannot own Meet links without domain-wide
  delegation, so the OAuth refresh-token path is the supported one.
- Persist `calendarEventId` so rescheduling the session (`PATCH`) can patch the
  event instead of leaking a second Meet room, and cancellation can delete it.
- Room codes minted by Calendar satisfy the same allowlist validator
  (`isValidMeetUrl` in `apps/backend/src/modules/courses/dto/live-sessions.dto.ts`).
