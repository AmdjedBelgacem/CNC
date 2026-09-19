import { IsString, IsOptional, IsNumber, IsBoolean, Min, Max, IsUUID, IsIn, IsObject, IsArray, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { type LessonVideoMeta } from '../../../database/schema/courses';

export class CreateCourseDto {
  @ApiProperty() @IsString() slug: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() academyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subtitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() thumbnailUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(5) difficulty?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() estimatedHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) priceCents?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['open', 'invite', 'paid']) accessMode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() trailerUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoKeywords?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ogImageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() autoIssueCertificate?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isArchived?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
}

export class UpdateCourseDto {
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() academyId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() subtitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() thumbnailUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(5) difficulty?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() estimatedHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) priceCents?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['open', 'invite', 'paid']) accessMode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() trailerUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoKeywords?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ogImageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() autoIssueCertificate?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isArchived?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
}

export class CreateSeriesDto {
  @ApiProperty() @IsUUID() courseId: string;
  @ApiProperty() @IsString() slug: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() thumbnailUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isArchived?: boolean;
}

export class UpdateSeriesDto {
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() thumbnailUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isArchived?: boolean;
}

export class CreateLessonDto {
  @ApiProperty() @IsUUID() seriesId: string;
  @ApiProperty() @IsString() slug: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() videoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() thumbnailUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsObject() videoMeta?: LessonVideoMeta | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() videoDuration?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() attachments?: { id: string; name: string; type: string; url: string; size: number }[] | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(5) difficulty?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isArchived?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() freePreview?: boolean;
}

export class UpdateLessonDto {
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() videoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() thumbnailUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsObject() videoMeta?: LessonVideoMeta | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() videoDuration?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() attachments?: { id: string; name: string; type: string; url: string; size: number }[] | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(5) difficulty?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isArchived?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() freePreview?: boolean;
}

export class LessonUploadUrlDto {
  @ApiProperty({ description: 'Original file name (used for the stored extension)' })
  @IsString()
  filename: string;

  @ApiProperty({ description: 'MIME type of the video' })
  @IsString()
  contentType: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsNumber()
  size: number;
}

export class LessonUploadDto {
  @ApiProperty({ description: 'Base64 data URL of the video (server-mediated fallback)' })
  @IsString()
  file: string;

  @ApiPropertyOptional({ description: 'Original file name' })
  @IsOptional()
  @IsString()
  filename?: string;
}

class ReorderSeriesItemDto {
  @IsUUID() id!: string;
  @IsInt() @Min(0) @Max(1000) sortOrder!: number;
}

class ReorderLessonItemDto {
  @IsUUID() id!: string;
  @IsUUID() seriesId!: string;
  @IsInt() @Min(0) @Max(1000) sortOrder!: number;
}

export class ReorderCurriculumDto {
  @ApiProperty({ type: () => ReorderSeriesItemDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderSeriesItemDto)
  series!: ReorderSeriesItemDto[];

  @ApiProperty({ type: () => ReorderLessonItemDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderLessonItemDto)
  lessons!: ReorderLessonItemDto[];
}

export class CourseFilterDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(5) difficulty?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() published?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() archived?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() academy?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() page?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() limit?: number;
}

export class UpdateProgressDto {
  @ApiProperty() @IsUUID() lessonId: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(360000) watchTimeSeconds?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() completed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) quizScore?: number;
}

export class EnrollDto {
  @ApiProperty() @IsUUID() courseId: string;
}

export class UploadFileDto {
  @ApiProperty({ description: 'Base64 data URL of the file' })
  @IsString()
  file: string;

  @ApiPropertyOptional({ description: 'Storage folder, e.g. "courses" or "lessons"' })
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiPropertyOptional({ description: 'Original file name' })
  @IsOptional()
  @IsString()
  name?: string;
}
