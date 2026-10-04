import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { AiChatService } from './ai-chat.service';
import { AiCorpusService } from './ai-corpus.service';
import { AiSettingsService } from './ai-settings.service';
import { AiWebSearchService } from './ai-web-search.service';
import { AiFeedbackService } from './ai-feedback.service';
import { AiEvalService } from './ai-eval.service';
import {
  AiEvalCaseDto,
  AiEvalRunDto,
  AiReindexDto,
  UpdateAiSettingsDto,
  UpdateAiWebSearchDto,
} from './dto/ai.dto';

@ApiTags('admin-ai')
@ApiBearerAuth()
@Controller('admin/ai')
@TenantScoped()
@UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard, RolesGuard, PermissionsGuard)
@Roles('super_admin', 'admin')
export class AiAdminController {
  constructor(
    private readonly settings: AiSettingsService,
    private readonly corpus: AiCorpusService,
    private readonly chat: AiChatService,
    private readonly webSearch: AiWebSearchService,
    private readonly feedback: AiFeedbackService,
    private readonly evals: AiEvalService,
  ) {}

  @Get()
  @Permissions('settings:view')
  @ApiOperation({ summary: 'Get masked AI settings and status' })
  getSettings(@CurrentTenant() tenant: { id: string }) {
    return this.settings.getMaskedSettings(tenant.id);
  }

  @Get('settings')
  @Permissions('settings:view')
  @ApiOperation({ summary: 'Get masked AI settings and status' })
  getSettingsAlias(@CurrentTenant() tenant: { id: string }) {
    return this.settings.getMaskedSettings(tenant.id);
  }

  @Get('status')
  @Permissions('settings:view')
  @ApiOperation({ summary: 'Get AI assistant status' })
  async getStatus(@CurrentTenant() tenant: { id: string }) {
    const [settings, corpus] = await Promise.all([
      this.settings.getMaskedSettings(tenant.id),
      this.corpus.stats(tenant.id),
    ]);
    return { ...settings, corpus };
  }

  @Put()
  @Permissions('settings:edit')
  @ApiOperation({ summary: 'Update tenant AI settings; API key is write-only' })
  updateSettings(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateAiSettingsDto,
    @Req() request: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.settings.update(tenant.id, dto, {
      userId: user.id,
      ip: request.ip,
      userAgent: typeof request.headers?.['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
    });
  }

  @Put('settings')
  @Permissions('settings:edit')
  @ApiOperation({ summary: 'Update tenant AI settings; API key is write-only' })
  updateSettingsAlias(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateAiSettingsDto,
    @Req() request: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.settings.update(tenant.id, dto, {
      userId: user.id,
      ip: request.ip,
      userAgent: typeof request.headers?.['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
    });
  }

  @Post('test')
  @Permissions('settings:edit')
  @ApiOperation({ summary: 'Test the configured provider without exposing credentials' })
  test(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Req() request: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.chat.testProvider(tenant.id, {
      userId: user.id,
      ip: request.ip,
      userAgent: typeof request.headers?.['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
    });
  }

  // -------------------------------------------------------------------------
  // Web search
  // -------------------------------------------------------------------------

  @Get('web-search')
  @Permissions('settings:view')
  @ApiOperation({ summary: 'Get web search settings (key is never returned)' })
  async getWebSearch(@CurrentTenant() tenant: { id: string }) {
    return { data: await this.webSearch.getMaskedSettings(tenant.id) };
  }

  @Put('web-search')
  @Permissions('settings:edit')
  @ApiOperation({ summary: 'Configure web search; API key is write-only' })
  async updateWebSearch(@CurrentTenant() tenant: { id: string }, @Body() dto: UpdateAiWebSearchDto) {
    return { data: await this.webSearch.updateSettings(tenant.id, dto) };
  }

  @Post('web-search/test')
  @Permissions('settings:edit')
  @ApiOperation({ summary: 'Verify the search credential end to end' })
  async testWebSearch(@CurrentTenant() tenant: { id: string }) {
    return { data: await this.webSearch.testConnection(tenant.id) };
  }

  @Post('web-search/purge-cache')
  @Permissions('settings:edit')
  @ApiOperation({ summary: 'Drop expired cached search results' })
  async purgeWebCache(@CurrentTenant() tenant: { id: string }) {
    return { data: { purged: await this.webSearch.purgeExpired(tenant.id) } };
  }

  // -------------------------------------------------------------------------
  // Learning loop: feedback + evals
  // -------------------------------------------------------------------------

  @Get('feedback')
  @Permissions('settings:view')
  @ApiOperation({ summary: 'Feedback totals and recent votes' })
  async getFeedback(@CurrentTenant() tenant: { id: string }, @Query('limit') limit?: string) {
    const [summary, recent] = await Promise.all([
      this.feedback.summary(tenant.id),
      this.feedback.recent(tenant.id, limit ? Number(limit) : 20),
    ]);
    return { data: { summary, recent } };
  }

  @Get('eval/cases')
  @Permissions('settings:view')
  @ApiOperation({ summary: 'List evaluation cases' })
  async listEvalCases(@CurrentTenant() tenant: { id: string }) {
    return { data: await this.evals.listCases(tenant.id) };
  }

  @Put('eval/cases')
  @Permissions('settings:edit')
  @ApiOperation({ summary: 'Create or update an evaluation case' })
  async upsertEvalCase(@CurrentTenant() tenant: { id: string }, @Body() dto: AiEvalCaseDto) {
    return { data: await this.evals.upsertCase(tenant.id, dto) };
  }

  @Delete('eval/cases/:id')
  @Permissions('settings:edit')
  @ApiOperation({ summary: 'Delete an evaluation case' })
  async deleteEvalCase(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    await this.evals.deleteCase(tenant.id, id);
    return { data: { deleted: true } };
  }

  @Get('eval/runs')
  @Permissions('settings:view')
  @ApiOperation({ summary: 'List evaluation runs, newest first' })
  async listEvalRuns(@CurrentTenant() tenant: { id: string }) {
    return { data: await this.evals.listRuns(tenant.id) };
  }

  @Post('eval/runs')
  @Permissions('settings:edit')
  @ApiOperation({ summary: 'Score the assistant against the case set' })
  async runEval(@CurrentTenant() tenant: { id: string }, @CurrentUser() user: { id: string }, @Body() dto: AiEvalRunDto) {
    return { data: await this.evals.run(tenant.id, dto.label, { userId: user.id, limit: dto.limit }) };
  }

  @Get('learning')
  @Permissions('settings:view')
  @ApiOperation({ summary: 'Feedback signal plus the last two eval runs' })
  async learning(@CurrentTenant() tenant: { id: string }) {
    return { data: await this.evals.latestComparison(tenant.id) };
  }

  @Post('reindex')
  @Permissions('settings:edit')
  @ApiOperation({ summary: 'Reindex published tenant content into the AI corpus' })
  reindex(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { id: string },
    @Body() _dto: AiReindexDto,
  ) {
    return this.corpus.reindexTenant(tenant.id, { userId: user.id });
  }
}
