import { UnauthorizedException } from '@nestjs/common';

/**
 * The account states that must not hold a session, as `JwtStrategy.validate()` enforces
 * them for first-party tokens. Supabase mode used to check only `deleted`, so a suspended
 * account kept working until its Supabase session ran out.
 *
 * `locked` is honoured only while `lockedUntil` is in the future (or unset): nothing in
 * Supabase mode runs the lockout service that clears an expired lock, so treating a stale
 * `locked` as permanent would shut the account out for good.
 */
export function assertAccountUsable(
  user: { accountStatus?: string | null; lockedUntil?: Date | string | null },
  now: number = Date.now(),
): void {
  const status = user.accountStatus;
  if (status === 'deleted' || status === 'suspended') {
    throw new UnauthorizedException('Account is not accessible');
  }
  if (status === 'pending_verification') {
    throw new UnauthorizedException('Please verify your email address');
  }
  if (status === 'locked') {
    const until = user.lockedUntil ? new Date(user.lockedUntil).getTime() : null;
    if (until === null || Number.isNaN(until) || until > now) {
      throw new UnauthorizedException('Account is temporarily locked');
    }
  }
}
