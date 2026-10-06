import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, desc, eq } from 'drizzle-orm';
import { BadRequestException } from '@nestjs/common';
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
import { emailOutbox } from '../../database/schema/emails';
import { AuditService } from '../auth/services/audit.service';
import { EmailTemplatesService } from './email-templates.service';
import { EmailOutboxDispatcherService } from './email-outbox-dispatcher.service';
import { TRIGGER_REGISTRY } from './trigger.registry';
import { EmailRenderError } from './email-interpolator';

@ApiTags('admin-email')
@ApiBearerAuth()
@Controller('admin/email')
@TenantScoped()
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard, PermissionsGuard)
@Roles('super_admin', 'admin')
export class AdminEmailController {
  constructor(
    private readonly templates: EmailTemplatesService,
    private readonly outbox: EmailOutboxDispatcherService,
    private readonly drizzle: DrizzleService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- templates

  @Get('templates')
  @Permissions('email:view')
  @ApiOperation({ summary: 'List email templates visible to this tenant' })
  async list(@CurrentTenant() tenant: { id: string }) {
    return { data: await this.templates.list(tenant.id) };
  }

  @Post('templates')
  @Permissions('email:edit')
  async create(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Body() body: {
      name: string;
      slug: string;
      category: any;
      layout?: any;
      subjectTemplate?: string;
      preheaderTemplate?: string;
      variableSchema?: any[];
    },
  ) {
    if (!body?.name || !body?.slug || !body?.category) {
      throw new BadRequestException('name, slug and category are required');
    }
    return { data: await this.templates.create(tenant.id, user.id, body) };
  }

  @Get('templates/:id')
  @Permissions('email:view')
  async getOne(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    return { data: await this.templates.findOne(tenant.id, id) };
  }

  @Patch('templates/:id')
  @Permissions('email:edit')
  async update(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return {
      data: await this.templates.updateDraft(tenant.id, user.id, id, {
        name: body?.name,
        layout: body?.layout,
        subjectTemplate: body?.subjectTemplate,
        preheaderTemplate: body?.preheaderTemplate,
        variableSchema: body?.variableSchema,
      }),
    };
  }

  @Post('templates/:id/publish')
  @Permissions('email:publish')
  async publish(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: { note?: string; triggerKey?: string },
  ) {
    return {
      data: await this.templates.publish(tenant.id, user.id, id, {
        note: body?.note,
        triggerKey: body?.triggerKey,
      }),
    };
  }

  @Get('templates/:id/versions')
  @Permissions('email:view')
  async versions(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    return { data: await this.templates.versions(tenant.id, id) };
  }

  @Post('templates/:id/rollback/:version')
  @Permissions('email:publish')
  async rollback(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('version') version: string,
  ) {
    return {
      data: await this.templates.rollback(tenant.id, user.id, id, Number(version)),
    };
  }

  // ------------------------------------------------------------------ preview

  /**
   * Preview calls the same `renderEmail` the send path calls. There is no
   * separate preview renderer to drift out of sync, which is what makes "what
   * you build is what you send" true by construction rather than by discipline.
   */
  @Post('preview')
  @Permissions('email:view')
  @ApiOperation({ summary: 'Render a template exactly as the send path would' })
  async preview(
    @CurrentTenant() tenant: { id: string },
    @Body()
    body: {
      layout: any;
      subjectTemplate?: string;
      preheaderTemplate?: string;
      payload?: Record<string, unknown>;
      triggerKey?: string | null;
      width?: number;
    },
  ) {
    if (!body?.layout) throw new BadRequestException('layout is required');
    const trigger = body.triggerKey
      ? TRIGGER_REGISTRY.find((t) => t.key === body.triggerKey)
      : undefined;
    const brand = await this.templates.brandFor(tenant.id);

    try {
      const rendered = this.templates.renderForTrigger(
        body.layout,
        trigger,
        body.payload ?? trigger?.samplePayload ?? {},
        body.subjectTemplate || 'Preview subject',
        body.preheaderTemplate ?? null,
        {
          fromAddress: 'preview@localhost',
          supportEmail: brand.supportEmail,
          replyTo: brand.replyTo,
          unsubscribeUrlPath: null,
          utm: null,
        },
      );
      return {
        data: {
          html: rendered.html,
          text: rendered.text,
          subject: rendered.subject,
          preheader: rendered.preheader,
          compileHash: this.templates.hashArtifact(rendered.html, rendered.text),
        },
      };
    } catch (error) {
      // Compile errors are returned, not thrown as 500: the editor needs to show
      // "unknown variable X" against the field the admin is editing.
      if (error instanceof EmailRenderError) {
        return {
          data: null,
          error: { message: error.message, token: error.token ?? null },
        };
      }
      throw error;
    }
  }

  /** Editor linter: tokens used vs declared for the bound trigger. */
  @Post('lint')
  @Permissions('email:view')
  async lint(@Body() body: { layout: any; triggerKey?: string | null }) {
    return { data: this.templates.lintLayout(body?.layout, body?.triggerKey ?? null) };
  }

  // ----------------------------------------------------------------- triggers

  @Get('triggers')
  @Permissions('email:view')
  async triggers(@CurrentTenant() tenant: { id: string }) {
    const bindings = await this.templates.listBindings(tenant.id);
    return {
      data: TRIGGER_REGISTRY.map((t) => ({
        key: t.key,
        category: t.category,
        label: t.label,
        description: t.description,
        variables: t.variables,
        idempotent: t.idempotent,
        emitSites: t.emitSites,
        samplePayload: t.samplePayload,
        bindings: bindings.filter((b: any) => b.triggerKey === t.key),
      })),
    };
  }

  @Post('triggers')
  @Permissions('email:edit')
  async setBinding(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Body() body: { triggerKey: string; templateId: string; locale?: string; enabled?: boolean },
  ) {
    if (!body?.triggerKey || !body?.templateId) {
      throw new BadRequestException('triggerKey and templateId are required');
    }
    return this.templates.setBinding(tenant.id, user.id, {
      triggerKey: body.triggerKey,
      templateId: body.templateId,
      locale: body.locale ?? null,
      enabled: body.enabled ?? true,
    });
  }

  // ----------------------------------------------------------------- send log

  /**
   * Read-only by design. The body is never returned and never stored, so there
   * is no endpoint through which a reset URL could be read back out of the log.
   */
  @Get('log')
  @Permissions('email:view')
  @ApiOperation({ summary: 'Outbox as send log (no bodies)' })
  async log(
    @CurrentTenant() tenant: { id: string },
    @Query('triggerKey') triggerKey?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(Number(limit ?? 50) || 50, 200);
    const where = and(
      eq(emailOutbox.tenantId, tenant.id),
      ...(triggerKey ? [eq(emailOutbox.triggerKey, triggerKey)] : []),
      ...(status ? [eq(emailOutbox.status, status as any)] : []),
    );
    const rows = await this.drizzle.db
      .select({
        id: emailOutbox.id,
        triggerKey: emailOutbox.triggerKey,
        templateVersion: emailOutbox.templateVersion,
        recipientEmail: emailOutbox.recipientEmail,
        subject: emailOutbox.subject,
        status: emailOutbox.status,
        attempts: emailOutbox.attempts,
        lastErrorCode: emailOutbox.lastErrorCode,
        lastErrorMessage: emailOutbox.lastErrorMessage,
        providerId: emailOutbox.providerId,
        bodyHash: emailOutbox.bodyHash,
        scheduledFor: emailOutbox.scheduledFor,
        sentAt: emailOutbox.sentAt,
        createdAt: emailOutbox.createdAt,
      })
      .from(emailOutbox)
      .where(where)
      .orderBy(desc(emailOutbox.createdAt))
      .limit(take);

    return { data: rows, counts: await this.outbox.countsByStatus(tenant.id) };
  }

  @Post('log/:id/retry')
  @Permissions('email:publish')
  async retry(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    await this.outbox.requeue(id, tenant.id);
    await this.audit.log({
      userId: user.id,
      tenantId: tenant.id,
      action: 'email.log.retry',
      entityType: 'email_outbox',
      entityId: id,
    });
    return { ok: true };
  }
}