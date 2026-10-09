import type { LayoutProps } from '@titan/shared';
import { isUploadedMediaRef } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

/**
 * Section background treatments (absent/transparent = page default).
 *
 * These are coarse presets. `bgColor`, `bgGradient` and `bgImage` layer a specific look over
 * one, so an author is not limited to the presets and does not have to abandon them to fine-tune.
 */
const SECTION_BGS: Record<string, string> = {
  transparent: '',
  white: 'bg-surface-container-lowest',
  muted: 'bg-surface-container-low',
  secondary: 'bg-secondary/10',
  primary: 'bg-primary',
  'gradient-primary': 'bg-primary text-primary-foreground',
  'gradient-muted': 'bg-surface-container-low',
};

/** Colours a block is allowed to set, so a value cannot reach CSS unsanitised. */
const SAFE_COLOUR = /^(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\\([\\d.,\\s]+\\)|hsla?\\([\\d.,\\s]+\\)|oklch\\([\\d.,\\s]+\\)|transparent|currentColor)$/;

/** Gradients: two or three colour stops plus an optional angle, nothing else. */
const SAFE_GRADIENT = /^(?:linear|radial|conic)-gradient\\(\\s*(?:[\\d.]+deg\\s*)?(?:#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgba?|hsla?|oklch)\\([\\d.,\\s]+\\)|transparent|currentColor)(?:\\s+[\\d.]+%?)?(?:\\s*,\\s*(?:#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgba?|hsla?|oklch)\\([\\d.,\\s]+\\)|transparent|currentColor)(?:\\s+[\\d.]+%?)?)*\\s*\\)$/;

/**
 * A background image may only be a URL this deployment can serve.
 *
 * `isUploadedMediaRef` accepts app-relative upload paths and this deployment's own storage
 * bases, and rejects everything else — including `javascript:`, `data:`, protocol-relative and
 * third-party hosts. Without this, a style field would be a stored-XSS vector on every page the
 * builder touches.
 */
function safeBackgroundImage(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!isUploadedMediaRef(trimmed)) return undefined;
  return trimmed;
}

/** Coerces a free-text colour to a CSS value, or undefined when it does not match. */
function safeColour(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('#')) {
    if (!/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) return undefined;
    return trimmed;
  }
  return SAFE_COLOUR.test(trimmed) ? trimmed : undefined;
}

export function SectionBlock({ props, puck }: BlockComponentProps<LayoutProps>) {
  const { className, bg, hidden, bgColor, bgGradient, bgImage, glass, radius, border, borderColor, overflow } =
    props as LayoutProps & {
      bg?: string;
      hidden?: boolean;
      bgColor?: string;
      bgGradient?: string;
      bgImage?: string;
      glass?: boolean;
      radius?: number;
      border?: number;
      borderColor?: string;
      overflow?: 'hidden' | 'visible';
    };
  const id = (props as LayoutProps & { id?: string }).id;

  const colour = safeColour(bgColor) ?? safeColour(borderColor);
  const gradient = bgGradient?.trim() && SAFE_GRADIENT.test(bgGradient.trim()) ? bgGradient.trim() : undefined;
  const image = safeBackgroundImage(bgImage);

  const style = layoutStyle(props);

  /**
   * Layered so the author's look composes rather than replaces the preset. When only one of the
   * fine controls is set the preset still provides the base; when none are set this produces
   * exactly what it produced before.
   */
  if (colour) {
    if (border && borderColor && colour) style.border = `${border}px solid ${colour}`;
    if (bgColor) style.backgroundColor = colour;
  }
  if (gradient) style.backgroundImage = gradient;
  if (image) {
    style.backgroundImage = `url("${image}")`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
  }
  if (radius !== undefined && radius > 0) style.borderRadius = `${radius}px`;
  if (glass) {
    style.backgroundColor = 'color-mix(in srgb, currentColor 8%, transparent)';
    style.backdropFilter = 'blur(14px) saturate(140%)';
  }

  return (
    <section
      id={id}
      className={cn(
        SECTION_BGS[bg ?? 'transparent'],
        glass && 'border border-border/40',
        overflow === 'visible' ? 'overflow-visible' : 'overflow-hidden',
        hidden && 'hidden',
        className,
      )}
      style={style}
    >
      {' '}
      {puck.renderSlot('content')}{' '}
    </section>
  );
}