import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Matches,
  IsObject,
  IsInt,
  Min,
} from 'class-validator';
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
