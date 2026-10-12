import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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


export class TranslateGroupDto {
  @ApiProperty({ description: 'Caller-supplied key echoed back on the result, e.g. a lesson id.' })
  @IsString()
  @MaxLength(120)
  key!: string;

  @ApiProperty({ description: 'Label -> English source text.' })
  @IsObject()
  fields!: Record<string, string>;
}

export class TranslateFieldGroupsDto {
  @ApiProperty({ enum: ['en'] })
  @IsIn(['en'])
  sourceLocale!: 'en';

  @ApiProperty({ enum: ['ar'] })
  @IsIn(['ar'])
  targetLocale!: 'ar';

  @ApiProperty({ type: [TranslateGroupDto] })
  @IsArray()
  @ArrayMaxSize(200, { message: 'Too many items in one request — translate in batches' })
  @ValidateNested({ each: true })
  @Type(() => TranslateGroupDto)
  groups!: TranslateGroupDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  entity?: string;
}
