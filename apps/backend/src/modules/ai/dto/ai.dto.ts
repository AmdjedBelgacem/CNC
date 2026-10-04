import { Type } from 'class-transformer';
import type { AiLocale } from '../ai.types';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  MinLength,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';

export class AiChatHistoryDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}

export class AiPageContextDto {
  @IsUUID()
  courseId!: string;

  @IsUUID()
  lessonId!: string;
}

export const AI_CHAT_MODES = ['general', 'fact_check', 'ask_post', 'ask_lesson'] as const;
export type AiChatMode = (typeof AI_CHAT_MODES)[number];

export class AiSourceRefDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  href?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  /** Untrusted post/lesson text. Stored for display and used as DATA only. */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  excerpt?: string;
}

export class AiChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiPageContextDto)
  pageContext?: AiPageContextDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => AiChatHistoryDto)
  history?: AiChatHistoryDto[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  conversationId?: string;

  @IsOptional()
  @IsIn(['en', 'ar'])
  locale?: AiLocale;

  @IsOptional()
  @IsIn(AI_CHAT_MODES)
  mode?: AiChatMode;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiSourceRefDto)
  sourceRef?: AiSourceRefDto;
}

export class CreateAiConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsIn(['general', 'lesson', 'post', 'admin_test'])
  source?: 'general' | 'lesson' | 'post' | 'admin_test';

  @IsOptional()
  @ValidateNested()
  @Type(() => AiSourceRefDto)
  sourceRef?: AiSourceRefDto;
}

export class UpdateAiConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';
}

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  primaryModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fallbackModel?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  publicEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  retrievalTopK?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  retrievalMinScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1000)
  @Max(100000)
  maxContextChars?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  systemStyle?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1000)
  @Max(120000)
  timeoutMs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(256)
  @Max(8000)
  maxTokens?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  embeddingModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  embeddingBaseUrl?: string;
}

export class AiReindexDto {}

// ---------------------------------------------------------------------------
// Web search, feedback and evals
// ---------------------------------------------------------------------------

export const AI_WEB_SEARCH_PROVIDERS = ['brave', 'tavily', 'serper', 'none'] as const;
export const AI_EVAL_MODES = ['general', 'fact_check', 'ask_post', 'ask_lesson'] as const;

export class UpdateAiWebSearchDto {
  @IsIn(AI_WEB_SEARCH_PROVIDERS)
  provider!: (typeof AI_WEB_SEARCH_PROVIDERS)[number];

  /** Write-only. Omit to keep the stored key. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  maxResults?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(30000)
  timeoutMs?: number;

  /** Hostnames only. Empty means any public host. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  allowedDomains?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(AI_EVAL_MODES, { each: true })
  @ArrayMaxSize(4)
  allowedModes?: Array<(typeof AI_EVAL_MODES)[number]>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(86400)
  cacheTtlSeconds?: number;
}

export class AiFeedbackDto {
  /** 1 helpful, -1 not. 0 clears the vote. */
  @Type(() => Number)
  @IsInt()
  @Min(-1)
  @Max(1)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class AiEvalCaseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  question!: string;

  @IsOptional()
  @IsIn(AI_EVAL_MODES)
  mode?: (typeof AI_EVAL_MODES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  expectKeywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  forbidKeywords?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  minCitations?: number;

  @IsOptional()
  @IsBoolean()
  expectRefusal?: boolean;

  @IsOptional()
  @IsBoolean()
  expectWeb?: boolean;

  @IsOptional()
  @IsObject()
  sourceRef?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class AiEvalRunDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
