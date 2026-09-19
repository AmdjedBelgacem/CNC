import { AnnouncementBar } from '@/components/layout/announcement-bar';
import { NavMain } from '@/components/layout/nav-main';
import { Footer } from '@/components/layout/footer';
import { ChatWidget } from '@/components/chat/chat-widget';
import { PWARegister } from '@/components/pwa/pwa-register';
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {' '}
      <AnnouncementBar /> <NavMain /> <main className="flex-1 pt-[116px]">{children}</main>{' '}
      <Footer /> <ChatWidget /> <PWARegister />{' '}
    </div>
  );
}
