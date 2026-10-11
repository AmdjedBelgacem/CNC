import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
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
  @IsObject({ message: 'fields must be an object of label to text' })
  @Matches(/^[^{}]*$/, { message: 'fields must be a flat object of strings' })
  fields: Record<string, string>;

  @ApiPropertyOptional({ description: 'What these fields are, e.g. "course description"' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  entity?: string;
}
