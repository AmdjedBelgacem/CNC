import { Module } from '@nestjs/common';
import { AdminSearchController, SearchController } from './search.controller';
import { SearchService } from './search.service';
import { AiCoreModule } from '../ai/ai-core.module';

@Module({
  imports: [AiCoreModule],
  controllers: [SearchController, AdminSearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
