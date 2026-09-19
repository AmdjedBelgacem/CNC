import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAcademyDto {
  @ApiProperty() @IsString() slug: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) subtitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  // Images are upload-only: hero/logo/seo images must go through POST /admin/academies/:slug/images
  @ApiPropertyOptional() @IsOptional() @IsString() accentColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
}

export class UpdateAcademyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) subtitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  // Images are upload-only — PATCH with heroImageUrl/logoUrl/seoImageUrl is rejected.
  @ApiPropertyOptional() @IsOptional() @IsString() accentColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isArchived?: boolean;
}

export class AcademyImageUploadDto {
  @ApiProperty({ enum: ['hero', 'logo', 'seo'], description: 'Which academy image to set — hero (branding banner 1920x1080), logo (square/mark), seo (og:image 1200x630)' })
  @IsString()
  @IsIn(['hero', 'logo', 'seo'])
  kind!: 'hero' | 'logo' | 'seo';

  @ApiProperty({ description: 'Base64 data URL: data:image/png;base64,... (max 5MB decoded). No external URLs are accepted.' })
  @IsString()
  image!: string;

  @ApiPropertyOptional({ description: 'Optional original filename for extension hint' })
  @IsOptional()
  @IsString()
  filename?: string;
}

export class AssignCoursesDto {
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) courseSlugs: string[];
}
