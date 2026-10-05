import type { Metadata } from 'next';

/**
 * /notifications is a per-user inbox. It shipped `index, follow` and appeared in the
 * sitemap, which invited crawlers to fetch a page whose contents belong to whoever is
 * signed in — and wasted crawl budget on a URL with no public value.
 */
export const metadata: Metadata = {
  title: 'Notifications',
  robots: { index: false, follow: false, nocache: true },
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
