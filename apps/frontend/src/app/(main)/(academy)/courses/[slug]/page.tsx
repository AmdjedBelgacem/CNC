import { notFound } from 'next/navigation';
import Link from 'next/link';
import { DifficultyBar } from '@/components/academy/difficulty-bar';
import { ArrowLeft, Clock, Play, FileDown, Award } from 'lucide-react';
import { EnrollButton } from './enroll-button';
import { ProgressSection } from './progress-section';
import { LessonRow } from './lesson-row';
import { CourseProductsSidebar } from '@/components/store/course-products-sidebar';
import { ProductCarousel } from '@/components/store/product-carousel';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
interface LessonData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  videoDuration: number | null;
  difficulty: number;
  freePreview: boolean;
  sortOrder: number;
  isPublished: boolean;
}
interface SeriesData {
  id: string;
  title: string;
  slug: string;
  sortOrder: number;
  lessons?: LessonData[];
}
interface CourseData {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  difficulty: number;
  estimatedHours: number | null;
  isPublished: boolean;
  series?: SeriesData[];
}
async function getCourse(slug: string): Promise<CourseData | null> {
  try {
    const cookie =
      process.env.NODE_ENV === 'development' ? `x-tenant-slug=${DEFAULT_TENANT_SLUG}` : '';
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/courses/${slug}`,
      { headers: { cookie, 'x-tenant-slug': DEFAULT_TENANT_SLUG }, next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
export default async function CourseDetailPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const course = await getCourse(slug);
  if (!course) notFound();
  const lessonCount = course.series?.reduce((sum, s) => sum + (s.lessons?.length || 0), 0) || 0;
  const totalDuration =
    course.series?.reduce(
      (sum, s) => sum + (s.lessons?.reduce((ls, l) => ls + (l.videoDuration || 0), 0) || 0),
      0,
    ) || 0;
  return (
    <div className="min-h-screen">
      {' '}
      <div className="border-b bg-secondary/20">
        {' '}
        <div className="container mx-auto px-4 py-8">
          {' '}
          <Link
            href="/courses"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            {' '}
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Courses{' '}
          </Link>{' '}
          <div className="grid gap-8 lg:grid-cols-3">
            {' '}
            <div className="lg:col-span-2 space-y-6">
              {' '}
              <div>
                {' '}
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {course.title}
                </h1>{' '}
                {course.subtitle && (
                  <p className="mt-2 text-lg text-muted-foreground">{course.subtitle}</p>
                )}{' '}
              </div>{' '}
              <div className="flex flex-wrap gap-6">
                {' '}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {' '}
                  <Clock className="h-4 w-4" />{' '}
                  <span>
                    {course.estimatedHours || Math.round(totalDuration / 3600)}h total
                  </span>{' '}
                </div>{' '}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {' '}
                  <Play className="h-4 w-4" /> <span>{lessonCount} lessons</span>{' '}
                </div>{' '}
                <div className="w-40">
                  {' '}
                  <DifficultyBar level={course.difficulty} size="sm" />{' '}
                </div>{' '}
              </div>{' '}
              <ProgressSection courseId={course.id} />{' '}
              {course.description && (
                <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {' '}
                  {course.description}{' '}
                </div>
              )}{' '}
            </div>{' '}
            <div className="space-y-4">
              {' '}
              <div className="aspect-video rounded-lg bg-gradient-to-br from-primary/10 to-secondary overflow-hidden flex items-center justify-center">
                {' '}
                <Play className="h-16 w-16 text-primary/40" />{' '}
              </div>{' '}
              <EnrollButton courseId={course.id} />{' '}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                {' '}
                <h3 className="font-semibold text-sm">This course includes:</h3>{' '}
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {' '}
                  <li className="flex items-center gap-2">
                    {' '}
                    <Play className="h-4 w-4 text-primary shrink-0" /> {lessonCount} on-demand video
                    lessons{' '}
                  </li>{' '}
                  <li className="flex items-center gap-2">
                    {' '}
                    <FileDown className="h-4 w-4 text-primary shrink-0" /> Downloadable CAD/DXF
                    files{' '}
                  </li>{' '}
                  <li className="flex items-center gap-2">
                    {' '}
                    <FileDown className="h-4 w-4 text-primary shrink-0" /> Process sheets &amp;
                    setup sheets{' '}
                  </li>{' '}
                  <li className="flex items-center gap-2">
                    {' '}
                    <Award className="h-4 w-4 text-primary shrink-0" /> Certificate of
                    completion{' '}
                  </li>{' '}
                </ul>{' '}
              </div>{' '}
            </div>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      <div className="container mx-auto px-4 py-12">
        {' '}
        <h2 className="text-2xl font-bold mb-8">Course Content</h2>{' '}
        <div className="grid gap-8 lg:grid-cols-3">
          {' '}
          <div className="lg:col-span-2 space-y-6">
            {' '}
            {course.series?.map((series) => (
              <div key={series.id} className="rounded-lg border bg-card overflow-hidden">
                {' '}
                <div className="bg-secondary/30 px-5 py-3">
                  {' '}
                  <h3 className="font-semibold">{series.title}</h3>{' '}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {' '}
                    {series.lessons?.length || 0} lessons{' '}
                  </p>{' '}
                </div>{' '}
                <div className="divide-y">
                  {' '}
                  {series.lessons?.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      courseSlug={slug}
                      courseId={course.id}
                    />
                  ))}{' '}
                </div>{' '}
              </div>
            ))}{' '}
          </div>{' '}
          <div className="space-y-6">
            {' '}
            <div className="rounded-lg border bg-card p-5">
              {' '}
              <h3 className="font-semibold mb-3">Prerequisites</h3>{' '}
              <p className="text-sm text-muted-foreground">
                {' '}
                {course.difficulty <= 2
                  ? 'No prior CNC experience needed. This course starts from the basics.'
                  : course.difficulty <= 4
                    ? 'Basic CNC knowledge recommended. Familiarity with G-code is helpful.'
                    : 'Advanced CNC experience required. You should be comfortable with multi-axis programming.'}{' '}
              </p>{' '}
            </div>{' '}
            <CourseProductsSidebar tags={[]} />{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      <ProductCarousel endpoint="featured" title="Tools & Kits for This Course" />{' '}
    </div>
  );
}
