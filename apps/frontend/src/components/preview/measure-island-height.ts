/**
 * Height of the island's real content, not the preview document.
 *
 * The preview route is rendered inside the app shell, whose wrappers can stretch
 * the root div to the iframe viewport. Measuring the root or the document would
 * therefore report the viewport height (e.g. 754px) instead of the content
 * height (e.g. 3659px for the community wire, 38px for the ticker). The island
 * component is the first element child of `#island-preview-root`; its box is the
 * same box the public page uses.
 */
export function measureIslandHeight(root: HTMLElement | null): number {
  if (!root) return 0;
  const children = Array.from(root.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  if (children.length === 0) return 0;
  const top = Math.min(...children.map((child) => child.getBoundingClientRect().top));
  const bottom = Math.max(...children.map((child) => child.getBoundingClientRect().bottom));
  return Math.max(0, Math.ceil(bottom - top));
}
