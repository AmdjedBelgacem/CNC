# Analytics (GA4 + Snapchat Pixel)

Production tags load only when configured. Resolution order:

1. **Tenant settings** — Admin → Settings → Analytics (`settings.analytics.gaMeasurementId`, `settings.analytics.snapchatPixelId`)
2. **Env fallback** — `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_SNAPCHAT_PIXEL_ID` (single-brand / when tenant has never saved analytics)
3. **Disabled** — no vendor scripts

## Public config

`GET /content/analytics` (tenant header `x-tenant-slug`) returns only:

```json
{ "gaMeasurementId": "G-XXXX", "snapchatPixelId": "123456789012" }
```

Empty strings mean that vendor is off for the tenant config path. No secrets are exposed.

## Admin

- Section **Analytics** on `/admin/settings`
- Validation: GA4 must be empty or `G-[A-Z0-9]{4,}`; Snapchat must be empty or digits (≥5)
- Save: `PATCH /admin/tenant` with `{ "analytics": { "gaMeasurementId", "snapchatPixelId" } }` (merged into `tenants.settings`, other settings keys preserved)
- Tenant-scoped via existing JWT + tenant guards

## Loading

- Root layout resolves IDs server-side and passes them to `AnalyticsProvider`
- Uses `next/script` (`afterInteractive`) — GA4 `gtag.js` + Snapchat `sc-static.net/sce.min.js`
- No scripts when both IDs are blank
- Hydration-safe (same props on server/client); never blocks render

## Events

Helper module: `apps/frontend/src/lib/analytics.ts` (do not inline vendor calls).

| App event | GA4 | Snapchat |
|-----------|-----|----------|
| page_view (load + route change) | `config` / `page_path` | `PAGE_VIEW` |
| sign_up | `sign_up` | `SIGN_UP` |
| login | `login` | — |
| enroll | `enroll` | — |
| add_to_cart | `add_to_cart` | `ADD_CART` |
| begin_checkout | `begin_checkout` | `START_CHECKOUT` |
| purchase | `purchase` (+ value, currency, transaction_id, items) | `PURCHASE` |

No PII in payloads (email/name/phone stripped). Fail-soft if SDK missing.

Wired in: register, login, enroll button, cart store `addItem`, checkout submit, checkout success (`status === 'confirmed'`).

## Consent stub

`apps/frontend/src/lib/analytics-consent.ts` — key `titan.analytics.consent` (`granted` | `denied`).

**Default (no CMP yet):** allow when IDs are configured. A future CMP can call `setAnalyticsConsent('denied')` to stop loading/emission. Denied is checked before inject and before every event.

## Verify

```bash
# Configured (tenant or env): page HTML includes gtag + snap scripts
curl -s http://localhost:3000/academy | grep -E 'googletagmanager|sc-static|snaptr'

# Empty: neither script
# (clear IDs in admin + unset NEXT_PUBLIC_*)

# Config endpoint
curl -s -H 'x-tenant-slug: cnc-fundamentals' http://localhost:4000/content/analytics
```

Browser: Network → filter `googletagmanager` / `sc-static`; Console → `dataLayer` / `snaptr` on route change.
