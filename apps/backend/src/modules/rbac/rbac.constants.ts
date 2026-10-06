export const SUPER_ADMIN_KEY = 'super_admin';

/** Roles that may never be edited or deleted. */
export const PROTECTED_ROLE_KEYS = [SUPER_ADMIN_KEY];

/** Coarse privilege used to keep `users.role` (legacy column) in sync for @Roles checks. */
export const ROLE_PRIVILEGE: Record<string, number> = {
  super_admin: 100,
  admin: 80,
  moderator: 60,
  instructor: 40,
  sponsor: 30,
  learner: 10,
  student: 0,
};

export interface PermissionDef {
  key: string;
  group: string;
  label: string;
  description?: string;
}

/**
 * Canonical permission catalog. New grouped keys are the source of truth for
 * the UI/guards; legacy keys (from the previous ROLE_PERMISSIONS map) are also
 * registered so nothing reading them breaks during the transition.
 */
export const PERMISSION_CATALOG: PermissionDef[] = [
  // staff management
  { key: 'staff:view', group: 'staff', label: 'View staff' },
  { key: 'staff:invite', group: 'staff', label: 'Invite staff' },
  { key: 'staff:suspend', group: 'staff', label: 'Suspend staff' },
  { key: 'staff:unsuspend', group: 'staff', label: 'Unsuspend staff' },
  { key: 'staff:role_change', group: 'staff', label: 'Change a user’s role' },
  { key: 'staff:impersonate', group: 'staff', label: 'Impersonate users' },
  { key: 'staff:manage_roles', group: 'staff', label: 'Create & edit roles' },
  { key: 'staff:assign_roles', group: 'staff', label: 'Assign roles to staff' },
  // learner / user management
  { key: 'users:view', group: 'users', label: 'View users' },
  { key: 'users:suspend', group: 'users', label: 'Suspend users' },
  { key: 'users:unsuspend', group: 'users', label: 'Unsuspend users' },
  { key: 'users:force_password_reset', group: 'users', label: 'Force password reset' },
  { key: 'users:impersonate', group: 'users', label: 'Impersonate users' },
  { key: 'users:manage', group: 'users', label: 'Manage users' },
  // courses / content
  { key: 'courses:view', group: 'courses', label: 'View courses' },
  { key: 'courses:create', group: 'courses', label: 'Create courses' },
  { key: 'courses:edit', group: 'courses', label: 'Edit courses' },
  { key: 'courses:publish', group: 'courses', label: 'Publish courses' },
  { key: 'courses:delete', group: 'courses', label: 'Delete courses' },
  { key: 'content:edit', group: 'courses', label: 'Edit course content' },
  // academies
  { key: 'academies:view', group: 'academies', label: 'View academies' },
  { key: 'academies:create', group: 'academies', label: 'Create academies' },
  { key: 'academies:edit', group: 'academies', label: 'Edit academies' },
  { key: 'academies:publish', group: 'academies', label: 'Publish academies' },
  { key: 'academies:delete', group: 'academies', label: 'Delete academies' },
  // certificates
  { key: 'certificates:view', group: 'certificates', label: 'View certificates' },
  { key: 'certificates:issue', group: 'certificates', label: 'Issue certificates' },
  { key: 'certificates:revoke', group: 'certificates', label: 'Revoke certificates' },
  // orders / commerce
  { key: 'orders:view', group: 'orders', label: 'View orders' },
  { key: 'orders:refund', group: 'orders', label: 'Refund orders' },
  { key: 'orders:manage', group: 'orders', label: 'Manage orders' },
  // settings
  { key: 'settings:view', group: 'settings', label: 'View settings' },
  { key: 'settings:edit', group: 'settings', label: 'Edit settings' },
  { key: 'settings:tenant_edit', group: 'settings', label: 'Edit tenant settings' },
  // builder
  { key: 'builder:view', group: 'builder', label: 'View builder' },
  { key: 'builder:edit', group: 'builder', label: 'Edit builder' },
  { key: 'builder:publish', group: 'builder', label: 'Publish builder' },
  { key: 'builder:sections_manage', group: 'builder', label: 'Manage builder sections' },
  // admin custom email system
  { key: 'email:view', group: 'email', label: 'View email templates' },
  { key: 'email:edit', group: 'email', label: 'Edit email templates and triggers' },
  // Separated from edit on purpose: publishing is the act that changes what real
  // learners receive, so it is its own grant rather than part of general editing.
  { key: 'email:publish', group: 'email', label: 'Publish, rollback or retry email' },
  { key: 'email:test_send', group: 'email', label: 'Send test emails' },
  { key: 'email:settings', group: 'email', label: 'Edit email sender settings' },
  // analytics
  { key: 'analytics:view', group: 'analytics', label: 'View analytics' },
  { key: 'analytics:export', group: 'analytics', label: 'Export analytics' },
  // messaging / support
  { key: 'messaging:view', group: 'messaging', label: 'View messages' },
  { key: 'messaging:reply', group: 'messaging', label: 'Reply to messages' },
  { key: 'support:tickets_manage', group: 'messaging', label: 'Manage support tickets' },
  // legacy keys (backward compatibility)
  { key: 'users:read', group: 'legacy', label: 'View users (legacy)' },
  { key: 'users:write', group: 'legacy', label: 'Edit users (legacy)' },
  { key: 'users:ban', group: 'legacy', label: 'Ban users (legacy)' },
  { key: 'users:delete', group: 'legacy', label: 'Delete users (legacy)' },
  { key: 'users:impersonate', group: 'legacy', label: 'Impersonate (legacy)' },
  { key: 'courses:read', group: 'legacy', label: 'View courses (legacy)' },
  { key: 'courses:write', group: 'legacy', label: 'Edit courses (legacy)' },
  { key: 'courses:publish', group: 'legacy', label: 'Publish courses (legacy)' },
  { key: 'courses:delete', group: 'legacy', label: 'Delete courses (legacy)' },
  { key: 'tenants:read', group: 'legacy', label: 'View tenant (legacy)' },
  { key: 'tenants:write', group: 'legacy', label: 'Edit tenant (legacy)' },
  { key: 'tenants:manage', group: 'legacy', label: 'Manage tenant (legacy)' },
  { key: 'roles:manage', group: 'legacy', label: 'Manage roles (legacy)' },
  { key: 'audit:read', group: 'legacy', label: 'View audit logs (legacy)' },
  { key: 'sponsors:read', group: 'legacy', label: 'View sponsors (legacy)' },
  { key: 'sponsors:manage', group: 'legacy', label: 'Manage sponsors (legacy)' },
  { key: 'social:moderate', group: 'legacy', label: 'Moderate social (legacy)' },
  { key: 'social:delete', group: 'legacy', label: 'Delete social (legacy)' },
  { key: 'system:configure', group: 'legacy', label: 'Configure system (legacy)' },
];

