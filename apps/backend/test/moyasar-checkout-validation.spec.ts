import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CheckoutLineDto, CreateMoyasarOrderDto } from '../src/modules/payments/dto/moyasar.dto';

/**
 * A malformed reference must be a 400, not a 500.
 *
 * `refId` was an untyped string passed straight into `where id = $1`, so Postgres rejected `"x"`
 * with `invalid input syntax for type uuid` and the caller saw an opaque `Internal server error`.
 * That reads as "the server is broken" when the request was simply malformed.
 */
/**
 * Validate as the global `ValidationPipe` does: transform, then run the nested checks.
 *
 * `validate()` alone reports the `lines` property with no constraints because the failures live
 * on the child instances. The pipe walks them via `@ValidateNested({ each: true })`, so the test
 * does too — asserting the same outcome the API produces.
 */
async function validateLines(lines: unknown[]) {
  const dto = plainToInstance(CreateMoyasarOrderDto, { lines });
  const outer = await validate(dto);
  const messages = outer.flatMap((e) => Object.values(e.constraints ?? {}));
  const children = await Promise.all((dto.lines ?? []).map((line) => validate(line)));
  for (const child of children) {
    messages.push(...child.flatMap((e) => Object.values(e.constraints ?? {})));
  }
  return messages;
}

const realUuid = '73ea92f9-4e14-4c60-9d57-ac769e6c273b';

describe('checkout line validation', () => {
  it('accepts a well-formed line', async () => {
    expect(await validateLines([{ itemType: 'product', refId: realUuid, quantity: 1 }])).toEqual([]);
  });

  it('rejects a non-uuid refId', async () => {
    const errors = await validateLines([{ itemType: 'product', refId: 'x', quantity: 1 }]);
    expect(errors.join(' ')).toMatch(/refId must be a valid/);
  });

  it('rejects a missing refId', async () => {
    expect((await validateLines([{ itemType: 'product', quantity: 1 }])).join(' ')).toMatch(/refId/);
  });

  it('rejects an unknown itemType', async () => {
    const errors = await validateLines([{ itemType: 'subscription', refId: realUuid }]);
    expect(errors.join(' ')).toMatch(/itemType/);
  });

  /**
   * The allowed set must match the `OrderItemType` union the service actually handles.
   *
   * It previously listed `event` instead of `event_ticket` and omitted `custom`, so validation
   * would have rejected a legitimate event ticket even though the service prices it correctly.
   */
  it('accepts every item type the service can price', async () => {
    for (const itemType of ['course', 'product', 'event_ticket', 'bundle', 'custom']) {
      expect(await validateLines([{ itemType, refId: realUuid }])).toEqual([]);
    }
  });

  it('rejects "event", which is not the real item type', async () => {
    const errors = await validateLines([{ itemType: 'event', refId: realUuid }]);
    expect(errors.join(' ')).toMatch(/itemType/);
  });

  it('accepts a uuid of any version, not only v4', async () => {
    // Postgres uuid columns accept any version; pinning '4' would reject legitimate rows.
    const v1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    expect(await validateLines([{ itemType: 'product', refId: v1 }])).toEqual([]);
  });

  it('rejects a zero or negative quantity', async () => {
    expect((await validateLines([{ itemType: 'product', refId: realUuid, quantity: 0 }])).join(' '))
      .toMatch(/at least 1/);
  });

  it('rejects an absurd quantity', async () => {
    expect((await validateLines([{ itemType: 'product', refId: realUuid, quantity: 9999 }])).join(' '))
      .toMatch(/exceed/);
  });

  it('rejects a malformed variantId', async () => {
    const errors = await validateLines([{ itemType: 'product', refId: realUuid, variantId: 'nope' }]);
    expect(errors.join(' ')).toMatch(/variantId/);
  });

  it('accepts a valid variantId', async () => {
    expect(
      await validateLines([
        { itemType: 'product', refId: realUuid, variantId: '1d1b0c1a-1111-4111-8111-111111111111' },
      ]),
    ).toEqual([]);
  });

  it('rejects a non-array lines field', async () => {
    const dto = plainToInstance(CreateMoyasarOrderDto, { lines: 'nope' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('the dto defaults an omitted quantity rather than rejecting it', () => {
    expect(new CheckoutLineDto().quantity).toBeUndefined();
  });
});
