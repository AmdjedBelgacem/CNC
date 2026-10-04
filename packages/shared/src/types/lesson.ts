export type ContentLocale = 'en' | 'ar';

export type LocalizedContent<T> = Partial<Record<ContentLocale, T>>;

export interface CourseContentTranslation {
  title?: string;
  subtitle?: string | null;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
}

export interface SeriesContentTranslation {
  title?: string;
  description?: string | null;
}

export interface LessonContentTranslation {
  title?: string;
  description?: string | null;
}

export interface VideoBlockContent {
  source?: string | null;
  storageKey?: string | null;
  posterUrl?: string | null;
  captionsUrl?: string | null;
  transcript?: string | null;
}

export interface RichTextBlockContent {
  html?: string;
  text?: string;
  images?: Array<{ src: string; alt: string; caption?: string | null }>;
}

export interface InteractiveHotspot {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
  tooltip?: string | null;
  detail?: string | null;
}

export interface InteractiveImageBlockContent {
  src: string;
  alt: string;
  caption?: string | null;
  hotspots: InteractiveHotspot[];
}

export type QuizQuestionType = 'single' | 'multiple' | 'true_false';

export interface QuizOption {
  id: string;
  label: string;
}

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  options: QuizOption[];
  correctOptionIds?: string[];
  explanation?: string | null;
  points?: number;
}

export interface QuizBlockContent {
  passingScore: number;
  requiredToContinue: boolean;
  maxAttempts?: number | null;
  questions: QuizQuestion[];
}

export type LessonBlockContent =
  | VideoBlockContent
  | RichTextBlockContent
  | InteractiveImageBlockContent
  | QuizBlockContent;

export type LessonBlockType = 'video' | 'rich_text' | 'interactive_image' | 'quiz';

export interface LessonBlock {
  id: string;
  type: LessonBlockType;
  sortOrder: number;
  content: LessonBlockContent;
  translations?: LocalizedContent<Record<string, unknown>>;
}

export interface LessonContentDocument {
  schemaVersion: 1;
  blocks: LessonBlock[];
}

export interface PublicQuizQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  options: QuizOption[];
  points: number;
}

export interface PublicQuizBlockContent {
  passingScore: number;
  requiredToContinue: boolean;
  maxAttempts?: number | null;
  questions: PublicQuizQuestion[];
}

export interface PublicLessonBlock extends Omit<LessonBlock, 'content'> {
  content: Record<string, unknown>;
}

export interface QuizAttemptInput {
  answers: Record<string, string | string[]>;
}

export interface QuizQuestionResult {
  questionId: string;
  correct: boolean;
  explanation?: string | null;
}

export interface QuizAttemptResult {
  attemptId: string;
  score: number;
  passed: boolean;
  attemptNumber: number;
  results: QuizQuestionResult[];
}

export interface LessonLocaleMetadata {
  locale: ContentLocale;
  resolvedLocale: ContentLocale;
  availableLocales: ContentLocale[];
  fallbackFields: string[];
}
