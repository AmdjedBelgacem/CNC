import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  admin: 80,
  moderator: 60,
  instructor: 40,
  sponsor: 30,
  learner: 10,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // `user.role` is the role in the user's HOME tenant. Acting on another tenant (the request
    // tenant differs) it confers nothing, except for a platform super_admin. TenantScopeGuard
    // already refuses that today; this keeps a global admin role from ever reading as admin
    // of a tenant the user merely belongs to.
    const requestTenantId = request.tenant?.id ? String(request.tenant.id) : '';
    if (
      requestTenantId &&
      user.tenantId &&
      String(user.tenantId) !== requestTenantId &&
      user.role !== 'super_admin'
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const userLevel = ROLE_HIERARCHY[user.role as string] || 0;
    const hasRole = requiredRoles.some((role) => {
      const requiredLevel = ROLE_HIERARCHY[role] || 0;
      return userLevel >= requiredLevel;
    });

    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
