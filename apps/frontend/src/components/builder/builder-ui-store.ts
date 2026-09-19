'use client';
import { create } from 'zustand';
import type { PuckNode } from '@titan/shared';
export interface StatusInfo {
  status: 'draft' | 'published';
  version: number;
}
export type SectionDialogState =
  | { mode: 'save'; suggested: string; node: PuckNode }
  | { mode: 'rename'; id: string; name: string }
  | { mode: 'delete'; id: string; name: string }
  | null;
interface BuilderUIState {
  slug: string;
  status: StatusInfo | null;
  dirty: boolean;
  saving: boolean;
  versionsOpen: boolean;
  structureOpen: boolean;
  inspectorOpen: boolean;
  publishOpen: boolean;
  resetOpen: boolean;
  sectionDialog: SectionDialogState;
  setSlug: (slug: string) => void;
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
  slug: 'home',
  status: null,
  dirty: false,
  saving: false,
  versionsOpen: false,
  structureOpen: true,
  inspectorOpen: true,
  publishOpen: false,
  resetOpen: false,
  sectionDialog: null,
  setSlug: (slug) => set({ slug }),
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
