import { api } from '@/lib/api-client';

/**
 * Study-group API surface.
 *
 * Everything goes through `api.*` rather than raw `fetch`: that is what attaches the
 * `x-csrf-token` double-submit header, which the backend's global CsrfGuard requires on every
 * cookie-authenticated mutation. A hand-rolled `fetch` would get a 403 on join/create and look
 * like a permissions problem.
 */

export interface StudyGroup {
  id: string;
  hostId: string;
  name: string;
  description: string | null;
  /** Legacy taxonomy key (`cnc`, `grinding`…), not a slug into `academies`. */
  academy: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  meetingSchedule: string | null;
  maxMembers: number | null;
  memberCount: number;
  coverUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  role: string;
  joinedAt: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
}

/** What `GET /social/groups/:id` returns — the group plus viewer-specific fields. */
export interface StudyGroupDetail extends StudyGroup {
  members: GroupMember[];
  isMember: boolean;
  isHost: boolean;
  /** Host or site manager: may edit, archive and delete. */
  canManage: boolean;
  isFull: boolean;
}

/** Rows from `GET /social/groups/mine`, which additionally carries the viewer's own role. */
export interface MyGroup extends StudyGroup {
  memberRole: string;
  joinedAt: string;
  isHost: boolean;
}

export interface GroupListResult {
  data: StudyGroup[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  academy?: string;
  address?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  meetingSchedule?: string;
  maxMembers?: number;
  coverUrl?: string;
}

export type UpdateGroupInput = Partial<CreateGroupInput> & { isActive?: boolean };

export interface ListParams {
  search?: string;
  city?: string;
  academy?: string;
  page?: number;
  limit?: number;
}

function buildQuery(params: ListParams): string {
  const q = new URLSearchParams();
  if (params.search?.trim()) q.set('search', params.search.trim());
  if (params.city) q.set('city', params.city);
  if (params.academy) q.set('academy', params.academy);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const groupsApi = {
  list: (params: ListParams = {}) => api.get<GroupListResult>(`/social/groups${buildQuery(params)}`),
  cities: () => api.get<string[]>('/social/groups/cities'),
  mine: () => api.get<{ data: MyGroup[] }>('/social/groups/mine'),
  detail: (id: string) => api.get<{ data: StudyGroupDetail }>(`/social/groups/${id}`),
  create: (input: CreateGroupInput) => api.post<StudyGroup>('/social/groups', input),
  update: (id: string, input: UpdateGroupInput) => api.patch<StudyGroup>(`/social/groups/${id}`, input),
  remove: (id: string) => api.delete<{ data: { id: string; deleted: boolean } }>(`/social/groups/${id}`),
  join: (id: string) => api.post<{ data: StudyGroupDetail }>(`/social/groups/${id}/join`),
  leave: (id: string) =>
    api.post<{ data: { groupId: string; memberCount: number; left: boolean } }>(
      `/social/groups/${id}/leave`,
    ),
};

/**
 * Nest returns validation failures as `{ message: string[] }`, while permission and conflict
 * failures come back as `{ message: string }`. Turning either into one readable line keeps the
 * toast from rendering `Error: [object Object]`.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;
  const body = (err as { body?: unknown }).body;
  const message = (body as { message?: unknown } | undefined)?.message ?? (err as Error).message;
  if (Array.isArray(message)) return message.filter(Boolean).join('. ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}
