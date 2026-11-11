import { pageMeta } from '@/lib/page-title';
export const generateMetadata = pageMeta('titanTv');
export default function TitanTvLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
