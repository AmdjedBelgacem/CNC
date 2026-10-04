import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditService } from '../auth/services/audit.service';
import { GoogleIntegrationsService } from './google-integrations.service';
import type { GoogleIntegrationService } from '../../database/schema/payments-config';

const SERVICE_VALUES = ['google_ads', 'merchant_center', 'tag_manager', 'search_console'] as const;

/**
 * Platform-level Google connections.
 *
 * super_admin only, and deliberately not tenant-scoped: one Google account links
 * the Ads account, the Merchant feed, the GTM container and the Search Console
 * property for the whole install, so a tenant admin must not be able to rebind
 * them.
 */
@ApiTags('admin-integrations')
@ApiBearerAuth()
@Controller('admin/integrations')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('super_admin')
export class AdminIntegrationsController {
  constructor(
    private readonly google: GoogleIntegrationsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Permissions('settings:view')
  @ApiOperation({ summary: 'Connection status for every Google service' })
  async list() {
    return {
      data: await this.google.listStatuses(),
      // Surfaced so the UI can explain a blocked state instead of showing a dead button.
      platform: {
        oauthConfigured: Boolean(this.google.oauthClient()),
        developerTokenPresent: Boolean(this.google.developerToken()),
        encryptionReady: true,
      },
    };
  }

  @Get(':service')
  @Permissions('settings:view')
  @ApiOperation({ summary: 'One service status' })
  async one(@Param('service') service: string) {
    return { data: await this.google.getStatus(this.assertKnown(service)) };
  }

  /**
   * Start the consent flow. Returns the URL rather than redirecting so the caller
   * can hold the CSRF token for the callback; the redirect target is Google's.
   */
  @Post(':service/connect')
  @Permissions('settings:edit')
  @ApiOperation({ summary: 'Begin Google OAuth for one service' })
  async connect(
    @Param('service') service: string,
    @CurrentUser() user: { id: string },
    @Query('csrf') csrfToken: string | undefined,
    @Query('returnTo') returnTo: string | undefined,
    @Req() request: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const known = this.assertKnown(service);
    if (!csrfToken) throw new BadRequestException('csrf token is required to start a connection');
    await this.google.purgeExpiredStates();
    const flow = await this.google.startOAuth({
      service: known,
      initiatedBy: user.id,
      csrfToken,
      returnTo,
    });
    await this.audit.log({
      userId: user.id,
      action: 'google_oauth_started',
      entityType: 'google_integration',
      entityId: service,
      details: { service },
      ip: request.ip,
      userAgent:
        typeof request.headers?.['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
    });
    return { data: { authorizeUrl: flow.authorizeUrl, redirectUri: flow.redirectUri } };
  }

  /**
   * Google's redirect lands here. Public by necessity — Google is not
   * authenticated against this app — and therefore guarded by: a live,
   * unconsumed state row; the state must have been created by the same super
   * admin; the service must match; and the state must not have expired.
   */
  @Get('oauth/callback/:service')
  @ApiOperation({ summary: 'Google OAuth callback — exchanges the code and probes the API' })
  async callback(
    @Param('service') service: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('initiatedBy') initiatedBy: string | undefined,
    @Query('csrf') csrf: string | undefined,
    // Same shape the auth controller uses: Nest must not swallow the reply.
    @Res({ passthrough: true }) reply: any,
  ) {
    const known = this.assertKnown(service);
    const appUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    // Google reported a user-side refusal (or a malformed callback).
    if (error || !code || !state) {
      const url = new URL(`${appUrl}/admin/integrations`);
      url.searchParams.set('service', service);
      url.searchParams.set('result', error ? 'denied' : 'invalid');
      reply.status(302).redirect(url.toString());
      return;
    }

    const result = await this.google.completeOAuth({
      service: known,
      state,
      code,
      connectedBy: initiatedBy ?? '',
      csrfToken: csrf ?? null,
    });

    if (result.ok) {
      await this.audit.log({
        userId: initiatedBy ?? undefined,
        action: 'google_integration_connected',
        entityType: 'google_integration',
        entityId: service,
        details: { service, accountId: result.status.externalAccountId },
      });
    } else {
      await this.audit.log({
        userId: initiatedBy ?? undefined,
        action: 'google_integration_connect_failed',
        entityType: 'google_integration',
        entityId: service,
        details: { service, reason: result.error },
      });
    }

    const url = new URL(`${appUrl}/admin/integrations`);
    url.searchParams.set('service', service);
    url.searchParams.set('result', result.ok ? 'connected' : (result.error ?? 'failed'));
    reply.status(302).redirect(url.toString());
    return;
  }

  @Post(':service/disconnect')
  @Permissions('settings:edit')
  @ApiOperation({ summary: 'Disconnect a service and destroy the stored refresh token' })
  async disconnect(
    @Param('service') service: string,
    @CurrentUser() user: { id: string },
    @Req() request: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const result = await this.google.disconnect(this.assertKnown(service), user.id);
    await this.audit.log({
      userId: user.id,
      action: 'google_integration_disconnected',
      entityType: 'google_integration',
      entityId: service,
      details: { service },
      ip: request.ip,
      userAgent:
        typeof request.headers?.['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
    });
    return { data: result };
  }

  @Post(':service/test')
  @Permissions('settings:edit')
  @ApiOperation({ summary: 'Probe the API with a real read-only call' })
  async test(
    @Param('service') service: string,
    @CurrentUser() user: { id: string },
    @Req() request: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const result = await this.google.testConnection(this.assertKnown(service));
    await this.audit.log({
      userId: user.id,
      action: 'google_integration_tested',
      entityType: 'google_integration',
      entityId: service,
      details: { service, ok: result.ok, code: result.code ?? null },
      ip: request.ip,
      userAgent:
        typeof request.headers?.['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
    });
    return { data: result };
  }

  /** Narrows the route param to the known set, or refuses it outright. */
  private assertKnown(service: string): GoogleIntegrationService {
    if (!(SERVICE_VALUES as readonly string[]).includes(service)) {
      throw new BadRequestException(`Unknown integration: ${service}`);
    }
    return service as GoogleIntegrationService;
  }
}