/**
 * Fallback permission sets per fixed role, used during resolution when a user
 * has no `user_roles` assignment yet (pre-seed / transition). Also the source
 * for seeding system roles. Identical to what each system role is seeded with.
 */
export const SYSTEM_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: PERMISSION_CATALOG.map((p) => p.key),
  admin: Array.from(new Set([
    'users:read', 'users:write', 'users:ban', 'users:impersonate', 'courses:read', 'courses:write', 'courses:publish',
    'sponsors:read', 'sponsors:manage', 'audit:read', 'social:moderate', 'tenants:read', 'roles:manage',
    'staff:view', 'staff:invite', 'staff:suspend', 'staff:unsuspend', 'staff:role_change', 'staff:impersonate',
    'staff:manage_roles', 'staff:assign_roles',
    'users:view', 'users:suspend', 'users:unsuspend', 'users:force_password_reset', 'users:manage',
    'courses:view', 'courses:create', 'courses:edit', 'courses:publish', 'content:edit',
    'academies:view', 'academies:create', 'academies:edit', 'academies:publish', 'academies:delete',
    'certificates:view', 'orders:view', 'orders:refund',
    'settings:view', 'settings:edit', 'settings:tenant_edit',
    'builder:view', 'builder:edit', 'builder:publish',
    'analytics:view', 'analytics:export', 'messaging:view', 'messaging:reply', 'support:tickets_manage',
  ])),
  instructor: Array.from(new Set([
    'courses:read', 'courses:write', 'users:read',
    'courses:view', 'courses:create', 'courses:edit', 'courses:publish', 'content:edit',
    'users:view', 'builder:view', 'builder:edit', 'staff:view',
    'academies:view',
  ])),
  moderator: Array.from(new Set([
    'social:moderate', 'social:delete', 'users:read',
    'messaging:view', 'messaging:reply', 'support:tickets_manage',
    'users:view', 'courses:view', 'staff:view',
    'academies:view',
  ])),
  sponsor: Array.from(new Set([
    'sponsors:read', 'sponsors:manage', 'courses:read',
    'orders:view', 'courses:view', 'users:view', 'analytics:view', 'staff:view',
  ])),
  learner: Array.from(new Set(['courses:read', 'users:read', 'courses:view', 'users:view'])),
};

/** Fixed system roles seeded into every tenant. */
export const SYSTEM_ROLE_KEYS = ['super_admin', 'admin', 'instructor', 'moderator', 'sponsor', 'learner'];

export function allPermissionKeys(): string[] {
  return PERMISSION_CATALOG.map((p) => p.key);
}
