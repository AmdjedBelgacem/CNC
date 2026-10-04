'use client';
import {
  BookOpen,
  Boxes,
  Droplets,
  Factory,
  Gauge,
  Monitor,
  Package,
  Ruler,
  Scissors,
  Shirt,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Tone } from './admin-ui';

/**
 * Category identity for the catalogue.
 *
 * No product in this tenant has a thumbnail, so a grid of products would be a
 * grid of identical placeholders. The category is the only attribute that
 * genuinely distinguishes them, so each one is given an icon and a colour and
 * the fallback is a deterministic hue rather than the same grey box repeated.
 */
export interface CategoryStyle {
  icon: LucideIcon;
  tone: Tone;
  /** Hue used for the tile gradient, so a category keeps a stable colour. */
  hue: number;
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  'tool kits': { icon: Boxes, tone: 'blue', hue: 214 },
  tooling: { icon: Wrench, tone: 'blue', hue: 199 },
  'cutting tools': { icon: Scissors, tone: 'rose', hue: 344 },
  'hand tools': { icon: Wrench, tone: 'amber', hue: 32 },
  workholding: { icon: Factory, tone: 'purple', hue: 268 },
  measurement: { icon: Ruler, tone: 'cyan', hue: 187 },
  machines: { icon: Factory, tone: 'slate', hue: 215 },
  coolant: { icon: Droplets, tone: 'cyan', hue: 198 },
  digital: { icon: Monitor, tone: 'emerald', hue: 158 },
  reference: { icon: BookOpen, tone: 'amber', hue: 42 },
  merch: { icon: Shirt, tone: 'purple', hue: 300 },
  'shop organization': { icon: Package, tone: 'slate', hue: 240 },
  safety: { icon: Gauge, tone: 'amber', hue: 20 },
  gifts: { icon: Package, tone: 'rose', hue: 330 },
};

function hueFor(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) % 360;
  return h;
}

export function categoryStyle(category?: string | null): CategoryStyle {
  const key = (category ?? '').trim().toLowerCase();
  if (key && CATEGORY_STYLES[key]) return CATEGORY_STYLES[key];
  // Uncategorised, or a category added later: still stable and distinguishable.
  return {
    icon: Package,
    tone: 'slate',
    hue: key ? hueFor(key) : hueFor('uncategorised'),
  };
}
