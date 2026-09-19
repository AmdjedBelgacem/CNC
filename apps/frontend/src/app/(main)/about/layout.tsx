import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'About Us | TITANS of Manufacturing',
  description:
    'From a single CNC shop to a global education movement — TITANS of Manufacturing is on a mission to save manufacturing education.',
};
export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
