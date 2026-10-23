import { describe, expect, it } from 'vitest';
import { buildChatPayload } from '../src/hooks/use-ai-assistant';

describe('buildChatPayload Arabic dialect routing', () => {
  it('sends an explicit dialect and forces Arabic even for an English prompt', () => {
    const payload = buildChatPayload({
      message: 'Where is the store?',
      locale: 'en',
      arabicDialect: 'gulf',
    });
    expect(payload.arabicDialect).toBe('gulf');
    expect(payload.locale).toBe('ar');
  });

  it('treats auto as no preference and still detects Arabic text', () => {
    const auto = buildChatPayload({
      message: 'Where is the store?',
      locale: 'en',
      arabicDialect: 'auto',
    });
    expect(auto).not.toHaveProperty('arabicDialect');
    expect(auto.locale).toBe('en');

    const arabic = buildChatPayload({ message: 'وين المتجر؟', locale: 'en' });
    expect(arabic).not.toHaveProperty('arabicDialect');
    expect(arabic.locale).toBe('ar');
  });

  it('keeps the surrounding Arabic UI locale for short non-Arabic messages', () => {
    const payload = buildChatPayload({ message: 'CNC?', locale: 'ar' });
    expect(payload.locale).toBe('ar');
  });
});
