import {
  Controller, Get, Post, Patch, Param, Query, Body,
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
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @CurrentTenant() tenant: { id: string },
    @Query('category') category?: string,
    @Query('featured') featured?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.products.findByTenant(tenant.id, {
      category,
      featured: featured === 'true',
      search,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured products' })
  featured(@CurrentTenant() tenant: { id: string }) {
    return this.products.findByTenant(tenant.id, { featured: true, limit: 8 });
  }

  @Get('related/:id')
  @ApiOperation({ summary: 'Get related products by tags' })
  related(
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
  ) {
    return this.products.findRelated(tenant.id, id);
  }

  @Get('by-tags')
  @ApiOperation({ summary: 'Get products matching given tags' })
  byTags(
    @CurrentTenant() tenant: { id: string },
    @Query('tags') tags: string,
  ) {
    return this.products.findByCourseTags(tenant.id, tags ? tags.split(',') : []);
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
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
  ) {
    return this.products.findBySlug(tenant.id, slug);
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
    // Verify product belongs to tenant before update
    const existing = await this.products.findById(id);
    if (String((existing as any).tenantId) !== String(tenant.id)) {
      throw new NotFoundException('Product not found');
    }
    return this.products.update(id, body);
  }
}
