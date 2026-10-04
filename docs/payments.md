# Moyasar payments

Moyasar is the primary payment gateway. Stripe remains in the schema as a
secondary/legacy provider and is not wired to any new checkout path.

## What the customer flow is

1. The browser asks for a **pending order**: `POST /payments/moyasar/create-order`.
   The request carries line refs and quantities, never prices. Every amount,
   currency and product name is read from Postgres.
2. The backend returns the order plus the tenant's **publishable** key. The secret
   key never leaves the server.
3. The browser opens Moyasar's hosted form with the publishable key and a
   callback URL of `<FRONTEND_URL>/checkout/success`.
4. Two independent paths can settle the order, and both re-fetch the payment from
   Moyasar with the secret key before anything is written:
   - the browser calling `GET /payments/moyasar/callback?order=<id>&payment=<id>`,
   - Moyasar calling `POST /payments/moyasar/webhook`.
5. The success page calls the callback and renders the result. It never trusts
   query parameters, and it clears the cart only after a verified `paid` state.

### Direct buy

A course or event ticket does not go through the cart. `useBuyAndCheckout` creates
the order and sends the browser to `/checkout?order=<id>`, and that page loads
**that** order — it never rebuilds one from the cart. The lines, the total and the
currency on screen all come from the server response, so the number Moyasar
charges is the number the server computed. An order that is already paid, no
longer payable, or not the buyer's shows a message instead of a form.

### Resolving the first webhook

The hosted form is created in the browser, so a `payment_paid` webhook can be the
first thing that tells the server a payment exists. `create-order` therefore
returns a signed reference:

    order_ref = "<orderId>.<hmac_sha256(AUTH_SECRET, orderId + ':' + total)>"

which the form puts in the payment `metadata`. When a webhook arrives for a
payment id no order holds, the server re-fetches the payment with the secret key,
reads `metadata.order_ref`, and checks that signature against that order's own
total. A forged or tampered reference is refused (`unknown_order`) — a bare order
id in metadata would let anyone point their own payment at somebody else's order.
Amount and currency are still verified afterwards, so the reference is only a
pointer, never the proof.

## What makes an order paid

All of these must hold, checked in this order:

| Check | Failure |
| --- | --- |
| Credentials configured and tenant enabled | `503`, no order |
| Payment fetch succeeded | `503`, order stays `pending` |
| `status` is `paid` or `captured` | `failed` |
| `amount` equals the order total exactly | `failed`, `amount_mismatch` |
| `currency` equals the order currency | `failed`, `currency_mismatch` |

The transition to `paid` is a single conditional update
(`status <> 'paid'`), so two concurrent callbacks cannot both fulfil. A repeat
callback on an already-paid order returns `fulfilled: true` without doing work
again.

Fulfilment then claims each line by moving it out of the queue
(`fulfillment_state = 'processing'`), so two concurrent runs cannot deliver the
same line, and dispatches per type: `course` → existing enrolment path,
`product` → a row in `product_purchases` (unique per order line) plus an
inventory decrement when the product tracks stock, `event_ticket` → existing
registration path. A line that throws goes back to `failed` with the reason, and
`failed` lines are selected again on the next run — retry with
`POST /admin/payments/orders/:id/refulfill`, which is safe to repeat. A full
refund marks the order's purchases `refunded`, so "do they still own it" stays
answerable.

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `SECRETS_ENCRYPTION_KEY` | server | 32-byte key for AES-256-GCM. Falls back to `AI_SECRET_KEY` if unset. Without a valid key, secret writes fail closed with `503`. |
| `FRONTEND_URL` | server | Where the OAuth callback and Moyasar return the browser. |

Moyasar credentials are **per tenant**, entered in the admin UI, not in env. This
keeps a multi-tenant deployment from sharing one merchant account. Only
`publishableKey` is readable back; `secretKey` and `webhookSecret` are
write-only and are stored encrypted with AAD bound to `moyasar` and
`moyasar-webhook`.

## Webhook

Configure the Moyasar dashboard to POST to
`https://<api-host>/payments/moyasar/webhook`. Moyasar sends the secret token in
the `x-moyasar-token` header (the `secret_token` body field is also accepted).

With no secret configured, or a wrong one, the endpoint returns
`{"received":true,"handled":false,"reason":"bad_secret"}` and touches nothing.
`webhook_secret_not_configured` means the tenant has not set a webhook secret at
all — also a no-op.

The payload is treated as a pointer only. A webhook for a payment this server
does not know about returns `unknown_order`; the callback path is what binds the
first payment to its order.

## Health

`GET /admin/payments/config` returns `health` with `configured`,
`publishableKeyPresent`, `secretKeyPresent`, `webhookSecretPresent`, and the last
error code seen. A gateway that rejects a key is reported rather than hidden.

## Refunds

`POST /admin/payments/orders/:id/refund` refuses anything that is not `paid`, and
refunds through Moyasar before marking the order `refunded`. Partial refunds take
`{ amountCents }`.

## Endpoints

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/payments/moyasar/config` | member: publishable key + currency, or `status: not_configured` |
| `POST` | `/payments/moyasar/create-order` | member: pending order, idempotent per `idempotencyKey` |
| `GET` | `/payments/moyasar/callback` | member: verify + settle |
| `POST` | `/payments/moyasar/webhook` | public: Moyasar callback |
| `GET` | `/payments/orders/mine` | member: own orders |
| `GET` | `/payments/orders/:id` | member: own order with lines (buyer only) |
| `GET` | `/payments/purchases` | member: products bought, from the ledger |
| `GET` | `/admin/payments/config` | admin: masked settings + health |
| `PUT` | `/admin/payments/config` | admin: store credentials, enable |
| `GET` | `/admin/payments/orders` | admin: tenant orders |
| `POST` | `/admin/payments/orders/:id/refund` | admin: refund |
| `POST` | `/admin/payments/orders/:id/cancel` | admin: cancel a stale pending order |
| `GET` | `/admin/payments/orders/:id` | admin: gateway id, last error, per-line state |
| `POST` | `/admin/payments/orders/:id/refulfill` | admin: retry delivery for a paid order |

## Going live

1. Get `pk_live_` / `sk_live_` and a webhook secret from the Moyasar dashboard.
2. In the admin UI, set the publishable key, secret key and webhook secret, keep
   currency `SAR`, and enable. Set live mode only for live keys.
3. Register the webhook URL.
4. Put a low-value card through, then confirm in the database that
   `orders.status = 'paid'`, `orders.paid_at` is set, and the line reached
   `fulfilled`.
