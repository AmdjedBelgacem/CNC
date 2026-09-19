import { NavMain } from '@/components/layout/nav-main';
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {' '}
      <NavMain /> {children}{' '}
    </div>
  );
}
