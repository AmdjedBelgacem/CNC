import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import {
  EmailLayout,
  EmailTemplateStatus,
  EmailVariableDef,
} from '@titan/shared';
import { DrizzleService } from '../../database/drizzle.service';
import {
  emailTemplates,
  emailTemplateVersions,
  emailTriggerBindings,
} from '../../database/schema/emails';
import { tenants } from '../../database/schema/tenants';
import { AuditService } from '../auth/services/audit.service';
import {
  DEFAULT_EMAIL_LAYOUT,
  renderEmail,
  COMPILER_VERSION,
  CompileOptions,
} from './email-compiler';
import { extractTokens } from './email-interpolator';
import { allowedPathsFor, getTrigger, isKnownTrigger, TriggerDef } from './trigger.registry';

export interface TemplateBrandContext {
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  supportEmail: string | null;
  replyTo: string | null;
  utm: Record<string, string> | null;
}

@Injectable()
export class EmailTemplatesService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly audit: AuditService,
  ) {}

  /**
   * System templates (tenant_id NULL) plus this tenant's own. A tenant admin
   * must be able to see and duplicate a system template, but never edit it in
   * place — editing it would silently change mail for every other tenant.
   */
  async list(tenantId: string): Promise<any[]> {
    return this.drizzle.db
      .select({
        id: emailTemplates.id,
        tenantId: emailTemplates.tenantId,
        slug: emailTemplates.slug,
        name: emailTemplates.name,
        category: emailTemplates.category,
        status: emailTemplates.status,
        isSystem: emailTemplates.isSystem,
        version: emailTemplates.version,
        publishedAt: emailTemplates.publishedAt,
        updatedAt: emailTemplates.updatedAt,
      })
      .from(emailTemplates)
      .where(
        or(eq(emailTemplates.tenantId, tenantId), and(isNull(emailTemplates.tenantId), eq(emailTemplates.isSystem, true))),
      )
      .orderBy(desc(emailTemplates.updatedAt));
  }

  async findOne(tenantId: string, id: string): Promise<any> {
    const rows = await this.drizzle.db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException('Email template not found');
    // 404 rather than 403: a tenant admin probing another tenant's id should not
    // learn that the id exists.
    if (row.tenantId !== null && row.tenantId !== tenantId) {
      throw new NotFoundException('Email template not found');
    }
    return row;
  }

  async create(
    tenantId: string,
    actorId: string | undefined,
    input: {
      name: string;
      slug: string;
      category: any;
      layout?: EmailLayout;
      subjectTemplate?: string;
      preheaderTemplate?: string | null;
      variableSchema?: EmailVariableDef[];
    },
  ): Promise<any> {
    if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(input.slug)) {
      throw new BadRequestException(
        'Slug must be lowercase alphanumeric with hyphens (2-81 chars)',
      );
    }
    const [clash] = await this.drizzle.db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(and(eq(emailTemplates.tenantId, tenantId), eq(emailTemplates.slug, input.slug)))
      .limit(1);
    if (clash) throw new BadRequestException(`Slug "${input.slug}" is already in use`);

    const [row] = await this.drizzle.db
      .insert(emailTemplates)
      .values({
        tenantId,
        slug: input.slug,
        name: input.name,
        category: input.category,
        layout: input.layout ?? DEFAULT_EMAIL_LAYOUT,
        subjectTemplate: input.subjectTemplate ?? input.name,
        preheaderTemplate: input.preheaderTemplate ?? null,
        variableSchema: input.variableSchema ?? [],
        status: 'draft',
        updatedById: actorId ?? null,
      })
      .returning();

    if (!row) throw new BadRequestException('Template could not be created');

    await this.audit.log({
      userId: actorId,
      tenantId,
      action: 'email.template.create',
      entityType: 'email_template',
      entityId: row.id,
      details: { slug: input.slug, category: input.category },
    });
    return row;
  }

  /**
   * Saving a draft does NOT change what sends. Only `publish` snapshots and
   * bumps the version, so a half-finished edit can never reach a learner.
   */
  async updateDraft(
    tenantId: string,
    actorId: string | undefined,
    id: string,
    patch: {
      name?: string;
      layout?: EmailLayout;
      subjectTemplate?: string;
      preheaderTemplate?: string | null;
      variableSchema?: EmailVariableDef[];
    },
  ): Promise<any> {
    const existing = await this.findOne(tenantId, id);
    if (existing.isSystem) throw new ForbiddenException('System templates are read-only; duplicate one instead');
    if (existing.status === 'archived') {
      throw new BadRequestException('Archived templates cannot be edited');
    }

    const [row] = await this.drizzle.db
      .update(emailTemplates)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.layout !== undefined ? { layout: patch.layout } : {}),
        ...(patch.subjectTemplate !== undefined ? { subjectTemplate: patch.subjectTemplate } : {}),
        ...(patch.preheaderTemplate !== undefined ? { preheaderTemplate: patch.preheaderTemplate } : {}),
        ...(patch.variableSchema !== undefined ? { variableSchema: patch.variableSchema } : {}),
        updatedById: actorId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, id))
      .returning();

    await this.audit.log({
      userId: actorId,
      tenantId,
      action: 'email.template.update_draft',
      entityType: 'email_template',
      entityId: id,
      details: { fields: Object.keys(patch) },
    });
    return row;
  }

  /**
   * Snapshot + version bump. Immutable: rollback is "publish an old version as a
   * new version", so history is never rewritten and nothing already sent can be
   * retroactively altered.
   */
  async publish(
    tenantId: string,
    actorId: string | undefined,
    id: string,
    opts: { note?: string; triggerKey?: string },
  ): Promise<{ version: number; compileHash: string }> {
    const existing = await this.findOne(tenantId, id);
    if (existing.isSystem) throw new ForbiddenException('System templates cannot be republished by a tenant');

    const subjectTemplate =
      existing.subjectTemplate?.trim() || existing.name || 'Notification from Baroot CNC Solutions';
    const trigger = opts.triggerKey ? getTrigger(opts.triggerKey) : undefined;
    if (opts.triggerKey && !trigger) {
      throw new BadRequestException(`Unknown trigger "${opts.triggerKey}"`);
    }

    const rendered = this.renderForTrigger(
      existing.layout,
      trigger,
      trigger ? trigger.samplePayload : {},
      subjectTemplate,
      existing.preheaderTemplate ?? null,
      {
        fromAddress: 'onboarding@resend.dev',
        supportEmail: null,
        replyTo: null,
        unsubscribeUrlPath: null,
        utm: null,
      },
    );

    const nextVersion = (existing.version ?? 0) + 1;
    const compileHash = this.hashArtifact(rendered.html, rendered.text);

    await this.drizzle.db.insert(emailTemplateVersions).values({
      templateId: existing.id,
      tenantId: existing.tenantId ?? tenantId,
      version: nextVersion,
      subjectTemplate,
      preheaderTemplate: existing.preheaderTemplate ?? null,
      layout: existing.layout,
      variableSchema: existing.variableSchema ?? [],
      compiledHtml: rendered.html,
      compiledText: rendered.text,
      compileHash,
      schemaVersion: existing.layout?.schemaVersion ?? 1,
      status: 'published',
      note: opts.note ?? null,
      changedById: actorId ?? null,
    });

    await this.drizzle.db
      .update(emailTemplates)
      .set({
        version: nextVersion,
        status: 'published',
        publishedAt: new Date(),
        publishedById: actorId ?? null,
        updatedById: actorId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, id));

    await this.audit.log({
      userId: actorId,
      tenantId,
      action: 'email.template.publish',
      entityType: 'email_template',
      entityId: id,
      details: { version: nextVersion, compileHash, triggerKey: opts.triggerKey ?? null },
    });

    return { version: nextVersion, compileHash };
  }

  async versions(tenantId: string, templateId: string) {
    await this.findOne(tenantId, templateId);
    return this.drizzle.db
      .select()
      .from(emailTemplateVersions)
      .where(eq(emailTemplateVersions.templateId, templateId))
      .orderBy(desc(emailTemplateVersions.version));
  }

  /**
   * Rollback = republish an old version as a new one. History stays append-only.
   */
  async rollback(tenantId: string, actorId: string | undefined, templateId: string, version: number) {
    await this.findOne(tenantId, templateId);
    const [snap] = await this.drizzle.db
      .select()
      .from(emailTemplateVersions)
      .where(
        and(eq(emailTemplateVersions.templateId, templateId), eq(emailTemplateVersions.version, version)),
      )
      .limit(1);
    if (!snap) throw new NotFoundException(`Version ${version} not found`);

    await this.drizzle.db
      .update(emailTemplates)
      .set({
        layout: snap.layout,
        variableSchema: snap.variableSchema,
        updatedById: actorId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, templateId));

    const published = await this.publish(tenantId, actorId, templateId, { note: `Rollback to v${version}` });
    await this.audit.log({
      userId: actorId,
      tenantId,
      action: 'email.template.rollback',
      entityType: 'email_template',
      entityId: templateId,
      details: { fromVersion: version, toVersion: published.version },
    });
    return published;
  }

  /**
   * Resolution order. Deliberately explicit and fail-closed:
   *   tenant+locale -> tenant+default -> system+locale -> system+default -> none.
   * Disabled at any level stops the send; the template is retained.
   */
  async resolveBinding(tenantId: string, triggerKey: string, locale?: string | null) {
    const candidates = [
      { tenantId, locale: locale ?? null },
      { tenantId, locale: null },
      { tenantId: null, locale: locale ?? null },
      { tenantId: null, locale: null },
    ];
    for (const c of candidates) {
      const where = c.tenantId
        ? and(
            eq(emailTriggerBindings.tenantId, c.tenantId),
            eq(emailTriggerBindings.triggerKey, triggerKey),
            c.locale ? eq(emailTriggerBindings.locale, c.locale) : isNull(emailTriggerBindings.locale),
          )
        : and(
            isNull(emailTriggerBindings.tenantId),
            eq(emailTriggerBindings.triggerKey, triggerKey),
            c.locale ? eq(emailTriggerBindings.locale, c.locale) : isNull(emailTriggerBindings.locale),
          );
      const [row] = await this.drizzle.db
        .select()
        .from(emailTriggerBindings)
        .where(where)
        .limit(1);
      if (row) return row;
    }
    return null;
  }

  async setBinding(
    tenantId: string,
    actorId: string | undefined,
    input: { triggerKey: string; templateId: string; locale?: string | null; enabled?: boolean },
  ) {
    if (!isKnownTrigger(input.triggerKey)) {
      throw new BadRequestException(`Unknown trigger "${input.triggerKey}"`);
    }
    await this.findOne(tenantId, input.templateId);
    const locale = input.locale ?? null;

    const values = {
      tenantId,
      triggerKey: input.triggerKey,
      templateId: input.templateId,
      locale,
      enabled: input.enabled ?? true,
      delayMinutes: 0,
      updatedById: actorId ?? null,
      updatedAt: new Date(),
    };
    const where = and(
      eq(emailTriggerBindings.tenantId, tenantId),
      eq(emailTriggerBindings.triggerKey, input.triggerKey),
      locale ? eq(emailTriggerBindings.locale, locale) : isNull(emailTriggerBindings.locale),
    );

    // Explicit update-then-insert rather than ON CONFLICT. The unique indexes
    // here are PARTIAL (system defaults have a NULL tenant_id), and Postgres
    // cannot use a partial index as a conflict arbiter — `ON CONFLICT (cols)`
    // raises 42P10. An arbiter-less upsert would also be wrong, since it needs a
    // unique constraint to infer the target at all.
    const updated = await this.drizzle.db
      .update(emailTriggerBindings)
      .set(values)
      .where(where)
      .returning({ id: emailTriggerBindings.id });

    if (updated.length === 0) {
      try {
        await this.drizzle.db.insert(emailTriggerBindings).values({
          ...values,
          createdAt: new Date(),
        });
      } catch (error: any) {
        // Lost a race against a concurrent admin: their insert won, so apply ours.
        if (error?.code !== '23505') throw error;
        await this.drizzle.db.update(emailTriggerBindings).set(values).where(where);
      }
    }

    await this.audit.log({
      userId: actorId,
      tenantId,
      action: 'email.binding.set',
      entityType: 'email_binding',
      entityId: input.templateId,
      details: { triggerKey: input.triggerKey, locale, enabled: input.enabled ?? true },
    });
    return { ok: true };
  }

  async listBindings(tenantId: string) {
    return this.drizzle.db
      .select()
      .from(emailTriggerBindings)
      .where(
        or(
          eq(emailTriggerBindings.tenantId, tenantId),
          isNull(emailTriggerBindings.tenantId),
        ),
      )
      .orderBy(sql`${emailTriggerBindings.triggerKey} asc`);
  }

  /** Per-tenant branding read from the tenants row already in the schema. */
  async brandFor(tenantId: string): Promise<TemplateBrandContext> {
    const [row] = await this.drizzle.db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const settings = (row?.settings ?? {}) as Record<string, unknown>;
    return {
      brandName: row?.name ?? 'Baroot CNC Solutions',
      logoUrl: row?.logoUrl ?? null,
      primaryColor: row?.primaryColor ?? '#0b6b5f',
      supportEmail: (settings.supportEmail as string) ?? (settings.support_email as string) ?? null,
      replyTo: (settings.emailReplyTo as string) ?? (settings.email_reply_to as string) ?? null,
      utm: (settings.emailUtm as Record<string, string>) ?? null,
    };
  }

  renderForTrigger(
    layout: EmailLayout,
    trigger: TriggerDef | undefined,
    payload: Record<string, unknown>,
    subjectTemplate: string,
    preheaderTemplate: string | null,
    brand: {
      fromAddress: string;
      supportEmail: string | null;
      replyTo: string | null;
      unsubscribeUrlPath: string | null;
      utm: Record<string, string> | null;
    },
  ) {
    return renderEmail(layout, payload, subjectTemplate, preheaderTemplate, {
      // With no trigger bound (a draft being previewed before assignment) every
      // token is allowed; once bound, the contract is enforced.
      allowedPaths: trigger ? allowedPathsFor(trigger) : undefined,
      fromAddress: brand.fromAddress,
      supportEmail: brand.supportEmail,
      replyTo: brand.replyTo,
      unsubscribeUrlPath: brand.unsubscribeUrlPath,
      utm: brand.utm,
    } satisfies CompileOptions);
  }

  /**
   * Editor linter: which tokens does this layout use, and are they all declared?
   * Runs in the UI so a draft is caught before publish rather than by a dead
   * outbox row afterwards.
   */
  lintLayout(layout: EmailLayout, triggerKey?: string | null) {
    const trigger = triggerKey ? getTrigger(triggerKey) : undefined;
    const allowed = trigger ? allowedPathsFor(trigger) : null;
    const used = new Set<string>();
    collectTokens(layout, used);

    const unknown = allowed ? [...used].filter((t) => !allowed.includes(t)).sort() : [];
    const unused = allowed ? allowed.filter((a) => !used.has(a)).sort() : [];
    return {
      used: [...used].sort(),
      allowed: allowed ?? [],
      unknown,
      unused,
      triggerKnown: triggerKey ? Boolean(trigger) : null,
      valid: unknown.length === 0,
    };
  }

  hashArtifact(html: string, text: string): string {
    return createHash('sha256')
      .update(`${COMPILER_VERSION}\u0000${html}\u0000${text}`)
      .digest('hex');
  }
}

/** Walk every user-authored string in a layout and pull out its `{{tokens}}`. */
function collectTokens(layout: EmailLayout, into: Set<string>): void {
  const visitBlocks = (blocks: any[]) => {
    for (const block of blocks ?? []) {
      for (const value of Object.values(block.props ?? {})) {
        if (typeof value === 'string') {
          for (const token of extractTokens(value)) into.add(token);
        } else if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === 'string') for (const t of extractTokens(item)) into.add(t);
            else if (item && typeof item === 'object') visitBlocks(item.blocks ?? []);
          }
        } else if (value && typeof value === 'object' && Array.isArray((value as any).blocks)) {
          visitBlocks((value as any).blocks);
        }
      }
    }
  };
  visitBlocks(layout?.blocks ?? []);
}

export type { EmailTemplateStatus };