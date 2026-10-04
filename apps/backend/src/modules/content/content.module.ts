import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { BuilderModule } from '../builder/builder.module';

@Module({
  // The public navigation endpoint is served here but implemented in the
  // builder module, which owns the nav table.
  imports: [BuilderModule],
  controllers: [ContentController],
  providers: [ContentService],
})
export class ContentModule {}
