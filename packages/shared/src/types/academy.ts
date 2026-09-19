import type { Course } from './course';

/** Public summary of an academy, as rendered on cards and index pages. */
export interface AcademySummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  heroImageUrl: string | null;
  logoUrl: string | null;
  seoImageUrl: string | null;
  accentColor: string | null;
  isPublished: boolean;
  isArchived: boolean;
  sortOrder: number;
  courseCount: number;
}

/** Public academy detail: summary fields plus its published course list. */
export interface AcademyDetail extends AcademySummary {
  seoTitle: string | null;
  seoDescription: string | null;
  courses: Course[];
}

/** Academy reference embedded on course payloads. */
export interface CourseAcademyRef {
  id: string;
  slug: string;
  title: string;
  accentColor: string | null;
}
