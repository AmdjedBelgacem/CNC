import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Study Groups | Baroot CNC Solutions',
  description:
    'Learn together. Connect with CNC machinists in your area for hands-on study sessions.',
};
export default function GroupsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
