import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Our Partners | Baroot CNC Solutions',
  description:
    'Free manufacturing education is made possible by the generous support of our industry partners.',
};
export default function SponsorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
