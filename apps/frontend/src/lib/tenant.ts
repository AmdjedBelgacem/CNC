import { cookies } from 'next/headers';
import { DEFAULT_TENANT_SLUG } from './tenant-config';
export async function getTenantSlug(): Promise<string> {
  const store = await cookies();
  return store.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
}
export function getTenantTheme(tenant: {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string | null;
}): Record<string, string> {
  return {
    '--color-primary': tenant.primaryColor || '#0E7490',
    '--color-secondary': tenant.secondaryColor || '#0a1628',
    '--color-accent': tenant.accentColor || '#ff6b35',
    '--font-family': tenant.fontFamily || 'Inter, ui-sans-serif, system-ui, sans-serif',
    '--border-radius': '0.5rem',
  };
}
