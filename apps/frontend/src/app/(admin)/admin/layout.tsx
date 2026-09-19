import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AdminGate } from './admin-gate';
import { AdminRail } from '@/components/admin/admin-rail';
import { AdminSearchPalette } from '@/components/admin/admin-search-palette';
import { ToastViewport } from '@/components/ui/toast';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Fast path: no session cookie AT ALL -> login. Real role verification happens
  // client-side in <AdminGate>, which can refresh an expired access token and re-sync
  // the cookie — something a server render cannot do.
  //
  // The access cookie is therefore the wrong thing to gate on by itself. It lives 15
  // minutes and the browser deletes it on expiry, while the refresh cookie is good for
  // 7 days: keying this redirect on the access cookie alone bounced every live session
  // to /login the moment the access token aged out, server-side, before the client that
  // would have rotated it ever ran. Only the absence of BOTH cookies is conclusive.
  const store = await cookies();
  const accessToken =
    store.get('access-token')?.value ||
    store.get('__Host-access')?.value ||
    store.get('__Host-access-token')?.value;
  const refreshToken =
    store.get('refresh-token')?.value ||
    store.get('__Host-refresh')?.value ||
    store.get('__refresh-fallback')?.value;
  if (!accessToken && !refreshToken) redirect('/login?returnUrl=/admin');
  return (
    <div className="min-h-screen bg-background">
      {' '}
      <AdminRail /> <AdminSearchPalette />{' '}
      <main className="p-4 pb-14 sm:p-6 sm:pb-14 lg:p-8 lg:pb-8 lg:pl-20">
        {' '}
        <AdminGate>{children}</AdminGate>{' '}
      </main>{' '}
      <ToastViewport />{' '}
    </div>
  );
}
