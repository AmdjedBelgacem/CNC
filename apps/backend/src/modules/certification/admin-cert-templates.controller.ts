import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, Req, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsArray, IsHexColor, MaxLength, IsIn, ValidateNested, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CertificationService } from './certification.service';

class TemplateFieldDto {
  @IsString() key!: string;
  @IsString() label!: string;
  @IsNumber() @Min(0) @Max(100) x!: number;
  @IsNumber() @Min(0) @Max(100) y!: number;
  @IsNumber() @Min(6) @Max(72) fontSize!: number;
  @IsString() @IsIn(['normal', 'bold', '600', '700']) fontWeight!: string;
  @IsString() color!: string;
}

class CreateTemplateDto {
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsString() @IsIn(['modern', 'classic', 'minimal']) layout?: string;
  @IsOptional() @IsString() @IsHexColor() primaryColor?: string;
  @IsOptional() @IsString() @IsHexColor() secondaryColor?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) backgroundUrl?: string;
  @IsOptional() @IsString() fontFamily?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TemplateFieldDto) fields?: TemplateFieldDto[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateTemplateDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @IsIn(['modern', 'classic', 'minimal']) layout?: string;
  @IsOptional() @IsString() @IsHexColor() primaryColor?: string;
  @IsOptional() @IsString() @IsHexColor() secondaryColor?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) backgroundUrl?: string;
  @IsOptional() @IsString() fontFamily?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TemplateFieldDto) fields?: TemplateFieldDto[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags('admin-cert-templates')
@Controller('admin/cert-templates')
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
export class AdminCertTemplatesController {
  private readonly logger = new Logger(AdminCertTemplatesController.name);
  constructor(private certification: CertificationService) {}

  private effectiveTenant(req: any, queryTenantId?: string): string {
    const actorRole = (req.user as any)?.role;
    const actorId = (req.user as any)?.id;
    if (actorRole === 'super_admin' && queryTenantId) {
      const v = String(queryTenantId).trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
        throw new BadRequestException('Invalid tenantId');
      }
      this.logger.log(`super_admin ${actorId} tenant override → ${v} via ${req.method} ${req.url}`);
      return v;
    }
    const tid = String((req.user as any)?.tenantId || '');
    if (!tid) throw new ForbiddenException('Tenant context required');
    return tid;
  }

  @Get()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'List certificate templates' })
  list(
    @Req() req: any,
    @Query('q') q?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride);
    return this.certification.listTemplates(tid, {
      q: q || undefined,
      isActive: isActive || undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get(':id')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Get template detail' })
  detail(@Req() req: any, @Param('id') id: string, @Query('tenantId') tenantIdOverride?: string) {
    const tid = this.effectiveTenant(req, tenantIdOverride);
    return this.certification.getTemplate(tid, id);
  }

  @Post()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Create a certificate template' })
  create(@Req() req: any, @Body() dto: CreateTemplateDto, @Query('tenantId') tenantIdOverride?: string) {
    const tid = this.effectiveTenant(req, tenantIdOverride);
    const actorId = (req.user as any)?.id;
    const ip = req.ip;
    const ua = req.headers?.['user-agent'];
    return this.certification.createTemplate(tid, actorId, dto, ip, ua);
  }

  @Patch(':id')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Update a certificate template' })
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @Query('tenantId') tenantIdOverride?: string,
  ) {
    const tid = this.effectiveTenant(req, tenantIdOverride);
    const actorId = (req.user as any)?.id;
    const ip = req.ip;
    const ua = req.headers?.['user-agent'];
    return this.certification.updateTemplate(tid, id, actorId, dto, ip, ua);
  }
}
