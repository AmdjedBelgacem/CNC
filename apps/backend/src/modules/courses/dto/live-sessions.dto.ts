import { IsISO8601, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidatorConstraint, ValidatorConstraintInterface, registerDecorator, ValidationArguments } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Google Meet allowlist: the link is the only credential we hand to learners, so
 * anything that is not an https meet.google.com room is rejected at save time.
 * Room codes are lowercase letters/digits joined by hyphens (abc-defg-hij);
 * custom-named rooms are longer but follow the same charset.
 */
export function isValidMeetUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'meet.google.com'
      && /^[a-z0-9-]{3,40}$/.test(url.pathname.replace(/^\//, '').replace(/\/$/, ''))
      && !url.username && !url.password && !url.search;
  } catch {
    return false;
  }
}

@ValidatorConstraint({ name: 'meetUrl', async: false })
export class MeetUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (value === undefined || value === null || value === '') return true;
    return isValidMeetUrl(value);
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a Google Meet URL like https://meet.google.com/abc-defg-hij`;
  }
}

function IsMeetUrl() {
  return function decorate(object: object, propertyName: string) {
    registerDecorator({
      name: 'meetUrl',
      target: object.constructor,
      propertyName,
      options: { message: 'meetUrl must be a Google Meet URL like https://meet.google.com/abc-defg-hij' },
      validator: MeetUrlConstraint,
    });
  };
}

export class CreateLiveSessionDto {
  @ApiProperty() @IsString() @MaxLength(300) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() seriesId?: string;
  @ApiProperty({ description: 'ISO 8601 datetime (UTC or with offset)' }) @IsISO8601() startsAt: string;
  @ApiProperty({ description: 'ISO 8601 datetime, must be after startsAt' }) @IsISO8601() endsAt: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @ApiPropertyOptional({ description: 'Google Meet URL (https://meet.google.com/...)' })
  @IsOptional() @IsString() @IsMeetUrl() meetUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100000) capacity?: number;
}

export class UpdateLiveSessionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() seriesId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() endsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @ApiPropertyOptional({ description: 'Google Meet URL; omit to keep, null to clear' })
  @IsOptional() @IsString() @IsMeetUrl() meetUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100000) capacity?: number | null;
}
