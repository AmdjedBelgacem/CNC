'use client';
import { create } from 'zustand';
import type { PuckNode } from '@titan/shared';
export interface StatusInfo {
  /** `disabled` is a page that exists but is not publicly reachable. */
  status: 'draft' | 'published' | 'disabled';
  version: number;
  title?: string;
  isSystem?: boolean;
  showInNav?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}
export type SectionDialogState =
  | { mode: 'save'; suggested: string; node: PuckNode }
  | { mode: 'rename'; id: string; name: string }
  | { mode: 'delete'; id: string; name: string }
  | null;
/**
 * Builder UI state — panels, dirty flag, publish state.
 *
 * Deliberately NOT the open page. The page lives in the URL
 * (`use-open-page.ts`), and keeping a second copy here is what caused the page to
 * snap back to the homepage: a Fast Refresh rebuild re-evaluates this module, the
 * copy resets to a default, and nothing reconciled it. A module-level store is
 * the wrong home for something that must survive a reload.
 */
interface BuilderUIState {
  status: StatusInfo | null;
  dirty: boolean;
  saving: boolean;
  versionsOpen: boolean;
  structureOpen: boolean;
  inspectorOpen: boolean;
  publishOpen: boolean;
  resetOpen: boolean;
  sectionDialog: SectionDialogState;
  setStatus: (status: StatusInfo | null) => void;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  setVersionsOpen: (open: boolean) => void;
  toggleStructure: () => void;
  setInspectorOpen: (open: boolean) => void;
  setPublishOpen: (open: boolean) => void;
  setResetOpen: (open: boolean) => void;
  setSectionDialog: (dialog: SectionDialogState) => void;
}
export const useBuilderUI = create<BuilderUIState>((set) => ({
  status: null,
  dirty: false,
  saving: false,
  versionsOpen: false,
  structureOpen: true,
  inspectorOpen: true,
  publishOpen: false,
  resetOpen: false,
  sectionDialog: null,
  setStatus: (status) => set({ status }),
  setDirty: (dirty) => set({ dirty }),
  setSaving: (saving) => set({ saving }),
  setVersionsOpen: (versionsOpen) => set({ versionsOpen }),
  toggleStructure: () => set((s) => ({ structureOpen: !s.structureOpen })),
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  setPublishOpen: (publishOpen) => set({ publishOpen }),
  setResetOpen: (resetOpen) => set({ resetOpen }),
  setSectionDialog: (sectionDialog) => set({ sectionDialog }),
}));
