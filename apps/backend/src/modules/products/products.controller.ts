import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body, Req,
  UseGuards, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List published products with filters' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'featured', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'academyId', required: false })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @CurrentTenant() tenant: { id: string } | null,
    @Req() req: any,
    @Query('category') category?: string,
    @Query('featured') featured?: string,
    @Query('search') search?: string,
    @Query('academyId') academyId?: string,
    @Query('courseId') courseId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!tenant) return { data: [], total: 0 };
    return this.products.findByTenant(tenant.id, {
      // The resolver reads the locale cookie, then `?locale=`, then the header.
      localeInput: req,
      category,
      featured: featured === 'true',
      search,
      academyId,
      courseId,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured products' })
  featured(@CurrentTenant() tenant: { id: string } | null) {
    if (!tenant) return { data: [], total: 0 };
    return this.products.findByTenant(tenant.id, { featured: true, limit: 8 });
  }

  @Get('related/:id')
  @ApiOperation({ summary: 'Get related products by tags' })
  related(
    @CurrentTenant() tenant: { id: string } | null,
    @Param('id') id: string,
  ) {
    if (!tenant) return { data: [], total: 0 };
    return this.products.findRelated(tenant.id, id);
  }

  @Get('by-tags')
  @ApiOperation({ summary: 'Get products matching given tags' })
  byTags(
    @CurrentTenant() tenant: { id: string } | null,
    @Query('tags') tags: string,
  ) {
    if (!tenant) return { data: [], total: 0 };
    return this.products.findByCourseTags(tenant.id, tags ? tags.split(',') : []);
  }

  @Get('by-academy/:academyId')
  @ApiOperation({ summary: 'Get products linked to an academy' })
  byAcademy(
    @CurrentTenant() tenant: { id: string } | null,
    @Param('academyId') academyId: string,
  ) {
    if (!tenant) return { data: [], total: 0 };
    return this.products.findByAcademy(tenant.id, academyId);
  }

  @Get('by-course/:courseId')
  @ApiOperation({ summary: 'Get products linked to a course' })
  byCourse(
    @CurrentTenant() tenant: { id: string } | null,
    @Param('courseId') courseId: string,
  ) {
    if (!tenant) return { data: [], total: 0 };
    return this.products.findByCourse(tenant.id, courseId);
  }

  @Get('check-availability')
  @ApiOperation({ summary: 'Check if product is available for quantity' })
  checkAvailability(
    @Query('productId') productId: string,
    @Query('quantity') quantity: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.products.checkAvailability(productId, +quantity, variantId);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get product by slug' })
  findBySlug(
    @CurrentTenant() tenant: { id: string } | null,
    @Param('slug') slug: string,
    @Req() req: any,
  ) {
    if (!tenant) throw new NotFoundException('Tenant not resolved');
    return this.products.findBySlug(tenant.id, slug, req);
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product (admin-only, tenant-scoped)' })
  create(
    @CurrentTenant() tenant: { id: string },
    @Body() body: any,
  ) {
    return this.products.create({ ...body, tenantId: tenant.id });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product (admin-only, tenant-scoped)' })
  async update(@CurrentTenant() tenant: { id: string }, @Param('id') id: string, @Body() body: any) {
    const existing = await this.products.findById(id);
    if (String((existing as any).tenantId) !== String(tenant.id)) {
      throw new NotFoundException('Product not found');
    }
    return this.products.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product (admin-only)' })
  async remove(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    const existing = await this.products.findById(id);
    if (String((existing as any).tenantId) !== String(tenant.id)) {
      throw new NotFoundException('Product not found');
    }
    return this.products.remove(id);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a product (admin-only)' })
  async publish(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    const existing = await this.products.findById(id);
    if (String((existing as any).tenantId) !== String(tenant.id)) {
      throw new NotFoundException('Product not found');
    }
    return this.products.publish(id);
  }

  @Post(':id/unpublish')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unpublish a product (admin-only)' })
  async unpublish(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    const existing = await this.products.findById(id);
    if (String((existing as any).tenantId) !== String(tenant.id)) {
      throw new NotFoundException('Product not found');
    }
    return this.products.unpublish(id);
  }

  @Post(':id/archive')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a product (admin-only)' })
  async archive(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    const existing = await this.products.findById(id);
    if (String((existing as any).tenantId) !== String(tenant.id)) {
      throw new NotFoundException('Product not found');
    }
    return this.products.archive(id);
  }

  @Post(':id/restore')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore a product from archive (admin-only)' })
  async restore(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    const existing = await this.products.findById(id);
    if (String((existing as any).tenantId) !== String(tenant.id)) {
      throw new NotFoundException('Product not found');
    }
    return this.products.restore(id);
  }
}
