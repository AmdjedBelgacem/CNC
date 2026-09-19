import { Controller, Post, Get, Body, Req, Headers, HttpCode, HttpStatus, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { SkipCsrf } from '../auth/guards/csrf.guard';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Stripe checkout session (tenant-isolated, one-time)' })
  createCheckout(
    @CurrentUser() user: { id: string; tenantId: string },
    @Body() body: {
      items: any[];
      successUrl: string;
      cancelUrl: string;
    },
  ) {
    // Strict tenant isolation: use JWT tenant, not header
    return this.payments.createCheckout({
      tenantId: user.tenantId,
      userId: user.id,
      items: body.items,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('orders/by-session/:sessionId')
  @ApiOperation({ summary: 'Get order by Stripe session (tenant-isolated, user-scoped)' })
  getOrderBySession(
    @CurrentUser() user: { id: string; tenantId: string },
    @Param('sessionId') sessionId: string,
  ) {
    return this.payments.getOrderBySession(sessionId, user.tenantId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order by id (tenant + user scoped)' })
  getOrder(
    @CurrentUser() user: { id: string; tenantId: string },
    @Param('id') id: string,
  ) {
    return this.payments.getOrder(user.tenantId, user.id, id);
  }

  @Public()
  @SkipCsrf() // Stripe cannot present a CSRF token; authenticity comes from the signature.
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook handler — verifies signature, no order confirmed without verified event' })
  webhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody: string | Buffer = req.rawBody ?? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? ''));
    return this.payments.handleWebhook(rawBody, signature);
  }
}
