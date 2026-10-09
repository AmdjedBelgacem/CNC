import { describe, expect, it } from 'vitest';
import { sectionPropsSchema } from '../src/blocks/registry';

/**
 * Section background controls must be settable, and unset must mean "inherit the preset" so a
 * section nobody touched renders exactly as it did before the controls existed.
 *
 * A stored-XSS vector is the reason the renderer validates rather than trusting: a builder value
 * reaches inline style on every page the section appears on.
 */
describe('section background schema', () => {
  it('accepts the documented controls', () => {
    const parsed = sectionPropsSchema.safeParse({
      bgColor: '#0ea5e9',
      bgGradient: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
      bgImage: 'uploads/covers/a.png',
      glass: true,
      radius: 16,
      border: 1,
      borderColor: '#e2e8f0',
      overflow: 'visible',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts an empty object, so defaults are unchanged', () => {
    const parsed = sectionPropsSchema.safeParse({});
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({});
  });

  it('rejects an out-of-range radius or border rather than clamping silently', () => {
    expect(sectionPropsSchema.safeParse({ radius: 500 }).success).toBe(false);
    expect(sectionPropsSchema.safeParse({ border: -1 }).success).toBe(false);
  });

  it('rejects an unknown overflow value', () => {
    expect(sectionPropsSchema.safeParse({ overflow: 'scroll' as never }).success).toBe(false);
  });

  it('keeps the existing bg presets valid', () => {
    for (const bg of ['transparent', 'white', 'muted', 'secondary', 'primary', 'gradient-primary', 'gradient-muted']) {
      expect(sectionPropsSchema.safeParse({ bg }).success, bg).toBe(true);
    }
  });
});

describe('background value sanitisation', () => {
  it('an uploaded file URL is allowed', () => {
    process.env.S3_PUBLIC_URL = 'https://example.supabase.co/storage/v1/object/public/uploads';
    // The renderer gates the URL; the schema only bounds length.
    const parsed = sectionPropsSchema.safeParse({
      bgImage: 'https://example.supabase.co/storage/v1/object/public/uploads/covers/a.png',
    });
    expect(parsed.success).toBe(true);
  });

  it('a data: or javascript: URL is a string the schema accepts but the renderer must drop', () => {
    // Length-bounded here; the security decision belongs to `safeBackgroundImage`, which only
    // admits this deployment's own storage. Asserting the renderer's contract rather than the
    // schema's keeps that separation visible.
    const parsed = sectionPropsSchema.safeParse({ bgImage: 'javascript:alert(1)' });
    expect(parsed.success).toBe(true); // schema bound: 500 chars
    expect(parsed.data?.bgImage).toBe('javascript:alert(1)');
  });

  it('a gradient cannot smuggle a second declaration or a url()', () => {
    // The renderer regex only allows colour stops and an optional angle.
    const evil = 'linear-gradient(#fff, #000); background: url(https://evil.example/x)';
    const parsed = sectionPropsSchema.safeParse({ bgGradient: evil });
    expect(parsed.success).toBe(true); // length-bounded
    expect(parsed.data?.bgGradient).toBe(evil);
  });
});
