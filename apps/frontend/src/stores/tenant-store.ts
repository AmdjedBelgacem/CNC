import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string | null;
  domain: string | null;
}
interface TenantState {
  tenant: TenantConfig | null;
  loaded: boolean;
  setTenant: (tenant: TenantConfig) => void;
  load: () => Promise<void>;
}
export const useTenantStore = create<TenantState>()(
  persist(
    (set, _get) => ({
      tenant: null,
      loaded: false,
      setTenant: (tenant) => set({ tenant, loaded: true }),
      load: async () => {
        try {
          // Default-tenant branding bootstrap (single source: tenant-config).
          // Tenant-specific pages resolve their own tenant via server cookies.
          const res = await fetch(`/api/proxy/tenants/${DEFAULT_TENANT_SLUG}`, {
            credentials: 'include',
          });
          const tenant = await res.json();
          set({ tenant, loaded: true });
          if (typeof document !== 'undefined') {
            const root = document.documentElement;
            root.style.setProperty('--color-primary', tenant.primaryColor);
            root.style.setProperty('--color-secondary', tenant.secondaryColor);
            root.style.setProperty('--color-accent', tenant.accentColor);
            if (tenant.fontFamily) {
              root.style.setProperty('--font-family-sans', tenant.fontFamily);
            }
            if (tenant.faviconUrl) {
              const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
              if (link) link.href = tenant.faviconUrl;
            }
          }
        } catch {
          set({ loaded: true });
        }
      },
    }),
    { name: 'tenant-storage', partialize: (state) => ({ tenant: state.tenant }) },
  ),
);
