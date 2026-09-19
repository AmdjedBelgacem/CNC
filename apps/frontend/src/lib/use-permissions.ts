import { useAuthStore } from '@/stores/auth-store'; /** All permission keys granted to the current user (super_admin has ['*']). */
export function usePermissions(): string[] {
  return useAuthStore((s) => s.user?.permissions ?? []);
} /** True when the user holds every listed permission (or the wildcard). */
export function useCan(permission: string | string[]): boolean {
  const perms = usePermissions();
  if (perms.includes('*')) return true;
  const list = Array.isArray(permission) ? permission : [permission];
  return list.every((p) => perms.includes(p));
} /** True when the user holds at least one of the listed permissions (or the wildcard). */
export function useCanAny(permission: string | string[]): boolean {
  const perms = usePermissions();
  if (perms.includes('*')) return true;
  const list = Array.isArray(permission) ? permission : [permission];
  return list.some((p) => perms.includes(p));
} /** True when the current user is a super admin (ultimate authority). */
export function useIsSuper(): boolean {
  const perms = usePermissions();
  const role = useAuthStore((s) => s.user?.role);
  return perms.includes('*') || role === 'super_admin';
}
