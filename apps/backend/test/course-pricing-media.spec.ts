import { describe, expect, it } from 'vitest';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateCourseDto } from '../src/modules/courses/dto/courses.dto';
import { FxRatesService } from '../src/modules/courses/fx-rates.service';
import { parseLessonContentDocument } from '../src/modules/courses/lesson-content';

const internalVideo = '/uploads/lessons/demo.mp4';
const internalImage = '/uploads/lesson-images/demo.png';

function interactiveBlock(src: string, hotspot = { id: 'h1', x: 50, y: 50, label: 'Point' }) {
  return {
    id: 'image-1',
    type: 'interactive_image' as const,
    sortOrder: 0,
    content: { src, alt: 'Diagram', hotspots: [hotspot] },
  };
}

describe('upload-only course media and SAR pricing', () => {
  it('accepts uploaded media references and rejects external links', () => {
    const document = parseLessonContentDocument({
      schemaVersion: 1,
      blocks: [
        { id: 'video-1', type: 'video', sortOrder: 0, content: { source: internalVideo } },
        { id: 'text-1', type: 'rich_text', sortOrder: 1, content: { text: 'Read', images: [{ src: internalImage, alt: 'Diagram' }] } },
        interactiveBlock(internalImage),
      ],
    });
    expect(document.blocks).toHaveLength(3);
    expect(() => parseLessonContentDocument({
      schemaVersion: 1,
      blocks: [{ id: 'video-1', type: 'video', sortOrder: 0, content: { source: 'https://cdn.example.test/video.mp4' } }],
    })).toThrow(BadRequestException);
    expect(() => parseLessonContentDocument({
      schemaVersion: 1,
      blocks: [interactiveBlock('https://cdn.example.test/diagram.png')],
    })).toThrow(BadRequestException);
  });

  it('keeps hotspot areas inside the image bounds', () => {
    expect(() => parseLessonContentDocument({
      schemaVersion: 1,
      blocks: [interactiveBlock(internalImage, { id: 'h1', x: 90, y: 90, width: 20, height: 20, label: 'Outside' })],
    })).toThrow(BadRequestException);
  });

  it('validates SAR and rejects external course resources at the DTO boundary', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    await expect(pipe.transform({ slug: 'course', title: 'Course', currency: 'SAR' }, { type: 'body', metatype: CreateCourseDto })).resolves.toMatchObject({ currency: 'SAR' });
    await expect(pipe.transform({ slug: 'course', title: 'Course', currency: 'BTC' }, { type: 'body', metatype: CreateCourseDto })).rejects.toThrow();
    await expect(pipe.transform({ slug: 'course', title: 'Course', metadata: { resources: [{ url: 'https://example.test/file.pdf' }] } }, { type: 'body', metatype: CreateCourseDto })).rejects.toThrow();
  });

  it('loads live rates and exposes SAR as the base currency', async () => {
    const config = { get: () => 'data:application/json,%7B%22rates%22%3A%7B%22USD%22%3A1%2C%22SAR%22%3A3.75%2C%22EUR%22%3A0.92%7D%7D' };
    const service = new FxRatesService(config as never);
    const result = await service.getRates('SAR');
    expect(result.base).toBe('SAR');
    expect(result.source).toBe('live');
    expect(result.rates.USD).toBeCloseTo(0.2667, 3);
    expect(result.rates.EUR).toBeCloseTo(0.2453, 3);
    expect(result.currencies).toContain('SAR');
  });
});
