'use client'; /** * Imperative handle for page-level operations (load/save/publish/reset/revert) * so components rendered inside Puck's tree (the header override) can trigger * them without re-creating the overrides object (identity-churn remounts the * whole header). BuilderEditor assigns the live closures on every render. */
export interface BuilderActionHandlers {
  load: (slug: string) => void;
  openVersions: () => void;
  saveDraft: () => void;
  publish: (note?: string) => void;
  reset: () => void;
  revert: (version: number) => void;
  /**
   * Loads an AI-built layout into the canvas as one undoable step and returns the layout it
   * replaced, so the AI panel can offer its own Undo. Nothing is saved or published.
   */
  applyAiLayout: (layout: unknown) => unknown;
  /** The live layout, including unsaved edits, for the AI to work on. */
  getLiveLayout: () => unknown;
  /** Replace the page's Arabic copy in the editor (after a server-side translation). */
  setArabicLayout: (layout: unknown) => void;
}
export const builderActions: { current: BuilderActionHandlers | null } = { current: null };
