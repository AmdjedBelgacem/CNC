/**
 * Course difficulty scale — one definition for the whole app.
 *
 * The backend validates difficulty as 1–5 (`difficultySchema` in
 * `@titan/shared`, `@Min(1) @Max(5)` on the course DTO, and Payload's
 * `'1' | '2' | '3' | '4' | '5'` union), so 1–5 is canonical.
 *
 * The admin previously declared its own labels in three separate places and
 * two of them only defined 1–3. That silently mislabelled every level-3 course
 * as "Advanced" on list screens while the Studio (which used the full scale)
 * called the same course "Intermediate", and levels 4–5 fell through to a
 * missing-translation error. Anything that renders a difficulty must use
 * `difficultyKey`/`difficultyTone` from here so the labels cannot drift again.
 *
 * English is the fallback in each entry so a missing translation degrades to a
 * readable label rather than a raw numeric key.
 */

export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

/** StatusPill tone per level, so a level always reads the same colour. */
export type DifficultyTone = 'emerald' | 'cyan' | 'amber' | 'rose' | 'purple';

const TONES: Record<DifficultyLevel, DifficultyTone> = {
  1: 'emerald',
  2: 'cyan',
  3: 'amber',
  4: 'rose',
  5: 'purple',
};

const FALLBACKS: Record<DifficultyLevel, string> = {
  1: 'Beginner',
  2: 'Elementary',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert',
};

/**
 * Message key for a level, namespaced by the caller's own translator.
 * Pass the `t` from `useTranslations(...)` that points at the shared
 * `admin.difficulty` block.
 */
export function difficultyKey(level: number | null | undefined): string {
  const clamped = clampDifficulty(level);
  return `difficulty.${clamped}`;
}

/** Coerce anything to a valid level; unknown values fall back to 1. */
export function clampDifficulty(level: number | null | undefined): DifficultyLevel {
  const found = DIFFICULTY_LEVELS.find((value) => value === level);
  return found ?? 1;
}

export function difficultyTone(level: number | null | undefined): DifficultyTone {
  return TONES[clampDifficulty(level)];
}

export function difficultyFallback(level: number | null | undefined): string {
  return FALLBACKS[clampDifficulty(level)];
}

/** True when the stored value is outside the 1–5 range the backend accepts. */
export function isDifficultyOutOfRange(level: number | null | undefined): boolean {
  return typeof level === 'number' && !DIFFICULTY_LEVELS.includes(level as DifficultyLevel);
}
