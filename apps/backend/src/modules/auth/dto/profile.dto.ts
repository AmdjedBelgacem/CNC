import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';
import { themeTokensSchema } from '@titan/shared';

/** Empty strings from a form mean "leave unchanged", not "set to empty". */
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/**
 * `PATCH /auth/me`. The body used to be an inline type, which the ValidationPipe cannot see,
 * so anything (including `avatarUrl` pointing anywhere) reached `users`. Avatars and covers
 * are set by the upload endpoints only; they are deliberately not accepted here.
 *
 * The username pattern also admits `.`, because `deriveUsername` produces dotted handles
 * from email local-parts and the profile form sends the current username back unchanged.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  // Either case: accounts created before this rule may hold uppercase handles, and the
  // profile form sends the current username back, so a lowercase-only rule would stop
  // those people saving any profile change.
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'username may only contain letters, numbers, dots, hyphens and underscores',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/, { message: 'language must be a language code' })
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_+\-/]+$/, { message: 'timezone must be an IANA time zone name' })
  timezone?: string;
}

export const THEME_MODES = ['system', 'light', 'dark'] as const;
export const DENSITIES = ['comfortable', 'compact'] as const;
export const PROFILE_VISIBILITIES = ['public', 'followers', 'private'] as const;
export const WHO_CAN_MESSAGE = ['everyone', 'followers', 'none'] as const;
export const WHO_CAN_FOLLOW = ['everyone', 'approval'] as const;

/** A flat `{ key: boolean }` map with sane keys, as the notification settings store. */
export function isBooleanMap(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 50) return false;
  return entries.every(([k, v]) => /^[A-Za-z0-9_]{1,64}$/.test(k) && typeof v === 'boolean');
}

function IsBooleanMap(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isBooleanMap',
      target: target.constructor,
      propertyName,
      options: { message: `${propertyName} must be an object of boolean flags`, ...options },
      validator: { validate: isBooleanMap },
    });
}

/** `null` clears the personal theme; anything else must satisfy the shared token schema. */
function IsThemeTokensOrNull(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isThemeTokensOrNull',
      target: target.constructor,
      propertyName,
      options: { message: 'themeTokens must be valid theme tokens or null', ...options },
      validator: {
        validate: (value: unknown) =>
          value === undefined || value === null || themeTokensSchema.safeParse(value).success,
      },
    });
}

/**
 * `PUT /auth/me/preferences`. Was `@Body() body: any` spread into the insert, so
 * `{ "userId": "<someone else>" }` wrote another account's preferences.
 */
export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(THEME_MODES)
  theme?: (typeof THEME_MODES)[number];

  @IsOptional()
  @IsIn(DENSITIES)
  density?: (typeof DENSITIES)[number];

  @IsOptional()
  @IsIn(PROFILE_VISIBILITIES)
  profileVisibility?: (typeof PROFILE_VISIBILITIES)[number];

  @IsOptional()
  @IsIn(WHO_CAN_MESSAGE)
  whoCanMessage?: (typeof WHO_CAN_MESSAGE)[number];

  @IsOptional()
  @IsIn(WHO_CAN_FOLLOW)
  whoCanFollow?: (typeof WHO_CAN_FOLLOW)[number];

  @IsOptional()
  @IsBooleanMap()
  emailNotifications?: Record<string, boolean>;

  @IsOptional()
  @IsBooleanMap()
  inAppNotifications?: Record<string, boolean>;

  // Not @IsOptional: that would skip validation for `null`; the validator accepts undefined itself.
  @IsThemeTokensOrNull()
  themeTokens?: unknown;
}
