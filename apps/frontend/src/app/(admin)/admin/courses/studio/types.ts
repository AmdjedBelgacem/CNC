import type {
  ContentLocale,
  CourseContentTranslation,
  LessonContentDocument,
  LessonContentTranslation,
  SeriesContentTranslation,
} from '@titan/shared';

export type AccessMode = 'open' | 'invite' | 'paid';
export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
}
export interface LessonVideoMeta {
  key: string;
  size: number;
  contentType: string;
  filename: string;
}
export interface Lesson {
  id: string;
  seriesId: string;
  slug: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  videoMeta: LessonVideoMeta | null;
  videoDuration: number | null;
  content: string | null;
  contentBlocks?: LessonContentDocument | null;
  translations?: Partial<Record<ContentLocale, LessonContentTranslation>> | null;
  attachments: Attachment[] | null;
  difficulty: number;
  isPublished: boolean;
  isArchived: boolean;
  sortOrder: number;
  freePreview: boolean;
}
export interface Section {
  id: string;
  courseId: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  isPublished: boolean;
  isArchived: boolean;
  translations?: Partial<Record<ContentLocale, SeriesContentTranslation>> | null;
  lessons: Lesson[];
}
export interface CourseStudioData {
  id: string;
  slug: string;
  title: string;
  academyId: string | null;
  academy: { id: string; slug: string; title: string; accentColor: string | null } | null;
  subtitle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  difficulty: number;
  estimatedHours: number | null;
  priceCents: number | null;
  currency: string;
  accessMode: AccessMode;
  trailerUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  ogImageUrl: string | null;
  autoIssueCertificate: boolean;
  isPublished: boolean;
  isArchived: boolean;
  publishedAt: string | null;
  metadata: Record<string, unknown> | null;
  translations?: Partial<Record<ContentLocale, CourseContentTranslation>> | null;
  locale?: ContentLocale;
  resolvedLocale?: ContentLocale;
  availableLocales?: ContentLocale[];
  fallbackFields?: string[];
  localeMetadata?: {
    locale: ContentLocale;
    resolvedLocale: ContentLocale;
    availableLocales: ContentLocale[];
    fallbackFields: string[];
  } | null;
  series: Section[];
}
