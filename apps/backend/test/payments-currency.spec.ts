import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Payments currency invariant.
 *
 * Product prices are stored in the product's own currency (`products.currency`,
 * default USD). The Stripe session used to hardcode `currency: 'usd'`, so a
 * SAR-priced product would be handed to Stripe as a SAR *amount* denominated in
 * USD — roughly a 3.75x overcharge, silently, and the order row recorded USD
 * regardless of what was actually priced.
 *
 * These assertions pin the fix: the charge currency comes from the database
 * product row (never the client payload), each Stripe line carries its own
 * currency, and the order records the currency that was charged.
 */
describe('payments settlement currency', () => {
  const service = readFileSync(
    resolve(__dirname, '../src/modules/payments/payments.service.ts'),
    'utf8',
  );
  const config = readFileSync(resolve(__dirname, '../src/config/config.service.ts'), 'utf8');

  it('never hardcodes a currency on the Stripe session', () => {
    expect(service).not.toMatch(/currency:\s*'usd'/i);
    expect(service).not.toMatch(/currency:\s*"usd"/i);
  });

  it('takes the charge currency from the product row, not the request', () => {
    expect(service).toMatch(/currency: \(prodRow\.currency \|\| this\.config\.get\('PAYMENTS_CURRENCY'\)\)/);
  });

  it('sends each line in its own currency', () => {
    expect(service).toMatch(/currency: i\.currency \?\? settlementCurrency/);
  });

  it('records the charged currency on the order', () => {
    expect(service).toMatch(/currency: settlementCurrency\.toUpperCase\(\)/);
  });

  it('keeps a configurable fallback for products without a currency', () => {
    expect(config).toMatch(/PAYMENTS_CURRENCY: z/);
    expect(config).toMatch(/\.default\('usd'\)/);
  });

  it('rejects a client price that disagrees with the database', () => {
    // Existing anti-tampering guard: the charged amount is always the DB price.
    expect(service).toMatch(/Price mismatch for \$\{item\.productId\}/);
  });
});
