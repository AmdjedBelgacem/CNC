'use client'; /** * Imperative handle for page-level operations (load/save/publish/reset/revert) * so components rendered inside Puck's tree (the header override) can trigger * them without re-creating the overrides object (identity-churn remounts the * whole header). BuilderEditor assigns the live closures on every render. */
export interface BuilderActionHandlers {
  load: (slug: string) => void;
  openVersions: () => void;
  saveDraft: () => void;
  publish: (note?: string) => void;
  reset: () => void;
  revert: (version: number) => void;
}
export const builderActions: { current: BuilderActionHandlers | null } = { current: null };
