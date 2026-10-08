import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Req, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ProductsService } from './products.service';
import { UploadService } from '../auth/services/upload.service';
import { UploadFileDto } from '../courses/dto/courses.dto';
import { ConfigService } from '../../config/config.service';

@ApiTags('admin-products')
@Controller('admin/products')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
export class AdminProductsController {
  private readonly logger = new Logger(AdminProductsController.name);

  constructor(
    private products: ProductsService,
    private upload: UploadService,
    private config: ConfigService,
  ) {}

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
  @ApiOperation({ summary: 'Get product detail by slug (admin), including its ordered gallery' })
  async detail(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const product = await this.products.findBySlug(tid, slug);
    /**
     * The gallery is seeded from the legacy `thumbnailUrl` / `mediaUrls` shape on first
     * read, so an existing product gains gallery rows without a migration needing to
     * know which rows already existed. Cheap, and idempotent.
     */
    // findBySlug returns the raw row or a localized view depending on whether a locale
    // was passed; both carry the five fields the gallery backfill needs.
    const images = await this.products.ensureImagesFromLegacy(product as {
      id: string;
      tenantId: string;
      title?: string | null;
      thumbnailUrl?: string | null;
      mediaUrls?: string[] | null;
    });
    return { ...product, images, thumbnailUrl: product.thumbnailUrl ?? images.find((i) => i.isPrimary)?.url ?? null };
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
  @ApiOperation({
    summary: 'Partially update a product by slug (admin)',
    description:
      'Only keys present in the body are changed; omitted keys are left untouched. ' +
      'Pass expectedUpdatedAt for optimistic locking (409 on conflict). The gallery is ' +
      'managed through the /images endpoints, never through this body.',
  })
  async update(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Body() body: Record<string, unknown>,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const product = await this.products.findBySlug(tid, slug);
    const { expectedUpdatedAt, ...fields } = (body ?? {}) as { expectedUpdatedAt?: string } & Record<string, unknown>;
    const updated = await this.products.update(product.id, fields, expectedUpdatedAt ?? null);
    const images = await this.products.listImages(updated.id);
    // Return the FULL entity so the client can rehydrate from the server's version
    // rather than from whatever local state produced this request.
    return { ...updated, images };
  }

  @Post('upload')
  @Roles('super_admin', 'admin', 'instructor')
  @ApiOperation({ summary: 'Upload a product media file (thumbnail, PDFs)' })
  uploadFile(@Body() body: UploadFileDto) {
    // The fron宔 uses this so thumbnails and PDFs become hosted URLs rather
    // than base64 data URLs that would blow past the varchar(500) columns.
    return this.upload.uploadGeneric(body.file, body.folder || 'covers', body.name);
  }

  // ------------------------------------------------------------- gallery ---
  // Dedicated endpoints rather than a body field, so an ordinary product save can
  // never touch images. `images` is intentionally NOT part of the PATCH body.

  @Post(':slug/images')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Attach an uploaded image to a product gallery' })
  async addImage(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Body() body: { url: string; alt?: string | null; hotspots?: unknown; makePrimary?: boolean },
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const product = await this.products.findBySlug(tid, slug);
    const created = await this.products.addImage({
      tenantId: tid,
      productId: product.id,
      url: body?.url ?? '',
      alt: body?.alt ?? null,
      hotspots: body?.hotspots,
      makePrimary: body?.makePrimary === true,
      publicBase: this.config.get('S3_PUBLIC_URL'),
    });
    return created;
  }

  @Get(':slug/images')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'List a product gallery in display order' })
  async listImages(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const product = await this.products.findBySlug(tid, slug);
    return this.products.ensureImagesFromLegacy(product as never);
  }

  @Patch(':slug/images/reorder')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Reorder a product gallery; body is { imageIds: [...] } in display order' })
  async reorderImages(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Body() body: { imageIds: string[] },
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const product = await this.products.findBySlug(tid, slug);
    return this.products.reorderImages({
      tenantId: tid,
      productId: product.id,
      imageIds: Array.isArray(body?.imageIds) ? body.imageIds : [],
    });
  }

  @Patch(':slug/images/:imageId')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Edit an image alt text or hotspots, or set it as the primary' })
  async updateImage(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Param('imageId') imageId: string,
    @Body() body: { alt?: string | null; hotspots?: unknown; setPrimary?: boolean },
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const product = await this.products.findBySlug(tid, slug);
    return this.products.updateImage({
      tenantId: tid,
      productId: product.id,
      imageId,
      alt: body?.alt,
      hotspots: body?.hotspots,
      setPrimary: body?.setPrimary === true,
    });
  }

  @Delete(':slug/images/:imageId')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Delete one gallery image (never the whole product)' })
  async deleteImage(
    @Req() req: any,
    @CurrentTenant() tenant: { id: string },
    @Param('slug') slug: string,
    @Param('imageId') imageId: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride) || tenant.id;
    const product = await this.products.findBySlug(tid, slug);
    return this.products.deleteImage({ tenantId: tid, productId: product.id, imageId });
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
