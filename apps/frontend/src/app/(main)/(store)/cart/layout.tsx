import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

/**
 * /cart and /checkout are transactional and session-bound. They are disallowed in
 * robots.txt but were still indexable, and a cart page has no content worth an index
 * entry.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pageMeta');
  const title = t('cart.title');
  return {
    title: { default: title, template: `%s | ${title}` },
    robots: { index: false, follow: false, nocache: true },
  };
}

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
