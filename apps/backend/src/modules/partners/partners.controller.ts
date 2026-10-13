import { Controller, Post, Get, Body, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { PartnersService } from './partners.service';
import { CreatePartnerApplicationDto } from './dto/partner-application.dto';


@ApiTags('partners')
@Controller('partners')
export class PartnersController {
  constructor(private service: PartnersService) {}

  @Post('apply')
  @UseGuards(TenantGuard, OptionalAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Apply to become a partner' })
  async apply(@Body() body: CreatePartnerApplicationDto, @Req() req: any, @CurrentTenant() tenant: any) {
    const tenantId = tenant?.id ?? req.tenant?.id;
    const user = req.user;
    const userId = user?.id ?? user?.sub ?? null;
    return this.service.create(body, tenantId, userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Current user partner applications' })
  async me(@Req() req: any, @CurrentTenant() tenant: any) {
    const tenantId = tenant?.id ?? req.tenant?.id;
    const userId = req.user?.id ?? req.user?.sub;
    return this.service.getForUser(userId, tenantId);
  }
}
