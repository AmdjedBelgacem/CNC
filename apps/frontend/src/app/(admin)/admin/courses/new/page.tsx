'use client';
import { CreateEntityPage } from '@/components/admin/editor/create-entity';

/**
 * `/admin/courses/new` — kept for bookmarks and links. Creating asks only for what
 * defines a course (name, academy, starting outline), makes a draft and opens the
 * Course Studio, the same as the New dialog on the courses list.
 */
export default function NewCoursePage() {
  return <CreateEntityPage kind="course" backHref="/admin/courses" />;
}
