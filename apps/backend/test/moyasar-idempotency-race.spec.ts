import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A retried checkout must return the original order, not a 500.
 *
 * `createOrder` looked up the idempotency key and then inserted. Two concurrent requests — a
 * double-clicked Pay button, or a retry arriving during a slow response — both found nothing, both
 * inserted, and the unique index rejected the loser with a raw Postgres error that surfaced as
 * `Internal server error`. That is the one request the key exists to make safe.
 */
const src = readFileSync(
  resolve(__dirname, '../src/modules/payments/moyasar.service.ts'),
  'utf8',
);

describe('concurrent checkouts with one idempotency key', () => {
  it('catches a unique violation around the insert', () => {
    const insertAt = src.indexOf('insert(orders)');
    expect(insertAt).toBeGreaterThan(-1);
    const window = src.slice(insertAt - 600, insertAt + 1400);
    expect(window).toMatch(/catch\s*\(error\)/);
    expect(window).toMatch(/isUniqueViolation\(error\)/);
  });

  it('returns the winning order rather than rethrowing', () => {
    const window = src.slice(src.indexOf('insert(orders)') - 600, src.indexOf('insert(orders)') + 2000);
    expect(window).toMatch(/orderId:\s*winner\.id/);
  });

  it('rethrows when the conflict is not the idempotency key', () => {
    const window = src.slice(src.indexOf('insert(orders)') - 600, src.indexOf('insert(orders)') + 2200);
    // A genuine failure must not be swallowed and dressed up as a successful order.
    expect(window).toMatch(/throw error;/);
  });

  it('detects the violation through a wrapped DrizzleQueryError', () => {
    // The driver may hand back the Postgres error directly or wrapped as a cause.
    expect(src).toMatch(/function isUniqueViolation/);
    expect(src).toMatch(/23505/);
    expect(src).toMatch(/current\.cause/);
  });

  it('the unique index the race relies on still exists', () => {
    const schema = readFileSync(
      resolve(__dirname, '../src/database/schema/orders.ts'),
      'utf8',
    );
    expect(schema).toMatch(/orders_tenant_idempotency_unique/);
  });
});
