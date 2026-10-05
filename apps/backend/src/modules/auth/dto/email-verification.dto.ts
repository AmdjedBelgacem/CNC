import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Email-address payloads.
 *
 * `forgot-password` and `resend-verification` already behaved correctly because a missing
 * `email` simply matched no user. `verify-email` did not: an absent `token` reached
 * `hashToken(undefined)`, which threw `UNDEFINED_VALUE` from `crypto` and surfaced as a 500
 * with a generic body. Login had the same class of bug and was fixed with `LoginDto`; these
 * are the remaining two.
 *
 * With a DTO and the global `ValidationPipe` (whitelist + forbidNonWhitelisted), malformed
 * input becomes a 400 that names the offending field, and unknown fields are rejected rather
 * than ignored.
 */
export class EmailOnlyDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  /**
   * Verification tokens are hex. Constraining the shape keeps a caller from feeding an
   * arbitrary megabyte string into the sha256 that looks it up.
   */
  @Matches(/^[a-f0-9]+$/i, { message: 'token must be a hexadecimal verification token' })
  token!: string;
}

export class ResendVerificationDto extends EmailOnlyDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  /** Tenant slug only, used to build the branded link; never interpolated into SQL. */
  tenantSlug?: string;
}
