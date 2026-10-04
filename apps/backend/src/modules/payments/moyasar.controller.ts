import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SkipCsrf } from '../auth/guards/csrf.guard';
import { MoyasarService } from './moyasar.service';
import type { OrderItemType } from '../../database/schema/orders';

interface CheckoutLine {
  itemType: OrderItemType;
  refId: string;
  quantity?: number;
  variantId?: string;
}

@ApiTags('payments')
@Controller('payments')
export class MoyasarController {
  constructor(private readonly moyasar: MoyasarService) {}

  /**
   * Create a pending order.
   *
   * Tenant comes from the JWT, never a header, and prices come from the database
   * — the request says what to buy, never what it costs.
   */
  @UseGuards(JwtAuthGuard)
  @Post('moyasar/create-order')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a pending Moyasar order and return checkout parameters' })
  async createOrder(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Body()
    body: { lines: CheckoutLine[]; idempotencyKey?: string; successUrl?: string; cancelUrl?: string },
  ) {
    const order = await this.moyasar.createOrder({
      tenantId: tenant.id,
      userId: user.id,
      lines: Array.isArray(body?.lines) ? body.lines : [],
      idempotencyKey: body?.idempotencyKey ?? null,
      successUrl: body?.successUrl,
      cancelUrl: body?.cancelUrl,
    });
    const settings = await this.moyasar.getPublicSettings(tenant.id);
    return {
      ...order,
      // The only credential that ever reaches the browser.
      publishableKey: settings.publishableKey,
      liveMode: settings.liveMode,
    };
  }

  /**
   * The payer returns here with a payment id. The browser's word is not
   * evidence: the payment is re-fetched with the secret key and checked against
   * the order's amount and currency before anything is fulfilled.
   */
  @UseGuards(JwtAuthGuard)
  @Get('moyasar/callback')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a Moyasar payment against an order and fulfil it' })
  async callback(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Query('order') orderId: string | undefined,
    @Query('payment') paymentId: string | undefined,
    @Query('id') idFallback: string | undefined,
  ) {
    const payment = paymentId ?? idFallback;
    if (!orderId || !payment) {
      return { status: 'failed', reason: 'missing_parameters' };
    }
    try {
      const settled = await this.moyasar.settleFromPayment({
        tenantId: tenant.id,
        orderId,
        paymentId: payment,
        trigger: 'callback',
        // Without this, any authenticated member of the tenant could settle
        // somebody else's order by id. The owner check lives in the service so
        // the webhook path cannot accidentally skip it.
        actorUserId: user.id,
      });
      const order = await this.moyasar.getOrderForViewer(tenant.id, user.id, orderId);
      return {
        status: settled.status,
        fulfilled: settled.fulfilled,
        reason: settled.reason ?? null,
        order,
      };
    } catch (error) {
      return {
        status: 'failed',
        fulfilled: false,
        reason: (error as Error).message.slice(0, 200),
        order: null,
      };
    }
  }

  /**
   * Moyasar's server-to-server events. The shared secret is verified in constant
   * time and the payload is only a pointer: the payment is re-fetched before
   * anything is marked paid.
   */
  @Public()
  @SkipCsrf()
  @Post('moyasar/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Moyasar webhook — secret-verified, idempotent, never a bypass' })
  async webhook(
    @CurrentTenant() tenant: { id: string },
    @Req() req: { rawBody?: string | Buffer; body?: unknown },
    @Headers('x-moyasar-token') headerSecret: string | undefined,
  ) {
    const raw =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : req.rawBody
          ? req.rawBody.toString('utf8')
          : JSON.stringify(req.body ?? {});
    const provided = headerSecret ?? this.secretFromBody(raw);
    return this.moyasar.handleWebhook(tenant.id, raw, provided ?? null);
  }

  /** Moyasar sends the token in the body for some event types. */
  private secretFromBody(raw: string): string | null {
    try {
      const parsed = JSON.parse(raw) as { secret_token?: string };
      return typeof parsed.secret_token === 'string' ? parsed.secret_token : null;
    } catch {
      return null;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('orders/mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My orders (tenant + user scoped)' })
  async myOrders(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
  ) {
    const data = await this.moyasar.listMyOrders(tenant.id, user.id, limit ? Number(limit) : 20);
    return { data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('purchases')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Products I have bought, from the purchase ledger' })
  async myPurchases(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
  ) {
    return {
      data: await this.moyasar.listProductPurchases(tenant.id, user.id, limit ? Number(limit) : 50),
    };
  }

  // The guard is what populates request.user/request.tenant; without it this
  // route 500s on an undefined user instead of 401-ing an anonymous caller.
  @UseGuards(JwtAuthGuard)
  @Get('orders/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'One of my orders, verified against the order owner' })
  async myOrder(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return { data: await this.moyasar.getOrderForViewer(tenant.id, user.id, id) };
  }

  /** Enough for the checkout page to know whether it can render a form. */
  @UseGuards(JwtAuthGuard)
  @Get('moyasar/config')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Public payment configuration (no secrets)' })
  async config(@CurrentTenant() tenant: { id: string }) {
    return { data: await this.moyasar.getPublicSettings(tenant.id) };
  }
}
