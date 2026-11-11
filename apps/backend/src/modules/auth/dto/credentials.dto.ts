import { registerDecorator, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, type ValidationOptions } from 'class-validator';

/**
 * The server's password policy, which mirrors `passwordSchema` in @titan/shared that the forms
 * use. Until now only the browser enforced it: these bodies were inline types, so a direct API
 * call could register with the password "abc".
 */
export const PASSWORD_POLICY_MESSAGE =
  'password must be 8 to 128 characters and include an uppercase letter, a lowercase letter and a number';

export function isStrongPassword(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    value.length <= 128 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value)
  );
}

export function IsStrongPassword(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isStrongPassword',
      target: target.constructor,
      propertyName,
      options: { message: PASSWORD_POLICY_MESSAGE, ...options },
      validator: { validate: isStrongPassword },
    });
}

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsStrongPassword()
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9_-]+$/, { message: 'username may only contain lowercase letters, numbers, hyphens and underscores' })
  username?: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  token!: string;

  @IsStrongPassword()
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  currentPassword!: string;

  @IsStrongPassword()
  newPassword!: string;
}
