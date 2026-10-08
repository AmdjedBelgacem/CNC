import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Query,
  Param,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { QuotesService } from './quotes.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('quotes')
/**
 * Mounted at both `/quotes` and `/admin/quotes`.
 *
 * The public submit is `/quotes`, but the admin inbox lives at `/admin/quotes` alongside
 * every other admin screen — and a single-segment controller would have made it
 * unreachable. The GET and PATCH handlers carry admin guards regardless of which prefix
 * they are reached through, so the extra mount exposes nothing.
 */
@Controller(['quotes', 'admin/quotes'])
export class QuotesController {
  constructor(private quotes: QuotesService) {}

  /**
   * Public. A prospective customer has no account, which makes this the one write path a
   * stranger can reach — hence the throttle on top of the per-email cap in the service.
   * Without it, one script could post thousands of rows.
   */
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit a quote request (anonymous)' })
  create(
    @Body()
    body: {
      name: string;
      email: string;
      company?: string;
      message?: string;
      productId?: string;
      variantId?: string;
      quantity?: number;
    },
    @Req() req: any,
  ) {
    // The tenant comes from the resolved request, never from the body.
    const tenantId = req?.tenant?.id ?? req?.tenantId ?? null;
    return this.quotes.create({
      tenantId,
      productId: body.productId ?? null,
      variantId: body.variantId ?? null,
      name: body.name,
      email: body.email,
      company: body.company ?? null,
      message: body.message ?? null,
      quantity: body.quantity ?? null,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List quote requests for this tenant' })
  listForAdmin(
    @CurrentTenant() tenant: { id: string },
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.quotes.listForAdmin(tenant.id, {
      status,
      search,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Advance a quote request (status, note, quoted price)' })
  updateForAdmin(
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
    @Body() body: { status?: string; adminNote?: string | null; quotedPrice?: number | null },
  ) {
    return this.quotes.updateForAdmin(tenant.id, id, body);
  }
}