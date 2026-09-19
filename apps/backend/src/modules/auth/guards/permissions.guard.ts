import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, PermissionsMeta } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = this.reflector.getAllAndOverride<PermissionsMeta>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta || meta.permissions.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentication required');

    const perms: string[] = user.permissions || [];
    if (perms.includes('*')) return true;

    const ok =
      meta.mode === 'any'
        ? meta.permissions.some((p) => perms.includes(p))
        : meta.permissions.every((p) => perms.includes(p));

    if (!ok) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
