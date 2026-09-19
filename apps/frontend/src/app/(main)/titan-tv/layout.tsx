import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'TITAN TV — Video Library | TITANS of Manufacturing',
  description: 'Watch machine builds, tooling demos, and educational series.',
};
export default function TitanTvLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
