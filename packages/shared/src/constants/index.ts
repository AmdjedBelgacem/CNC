import { USER_ROLES } from '../types/auth';

export * from './theme-defaults';
export * from './page-defaults';
export * from './academy';

export const ROLES = USER_ROLES;

export const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  admin: 80,
  moderator: 60,
  instructor: 40,
  sponsor: 30,
  learner: 10,
};

export const PERMISSIONS = {
  users: {
    read: 'users:read',
    write: 'users:write',
    ban: 'users:ban',
    delete: 'users:delete',
    impersonate: 'users:impersonate',
  },
  courses: {
    read: 'courses:read',
    write: 'courses:write',
    publish: 'courses:publish',
    delete: 'courses:delete',
  },
  tenants: {
    read: 'tenants:read',
    write: 'tenants:write',
    manage: 'tenants:manage',
  },
  roles: {
    manage: 'roles:manage',
  },
  audit: {
    read: 'audit:read',
  },
  sponsors: {
    read: 'sponsors:read',
    manage: 'sponsors:manage',
  },
  social: {
    moderate: 'social:moderate',
    delete: 'social:delete',
  },
  system: {
    configure: 'system:configure',
  },
} as const;

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: Object.values(PERMISSIONS).flatMap((p) => Object.values(p)),
  admin: [
    PERMISSIONS.users.read,
    PERMISSIONS.users.write,
    PERMISSIONS.users.ban,
    PERMISSIONS.courses.read,
    PERMISSIONS.courses.write,
    PERMISSIONS.courses.publish,
    PERMISSIONS.sponsors.read,
    PERMISSIONS.sponsors.manage,
    PERMISSIONS.audit.read,
    PERMISSIONS.social.moderate,
    PERMISSIONS.tenants.read,
  ],
  instructor: [
    PERMISSIONS.courses.read,
    PERMISSIONS.courses.write,
    PERMISSIONS.users.read,
  ],
  moderator: [
    PERMISSIONS.social.moderate,
    PERMISSIONS.social.delete,
    PERMISSIONS.users.read,
  ],
  sponsor: [
    PERMISSIONS.sponsors.read,
    PERMISSIONS.courses.read,
    PERMISSIONS.users.read,
  ],
  learner: [
    PERMISSIONS.courses.read,
    PERMISSIONS.users.read,
  ],
};

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Advanced',
  4: 'Expert',
  5: 'Master',
};

export const DIFFICULTY_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#84cc16',
  3: '#eab308',
  4: '#f97316',
  5: '#ef4444',
};

export const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pending_verification: 'Pending Verification',
  suspended: 'Suspended',
  locked: 'Locked',
  deleted: 'Deleted',
};

export const ORDER_STATUSES = [
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded',
] as const;

export const EVENT_TYPES = ['workshop', 'webinar', 'conference', 'meetup', 'competition'] as const;

export const ATTACHMENT_TYPES = ['cad', 'dxf', 'pdf', 'spreadsheet', 'image', 'other'] as const;

export const SPONSOR_TIERS = ['platinum', 'gold', 'silver', 'bronze'] as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const CACHE_TTL = {
  TENANT: 3600,
  COURSES: 300,
  PRODUCTS: 300,
  FEED: 60,
  USER_PROFILE: 600,
} as const;

export const AUTH_CONSTANTS = {
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',
  REFRESH_TOKEN_EXPIRY_REMEMBER: '30d',
  EMAIL_VERIFICATION_EXPIRY: 24 * 60 * 60 * 1000,
  PASSWORD_RESET_EXPIRY: 60 * 60 * 1000,
  MAGIC_LINK_EXPIRY: 15 * 60 * 1000,
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000,
  LOCKOUT_DURATION_ESCALATED: 60 * 60 * 1000,
  MAX_CONCURRENT_SESSIONS: 10,
  VERIFICATION_TOKEN_LENGTH: 32,
  REFRESH_TOKEN_LENGTH: 64,
  BACKUP_CODE_COUNT: 8,
  BACKUP_CODE_LENGTH: 10,
  RATE_LIMIT_LOGIN: { ttl: 60000, limit: 10 },
  RATE_LIMIT_REGISTER: { ttl: 3600000, limit: 3 },
  RATE_LIMIT_VERIFICATION: { ttl: 3600000, limit: 5 },
  RATE_LIMIT_PASSWORD_RESET: { ttl: 3600000, limit: 3 },
} as const;
