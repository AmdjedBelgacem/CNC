import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Matches,
  IsObject,
  IsInt,
  IsBoolean,
  IsIn,
  IsArray,
  Min,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PAGE_TEMPLATES } from '@titan/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePageDto {
  @ApiProperty({ description: 'URL slug for the page (lowercase, hyphens)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase alphanumeric with hyphens' })
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Starting layout', enum: PAGE_TEMPLATES })
  @IsOptional()
  @IsIn(PAGE_TEMPLATES as unknown as string[])
  template?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showInNav?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string | null;

  @ApiPropertyOptional({ description: 'Seed the new page from an existing page layout' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  copyFromSlug?: string;
}

export class UpdatePageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'New URL slug. Rejected for built-in pages.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase alphanumeric with hyphens' })
  slug?: string;

  @ApiPropertyOptional({ enum: ['draft', 'published', 'disabled'] })
  @IsOptional()
  @IsIn(['draft', 'published', 'disabled'])
  status?: 'draft' | 'published' | 'disabled';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showInNav?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string | null;
}

export class DuplicatePageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}

/* ------------------------------------------------------------- navigation */

export class NavItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @ApiPropertyOptional({ description: 'Arabic label. Falls back to the English one.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  labelAr?: string | null;

  @ApiProperty({ enum: ['page', 'url', 'group'] })
  @IsIn(['page', 'url', 'group'])
  type!: 'page' | 'url' | 'group';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  href?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pageSlug?: string | null;

  @ApiPropertyOptional({ type: [NavItemDto], isArray: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => NavItemDto)
  @ArrayMaxSize(30)
  children?: NavItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  icon?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;
}

export class SaveNavigationDto {
  @ApiProperty({ type: [NavItemDto], isArray: true })
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => NavItemDto)
  items!: NavItemDto[];
}

export class SavePageDto {
  @ApiProperty({ description: 'Puck layout tree (validated against the shared block registry)' })
  @IsObject()
  layout!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}

export class PublishDto {
  @ApiPropertyOptional({
    description: 'Current Puck layout. When supplied, the draft is saved and published atomically.',
  })
  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Optional note attached to the version snapshot' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RevertDto {
  @ApiProperty({ description: 'Version number to restore' })
  @IsInt()
  @Min(1)
  version!: number;
}

export class SaveThemeDto {
  @ApiProperty({ description: 'Theme tokens (light/dark color sets, radius, glass, fonts)' })
  @IsObject()
  tokens!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}

export class SaveSavedSectionDto {
  @ApiProperty({ description: 'Display name of the saved section' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ description: 'The container node (usually a section) being saved' })
  @IsObject()
  node!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Legacy DropZone-era zone entries, keyed "<nodeId>:<slot>". Accepted on write for backwards compatibility and merged inline; new clients send slot children inside the node.' })
  @IsOptional()
  @IsObject()
  zones?: Record<string, unknown[]>;
}

export class RenameSavedSectionDto {
  @ApiProperty({ description: 'New display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;
}
