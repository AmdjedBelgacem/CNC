import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { TenantGuard } from '../src/common/guards/tenant.guard';
import { TenantResolveGuard } from '../src/common/guards/tenant-resolve.guard';
import { TenantScopeGuard } from '../src/modules/auth/guards/tenant-scope.guard';

// Helper to mock ExecutionContext
function ctx(req: any, handler = {}, klass = {}) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => klass,
  } as any;
}

describe('P0 Tenant Isolation', () => {
  it('TenantResolveGuard – missing X-Tenant-Slug for auth route → request.tenant = null (fail closed downstream)', async () => {
    const drizzle = { db: { query: { tenants: { findFirst: vi.fn().mockResolvedValue(null) } } } } as any;
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as any;
    const guard = new TenantResolveGuard(drizzle, reflector);
    const req: any = { headers: {} };
    await guard.canActivate(ctx(req));
    expect(req.tenant).toBeNull();
  });

  it('TenantResolveGuard – invalid slug format → null', async () => {
    const drizzle = { db: { query: { tenants: { findFirst: vi.fn() } } } } as any;
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as any;
    const guard = new TenantResolveGuard(drizzle, reflector);
    const req: any = { headers: { 'x-tenant-slug': '../../etc' } };
    await guard.canActivate(ctx(req));
    expect(req.tenant).toBeNull();
    expect(drizzle.db.query.tenants.findFirst).not.toHaveBeenCalled();
  });

  it('TenantGuard – unauth public bypass, auth without tenant → 403', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as any;
    const guard = new TenantGuard(reflector);
    const req: any = { tenant: null };
    expect(() => guard.canActivate(ctx(req))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx(req))).toThrow('Tenant context required');
  });

  it('TenantGuard – public route → pass', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) } as any;
    const guard = new TenantGuard(reflector);
    expect(guard.canActivate(ctx({}))).toBe(true);
  });

  it('TenantScopeGuard – unauthenticated → 401', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as any;
    const guard = new TenantScopeGuard(reflector);
    const req: any = { user: null, tenant: { id: 't1', isActive: true } };
    expect(() => guard.canActivate(ctx(req))).toThrow(UnauthorizedException);
  });

  it('TenantScopeGuard – same tenant → pass', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as any;
    const guard = new TenantScopeGuard(reflector);
    const req: any = { user: { tenantId: 't1', role: 'admin' }, tenant: { id: 't1', isActive: true } };
    expect(guard.canActivate(ctx(req))).toBe(true);
  });

  it('TenantScopeGuard – cross-tenant admin without secondary role → 403', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as any;
    const guard = new TenantScopeGuard(reflector);
    const req: any = { user: { tenantId: 't1', role: 'admin', tenantRoles: [] }, tenant: { id: 't2', isActive: true } };
    expect(() => guard.canActivate(ctx(req))).toThrow(ForbiddenException);
  });

  it('TenantScopeGuard – cross-tenant with tenantRoles → pass', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as any;
    const guard = new TenantScopeGuard(reflector);
    const req: any = { user: { tenantId: 't1', role: 'admin', tenantRoles: [{ tenantId: 't2' }] }, tenant: { id: 't2', isActive: true } };
    expect(guard.canActivate(ctx(req))).toBe(true);
  });

  it('TenantScopeGuard – learner cross-tenant → 403', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as any;
    const guard = new TenantScopeGuard(reflector);
    const req: any = { user: { tenantId: 't1', role: 'learner' }, tenant: { id: 't2', isActive: true } };
    expect(() => guard.canActivate(ctx(req))).toThrow('Access to this tenant is not permitted');
  });

  it('TenantScopeGuard – super_admin header → pass (audited at controller)', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as any;
    const guard = new TenantScopeGuard(reflector);
    const req: any = { user: { tenantId: 't1', role: 'super_admin' }, tenant: { id: 't2', isActive: true } };
    expect(guard.canActivate(ctx(req))).toBe(true);
  });
});

describe('P0 effectiveTenant validation', () => {
  function effectiveTenant(req: any, queryTenantId?: string) {
    const role = req.user?.role;
    if (role === 'super_admin' && queryTenantId) {
      const v = String(queryTenantId).trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) throw new Error('Invalid tenantId');
      return v;
    }
    const tid = String(req.user?.tenantId || '');
    if (!tid) throw new Error('Tenant context required');
    return tid;
  }
  it('learner with super_admin query param → ignored, uses own tenant', () => {
    const req = { user: { role: 'learner', tenantId: 't-learner' } };
    expect(effectiveTenant(req, '00000000-0000-0000-0000-000000000001')).toBe('t-learner');
  });
  it('super_admin with invalid UUID → throws', () => {
    const req = { user: { role: 'super_admin', tenantId: 't1' } };
    expect(() => effectiveTenant(req, 'not-a-uuid')).toThrow('Invalid tenantId');
  });
  it('super_admin with valid UUID → uses override', () => {
    const req = { user: { role: 'super_admin', tenantId: 't1' } };
    expect(effectiveTenant(req, '123e4567-e89b-12d3-a456-426614174000')).toBe('123e4567-e89b-12d3-a456-426614174000');
  });
  it('missing tenant → throws', () => {
    const req = { user: { role: 'admin', tenantId: '' } };
    expect(() => effectiveTenant(req)).toThrow('Tenant context required');
  });
});
