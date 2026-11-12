import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { BuilderService, type Actor } from '../builder.service';
import { BuilderAiService } from './builder-ai.service';

class HistoryTurnDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(4000)
  content!: string;
}

export class BuilderAiRunDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(6000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pageSlug?: string;

  /** The editor's live layout, including unsaved edits. */
  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  selectedId?: string;

  /** Screenshots as data URLs, already downscaled by the browser. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(900_000, { each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  code?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => HistoryTurnDto)
  history?: HistoryTurnDto[];
}

export class BuilderAiSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  visionModel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  visionBaseUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  visionApiKey?: string | null;
}

@ApiTags('builder')
@ApiBearerAuth()
@Controller('builder/ai')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('super_admin', 'admin')
export class BuilderAiController {
  constructor(
    private readonly ai: BuilderAiService,
    private readonly builder: BuilderService,
  ) {}

  @Post('runs')
  @Throttle({ default: { ttl: 60_000, limit: 12 } })
  @ApiOperation({ summary: 'Start an AI builder run (edit, build or create a page). Poll GET runs/:id.' })
  start(@CurrentTenant() tenant: any, @CurrentUser() user: Actor, @Body() dto: BuilderAiRunDto) {
    return this.ai.start(this.builder.assertTenant(tenant), user, dto);
  }

  @Get('runs/:id')
  @Throttle({ default: { ttl: 60_000, limit: 240 } })
  @ApiOperation({ summary: 'Progress and result of an AI builder run' })
  get(
    @CurrentTenant() tenant: any,
    @CurrentUser() user: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.ai.get(this.builder.assertTenant(tenant), user.id, id);
  }

  @Get('settings')
  @ApiOperation({ summary: 'AI builder model settings (vision model for pictures)' })
  settings(@CurrentTenant() tenant: any) {
    return this.ai.getSettings(this.builder.assertTenant(tenant));
  }

  @Put('settings')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Save the AI builder vision model settings' })
  saveSettings(@CurrentTenant() tenant: any, @Body() dto: BuilderAiSettingsDto) {
    return this.ai.saveSettings(this.builder.assertTenant(tenant), dto);
  }
}
