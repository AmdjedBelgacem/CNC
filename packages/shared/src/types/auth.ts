export const ACCOUNT_STATUSES = [
  'active',
  'pending_verification',
  'suspended',
  'locked',
  'deleted',
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const USER_ROLES = [
  'super_admin',
  'admin',
  'instructor',
  'learner',
  'sponsor',
  'moderator',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const AUTH_PROVIDERS = ['email', 'google', 'github'] as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const VERIFICATION_TOKEN_TYPES = [
  'email_verification',
  'password_reset',
  'email_change',
  'magic_link',
] as const;

export type VerificationTokenType = (typeof VERIFICATION_TOKEN_TYPES)[number];

export const AUDIT_ACTIONS = [
  'user.login',
  'user.login.failed',
  'user.logout',
  'user.register',
  'user.email.verify',
  'user.email.change',
  'user.password.change',
  'user.password.reset',
  'user.2fa.enable',
  'user.2fa.disable',
  'user.oauth.link',
  'user.oauth.unlink',
  'user.role.change',
  'user.suspend',
  'user.unsuspend',
  'user.lockout',
  'user.impersonate',
  'user.impersonate.end',
  'user.delete',
  'user.force_logout',
  'admin.session.revoke',
  'admin.password.reset',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  twoFactorRequired?: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: string;
  accountStatus: AccountStatus;
  twoFactorEnabled: boolean;
  tenantId: string;
  permissions: string[];
  tenantRoles?: { tenantId: string; tenantSlug: string; role: string }[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface SessionInfo {
  id: string;
  deviceInfo: string | null;
  ip: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}
