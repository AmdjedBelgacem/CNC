/**
 * Route transition for `/(auth)`.
 *
 * A `template` remounts on every navigation, which is the only place in the App
 * Router where an exit animation can actually run — a `layout` stays mounted and
 * its `AnimatePresence` never sees the old page leave.
 *
 * The admin console is deliberately excluded: it is a tool, not a browsing
 * experience. Crossfading on every table filter or drawer open makes the content
 * feel like it's lagging behind the interaction, so admin navigation stays
 * instant.
 */
import { PageTransition } from '@/components/ui/page-transition';

export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
