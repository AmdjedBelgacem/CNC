import type { Metadata } from 'next';

/**
 * /cart and /checkout are transactional and session-bound. They are disallowed in
 * robots.txt but were still indexable, and a cart page has no content worth an index
 * entry.
 */
export const metadata: Metadata = {
  title: {
    default: 'Cart',
    template: '%s | Cart',
  },
  robots: { index: false, follow: false, nocache: true },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
