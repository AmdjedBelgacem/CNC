import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Login used to accept an unvalidated inline body type, so `{}` reached the
 * service and surfaced as a 500 from the database layer. A real DTO turns
 * malformed credentials into a 400 and keeps the throttle/2FA paths honest.
 */
export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberDevice?: boolean;
}
