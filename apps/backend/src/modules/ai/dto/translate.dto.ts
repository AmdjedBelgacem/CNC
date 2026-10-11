import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class TranslateFieldsDto {
  @ApiProperty({ enum: ['en'], description: 'Only English can be the source' })
  @IsIn(['en'], { message: 'sourceLocale must be "en"' })
  sourceLocale: string;

  @ApiProperty({ enum: ['ar'] })
  @IsIn(['ar'], { message: 'targetLocale must be "ar"' })
  targetLocale: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Field label to English source text',
    example: { title: 'CNC Fundamentals', description: 'Learn the basics.' },
  })
  /**
   * `label -> English text`.
   *
   * Only `@IsObject` applies here. A `@Matches` guard was tried and rejected every request with
   * "fields must be a flat object of strings" — `@Matches` only accepts a string, so it fails on
   * any object at all. The value types are checked per entry in the service instead, where the
   * offending key can be named.
   */
  @IsObject({ message: 'fields must be an object of label to text' })
  fields: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'What these fields are, e.g. "course description"' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  entity?: string;
}
