/**
 * Root not-found boundary.
 *
 * This catches unmatched URLs *and* `notFound()` calls from anywhere below, and
 * renders inside the root layout — so unlike `global-error.tsx` it can use the
 * shared providers, tokens, navigation and footer.
 */
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NotFoundView } from '@/components/ui/error-view';

/** A missing page used to carry the homepage title, which made it look like a real result. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ui.errorView');
  return { title: t('notFoundTitle'), robots: { index: false, follow: false } };
}

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-container-max flex-col">
      <NotFoundView />
    </div>
  );
}