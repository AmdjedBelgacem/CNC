/**
 * Route-level loading state for `/admin/builder`.
 *
 * The editor is a heavy dynamic import (Puck plus the whole block registry), so
 * the wait is long enough that the placeholder has to describe the shape of the
 * thing arriving. `BuilderSkeleton` previews the two-tier bar and the
 * three-column body, which also removes the layout shift.
 */
import { BuilderSkeleton } from '@/components/builder/builder-shell';

export default function Loading() {
  return <BuilderSkeleton />;
}
