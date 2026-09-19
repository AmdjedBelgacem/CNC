import { Injectable, CanActivate, ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DrizzleService } from '../../database/drizzle.service';
import { tenants } from '../../database/schema/tenants';
import { IS_PUBLIC_KEY } from '../../modules/auth/decorators/public.decorator';
import { TENANT_SCOPED_KEY } from '../decorators/tenant-scoped.decorator';
import { eq } from 'drizzle-orm';

@Injectable()
export class TenantResolveGuard implements CanActivate {
  constructor(
    private drizzle: DrizzleService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const tenantScoped = this.reflector.getAllAndOverride<boolean>(TENANT_SCOPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const rawSlug = request.headers?.['x-tenant-slug'];
    const tenantSlug = typeof rawSlug === 'string' && rawSlug.trim() ? rawSlug.trim() : null;

    /** Fail closed with a clean 404 instead of letting a controller dereference null. */
    const unresolved = () => {
      request.tenant = null;
      if (tenantScoped) {
        throw new NotFoundException('Tenant not found');
      }
      return true;
    };

    // Public routes: still resolve if header present, but never default silently.
    if (!tenantSlug) {
      if (isPublic) {
        // Try to resolve a default active tenant for public pages, but don't fail.
        const fallback = await this.drizzle.db.query.tenants.findFirst({
          where: eq(tenants.isActive, true),
        });
        request.tenant = fallback ?? null;
        if (!fallback && tenantScoped) throw new NotFoundException('Tenant not found');
        return true;
      }
      // Authenticated routes require explicit tenant header – fail closed.
      return unresolved();
    }

    // Validate slug format to prevent enumeration noise / injection
    if (!/^[a-z0-9-]{2,100}$/.test(tenantSlug)) {
      return unresolved();
    }

    const tenant = await this.drizzle.db.query.tenants.findFirst({
      where: eq(tenants.slug, tenantSlug),
    });

    request.tenant = tenant ?? null;
    if (!tenant && tenantScoped) throw new NotFoundException('Tenant not found');
    return true;
  }
}
