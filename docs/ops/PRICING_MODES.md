# Product pricing modes and quote requests

## The problem

A CNC shop prices three ways, and a single nullable `products.price` cannot express any of
them honestly:

| Mode | Meaning |
|---|---|
| `fixed` | one exact figure — what the site did before |
| `from` | a headline figure that varies by variant (3-axis vs 5-axis, vise jaw widths) |
| `request` | no figure at all; the machine is quoted per configuration |

Both live products turned out to have `price = NULL`, so the storefront was already
rendering "Price on request" — but by accident, through a null-price fallback, with a
**disabled Add to Cart** and no way to enquire. The old behaviour made a missing price look
like an oversight. `request` mode makes it a deliberate, admin-chosen state with a working
call to action.

## Model

`products.pricing_mode` — `varchar(20) NOT NULL DEFAULT 'fixed'`. NOT NULL so no existing row
changes meaning on deploy, and so the read path never has to infer a mode from a null price:
a genuinely free product and a quote-only machine are otherwise indistinguishable.

`pricingMode` is on the client allowlist, so it is **validated** on create and update.
Without that, a request could store `'starting'`; the storefront switch would fall through
to `fixed`, and a quote-only machine would quietly publish a price. Rejected with a 400
naming the three legal values.

`from` is **computed** from the lowest figure a buyer could actually pay — the product price
and every variant price — not a separate admin-set field that could contradict the options.

## Storefront

| Mode | Headline | Controls |
|---|---|---|
| `fixed` | the price | Add to Cart, Buy Now |
| `from` | "From X" | Add to Cart, Buy Now |
| `request` | "Price on request" | **Request a quote** only |

In `request` mode the cart is *replaced*, not disabled: a greyed-out Add to cart reads as a
broken site, a clear "Request a quote" reads as the intended path. Buy Now goes with it for
the same reason.

Nothing about the price leaks in `request` mode. A stored price is kept for the admin's
reference but not displayed, and compare-at is gated to `fixed` — a struck-through figure
beside a quote prompt would expose the very number the mode exists to withhold. Both were
caught by verifying against the running site rather than by reading the code.

The quote form is a **modal on the product page**, so the shopper keeps the machine, its
images and its hotspot annotations in view. Product and variant travel with the submission;
the customer does not pick them from a list.

## Quotes

`quotes` was a bare contact form — name, email, company, message, no tenant, no product — so
a request could not be attributed, triaged, or answered without risking a double reply. It
now carries:

| Column | Why |
|---|---|
| `tenant_id` | scoping; a quote is that tenant's business |
| `product_id`, `variant_id` | what was asked about, so the admin opens the product rather than guessing from free text |
| `status` | `new → contacted → closed`. Without it there is no way to know a request was handled |
| `quoted_price` | minor units, matching `products.price`. Never a float, never a formatted string |
| `admin_note` | the conversation, which otherwise lives in someone's inbox |

Existing rows keep their NULLs — they were real submissions with no product behind them, and
backfilling a tenant would be a guess.

## Guards on the public endpoint

`POST /quotes` is the one write an unauthenticated visitor can reach, so it carries three
guards plus a rate limit:

1. **Per-email cap** of 3 *open* requests per product. A stuck form or a retry loop cannot
   flood an inbox. The email is lower-cased first, so the cap cannot be dodged by changing
   case.
2. **The product must actually be quote-only.** A stale tab cannot turn a published price
   into a sales lead.
3. **Product and variant are resolved server-side**, including confirming the variant belongs
   to *that* product — accepting the buyer's value unchecked would let a request reference
   another product's variant.
4. **5 requests/minute** on top, via the existing throttler.

`GET /admin/quotes` and `PATCH /admin/quotes/:id` are tenant-scoped: one tenant cannot read or
advance another's requests. Only `status`, `admin_note` and `quoted_price` are writable.

New requests notify tenant admins in-app **and by email**. That notification is wrapped so a
mail outage cannot lose the request — the row is the record of truth.

## Verified in production

| Check | Result |
|---|---|
| Migration 036 applied at boot | `pricing_mode` present; all 12 `quotes` columns present |
| Existing products unchanged | all 6 report `pricingMode: fixed` |
| Request mode renders | "Request a quote" button present; Add to Cart and Buy Now absent; no price span |
| Compare-at suppressed in request mode | confirmed |
| Reverting to `fixed` | previous behaviour restored |
| Public quote submission | creates a linked row with `status: new` |
| Per-email cap | 3 accepted, 4th refused with 400 |
| Validation | empty body 400, bad email 400, unknown product 404 |
| Arabic | fully translated page (64,972 Arabic chars), `السعر عند الطلب` / `اطلب عرض سعر` |
| Pages | 47 routes × 2 locales, no 4xx/5xx, no `MISSING_MESSAGE` |
| Tests | backend 841 passed / 5 skipped, frontend 76 passed |

Test data created during verification (3 quote rows, a temporary `request` mode on the 3-Axis
product) was removed and reverted.

## Notes

* The storefront fetch is cached for 60 seconds, so a pricing change takes up to a minute to
  appear. Worth knowing when testing: a revert can look like it did not take.
* `from` mode with no price anywhere on the product falls back to "Price on request" rather
  than showing an empty "From". That is deliberate — a blank headline reads as broken.
* `/admin/quotes` is linked from the admin rail under Commerce. A new request also appears
  in the notification bell (category `commerce`) with a direct link to the inbox.
* The storefront product card follows the same mode as the detail page: `request` replaces
  the cart with a "Request a quote" button that opens the same form, and related products
  are passed through unchanged so a missing price is never rendered as `0`.