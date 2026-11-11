import { pageMeta } from '@/lib/page-title';
export const generateMetadata = pageMeta('sponsors');
export default function SponsorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
