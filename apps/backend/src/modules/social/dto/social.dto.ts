import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const HTTPS_URL = { protocols: ['https'], require_protocol: true };

/**
 * `PATCH /social/profile`.
 *
 * Only the public profile fields a member may edit. The handler used to take an inline type,
 * which the global ValidationPipe cannot whitelist, and the service spread it into `users` —
 * so `{"role":"super_admin"}` was a privilege escalation. Anything not declared here is now
 * rejected with a 400, and the service copies these keys one by one.
 */
export class UpdateSocialProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string;

  /** An https URL, or `''` / `null` to clear it. */
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsUrl(HTTPS_URL)
  @MaxLength(500)
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;
}

/** `POST /social/portfolio`. The owner is always the caller, never a body field. */
export class CreatePortfolioItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsUrl(HTTPS_URL)
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsUrl(HTTPS_URL)
  @MaxLength(500)
  projectUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];
}
