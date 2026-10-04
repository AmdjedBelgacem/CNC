import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Payments invariants.
 *
 * Money rules fail silently: an order marked paid without a verified charge, a
 * webhook that trusts its own payload, a refund that ignores the gateway. Each
 * assertion below pins one of those.
 *
 * The order of checks in `settleFromPayment` is the load-bearing part, so those
 * are asserted positionally rather than just for presence.
 */
const src = (name: string) =>
  readFileSync(resolve(__dirname, `../src/modules/payments/${name}`), 'utf8');

const moyasar = src('moyasar.service.ts');
const controller = src('moyasar.controller.ts');
const adminController = src('admin-payments.controller.ts');
const config = readFileSync(resolve(__dirname, '../src/config/config.service.ts'), 'utf8');
const secretBox = readFileSync(
  resolve(__dirname, '../src/common/security/secret-box.service.ts'),
  'utf8',
);

describe('Moyasar settlement', () => {
  it('re-fetches the payment with the secret key before trusting anything', () => {
    // The browser's claim is a pointer, never evidence.
    expect(moyasar).toMatch(/async fetchPayment\(tenantId: string, paymentId: string\)/);
    expect(moyasar).toMatch(/Basic \$\{Buffer\.from\(`\$\{runtime\.secretKey\}:`\)/);
    expect(moyasar).toMatch(/authorization: `Basic/);
  });

  it('accepts only paid or captured', () => {
    expect(moyasar).toMatch(
      /const paid = payment\.status === 'paid' \|\| payment\.status === 'captured';/,
    );
  });

  it('verifies amount and currency before fulfilling', () => {
    const settle = moyasar.slice(
      moyasar.indexOf('async settleFromPayment'),
      moyasar.indexOf('private redactProviderPayload'),
    );
    const statusCheck = settle.indexOf("payment.status === 'paid'");
    const amountCheck = settle.indexOf('if (payment.amount !== order.total)');
    const currencyCheck = settle.indexOf('if (payment.currency.toUpperCase()');
    const fulfill = settle.indexOf('this.fulfillOrder');
    expect(statusCheck).toBeGreaterThan(-1);
    expect(amountCheck).toBeGreaterThan(statusCheck);
    expect(currencyCheck).toBeGreaterThan(amountCheck);
    expect(fulfill).toBeGreaterThan(currencyCheck);
  });

  it('never fulfils on an amount or currency mismatch', () => {
    const settle = moyasar.slice(
      moyasar.indexOf('async settleFromPayment'),
      moyasar.indexOf('private redactProviderPayload'),
    );
    // Each mismatch marks the order failed and returns without fulfilling.
    expect(settle).toMatch(/reason: 'amount_mismatch'/);
    expect(settle).toMatch(/reason: 'currency_mismatch'/);
    const amountBlock = settle.slice(settle.indexOf('amount_mismatch') - 400, settle.indexOf('amount_mismatch'));
    expect(amountBlock).not.toContain('fulfillOrder');
  });

  it('claims the paid transition so a duplicate webhook cannot double-deliver', () => {
    // `status <> 'paid'` in the WHERE clause is the claim.
    expect(moyasar).toMatch(/sql`\$\{orders\.status\} <> 'paid'`/);
    expect(moyasar).toMatch(/if \(claimed\.length === 0\)/);
  });

  it('is idempotent for an already-settled order', () => {
    expect(moyasar).toMatch(
      /if \(order\.status === 'paid'\) \{\s*\n\s*return \{ orderId: order\.id, status: 'paid', fulfilled: true \};/,
    );
  });

  it('takes prices from the database, never the request', () => {
    // The request shape has no money in it at all.
    expect(controller).toMatch(/body: \{ lines: CheckoutLine\[\]/);
    const inputType = moyasar.slice(
      moyasar.indexOf('export interface CreateOrderLineInput'),
      moyasar.indexOf('export interface VerifiedPayment'),
    );
    expect(inputType).not.toMatch(/price|amount|currency/i);
    // Every amount comes from a database row.
    expect(moyasar).toMatch(/unitAmountCents: course\.priceCents/);
    expect(moyasar).toMatch(/unitAmountCents: event\.price/);
    expect(moyasar).toMatch(/let unitAmountCents = product\.price;/);
  });

  it('scopes every order read and write to the tenant', () => {
    expect(moyasar).toMatch(
      /eq\(orders\.id, params\.orderId\), eq\(orders\.tenantId, params\.tenantId\)/,
    );
    expect(moyasar).toMatch(
      /eq\(orders\.id, orderId\),\s*\n\s*eq\(orders\.tenantId, tenantId\),\s*\n\s*eq\(orders\.userId, userId\)/,
    );
  });
});

describe('Moyasar failure modes', () => {
  it('fails closed when credentials are missing', () => {
    expect(moyasar).toMatch(/throw new ServiceUnavailableException\('Payments are not configured/);
    expect(moyasar).toMatch(/throw new ServiceUnavailableException\('Payments are disabled/);
    expect(moyasar).toMatch(/throw new ServiceUnavailableException\('Payments are missing a server secret key'\)/);
  });

  it('never stubs a paid order when the gateway is unreachable', () => {
    expect(moyasar).toMatch(/throw new ServiceUnavailableException\('Payment provider is unreachable'\)/);
    // There is no "assume success" branch anywhere in the settlement path.
    const settle = moyasar.slice(
      moyasar.indexOf('async settleFromPayment'),
      moyasar.indexOf('private redactProviderPayload'),
    );
    expect(settle).not.toMatch(/catch[\s\S]{0,200}status: 'paid'/);
  });

  it('rejects a webhook with no secret or the wrong secret', () => {
    expect(moyasar).toMatch(/if \(!runtime\.webhookSecret\) \{[\s\S]{0,400}webhook_secret_not_configured/);
    expect(moyasar).toMatch(/this\.constantTimeEquals\(providedSecret, runtime\.webhookSecret\)/);
    expect(moyasar).toMatch(/reason: 'bad_secret'/);
  });

  it('treats a webhook payload as a pointer, not as proof', () => {
    const webhook = moyasar.slice(
      moyasar.indexOf('async handleWebhook'),
      moyasar.indexOf('private async findOrderByPayment'),
    );
    // It must go back through settleFromPayment, which re-fetches.
    expect(webhook).toMatch(/this\.settleFromPayment\(\{/);
    expect(webhook).not.toMatch(/status: 'paid'/);
  });

  it('validates the payment id before it reaches the gateway URL', () => {
    expect(moyasar).toMatch(/if \(!\/\^\[A-Za-z0-9_-\]\{1,80\}\$\/\.test\(paymentId\)\)/);
  });
});

describe('Moyasar fulfillment', () => {
  it('claims each line once', () => {
    expect(moyasar).toMatch(
      /and\(\s*eq\(orderItems\.id, line\.id\),\s*\n\s*inArray\(orderItems\.fulfillmentState, \['pending', 'failed'\]\),/,
    );
  });

  it('reuses the existing enrolment and registration paths', () => {
    expect(moyasar).toMatch(/this\.courses\.enrollUser\(tenantId, userId, line\.refId!\)/);
    expect(moyasar).toMatch(/this\.events\.register\(line\.refId!, userId, tenantId\)/);
  });

  it('decrements stock only for products that track it', () => {
    expect(moyasar).toMatch(/if \(product\.trackInventory\) \{/);
    expect(moyasar).toMatch(/greatest\(\$\{productsBundle\.inventory\} - \$\{line\.quantity\}, 0\)/);
  });

  it('releases a failed line so a retry can pick it up', () => {
    expect(moyasar).toMatch(/set\(\{ fulfillmentState: 'failed', fulfillmentError: message \}\)/);
  });
});

describe('secret handling', () => {
  it('never returns a secret from a read endpoint', () => {
    expect(adminController).toMatch(/secretKeyConfigured: Boolean\(row\?\.encryptedSecretKey\)/);
    expect(adminController).toMatch(/webhookSecretConfigured: Boolean\(row\?\.encryptedWebhookSecret\)/);
    // The read method's own body must not carry the ciphertext out.
    const read = adminController.slice(
      adminController.indexOf('async getConfig'),
      adminController.indexOf("@Put('config')"),
    );
    expect(read).not.toMatch(/encryptedSecretKey[,}]/);
    expect(read).not.toMatch(/encryptedWebhookSecret[,}]/);
    expect(moyasar).toMatch(/getPublicSettings[\s\S]{0,900}publishableKey: row\.enabled \? row\.publishableKey : null/);
  });

  it('encrypts payment and OAuth credentials with AES-GCM bound to scope', () => {
    expect(secretBox).toMatch(/createCipheriv\('aes-256-gcm'/);
    expect(secretBox).toMatch(/cipher\.setAAD\(Buffer\.from\(this\.aad\(scope, provider\), 'utf8'\)\)/);
    expect(adminController).toMatch(/encryptOrThrow\(dto\.secretKey, tenant\.id, 'moyasar'\)/);
    expect(adminController).toMatch(/encryptOrThrow\(\s*\n?\s*dto\.webhookSecret,\s*\n?\s*tenant\.id,\s*\n?\s*'moyasar-webhook',?\s*\n?\s*\)/);
  });

  it('refuses to store anything when no master key is configured', () => {
    expect(secretBox).toMatch(/class SecretBoxUnavailableError/);
    expect(secretBox).toMatch(/if \(key\.length !== 32\) return \{ key: null, status: 'invalid' \}/);
    expect(secretBox).toMatch(/throw new ServiceUnavailableException\(\s*\n?\s*'Secret storage is not configured/);
  });

  it('keeps the publishable key separate from the secret key', () => {
    // Only pk_* is ever handed to the browser, and only after the tenant enables it.
    expect(moyasar).toMatch(/publishableKey: row\.enabled \? row\.publishableKey : null/);
    expect(moyasar).toMatch(/if \(!row\.publishableKey\) \{/);
  });
});

describe('order model', () => {
  const orders = readFileSync(resolve(__dirname, '../src/database/schema/orders.ts'), 'utf8');
  const migration = readFileSync(
    resolve(__dirname, '../src/database/migrations/020_moyasar_orders_google_integrations.sql'),
    'utf8',
  );

  it('stores the gateway identity on the order', () => {
    expect(orders).toMatch(/provider: varchar\('provider', \{ length: 32 \}\)\.default\('moyasar'\)\.notNull\(\)/);
    expect(orders).toMatch(/providerPaymentId: varchar\('provider_payment_id', \{ length: 255 \}\)/);
    expect(orders).toMatch(/providerPayload: jsonb\('provider_payload'\)/);
    expect(orders).toMatch(/idempotencyKey: varchar\('idempotency_key', \{ length: 120 \}\)/);
    expect(migration).toMatch(/ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'SAR'/);
  });

  it('types every line so any payable entity can be added later', () => {
    expect(orders).toMatch(
      /export type OrderItemType = 'course' \| 'product' \| 'event_ticket' \| 'bundle' \| 'custom'/,
    );
    expect(orders).toMatch(/itemType: varchar\('item_type', \{ length: 32 \}\)\.default\('product'\)\.notNull\(\)/);
    expect(orders).toMatch(/refId: uuid\('ref_id'\)/);
    expect(orders).toMatch(/unitAmountCents: integer\('unit_amount_cents'\)\.notNull\(\)\.default\(0\)/);
  });

  it('makes a retried checkout idempotent per tenant', () => {
    expect(orders).toMatch(
      /idempotencyUnique: uniqueIndex\('orders_tenant_idempotency_unique'\)\.on\(table\.tenantId, table\.idempotencyKey\)/,
    );
  });

  it('prevents the same entity being claimed twice in one order', () => {
    expect(orders).toMatch(
      /lineUnique: uniqueIndex\('order_items_order_ref_unique'\)\.on\(table\.orderId, table\.itemType, table\.refId\)/,
    );
  });
});

describe('payment ↔ order binding', () => {
  it('signs the order reference over the id and the total', () => {
    // An unsigned reference would let anyone point their payment at a victim's
    // order, so the total is inside the signature too.
    expect(moyasar).toMatch(/signOrderRef\(orderId: string, total: number\): OrderRef/);
    expect(moyasar).toMatch(/createHmac\('sha256', key\)\.update\(`\$\{orderId\}:\$\{total\}`\)/);
    expect(moyasar).toMatch(/return timingSafeEqual\(a, b\)/);
  });

  it('returns the signed ref from create-order so the form can send it', () => {
    expect(moyasar).toMatch(/orderRef: this\.signOrderRef\(created\.id, total\)/);
    expect(moyasar).toMatch(/orderRef: this\.signOrderRef\(existing\.id, existing\.total\)/);
  });

  it('resolves an unknown payment through the signed ref, not the webhook body', () => {
    // The webhook envelope is never trusted for this: the payment is re-fetched
    // with the secret key and its own metadata is checked.
    const resolver = moyasar.slice(
      moyasar.indexOf('private async findOrderBySignedRef'),
      moyasar.indexOf('private async findOrderByPayment'),
    );
    expect(resolver).toMatch(/await this\.fetchPayment\(tenantId, paymentId\)/);
    expect(resolver).toMatch(/if \(!this\.verifyOrderRef\(\{ orderId, sig \}, order\.total\)\)/);
    const fetchAt = resolver.indexOf('fetchPayment');
    const verifyAt = resolver.indexOf('verifyOrderRef');
    expect(verifyAt).toBeGreaterThan(fetchAt);
  });

  it('keeps the payment id lookup as the first resolution path', () => {
    const webhook = moyasar.slice(
      moyasar.indexOf('const order = await this.findOrderByPayment'),
      moyasar.indexOf('if (type === \'payment_refunded\''),
    );
    const byId = webhook.indexOf('findOrderByPayment');
    const byRef = webhook.indexOf('findOrderBySignedRef');
    expect(byId).toBeGreaterThan(-1);
    expect(byRef).toBeGreaterThan(byId);
    expect(webhook).toMatch(/if \(!target\)/);
  });
});

describe('member route guards', () => {
  it('guards every member order route, or request.user is never populated', () => {
    // A missing @UseGuards(JwtAuthGuard) produced a 500 on a legitimate request,
    // because the chain that fills request.user/request.tenant never ran.
    const lines = controller.split('\n');
    let guarded = false;
    let isPublic = false;
    const seen: Array<{ route: string; guarded: boolean; isPublic: boolean }> = [];
    for (const line of lines) {
      if (line.includes('@UseGuards(JwtAuthGuard)')) guarded = true;
      if (line.includes('@Public()')) isPublic = true;
      const route = line.match(/@(Get|Post|Put|Patch|Delete)\('?([^')]*)'?/);
      if (route) {
        seen.push({ route: route[2] || '/', guarded, isPublic });
        guarded = false;
        isPublic = false;
      }
    }

    const memberRoutes = seen.filter((r) => /^(orders|purchases|moyasar\/)/.test(r.route));
    expect(memberRoutes.length).toBeGreaterThanOrEqual(4);
    for (const entry of memberRoutes) {
      // The webhook is the only route that may be unauthenticated.
      if (entry.route === 'moyasar/webhook') {
        expect(entry.isPublic).toBe(true);
      } else {
        expect(`${entry.route} guarded=${entry.guarded}`).toBe(`${entry.route} guarded=true`);
      }
    }
  });

  it('leaves only the gateway webhook public', () => {
    const publicBlocks = controller.split('@Public').slice(1);
    expect(publicBlocks.length).toBe(1);
    expect(publicBlocks[0]).toMatch(/moyasar\/webhook/);
  });
});

describe('callback authorization', () => {
  it('requires the caller to be the buyer, not just the tenant', () => {
    expect(moyasar).toMatch(
      /if \(params\.trigger === 'callback' && params\.actorUserId && order\.userId !== params\.actorUserId\)/,
    );
    // 404, so a non-owner cannot even learn the order exists.
    expect(moyasar).toMatch(
      /not the buyer[\s\S]{0,120}throw new NotFoundException\('Order not found'\)/,
    );
  });

  it('passes the actor from the controller', () => {
    expect(controller).toMatch(/trigger: 'callback',\s*\n\s*\/\/ Without this[\s\S]{0,200}actorUserId: user\.id/);
  });
});

describe('fulfillment reliability', () => {
  it('retries failed lines instead of only pending ones', () => {
    expect(moyasar).toMatch(
      /inArray\(orderItems\.fulfillmentState, \['pending', 'failed'\]\)/,
    );
  });

  it('claims a line by moving it out of the retry queue entirely', () => {
    // `processing` is claimed so a concurrent retry cannot deliver it twice.
    expect(moyasar).toMatch(/set\(\{ fulfillmentState: 'processing', fulfillmentError: null \}\)/);
    const claim = moyasar.slice(
      moyasar.indexOf("set({ fulfillmentState: 'processing', fulfillmentError: null })"),
      moyasar.indexOf('if (claimed.length === 0) continue;'),
    );
    expect(claim).toMatch(/inArray\(orderItems\.fulfillmentState, \['pending', 'failed'\]\)/);
    expect(claim).toMatch(/\.returning\(\{ id: orderItems\.id \}\)/);
  });

  it('marks the line fulfilled only after delivery succeeded', () => {
    const deliver = moyasar.slice(
      moyasar.indexOf('await this.deliverLine(tenantId, order.userId, order, line)'),
      moyasar.indexOf('private notifyOrderPaid'),
    );
    const doneAt = deliver.indexOf("fulfillmentState: 'fulfilled'");
    const failAt = deliver.indexOf("fulfillmentState: 'failed'");
    expect(doneAt).toBeGreaterThan(-1);
    expect(failAt).toBeGreaterThan(doneAt);
  });

  it('records a real purchase for a product line, not just stock', () => {
    expect(moyasar).toMatch(/await this\.drizzle\.db\s*\n\s*\.insert\(productPurchases\)/);
    expect(moyasar).toMatch(/orderItemId: line\.id/);
    expect(moyasar).toMatch(/productId: product\.id/);
    // The unique index is the double-delivery guard.
    expect(moyasar).toMatch(/\.onConflictDoNothing\(\{ target: productPurchases\.orderItemId \}\)/);
  });

  it('skips stock movement when the purchase already existed', () => {
    const deliver = moyasar.slice(
      moyasar.indexOf('const recorded = await this.drizzle.db'),
      moyasar.indexOf('if (product.trackInventory)'),
    );
    expect(deliver).toMatch(/if \(recorded\.length === 0\)/);
    expect(deliver).toMatch(/return;/);
  });

  it('releases a failed line back into the retry queue', () => {
    expect(moyasar).toMatch(/set\(\{ fulfillmentState: 'failed', fulfillmentError: message \}\)/);
  });

  it('only tells the buyer once per delivery run', () => {
    expect(moyasar).toMatch(/if \(delivered > 0\) \{\s*\n\s*this\.notifyOrderPaid/);
  });

  it('releases purchases on a full refund', () => {
    expect(moyasar).toMatch(
      /if \(refundedAmount >= order\.total\) \{[\s\S]{0,300}set\(\{ status: 'refunded', refundedAt: new Date\(\), updatedAt: new Date\(\) \}\)/,
    );
  });
});

describe('order-aware checkout', () => {
  const page = readFileSync(
    resolve(__dirname, '../../frontend/src/app/(main)/(store)/checkout/page.tsx'),
    'utf8',
  );
  const success = readFileSync(
    resolve(__dirname, '../../frontend/src/app/(main)/(store)/checkout/success/page.tsx'),
    'utf8',
  );
  const hook = readFileSync(resolve(__dirname, '../../frontend/src/hooks/use-payments.ts'), 'utf8');
  const analytics = readFileSync(resolve(__dirname, '../../frontend/src/lib/analytics.ts'), 'utf8');

  it('lands the direct-buy hook on a checkout that reads the order', () => {
    expect(hook).toMatch(/window\.location\.href = `\/checkout\?order=\$\{order\.orderId\}`/);
    expect(page).toMatch(/const requestedOrderId = searchParams\.get\('order'\)/);
  });

  it('loads that order instead of building one from the cart', () => {
    // The route is /payments/orders/:id, not /payments/moyasar/orders/:id: getting
    // this wrong 404s and the direct buy silently shows "order not found".
    expect(page).toMatch(
      /api\.get<\{ data: OrderView \}>\(\s*`\/payments\/orders\/\$\{encodeURIComponent\(requestedOrderId\)\}`/,
    );
    // The cart must not create a second order when an order id is present.
    expect(page).toMatch(/if \(requestedOrderId\) return;\s*\n\s*if \(items\.length > 0 && !order\)/);
  });

  it('does not show the empty cart for a direct buy', () => {
    expect(page).toMatch(/if \(!requestedOrderId && items\.length === 0\) \{/);
  });

  it('sends the server order to the form, not a client number', () => {
    expect(page).toMatch(/amount: effective\.amount,\s*\n\s*currency: effective\.currency,/);
    expect(page).toMatch(/const effective = directOrder/);
    expect(page).toMatch(/amount: directOrder\.total,\s*\n\s*currency: directOrder\.currency,/);
  });

  it('carries the signed reference in the gateway metadata', () => {
    expect(page).toMatch(/order_ref: `\$\{effective\.orderRef\.orderId\}\.\$\{effective\.orderRef\.sig\}`/);
  });

  it('clears the cart only on a verified paid', () => {
    expect(success).toMatch(/if \(status !== 'paid' \|\| !order \|\| purchaseTracked\.current\) return;/);
    expect(success).toMatch(/if \(cartCleared\.current\) return;[\s\S]{0,80}clearCart\(\);/);
    // And the checkout page must not offer a way to empty it early.
    expect(page).not.toMatch(/clearCart\(\)/);
  });

  it('reports revenue in the order currency', () => {
    expect(analytics).toMatch(/currency: input\.currency \?\? 'SAR'/);
    // No funnel event may report a hardcoded USD for a SAR merchant.
    const funnel = analytics.slice(analytics.indexOf('export function trackAddToCart'));
    expect(funnel).not.toMatch(/currency: 'USD'/);
    expect(funnel).toMatch(/currency: item\.currency \?\? 'SAR'/);
    expect(success).toMatch(/currency: order\.currency,/);
  });
});

describe('google integrations security', () => {
  const service = readFileSync(
    resolve(__dirname, '../src/modules/integrations/google-integrations.service.ts'),
    'utf8',
  );
  const controller = readFileSync(
    resolve(__dirname, '../src/modules/integrations/admin-integrations.controller.ts'),
    'utf8',
  );

  it('is super_admin only', () => {
    expect(controller).toMatch(/@Roles\('super_admin'\)/);
    expect(controller).toMatch(/@Controller\('admin\/integrations'\)/);
  });

  it('stores the refresh token encrypted and never returns it', () => {
    expect(service).toMatch(/this\.secrets\.encryptOrThrow\(\s*\n?\s*token\.refreshToken, 'platform', `google:\$\{params\.service\}`/);
    // The status projection must expose identity and ids, never credentials.
    // Reading the column to decide "connected vs not" is necessary; returning it
    // is not. So the assertion is on the object literal that is sent to the client.
    const projection = service.slice(
      service.indexOf('const base = {'),
      service.indexOf('if (!row?.encryptedRefreshToken)'),
    );
    expect(projection).toMatch(/connectedEmail/);
    expect(projection).toMatch(/externalAccountId/);
    expect(projection).not.toMatch(/refreshToken/i);
  });

  it('binds the OAuth state to the admin who started it and consumes it once', () => {
    expect(service).toMatch(/if \(stateRow\.initiatedBy !== params\.connectedBy\)/);
    expect(service).toMatch(/if \(stateRow\.consumedAt\)/);
    expect(service).toMatch(/error: 'state_expired'/);
    expect(service).toMatch(/if \(stateRow\.service !== params\.service\)/);
  });

  it('validates state before exchanging the code, so a forged callback cannot spend the flow', () => {
    const flow = service.slice(service.indexOf('const stateHash = createHash'));
    const stateCheck = flow.indexOf("error: 'unknown_state'");
    const csrfCheck = flow.indexOf("error: 'csrf_mismatch'");
    const consume = flow.indexOf('consumedAt: new Date()');
    const exchange = flow.indexOf('this.exchangeCode');
    expect(stateCheck).toBeGreaterThan(-1);
    // Every guard, then consume-once, then only then spend the code.
    expect(csrfCheck).toBeGreaterThan(stateCheck);
    expect(consume).toBeGreaterThan(csrfCheck);
    expect(exchange).toBeGreaterThan(consume);
  });

  it('redirects a browser callback instead of returning an empty body', () => {
    // A bare @Res() swallowed the reply and returned 200 with no body.
    expect(controller).toMatch(/@Res\(\{ passthrough: true \}\) reply: any/);
    expect(controller).toMatch(/reply\.status\(302\)\.redirect\(url\.toString\(\)\)/);
  });

  it('refuses a connection with no refresh token', () => {
    // A grant that cannot be refreshed is not a connection.
    expect(service).toMatch(/if \(!token\.refreshToken\) \{/);
    expect(service).toMatch(/error: 'no_refresh_token'/);
  });

  it('marks revoked when Google reports invalid_grant', () => {
    expect(service).toMatch(/if \(response\.status === 400 \|\| response\.status === 401\) \{[\s\S]{0,300}invalid_grant/);
  });

  it('reports a blocked reason instead of a fake connected state', () => {
    expect(service).toMatch(/blockedReason\(service: GoogleIntegrationService\): string \| null/);
    expect(service).toMatch(/GOOGLE_ADS_DEVELOPER_TOKEN is not set/);
    expect(service).toMatch(/status: blocked \? \('blocked' as const\) : \('not_connected' as const\)/);
  });

  it('only reaches connected through a real API probe', () => {
    expect(service).toMatch(/async probe\(/);
    expect(service).toMatch(/listAccessibleCustomers/);
    expect(service).toMatch(/tagmanager\/v2\/accounts/);
    expect(service).toMatch(/webmasters\/v3\/sites/);
    expect(service).toMatch(/shoppingcontent\.googleapis\.com/);
  });

  it('audits connect and disconnect', () => {
    expect(controller).toMatch(/action: 'google_integration_connected'/);
    expect(controller).toMatch(/action: 'google_integration_disconnected'/);
    expect(controller).toMatch(/action: 'google_integration_tested'/);
  });

  it('documents the scopes it asks for', () => {
    for (const scope of ['adwords', 'auth/content', 'webmasters.readonly', 'tagmanager.readonly']) {
      expect(service).toContain(scope);
    }
  });
});
