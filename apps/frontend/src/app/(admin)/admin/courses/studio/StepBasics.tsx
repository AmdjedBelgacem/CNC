'use client';
import { useEffect, useState } from 'react';
import { INPUT, LABEL } from './glass';
import { slugify } from './slugify';
import type { CourseStudioData } from './types';

interface AcademyOption {
  id: string;
  slug: string;
  title: string;
}

export function StepBasics({
  course,
  update,
}: {
  course: CourseStudioData;
  update: (patch: Partial<CourseStudioData>) => void;
}) {
  const slug = course.slug || slugify(course.title || '');
  const [academies, setAcademies] = useState<AcademyOption[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/proxy/admin/academies?limit=100', {
          credentials: 'include',
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setAcademies(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!cancelled) setAcademies([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      {' '}
      <div className="space-y-1.5">
        {' '}
        <label className={LABEL}>Title *</label>{' '}
        <input
          value={course.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="e.g. CNC Milling Fundamentals"
          className={INPUT}
        />{' '}
        <p className="font-sans text-xs text-muted-foreground">
          Slug: <span className="font-mono">/{slug || 'auto-generated'}</span>
        </p>{' '}
      </div>{' '}
      <div className="space-y-1.5">
        {' '}
        <label className={LABEL}>Academy</label>{' '}
        <select
          value={course.academyId ?? ''}
          onChange={(e) =>
            update({
              academyId: e.target.value || null,
              academy: null,
            })
          }
          disabled={academies === null}
          className={INPUT}
        >
          {' '}
          <option value="">No academy — tenant course library only</option>{' '}
          {(academies ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {' '}
              {a.title}{' '}
            </option>
          ))}{' '}
        </select>{' '}
        <p className="font-sans text-xs text-muted-foreground">
          The academy this course belongs to. Published courses appear on the academy page once
          assigned.
        </p>{' '}
      </div>{' '}
      <div className="space-y-1.5">
        {' '}
        <label className={LABEL}>Subtitle</label>{' '}
        <input
          value={course.subtitle ?? ''}
          onChange={(e) => update({ subtitle: e.target.value || null })}
          placeholder="Short marketing line shown under the title"
          className={INPUT}
        />{' '}
      </div>{' '}
      <div className="space-y-1.5">
        {' '}
        <label className={LABEL}>Description</label>{' '}
        <textarea
          value={course.description ?? ''}
          onChange={(e) => update({ description: e.target.value || null })}
          rows={5}
          placeholder="What will learners walk away with?"
          className={INPUT + ' resize-y'}
        />{' '}
      </div>{' '}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {' '}
        <div className="space-y-1.5">
          {' '}
          <label className={LABEL}>Difficulty</label>{' '}
          <select
            value={course.difficulty}
            onChange={(e) => update({ difficulty: Number(e.target.value) })}
            className={INPUT}
          >
            {' '}
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {' '}
                {d} — {['Beginner', 'Elementary', 'Intermediate', 'Advanced', 'Expert'][d - 1]}{' '}
              </option>
            ))}{' '}
          </select>{' '}
        </div>{' '}
        <div className="space-y-1.5">
          {' '}
          <label className={LABEL}>Estimated hours</label>{' '}
          <input
            type="number"
            min={0}
            value={course.estimatedHours ?? ''}
            onChange={(e) =>
              update({ estimatedHours: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="e.g. 12"
            className={INPUT}
          />{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
