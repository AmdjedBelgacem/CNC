import { Controller, Post, Get, Req, Headers, HttpCode, HttpStatus, UseGuards, Param } from '@nestjs/common';
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

  /*
   * `POST /payments/checkout` (legacy Stripe) was removed. Nothing in the app used it (checkout
   * is Moyasar), and it took an untyped body: negative or fractional quantities, totals summed
   * across currencies, and arbitrary success/cancel redirect URLs. The webhook below stays so
   * any order created through it can still settle.
   */

  @UseGuards(JwtAuthGuard)
  @Get('orders/by-session/:sessionId')
  @ApiOperation({ summary: 'Get order by Stripe session (tenant-isolated, user-scoped)' })
  getOrderBySession(
    @CurrentUser() user: { id: string; tenantId: string },
    @Param('sessionId') sessionId: string,
  ) {
    return this.payments.getOrderBySession(sessionId, user.tenantId, user.id);
  }

  // `GET payments/orders/:id` now lives on MoyasarController: it is the same
  // tenant+user scoped lookup but returns line items and fulfillment state, which
  // the gateway-neutral order model needs. Declaring it twice is a boot failure.

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
