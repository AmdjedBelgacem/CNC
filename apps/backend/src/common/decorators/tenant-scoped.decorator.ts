import { SetMetadata } from '@nestjs/common';

export const TENANT_SCOPED_KEY = 'tenantScoped';

/**
 * Marks a route (or whole controller) as REQUIRING a resolved tenant.
 *
 * `TenantResolveGuard` sets `request.tenant = null` when the `x-tenant-slug` header is
 * missing, malformed, or names an unknown tenant. Without this marker the request is
 * allowed through and any `@CurrentTenant()` dereference becomes
 * `TypeError: Cannot read properties of null (reading 'id')` → HTTP 500.
 *
 * With the marker, the guard throws a clean 404 instead. Apply it to every controller
 * whose handlers are meaningless without a tenant (public academy/course/event/content
 * reads in particular).
 */
export const TenantScoped = () => SetMetadata(TENANT_SCOPED_KEY, true);
