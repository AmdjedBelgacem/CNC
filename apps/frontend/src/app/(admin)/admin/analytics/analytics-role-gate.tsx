'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
const ADMIN_ROLES = ['super_admin', 'admin'];
export function AnalyticsRoleGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const hydrated = useAuthStore((s) => s.hydrated);
  useEffect(() => {
    if (hydrated && role && !ADMIN_ROLES.includes(role)) {
      router.replace('/admin');
    }
  }, [hydrated, role, router]);
  if (hydrated && role && !ADMIN_ROLES.includes(role)) return null;
  return <>{children}</>;
}
