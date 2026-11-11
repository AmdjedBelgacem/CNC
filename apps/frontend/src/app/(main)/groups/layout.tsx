import { pageMeta } from '@/lib/page-title';
export const generateMetadata = pageMeta('groups');
export default function GroupsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
