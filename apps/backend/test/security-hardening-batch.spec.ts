import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PgDialect } from 'drizzle-orm/pg-core';

import { ROLES_KEY } from '../src/modules/auth/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../src/modules/auth/decorators/public.decorator';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { TenantScopeGuard } from '../src/modules/auth/guards/tenant-scope.guard';
import { TenantGuard } from '../src/common/guards/tenant.guard';

import { CreatePortfolioItemDto, UpdateSocialProfileDto } from '../src/modules/social/dto/social.dto';
import { SocialService } from '../src/modules/social/social.service';
import { RepairController } from '../src/modules/repair/repair.controller';
import { RepairService } from '../src/modules/repair/repair.service';
import { CreateRepairShopDto, UpdateRepairShopDto } from '../src/modules/repair/dto/repair.dto';
import { BuilderController } from '../src/modules/builder/builder.controller';
import { BuilderAiController } from '../src/modules/builder/ai/builder-ai.controller';
import { RbacService } from '../src/modules/rbac/rbac.service';
import { QuotesController } from '../src/modules/quotes/quotes.controller';
import { AdminController } from '../src/modules/admin/admin.controller';
import { EventsController } from '../src/modules/events/events.controller';
import { eventValuesFrom } from '../src/modules/events/events.service';
import { CreateEventDto, UpdateEventDto } from '../src/modules/events/dto/event.dto';
import { escapeLike, ilikeContains } from '../src/common/utils/escape-like';
import { users } from '../src/database/schema/users';

const errorsFor = async <T extends object>(cls: new () => T, plain: object) =>
  (await validate(plainToInstance(cls, plain), { whitelist: true, forbidNonWhitelisted: true }))
    .map((e) => e.property)
    .sort();

const guardsOf = (target: object) => (Reflect.getMetadata(GUARDS_METADATA, target) ?? []) as unknown[];
const rolesOf = (target: object) => Reflect.getMetadata(ROLES_KEY, target) as string[] | undefined;
const isPublic = (target: object) => Reflect.getMetadata(IS_PUBLIC_KEY, target) === true;
const src = (rel: string) => readFileSync(join(__dirname, '..', 'src', rel), 'utf8');

/** A drizzle stand-in whose update/insert chains record what they were given. */
function recordingDb(opts: { returning?: unknown[] } = {}) {
  const calls: { set?: any; values?: any; where?: any } = {};
  const chain: any = {
    set: (v: any) => { calls.set = v; return chain; },
    values: (v: any) => { calls.values = v; return chain; },
    where: (w: any) => { calls.where = w; return chain; },
    returning: async () => opts.returning ?? [],
  };
  const db: any = {
    update: () => chain,
    insert: () => chain,
    query: { users: { findMany: async () => [] } },
  };
  return { db, calls };
}

