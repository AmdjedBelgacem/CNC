import { describe, expect, it } from 'vitest';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateCourseDto } from '../src/modules/courses/dto/courses.dto';
import { CoursesService } from '../src/modules/courses/courses.service';
import {
  extractLessonBlockText,
  gradeQuizBlock,
  localizeCourseFields,
  localizeLessonDocument,
  parseLessonContentDocument,
  redactPublicLessonBlocks,
  resolveContentLocale,
} from '../src/modules/courses/lesson-content';

const quizDocument = {
  schemaVersion: 1 as const,
  blocks: [
    {
      id: 'quiz-1',
      type: 'quiz' as const,
      sortOrder: 0,
      content: {
        passingScore: 50,
        requiredToContinue: true,
        questions: [
          {
            id: 'q1',
            type: 'single' as const,
            prompt: 'Choose one',
            options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
            correctOptionIds: ['a'],
            explanation: 'A is correct',
            points: 1,
          },
          {
            id: 'q2',
            type: 'multiple' as const,
            prompt: 'Choose all',
            options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }],
            correctOptionIds: ['a', 'c'],
            points: 3,
          },
        ],
      },
    },
  ],
};

describe('lesson content contracts', () => {
  it('resolves locale headers before cookie and accept-language', () => {
    expect(resolveContentLocale({
      headers: {
        'x-locale': 'ar',
        cookie: 'NEXT_LOCALE=en',
        'accept-language': 'en-US,en;q=0.9',
      },
    })).toBe('ar');
    expect(resolveContentLocale({ headers: { cookie: 'NEXT_LOCALE=ar', 'accept-language': 'en' } })).toBe('ar');
    expect(resolveContentLocale({ headers: { 'accept-language': 'fr-FR,ar;q=0.8,en;q=0.5' } })).toBe('ar');
  });

  it('uses the shared validator and rejects invalid block documents', () => {
    expect(parseLessonContentDocument(quizDocument).blocks[0]?.id).toBe('quiz-1');
    expect(() => parseLessonContentDocument({
      schemaVersion: 1,
      blocks: [{
        id: 'bad',
        type: 'quiz',
        sortOrder: 0,
        content: {
          passingScore: 50,
          requiredToContinue: true,
          questions: [{
            id: 'q1',
            type: 'single',
            prompt: 'Question',
            options: [{ id: 'a', label: 'A' }],
            correctOptionIds: ['missing'],
          }],
        },
      }],
    })).toThrow(BadRequestException);
  });

  it('redacts quiz answer keys and gated blocks from public content', () => {
    const document = parseLessonContentDocument({
      ...quizDocument,
      blocks: [
        ...quizDocument.blocks,
        {
          id: 'gated',
          type: 'rich_text',
          sortOrder: 1,
          content: { text: 'Private text', gated: true },
        },
      ],
    });
    const publicDocument = redactPublicLessonBlocks(document, 'en', false);
    expect(publicDocument.blocks).toHaveLength(1);
    const serialized = JSON.stringify(publicDocument);
    expect(serialized).not.toContain('correctOptionIds');
    expect(serialized).not.toContain('A is correct');
    expect(serialized).not.toContain('Private text');
  });

  it('falls back field by field and localizes block content', () => {
    const course = localizeCourseFields({
      title: 'English title',
      description: 'English description',
      translations: { ar: { title: 'عنوان' } },
    }, 'ar');
    expect(course.value.title).toBe('عنوان');
    expect(course.value.description).toBe('English description');
    expect(course.metadata.resolvedLocale).toBe('ar');
    expect(course.metadata.fallbackFields).toContain('description');
    const document = localizeLessonDocument(parseLessonContentDocument({
      schemaVersion: 1,
      blocks: [{
        id: 'rich',
        type: 'rich_text',
        sortOrder: 0,
        content: { text: 'English text', html: '<p>English</p>' },
        translations: { ar: { text: 'نص' } },
      }],
    }), 'ar');
    expect((document.blocks[0]?.content as Record<string, unknown>).text).toBe('نص');
    expect((document.blocks[0]?.content as Record<string, unknown>).html).toBe('<p>English</p>');
  });

  it('rejects invalid translation documents at the DTO boundary', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    await expect(pipe.transform({
      slug: 'course',
      title: 'Course',
      translations: { fr: { title: 'Cours' } },
    }, { type: 'body', metatype: CreateCourseDto })).rejects.toThrow();
  });

  it('rejects quiz grading across tenant boundaries before lookup', async () => {
    const service = new CoursesService({} as any, {} as any);
    await expect(service.gradeQuizAttempt(
      'tenant-a',
      { id: 'user-a', role: 'student', tenantId: 'tenant-b' },
      'course',
      'lesson',
      'quiz',
      {},
    )).rejects.toThrow('Tenant access denied');
  });

  it('grades weighted questions and exact multiple-choice sets', () => {
    const result = gradeQuizBlock(parseLessonContentDocument(quizDocument).blocks[0]!, {
      q1: 'a',
      q2: ['c', 'a'],
    });
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(extractLessonBlockText(parseLessonContentDocument(quizDocument))).not.toContain('correctOptionIds');
    expect(extractLessonBlockText(parseLessonContentDocument(quizDocument))).not.toContain('A is correct');
  });
});
