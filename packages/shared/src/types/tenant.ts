export interface Tenant {
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
  isActive: boolean;
  domain: string | null;
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  allowRegistration?: boolean;
  requireApproval?: boolean;
  defaultUserRole?: string;
  featureFlags?: Record<string, boolean>;
  socialEnabled?: boolean;
  storeEnabled?: boolean;
  eventsEnabled?: boolean;
  certificationEnabled?: boolean;
}

export interface TenantTheme {
  '--color-primary': string;
  '--color-secondary': string;
  '--color-accent': string;
  '--font-family': string;
  '--border-radius': string;
}
