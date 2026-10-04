import { Global, Module } from '@nestjs/common';
import { AiAuditService } from './ai-audit.service';
import { AiCorpusService } from './ai-corpus.service';
import { AiProviderService } from './ai-provider.service';
import { AiRetrievalService } from './ai-retrieval.service';
import { AiSafetyService } from './ai-safety.service';
import { AiSecretService } from './ai-secret.service';
import { AiSettingsService } from './ai-settings.service';
import { AiWebSearchService } from './ai-web-search.service';
import { AiFeedbackService } from './ai-feedback.service';

const SERVICES = [
  AiAuditService,
  AiCorpusService,
  AiProviderService,
  AiRetrievalService,
  AiSafetyService,
  AiSecretService,
  AiSettingsService,
  AiWebSearchService,
  AiFeedbackService,
] as const;

@Global()
@Module({
  providers: [...SERVICES],
  exports: [...SERVICES],
})
export class AiCoreModule {}
