import { passwordSchema } from '@titan/shared';

/**
 * Whether a password meets the policy the server enforces: 8 to 128 characters with an
 * uppercase letter, a lowercase letter and a number. Both sides read the same rule from
 * @titan/shared so the form can say no before the request does.
 */
export function meetsPasswordPolicy(password: string): boolean {
  return passwordSchema.safeParse(password).success;
}
