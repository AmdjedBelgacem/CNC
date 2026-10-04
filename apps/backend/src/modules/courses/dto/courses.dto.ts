import { IsString, IsOptional, IsNumber, IsBoolean, Min, Max, MaxLength, Matches, IsUUID, IsIn, IsObject, IsArray, IsInt, ValidateNested, ValidatorConstraint, ValidatorConstraintInterface, registerDecorator, ValidationArguments } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { type LessonVideoMeta } from '../../../database/schema/courses';
import { CURRENCY_CODES, courseTranslationsSchema, lessonContentDocumentSchema, lessonTranslationsSchema, seriesTranslationsSchema } from '@titan/shared';
import type { CourseContentTranslation, LessonBlock, LessonContentDocument, LessonContentTranslation, SeriesContentTranslation } from '@titan/shared';
import type { z } from 'zod';

const uploadedMediaPattern = /^(?:tenants\/|uploads\/|\/uploads\/|\/images\/)[A-Za-z0-9._/-]+$/;

function IsLessonZodSchema(schema: z.ZodTypeAny) {
  return function decorate(object: object, propertyName: string) {
    registerDecorator({
      name: 'lessonZodSchema',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} is invalid` },
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null) return true;
          return schema.safeParse(value).success;
        },
        defaultMessage() {
          return `${propertyName} is invalid`;
        },
      },
    });
  };
}

@ValidatorConstraint({ name: 'lessonDocumentBlocks', async: false })
class LessonDocumentBlocksConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return lessonContentDocumentSchema.safeParse({ schemaVersion: 1, blocks: value }).success;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} contains an invalid lesson block document`;
  }
}

function IsLessonDocumentBlocks() {
  return function decorate(object: object, propertyName: string) {
    registerDecorator({
      name: 'lessonDocumentBlocks',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} contains an invalid lesson block document` },
      validator: LessonDocumentBlocksConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'uploadedCourseMetadata', async: false })
class UploadedCourseMetadataConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const resources = (value as Record<string, unknown>).resources;
    if (resources === undefined) return true;
    return Array.isArray(resources) && resources.every((resource) => {
      if (!resource || typeof resource !== 'object' || Array.isArray(resource)) return false;
      const url = (resource as Record<string, unknown>).url;
      return typeof url === 'string' && (url.length === 0 || uploadedMediaPattern.test(url));
    });
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} resources must reference uploaded workspace files`;
  }
}

function IsUploadedCourseMetadata() {
  return function decorate(object: object, propertyName: string) {
    registerDecorator({
      name: 'uploadedCourseMetadata',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} resources must reference uploaded workspace files` },
      validator: UploadedCourseMetadataConstraint,
    });
  };
}

export class CreateCourseDto {
  @ApiProperty() @IsString() slug: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() academyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subtitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) @Matches(uploadedMediaPattern) thumbnailUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(5) difficulty?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() estimatedHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) priceCents?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['open', 'invite', 'paid']) accessMode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3) @IsIn(CURRENCY_CODES) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) @Matches(uploadedMediaPattern) trailerUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoKeywords?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) @Matches(uploadedMediaPattern) ogImageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() autoIssueCertificate?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsObject() @IsUploadedCourseMetadata() metadata?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() @IsLessonZodSchema(courseTranslationsSchema) translations?: Partial<Record<'en' | 'ar', CourseContentTranslation>> | null;
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
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) @Matches(uploadedMediaPattern) thumbnailUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(5) difficulty?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() estimatedHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) priceCents?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['open', 'invite', 'paid']) accessMode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3) @IsIn(CURRENCY_CODES) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) @Matches(uploadedMediaPattern) trailerUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seoKeywords?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) @Matches(uploadedMediaPattern) ogImageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() autoIssueCertificate?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsObject() @IsUploadedCourseMetadata() metadata?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() @IsLessonZodSchema(courseTranslationsSchema) translations?: Partial<Record<'en' | 'ar', CourseContentTranslation>> | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isArchived?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
}

export class CreateSeriesDto {
  @ApiProperty() @IsUUID() courseId: string;
  @ApiProperty() @IsString() slug: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() @IsLessonZodSchema(seriesTranslationsSchema) translations?: Partial<Record<'en' | 'ar', SeriesContentTranslation>> | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) @Matches(uploadedMediaPattern) thumbnailUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isArchived?: boolean;
}

export class UpdateSeriesDto {
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() @IsLessonZodSchema(seriesTranslationsSchema) translations?: Partial<Record<'en' | 'ar', SeriesContentTranslation>> | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) @Matches(uploadedMediaPattern) thumbnailUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isArchived?: boolean;
}

class UploadedAttachmentDto {
  @IsString() @MaxLength(100) id!: string;
  @IsString() @MaxLength(300) name!: string;
  @IsString() @MaxLength(100) type!: string;
  @IsString() @MaxLength(500) @Matches(uploadedMediaPattern) url!: string;
  @IsInt() @Min(0) size!: number;
}

export class CreateLessonDto {
  @ApiProperty() @IsUUID() seriesId: string;
  @ApiProperty() @IsString() slug: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) @Matches(uploadedMediaPattern) videoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) @Matches(uploadedMediaPattern) thumbnailUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsObject() videoMeta?: LessonVideoMeta | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() videoDuration?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() @IsLessonZodSchema(lessonTranslationsSchema) translations?: Partial<Record<'en' | 'ar', LessonContentTranslation>> | null;
  @ApiPropertyOptional() @IsOptional() @IsObject() @IsLessonZodSchema(lessonContentDocumentSchema) contentBlocks?: LessonContentDocument | null;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => UploadedAttachmentDto) attachments?: UploadedAttachmentDto[] | null;
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
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) @Matches(uploadedMediaPattern) videoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) @Matches(uploadedMediaPattern) thumbnailUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsObject() videoMeta?: LessonVideoMeta | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() videoDuration?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() @IsLessonZodSchema(lessonTranslationsSchema) translations?: Partial<Record<'en' | 'ar', LessonContentTranslation>> | null;
  @ApiPropertyOptional() @IsOptional() @IsObject() @IsLessonZodSchema(lessonContentDocumentSchema) contentBlocks?: LessonContentDocument | null;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => UploadedAttachmentDto) attachments?: UploadedAttachmentDto[] | null;
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

export class LessonBlockBodyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() id?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['video', 'rich_text', 'interactive_image', 'quiz']) type?: LessonBlock['type'];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(1000) sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsObject() content?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() translations?: Record<string, Record<string, unknown>>;
}

export class CreateLessonBlockDto extends LessonBlockBodyDto {
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => LessonBlockBodyDto) block?: LessonBlockBodyDto;
}

export class UpdateLessonBlockDto extends LessonBlockBodyDto {}

export class LessonContentDocumentDto {
  @IsOptional() @IsInt() @Min(1) @Max(1) schemaVersion?: 1;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LessonBlockBodyDto) @IsLessonDocumentBlocks() blocks!: LessonBlockBodyDto[];
}

export class ReorderLessonBlockItemDto {
  @IsString() id!: string;
  @IsInt() @Min(0) @Max(1000) sortOrder!: number;
}

export class ReorderLessonBlocksDto {
  @ApiPropertyOptional({ type: () => ReorderLessonBlockItemDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderLessonBlockItemDto)
  blocks?: ReorderLessonBlockItemDto[];

  @ApiPropertyOptional({ type: () => ReorderLessonBlockItemDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderLessonBlockItemDto)
  items?: ReorderLessonBlockItemDto[];
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
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5) difficulty?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() published?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() archived?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() academy?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() limit?: number;
}

export class UpdateProgressDto {
  @ApiProperty() @IsUUID() lessonId: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(360000) watchTimeSeconds?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() completed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) quizScore?: number;
}

export class QuizAttemptDto {
  @ApiProperty({ type: Object })
  @IsObject()
  answers!: Record<string, string | string[]>;
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
