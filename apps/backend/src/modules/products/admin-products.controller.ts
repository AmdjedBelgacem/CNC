import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Req, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ProductsService } from './products.service';

@ApiTags('admin-products')
@Controller('admin/products')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
export class AdminProductsController {
  private readonly logger = new Logger(AdminProductsController.name);

  constructor(private products: ProductsService) {}

  private effectiveTenant(req: any, queryTenantId?: string): string {
    const actorRole = (req.user as any)?.role;
    const actorId = (req.user as any)?.id;
    if (actorRole === 'super_admin' && queryTenantId) {
      const v = String(queryTenantId).trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
        throw new BadRequestException('Invalid tenantId');
      }
      this.logger.log(`super_admin ${actorId} tenant override -> ${v} via ${req.method} ${req.url}`);
      return v;
    }
    const tid = String((req.user as any)?.tenantId || '');
    if (!tid) throw new ForbiddenException('Tenant context required');
    return tid;
  }

  @Get()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'List all products with filters (admin)' })
  list(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('academyId') academyId?: string,
    @Query('courseId') courseId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    return this.products.adminList(tid, {
      status,
      search,
      category,
      academyId,
      courseId,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get(':slug')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get product detail by slug (admin)' })
  detail(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    return this.products.findBySlug(tid, slug);
  }

  @Post()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Create a product (admin)' })
  create(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Body() body: any,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    return this.products.create({ ...body, tenantId: tid });
  }

  @Patch(':slug')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Update a product by slug (admin)' })
  async update(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Body() body: any,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const product = await this.products.findBySlug(tid, slug);
    return this.products.update(product.id, body);
  }

  @Post(':slug/publish')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Publish a product (admin)' })
  async publish(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const product = await this.products.findBySlug(tid, slug);
    return this.products.publish(product.id);
  }

  @Post(':slug/unpublish')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Unpublish a product (admin)' })
  async unpublish(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const product = await this.products.findBySlug(tid, slug);
    return this.products.unpublish(product.id);
  }

  @Post(':slug/archive')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Archive a product (admin)' })
  async archive(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const product = await this.products.findBySlug(tid, slug);
    return this.products.archive(product.id);
  }

  @Post(':slug/restore')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Restore a product from archive (admin)' })
  async restore(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const product = await this.products.findBySlug(tid, slug);
    return this.products.restore(product.id);
  }

  @Delete(':slug')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Delete a product (admin)' })
  async remove(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const product = await this.products.findBySlug(tid, slug);
    return this.products.remove(product.id);
  }
}
