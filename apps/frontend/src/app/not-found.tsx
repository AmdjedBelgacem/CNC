/**
 * Root not-found boundary.
 *
 * This catches unmatched URLs *and* `notFound()` calls from anywhere below, and
 * renders inside the root layout — so unlike `global-error.tsx` it can use the
 * shared providers, tokens, navigation and footer.
 */
import { NotFoundView } from '@/components/ui/error-view';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-container-max flex-col">
      <NotFoundView />
    </div>
  );
}