describe('1. social profile / portfolio cannot write privileged columns', () => {
  it('the profile DTO rejects role, tenantId and other non-profile keys', async () => {
    expect(await errorsFor(UpdateSocialProfileDto, { name: 'A', bio: 'hi', avatarUrl: 'https://x.test/a.png' })).toEqual([]);
    expect(await errorsFor(UpdateSocialProfileDto, { role: 'super_admin' })).toEqual(['role']);
    expect(await errorsFor(UpdateSocialProfileDto, { tenantId: 'x', passwordHash: 'y' })).toEqual(['passwordHash', 'tenantId']);
    expect(await errorsFor(UpdateSocialProfileDto, { avatarUrl: 'javascript:alert(1)' })).toEqual(['avatarUrl']);
    expect(await errorsFor(UpdateSocialProfileDto, { avatarUrl: 'http://x.test/a.png' })).toEqual(['avatarUrl']);
    expect(await errorsFor(UpdateSocialProfileDto, { avatarUrl: '' })).toEqual([]);
    expect(await errorsFor(UpdateSocialProfileDto, { headline: 'x'.repeat(201) })).toEqual(['headline']);
  });

  it('updateProfile copies only the profile keys even if the body carries more', async () => {
    const { db, calls } = recordingDb();
    const service = new SocialService({ db } as any, {} as any);
    await expect(
      service.updateProfile('u1', 't1', { name: 'N', avatarUrl: '', role: 'super_admin', tenantId: 't2' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(Object.keys(calls.set).sort()).toEqual(['avatarUrl', 'name', 'updatedAt']);
    expect(calls.set.avatarUrl).toBeNull();
  });

  it('the portfolio DTO rejects userId and addPortfolioItem forces the caller as owner', async () => {
    expect(await errorsFor(CreatePortfolioItemDto, { title: 'T', userId: 'victim' })).toEqual(['userId']);
    expect(await errorsFor(CreatePortfolioItemDto, { title: 'T', tags: ['a'], projectUrl: 'https://x.test' })).toEqual([]);

    const { db, calls } = recordingDb({ returning: [{ id: 'p1' }] });
    const service = new SocialService({ db } as any, {} as any);
    await service.addPortfolioItem('me', { title: 'T', userId: 'victim', sortOrder: 5 } as any);
    expect(calls.values.userId).toBe('me');
    expect(calls.values).not.toHaveProperty('sortOrder');
  });
});

describe('2. repair writes are admin-only and tenant-scoped', () => {
  const proto = RepairController.prototype;

  it('POST and PATCH require auth, tenant scope and an admin role', () => {
    for (const handler of [proto.create, proto.update]) {
      expect(guardsOf(handler)).toEqual([JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard]);
      expect(rolesOf(handler)).toEqual(['admin', 'super_admin']);
      expect(isPublic(handler)).toBe(false);
    }
  });

  it('the GETs stay public', () => {
    expect(isPublic(proto.findAll)).toBe(true);
    expect(isPublic(proto.findById)).toBe(true);
  });

  it('the DTO rejects tenantId, id and derived counters', async () => {
    expect(await errorsFor(CreateRepairShopDto, { name: 'S', address: 'A' })).toEqual([]);
    expect(await errorsFor(CreateRepairShopDto, { name: 'S', address: 'A', tenantId: 'x', rating: 5 })).toEqual(['rating', 'tenantId']);
    expect(await errorsFor(UpdateRepairShopDto, { id: 'x' })).toEqual(['id']);
  });

  it('create forces the request tenant and update is scoped by tenant and 404s', async () => {
    const created = recordingDb({ returning: [{ id: 's1' }] });
    await new RepairService({ db: created.db } as any).create('tenant-a', { name: 'S', address: 'A', tenantId: 'tenant-b' } as any);
    expect(created.calls.values.tenantId).toBe('tenant-a');

    const updated = recordingDb({ returning: [] });
    await expect(
      new RepairService({ db: updated.db } as any).update('tenant-a', 'shop-1', { name: 'X', tenantId: 'tenant-b' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(updated.calls.set).not.toHaveProperty('tenantId');
    const where = new PgDialect().sqlToQuery(updated.calls.where);
    expect(where.sql).toContain('"tenant_id"');
    expect(where.params).toContain('tenant-a');
  });
});

describe('3. builder controllers bind the caller to the request tenant', () => {
  it.each([BuilderController, BuilderAiController])('%o has TenantScopeGuard at class level', (cls) => {
    expect(guardsOf(cls)).toContain(TenantScopeGuard);
  });

  it('no builder route is public (so the class guards apply to all)', () => {
    for (const cls of [BuilderController, BuilderAiController]) {
      for (const name of Object.getOwnPropertyNames(cls.prototype)) {
        if (name === 'constructor') continue;
        expect(isPublic((cls.prototype as any)[name])).toBe(false);
      }
    }
  });
});

describe('4. rbac setUserRoles refuses a target in another tenant', () => {
  const crossTenantTarget = { id: 'u2', tenantId: 'tenant-b', role: 'super_admin' };
  const rbacWith = (select: () => never) =>
    new RbacService({ db: { query: { users: { findFirst: async () => crossTenantTarget } }, select } } as any);

  it('a tenant admin gets 404', async () => {
    const select = vi.fn(() => { throw new Error('should not query roles'); }) as any;
    await expect(
      rbacWith(select).setUserRoles({ id: 'a1', role: 'admin', permissions: ['*'] }, 'tenant-a', 'u2', []),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(select).not.toHaveBeenCalled();
  });

  it('a super_admin is not stopped by the tenant check', async () => {
    const sentinel = new Error('reached role lookup');
    const select = (() => { throw sentinel; }) as any;
    await expect(
      rbacWith(select).setUserRoles({ id: 's1', role: 'super_admin', permissions: ['*'] }, 'tenant-a', 'u2', []),
    ).rejects.toBe(sentinel);
  });
});

describe('5. quotes admin handlers require an admin role', () => {
  const proto = QuotesController.prototype;
  it('list and update declare @Roles and TenantScopeGuard', () => {
    for (const handler of [proto.listForAdmin, proto.updateForAdmin]) {
      expect(rolesOf(handler)).toEqual(['admin', 'super_admin']);
      expect(guardsOf(handler)).toContain(TenantScopeGuard);
    }
  });
  it('the anonymous submit stays unguarded', () => {
    expect(guardsOf(proto.create)).toEqual([]);
    expect(rolesOf(proto.create)).toBeUndefined();
  });
});

describe('6. admin sessions lookup is tenant-bound', () => {
  const controllerFor = (targetTenant: string) => {
    const auth = {
      getProfile: vi.fn(async () => ({ id: 'u2', tenantId: targetTenant })),
      getSessions: vi.fn(async () => ({ sessions: ['s'] })),
    };
    return { controller: new AdminController({} as any, auth as any, {} as any), auth };
  };

  it('a tenant admin cannot list sessions of another tenant user', async () => {
    const { controller, auth } = controllerFor('tenant-b');
    await expect(controller.listSessions({ role: 'admin', tenantId: 'tenant-a' }, 'u2')).rejects.toBeInstanceOf(ForbiddenException);
    expect(auth.getSessions).not.toHaveBeenCalled();
  });

  it('same-tenant admins and super_admins still can', async () => {
    const same = controllerFor('tenant-a');
    await expect(same.controller.listSessions({ role: 'admin', tenantId: 'tenant-a' }, 'u2')).resolves.toEqual({ sessions: ['s'] });
    const sup = controllerFor('tenant-b');
    await expect(sup.controller.listSessions({ role: 'super_admin', tenantId: 'tenant-a' }, 'u2')).resolves.toEqual({ sessions: ['s'] });
    expect(sup.auth.getProfile).not.toHaveBeenCalled();
  });
});

describe('7. event writes cannot set tenantId / id / timestamps', () => {
  it('the controller uses the class DTOs, not `any`', () => {
    const types = (name: string) => Reflect.getMetadata('design:paramtypes', EventsController.prototype, name);
    expect(types('create')).toContain(CreateEventDto);
    expect(types('update')).toContain(UpdateEventDto);
  });

  it('the update DTO rejects privileged keys', async () => {
    expect(await errorsFor(UpdateEventDto, { title: 'T' })).toEqual([]);
    expect(await errorsFor(UpdateEventDto, { tenantId: 'x', id: 'y', createdAt: 'z' })).toEqual(['createdAt', 'id', 'tenantId']);
  });

  it('eventValuesFrom keeps only declared fields and parses dates', () => {
    const values = eventValuesFrom({ title: 'T', startDate: '2026-01-01T00:00:00Z', tenantId: 'x', id: 'y', updatedAt: 'z' } as any);
    expect(Object.keys(values).sort()).toEqual(['startDate', 'title']);
    expect(values.startDate).toBeInstanceOf(Date);
  });
});

describe('8. LIKE patterns escape user wildcards', () => {
  it('escapeLike escapes %, _ and backslash', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });

  it('ilikeContains binds an escaped pattern with ESCAPE', () => {
    const q = new PgDialect().sqlToQuery(ilikeContains(users.name, '%'));
    expect(q.sql).toMatch(/ILIKE \$1 ESCAPE '\\'/);
    expect(q.params).toEqual(['%\\%%']);
  });

  it.each([
    'modules/repair/repair.service.ts',
    'modules/social/social.service.ts',
    'modules/courses/courses.service.ts',
    'modules/products/products.service.ts',
    'modules/quotes/quotes.service.ts',
    'modules/search/search.service.ts',
  ])('%s uses the shared helper and builds no raw %%${...}%% pattern', (file) => {
    const text = src(file);
    expect(text).toContain("common/utils/escape-like'");
    expect(text).not.toMatch(/`%\$\{(?!escapeLike)/);
    expect(text).not.toMatch(/function escapeLike/);
  });
});
