import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordDto, RegisterDto, ResetPasswordDto, isStrongPassword } from '../src/modules/auth/dto/credentials.dto';

const errorsFor = async <T extends object>(cls: new () => T, plain: object) =>
  (await validate(plainToInstance(cls, plain), { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property);

describe('password policy is enforced by the server, not just the form', () => {
  it('accepts a password the shared policy accepts, and rejects the ones it rejects', () => {
    expect(isStrongPassword('Str0ng-Pass!9x')).toBe(true);
    for (const weak of ['abc', 'alllowercase1', 'ALLUPPERCASE1', 'NoDigitsHere', 'Sh0rt', '', undefined, 12345678, 'A1' + 'a'.repeat(200)]) {
      expect(isStrongPassword(weak), String(weak)).toBe(false);
    }
  });

  it('register rejects "abc" and accepts a normal signup, with or without a username', async () => {
    const base = { email: 'a@example.com', name: 'A' };
    expect(await errorsFor(RegisterDto, { ...base, password: 'abc' })).toEqual(['password']);
    expect(await errorsFor(RegisterDto, { ...base, password: 'Str0ng-Pass!9x' })).toEqual([]);
    expect(await errorsFor(RegisterDto, { ...base, password: 'Str0ng-Pass!9x', username: 'qa_user-1' })).toEqual([]);
    expect(await errorsFor(RegisterDto, { ...base, password: 'Str0ng-Pass!9x', username: 'Bad Name' })).toEqual(['username']);
  });

  it('register still requires an email and a name', async () => {
    expect((await errorsFor(RegisterDto, { password: 'Str0ng-Pass!9x' })).sort()).toEqual(['email', 'name']);
  });

  it('rejects fields the form never sends, so nothing rides along unvalidated', async () => {
    expect(await errorsFor(RegisterDto, { email: 'a@example.com', name: 'A', password: 'Str0ng-Pass!9x', role: 'super_admin' })).toEqual(['role']);
  });

  it('reset and change apply the same rule to the new password, not the current one', async () => {
    expect(await errorsFor(ResetPasswordDto, { token: 't', password: 'abc' })).toEqual(['password']);
    expect(await errorsFor(ChangePasswordDto, { currentPassword: 'old', newPassword: 'abc' })).toEqual(['newPassword']);
    // The current password may be anything: it is only compared with what is stored.
    expect(await errorsFor(ChangePasswordDto, { currentPassword: 'legacy', newPassword: 'Str0ng-Pass!9x' })).toEqual([]);
  });
});
