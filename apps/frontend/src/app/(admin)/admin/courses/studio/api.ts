import { ensureCsrfToken } from '@/lib/api-client';
import type { Attachment, CourseStudioData, LessonVideoMeta } from './types';
const BASE = '/api/proxy/admin/courses';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
async function req<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body != null) headers['Content-Type'] = 'application/json';
  // The backend enforces a double-submit pair (cookie === header) on every
  // mutation, so a client that forgets the header 403s on all writes. Every other
  // admin surface goes through `api.*` in lib/api-client which handles this; the
  // Studio talks to the proxy directly, so it must opt in explicitly.
  if (!SAFE_METHODS.includes(method)) {
    const token = await ensureCsrfToken();
    if (token) headers['x-csrf-token'] = token;
  }
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let data: any = null;
    try {
      data = await res.json();
    } catch {}
    const msg =
      data?.message ||
      (Array.isArray(data?.reasons) ? data.reasons.join('; ') : '') ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
export const getStudio = (slug: string) => req<CourseStudioData>(`${BASE}/${slug}`, 'GET');
export const saveCourse = (slug: string, patch: Record<string, unknown>) =>
  req<CourseStudioData>(`${BASE}/${slug}`, 'PATCH', patch);
export const createDraft = (body: { slug: string; title: string }) =>
  req<CourseStudioData>(`${BASE}`, 'POST', body);
export const createSeries = (courseId: string, slug: string, title: string) =>
  req<CourseStudioData['series'][number]>(`${BASE}/series`, 'POST', { courseId, slug, title });
export const updateSeries = (id: string, patch: Record<string, unknown>) =>
  req<CourseStudioData['series'][number]>(`${BASE}/series/${id}`, 'PATCH', patch);
export const deleteSeries = (id: string) =>
  req<{ id: string; deleted: boolean }>(`${BASE}/series/${id}`, 'DELETE');
export const createLesson = (seriesId: string, slug: string, title: string) =>
  req<CourseStudioData['series'][number]['lessons'][number]>(`${BASE}/lessons`, 'POST', {
    seriesId,
    slug,
    title,
  });
export const updateLesson = (id: string, patch: Record<string, unknown>) =>
  req<CourseStudioData['series'][number]['lessons'][number]>(
    `${BASE}/lessons/${id}`,
    'PATCH',
    patch,
  );
export const deleteLesson = (id: string) =>
  req<{ id: string; deleted: boolean }>(`${BASE}/lessons/${id}`, 'DELETE');
export const duplicateLesson = (id: string) =>
  req<CourseStudioData['series'][number]['lessons'][number]>(
    `${BASE}/lessons/${id}/duplicate`,
    'POST',
    {},
  );
export const reorderCurriculum = (
  slug: string,
  body: {
    series: { id: string; sortOrder: number }[];
    lessons: { id: string; seriesId: string; sortOrder: number }[];
  },
) => req<{ success: boolean }>(`${BASE}/${slug}/curriculum/reorder`, 'POST', body);
export const publishCourse = (slug: string) =>
  req<CourseStudioData>(`${BASE}/${slug}/publish`, 'POST', {});
export const unpublishCourse = (slug: string) =>
  req<CourseStudioData>(`${BASE}/${slug}/unpublish`, 'POST', {});
export interface UploadResult {
  url: string;
  name: string;
  type: string;
  size: number;
}
export const uploadFile = (dataUrl: string, folder?: string, name?: string) =>
  req<UploadResult>(`${BASE}/upload`, 'POST', { file: dataUrl, folder, name });
export interface LessonUploadUrlResult {
  key: string;
  uploadUrl: string;
}
export const getLessonUploadUrl = (
  lessonId: string,
  payload: { filename: string; contentType: string; size: number },
) => req<LessonUploadUrlResult>(`${BASE}/lessons/${lessonId}/upload-url`, 'POST', payload);
export interface LessonServerUploadResult {
  key: string;
  playbackUrl: string;
  meta: LessonVideoMeta;
}
export const uploadLessonVideoServer = (
  lessonId: string,
  payload: { file: string; filename?: string },
) => req<LessonServerUploadResult>(`${BASE}/lessons/${lessonId}/upload`, 'POST', payload);
export interface PublishCheck {
  ok: boolean;
  reasons: string[];
}
export const checkPublish = (slug: string) => req<PublishCheck>(`${BASE}/${slug}/validate`, 'GET');
export type { Attachment };
