import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, eq } from 'drizzle-orm';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { DrizzleService } from '../../database/drizzle.service';
import { paymentConfigs } from '../../database/schema/payments-config';
import { SecretBoxService } from '../../common/security/secret-box.service';
import { AuditService } from '../auth/services/audit.service';
import { MoyasarService } from './moyasar.service';
import { UpdatePaymentConfigDto } from './dto/payment-config.dto';

@ApiTags('admin-payments')
@ApiBearerAuth()
@Controller('admin/payments')
@TenantScoped()
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard, PermissionsGuard)
@Roles('super_admin', 'admin')
export class AdminPaymentsController {
  constructor(
    private readonly moyasar: MoyasarService,
    private readonly drizzle: DrizzleService,
    private readonly secrets: SecretBoxService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Read config with secrets masked. The stored ciphertext is never returned —
   * only whether a key exists, so the UI can say "configured" without ever
   * holding the value.
   */
  @Get('config')
  @Permissions('settings:view')
  @ApiOperation({ summary: 'Payment configuration with secrets masked' })
  async getConfig(@CurrentTenant() tenant: { id: string }) {
    const [row] = await this.drizzle.db
      .select()
      .from(paymentConfigs)
      .where(and(eq(paymentConfigs.tenantId, tenant.id), eq(paymentConfigs.provider, 'moyasar')))
      .limit(1);
    return {
      data: {
        provider: 'moyasar',
        publishableKey: row?.publishableKey ?? null,
        publishableKeyMasked: row?.publishableKey ? this.mask(row.publishableKey) : null,
        secretKeyConfigured: Boolean(row?.encryptedSecretKey),
        webhookSecretConfigured: Boolean(row?.encryptedWebhookSecret),
        currency: row?.currency ?? 'SAR',
        enabled: row?.enabled ?? false,
        liveMode: row?.liveMode ?? false,
        status: row?.status ?? 'not_configured',
        lastTestedAt: row?.lastTestedAt ?? null,
        lastErrorCode: row?.lastErrorCode ?? null,
        encryptionReady: this.secrets.configured,
        health: await this.moyasar.health(tenant.id),
      },
    };
  }

  @Put('config')
  @Permissions('settings:edit')
  @ApiOperation({ summary: 'Update payment configuration; secret keys are write-only' })
  async updateConfig(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Body() dto: UpdatePaymentConfigDto,
    @Req() request: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const [existing] = await this.drizzle.db
      .select()
      .from(paymentConfigs)
      .where(and(eq(paymentConfigs.tenantId, tenant.id), eq(paymentConfigs.provider, 'moyasar')))
      .limit(1);

    let encryptedSecretKey = existing?.encryptedSecretKey ?? null;
    let encryptedWebhookSecret = existing?.encryptedWebhookSecret ?? null;

    if (dto.clearSecretKey) encryptedSecretKey = null;
    if (dto.secretKey) {
      encryptedSecretKey = this.secrets.encryptOrThrow(dto.secretKey, tenant.id, 'moyasar');
    }
    if (dto.clearWebhookSecret) encryptedWebhookSecret = null;
    if (dto.webhookSecret) {
      encryptedWebhookSecret = this.secrets.encryptOrThrow(
        dto.webhookSecret,
        tenant.id,
        'moyasar-webhook',
      );
    }

    const enabled = dto.enabled ?? existing?.enabled ?? false;
    if (enabled && !encryptedSecretKey && !dto.secretKey) {
      // Fail closed at configuration time rather than at the till.
      return {
        data: { error: 'A secret key is required before payments can be enabled' },
        status: 400,
      };
    }

    const values = {
      tenantId: tenant.id,
      provider: 'moyasar' as const,
      publishableKey: dto.publishableKey ?? existing?.publishableKey ?? null,
      encryptedSecretKey,
      encryptedWebhookSecret,
      currency: (dto.currency ?? existing?.currency ?? 'SAR').toUpperCase(),
      enabled,
      liveMode: dto.liveMode ?? existing?.liveMode ?? false,
      successUrl: dto.successUrl ?? existing?.successUrl ?? null,
      cancelUrl: dto.cancelUrl ?? existing?.cancelUrl ?? null,
      status: enabled ? 'configured' : 'disabled',
      lastErrorCode: null,
      updatedAt: new Date(),
    };

    await this.drizzle.db
      .insert(paymentConfigs)
      .values(values)
      .onConflictDoUpdate({
        target: [paymentConfigs.tenantId, paymentConfigs.provider],
        set: values,
      });

    await this.audit.log({
      userId: user.id,
      tenantId: tenant.id,
      action: 'payment_config_updated',
      entityType: 'payment_config',
      entityId: tenant.id,
      // Only whether keys exist, never their values.
      details: {
        provider: 'moyasar',
        enabled,
        liveMode: values.liveMode,
        secretKeyRotated: Boolean(dto.secretKey),
        webhookSecretRotated: Boolean(dto.webhookSecret),
      },
      ip: request.ip,
      userAgent:
        typeof request.headers?.['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
    });

    return { data: { saved: true, health: await this.moyasar.health(tenant.id) } };
  }

  @Get('orders')
  @Permissions('orders:view')
  @ApiOperation({ summary: 'Tenant order list' })
  async listOrders(
    @CurrentTenant() tenant: { id: string },
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.moyasar.listOrdersForTenant(tenant.id, {
      status,
      limit: limit ? Number(limit) : 50,
    });
    return { data };
  }

  @Get('orders/:id')
  @Permissions('orders:view')
  @ApiOperation({
    summary: 'Order detail with gateway id, last error and per-line fulfillment state',
  })
  async getOrder(@CurrentTenant() tenant: { id: string }, @Param('id') orderId: string) {
    return { data: await this.moyasar.getOrderForAdmin(tenant.id, orderId) };
  }

  @Post('orders/:id/refulfill')
  @Permissions('orders:manage')
  @ApiOperation({
    summary: 'Retry delivery for a paid order whose lines failed',
  })
  async refulfill(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Param('id') orderId: string,
  ) {
    const result = await this.moyasar.refulfillOrder(tenant.id, orderId);
    await this.audit.log({
      userId: user.id,
      tenantId: tenant.id,
      action: 'order_refulfilled',
      entityType: 'order',
      entityId: orderId,
      details: { complete: result.complete },
    });
    return { data: result };
  }

  @Post('orders/:id/refund')
  @Permissions('orders:refund')
  @ApiOperation({ summary: 'Refund an order through Moyasar' })
  async refund(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Param('id') orderId: string,
    @Body() body: { amountCents?: number; reason?: string },
    @Req() request: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const result = await this.moyasar.refund({
      tenantId: tenant.id,
      orderId,
      amountCents: body?.amountCents,
      reason: body?.reason,
    });
    await this.audit.log({
      userId: user.id,
      tenantId: tenant.id,
      action: 'order_refunded',
      entityType: 'order',
      entityId: orderId,
      details: { amount: result.amount, reason: body?.reason ?? null },
      ip: request.ip,
      userAgent:
        typeof request.headers?.['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
    });
    return { data: result };
  }

  @Post('expire-stale')
  @Permissions('orders:manage')
  @ApiOperation({ summary: 'Cancel abandoned pending orders' })
  async expireStale(@CurrentTenant() tenant: { id: string }) {
    return { data: { canceled: await this.moyasar.expireStaleOrders(tenant.id) } };
  }

  /** Show enough of a key to recognise it, never enough to use it. */
  private mask(value: string): string {
    if (value.length <= 10) return '••••';
    return `${value.slice(0, 6)}••••${value.slice(-4)}`;
  }
}
