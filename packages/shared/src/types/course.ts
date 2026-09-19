export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface Course {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  difficulty: Difficulty;
  estimatedHours: number | null;
  isPublished: boolean;
  sortOrder: number;
  metadata: CourseMetadata | null;
  createdAt: Date;
  updatedAt: Date;
  series?: Series[];
}

export interface CourseMetadata {
  prerequisites?: string[];
  learningObjectives?: string[];
  requiredTools?: string[];
  relatedProducts?: string[];
  tags?: string[];
}

export interface Series {
  id: string;
  courseId: string;
  tenantId: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  isPublished: boolean;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  seriesId: string;
  tenantId: string;
  slug: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  videoDuration: number | null;
  content: string | null;
  attachments: Attachment[] | null;
  difficulty: Difficulty;
  isPublished: boolean;
  sortOrder: number;
  freePreview: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'cad' | 'dxf' | 'pdf' | 'spreadsheet' | 'image' | 'other';
  url: string;
  size: number;
  description?: string;
}

export interface Project {
  id: string;
  courseId: string;
  tenantId: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  difficulty: Difficulty;
  estimatedHours: number | null;
  materials: string[] | null;
  tools: string[] | null;
  files: Attachment[] | null;
  isPublished: boolean;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  tenantId: string;
  status: 'active' | 'completed' | 'paused';
  startedAt: Date;
  completedAt: Date | null;
  certificateId: string | null;
}

export interface LessonProgress {
  id: string;
  userId: string;
  lessonId: string;
  completed: boolean;
  watchTimeSeconds: number;
  quizScore: number | null;
  completedAt: Date | null;
}
