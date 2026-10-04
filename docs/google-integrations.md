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
