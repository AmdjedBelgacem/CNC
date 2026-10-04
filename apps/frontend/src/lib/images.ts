export type EntityType =
  | 'product'
  | 'course'
  | 'lesson'
  | 'academy'
  | 'event'
  | 'user'
  | 'portfolio'
  | 'sponsor'
  | 'video';

const PLACEHOLDER_MAP: Record<EntityType, string> = {
  product: '/images/placeholder-product.svg',
  course: '/images/placeholder-course.svg',
  lesson: '/images/placeholder-lesson.svg',
  academy: '/images/placeholder-academy.svg',
  event: '/images/placeholder-event.svg',
  user: '/images/placeholder-user.svg',
  portfolio: '/images/placeholder-user.svg',
  sponsor: '/images/placeholder-sponsor.svg',
  video: '/images/placeholder-lesson.svg',
};

export function getImageSrc(url: string | null | undefined, entity: EntityType): string {
  if (url && url.trim().length > 0) return url;
  return PLACEHOLDER_MAP[entity];
}
