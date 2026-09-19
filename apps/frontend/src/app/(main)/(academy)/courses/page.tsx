import { Suspense } from 'react';
import { CourseGrid } from './course-grid';
export const metadata = {
  title: 'Course Library - TITANS of Manufacturing',
  description: 'Browse our comprehensive library of CNC machining courses.',
};
export default function CoursesPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      {' '}
      <div className="mb-10">
        {' '}
        <h1 className="text-4xl font-bold tracking-tight">Course Library</h1>{' '}
        <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
          {' '}
          Project-based CNC courses from beginner to master. Each course includes video lessons,
          downloadable CAD files, process sheets, and a certificate of completion.{' '}
        </p>{' '}
      </div>{' '}
      <Suspense fallback={null}>
        {' '}
        <CourseGrid />{' '}
      </Suspense>{' '}
    </div>
  );
}
