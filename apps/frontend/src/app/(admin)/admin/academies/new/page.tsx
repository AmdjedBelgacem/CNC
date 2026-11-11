'use client';
import { CreateEntityPage } from '@/components/admin/editor/create-entity';

/**
 * `/admin/academies/new` — kept for bookmarks and links. Creating asks only for a
 * name, an address and an accent colour, makes a draft and opens the editor, the
 * same as the New dialog on the academies list. Images, copy and courses are added
 * in the editor.
 */
export default function NewAcademyPage() {
  return <CreateEntityPage kind="academy" backHref="/admin/academies" />;
}
