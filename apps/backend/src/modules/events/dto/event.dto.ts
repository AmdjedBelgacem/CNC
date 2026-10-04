import { PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsDateString,
  IsIn,
  IsObject,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export const EVENT_TYPES = ['workshop', 'webinar', 'conference', 'meetup', 'competition'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export class CreateEventDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(EVENT_TYPES)
  eventType?: EventType;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsObject()
  location?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isVirtual?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAttendees?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateEventDto extends PartialType(CreateEventDto) {}

export class AdminListEventsDto {
  @IsOptional()
  @IsIn(EVENT_TYPES)
  type?: EventType;

  @IsOptional()
  @IsIn(['draft', 'published', 'all'])
  status?: 'draft' | 'published' | 'all';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
