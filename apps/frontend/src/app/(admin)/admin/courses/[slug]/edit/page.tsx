import { CourseStudio } from '../../studio/CourseStudio';
export default async function EditCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CourseStudio slug={slug} />;
}
