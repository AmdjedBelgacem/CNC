import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export interface PermissionsMeta {
  permissions: string[];
  mode: 'all' | 'any';
}

/**
 * Guard a route by one or more permission keys.
 * mode 'all' (default): actor must hold every listed permission.
 * mode 'any': actor must hold at least one.
 * A `*` permission (super_admin) always passes.
 */
export const Permissions = (
  permissions: string | string[],
  mode: 'all' | 'any' = 'all',
) => SetMetadata(PERMISSIONS_KEY, { permissions: Array.isArray(permissions) ? permissions : [permissions], mode });
