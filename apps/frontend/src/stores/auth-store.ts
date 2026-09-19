import { create } from 'zustand';
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  language?: string;
  timezone?: string;
  role: string;
  accountStatus: string;
  twoFactorEnabled: boolean;
  tenantId: string;
  permissions: string[];
  impersonating?: boolean;
  tenantRoles?: { tenantId: string; tenantSlug: string; role: string }[];
}
interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  twoFactorRequired: boolean;
  impersonating: boolean;
  hydrated: boolean;
  setUser: (user: AuthUser | null) => void;
  setAuth: (user: AuthUser) => void;
  setTwoFactorRequired: (required: boolean) => void;
  setImpersonating: (impersonating: boolean) => void;
  updateUser: (user: Partial<AuthUser>) => void;
  logout: () => void;
  setHydrated: (hydrated: boolean) => void;
} /* One-time purge of legacy localStorage tokens (migration from v1 to httpOnly cookies) */
/* Runs once on module load in browser
 */
if (typeof window !== 'undefined') {
  try {
    const legacyKeys = ['auth-token-v2', 'auth-refresh-v2', 'auth-storage'];
    let hadLegacy = false;
    for (const k of legacyKeys) {
      if (localStorage.getItem(k) !== null) {
        hadLegacy = true;
        localStorage.removeItem(k);
      }
    }
    if (hadLegacy) {
      /* Also clear the non-httpOnly mirror cookie if present */ document.cookie =
        'access-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
    }
  } catch {}
}
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  twoFactorRequired: false,
  impersonating: false,
  hydrated: false,
  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      impersonating: !!user?.impersonating,
      twoFactorRequired: false,
      hydrated: true,
    }),
  setAuth: (user) =>
    set({
      user,
      isAuthenticated: true,
      impersonating: !!user?.impersonating,
      twoFactorRequired: false,
      hydrated: true,
    }),
  setTwoFactorRequired: (required) => set({ twoFactorRequired: required }),
  setImpersonating: (impersonating) => set({ impersonating }),
  updateUser: (partial) =>
    set((state) => ({ user: state.user ? { ...state.user, ...partial } : null })),
  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      twoFactorRequired: false,
      impersonating: false,
      hydrated: true,
    }),
  setHydrated: (hydrated) => set({ hydrated }),
}));
