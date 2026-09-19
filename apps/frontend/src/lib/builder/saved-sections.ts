import {
  cloneSubtreeWithFreshIds,
  findNodeById,
  inlineSectionZones,
  type PageLayout,
  type PuckNode,
  type SavedSectionRecord,
} from '@titan/shared';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
/** Saved section as stored by the backend (tenant-scoped). */
export type SavedSection = SavedSectionRecord;
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiProxyFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Saved sections request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
export async function getSavedSections(): Promise<SavedSection[]> {
  const rows = await request<SavedSection[]>('/api/proxy/builder/saved-sections');
  // Normalize legacy payloads (flat `zones`) to inline slot children.
  return rows.map((row) => ({ ...row, node: inlineSectionZones(row.node, row.zones), zones: {} }));
}
export async function saveSection(name: string, node: PuckNode): Promise<SavedSection> {
  return request<SavedSection>('/api/proxy/builder/saved-sections', {
    method: 'POST',
    body: JSON.stringify({ name, node }),
  });
}
export async function renameSavedSection(id: string, name: string): Promise<SavedSection> {
  return request<SavedSection>(`/api/proxy/builder/saved-sections/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}
export async function deleteSavedSection(id: string): Promise<void> {
  await request<{ id: string; deleted: boolean }>(`/api/proxy/builder/saved-sections/${id}`, {
    method: 'DELETE',
  });
} /** * Extracts the subtree rooted at the given id (node with inline slot * children) from the live builder state. Returns a detached deep copy so * later edits to the page can never mutate the saved payload. */
export function extractSubtree(layout: PageLayout, nodeId: string): { node: PuckNode } | null {
  const node = findNodeById(layout, nodeId);
  if (!node) return null;
  return { node: structuredClone(node) };
} /** * Clones a saved subtree with fresh ids for every node, so inserting the * same saved section multiple times never collides. */
export function cloneSubtree(node: PuckNode): { node: PuckNode } {
  return { node: cloneSubtreeWithFreshIds(structuredClone(node)) };
}
