import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateAcademyDto } from '../src/modules/academies/dto/academies.dto';
import { UpdatePageDto } from '../src/modules/builder/dto/builder.dto';

/**
 * `forbidNonWhitelisted` turns an unlisted property into a 400, so a field present in the schema
 * but missing from the DTO is not merely ignored — saving Arabic copy was impossible.
 */
describe('translation payloads reach the API', () => {
  it('accepts academy translations', () => {
    const dto = plainToInstance(UpdateAcademyDto, {
      title: 'A',
      translations: { ar: { title: 'أ', subtitle: 'ب' } },
    });
    expect(validateSync(dto)).toEqual([]);
    expect(dto.translations).toEqual({ ar: { title: 'أ', subtitle: 'ب' } });
  });

  it('accepts localized page layouts', () => {
    const dto = plainToInstance(UpdatePageDto, {
      title: 'P',
      translations: { ar: { title: 'ص', layout: { version: '1', blocks: [] } } },
    });
    expect(validateSync(dto)).toEqual([]);
    expect(dto.translations?.ar?.title).toBe('ص');
  });

  it('still rejects a non-object translations value', () => {
    const dto = plainToInstance(UpdatePageDto, { translations: 'nope' as never });
    expect(validateSync(dto).map((e) => e.property)).toContain('translations');
  });

  it('still enforces the page slug rule', () => {
    const dto = plainToInstance(UpdatePageDto, { slug: 'Bad Slug' });
    expect(validateSync(dto).map((e) => e.property)).toContain('slug');
  });
});
