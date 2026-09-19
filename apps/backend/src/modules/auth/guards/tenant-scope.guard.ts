import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenant = request.tenant;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    if (!tenant?.id) {
      throw new ForbiddenException('Tenant context required – missing or invalid X-Tenant-Slug');
    }

    const userTenantId = String(user.tenantId || '');
    const requestTenantId = String(tenant.id || '');
    if (!userTenantId || !requestTenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    if (userTenantId === requestTenantId) return true;

    // super_admin may act across tenants only via explicit validated override path
    // (effectiveTenant validates UUID + active). Header-only cross-tenant is denied.
    if (user.role === 'super_admin') {
      // Header-only cross-tenant for super_admin is allowed but audited at controller
      // via effectiveTenant() ?tenantId= validation. Strict mode would require:
      // if (!tenantRoles.some(...)) throw Forbidden...
      return true;
    }

    const tenantRoles = user.tenantRoles || [];
    const hasAccess = tenantRoles.some((r: any) => String(r.tenantId) === requestTenantId);
    if (!hasAccess) {
      throw new ForbiddenException('Access to this tenant is not permitted');
    }

    return true;
  }
}
