import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../src/modules/auth/auth.controller';

/**
 * verify-password gates the reauth modal, which only proceeded on `res.ok`. It used
 * to `return { valid: false }` under a 200, so ANY password "verified" and the
 * reauth step was a no-op — including on the email-change and 2FA-disable paths.
 *
 * These tests pin the contract: wrong/missing password must be a 401.
 */
function controllerWith(verifyPassword: (userId: string, password: string) => Promise<boolean>) {
  // AuthController's first constructor param is AuthService itself.
  const controller = AuthController as unknown as new (...args: unknown[]) => {
    verifyPassword(user: { id: string }, body: { password: string }): Promise<unknown>;
  };
  const noop = {};
  return new controller({ verifyPassword }, noop, noop, noop, noop, noop, noop, noop, { get: () => undefined });
}

const call = (verified: boolean, password: unknown) =>
  controllerWith(async () => verified).verifyPassword({ id: 'u1' }, { password } as { password: string });

describe('POST /auth/verify-password', () => {
  it('rejects a wrong password with 401, not a 200 body', async () => {
    await expect(call(false, 'wrong-password')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an empty password without consulting the store', async () => {
    let consulted = false;
    const ctrl = controllerWith(async () => {
      consulted = true;
      return true;
    });
    // An empty password must never be able to verify, even if the hash check would pass.
    await expect(ctrl.verifyPassword({ id: 'u1' }, { password: '' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(consulted).toBe(false);
  });

  it('rejects a missing password field', async () => {
    await expect(call(true, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns valid:true only for a correct password', async () => {
    await expect(call(true, 'correct-password')).resolves.toEqual({ valid: true });
  });

  it('never resolves with valid:false, which callers would read as success', async () => {
    await expect(call(false, 'nope')).rejects.toBeDefined();
  });
});