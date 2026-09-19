import type { AccountStatus } from './auth';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  username: string | null;
  name: string | null;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  role: string;
  authProviderId: string | null;
  passwordHash: string | null;
  metadata: UserMetadata | null;
  isActive: boolean | null;
  accountStatus: AccountStatus;
  emailVerifiedAt: string | null;
  twoFactorEnabled: boolean;
  lockedUntil: string | null;
  failedLoginAttempts: number;
  deletedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserMetadata {
  bio?: string;
  title?: string;
  company?: string;
  location?: string;
  website?: string;
  github?: string;
  linkedin?: string;
  skills?: string[];
  certifications?: string[];
  socialLinks?: Record<string, string>;
}
