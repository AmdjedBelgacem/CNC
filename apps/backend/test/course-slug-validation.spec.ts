import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateCourseDto, UpdateCourseDto, CreateLessonDto, CreateSeriesDto } from '../src/modules/courses/dto/courses.dto';

const SERIES_ID = '11111111-1111-4111-8111-111111111111';
const errorsFor = async (cls: any, body: Record<string, unknown>) =>
  (await validate(plainToInstance(cls, body))).filter((e) => e.property === 'slug');

describe('course, series and lesson slugs must be routable', () => {
  it.each(['aerospace machining-101', 'Upper-Case', 'has/slash', '-leading', 'double--hyphen', ''])(
    'rejects %j',
    async (slug) => {
      expect(await errorsFor(CreateCourseDto, { slug, title: 't' })).not.toHaveLength(0);
      expect(await errorsFor(UpdateCourseDto, { slug })).not.toHaveLength(0);
      expect(await errorsFor(CreateSeriesDto, { courseId: SERIES_ID, slug, title: 't' })).not.toHaveLength(0);
      expect(await errorsFor(CreateLessonDto, { seriesId: SERIES_ID, slug, title: 't' })).not.toHaveLength(0);
    },
  );

  it.each(['aerospace-machining-101', 'cnc', 'a1-b2-c3'])('accepts %j', async (slug) => {
    expect(await errorsFor(CreateCourseDto, { slug, title: 't' })).toHaveLength(0);
    expect(await errorsFor(UpdateCourseDto, { slug })).toHaveLength(0);
  });

  it('leaves an omitted slug on update alone', async () => {
    expect(await errorsFor(UpdateCourseDto, { title: 'only the title' })).toHaveLength(0);
  });

  it('rejects an over-long slug', async () => {
    expect(await errorsFor(CreateCourseDto, { slug: 'a'.repeat(101), title: 't' })).not.toHaveLength(0);
  });
});
