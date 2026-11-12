import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BuilderController } from './builder.controller';
import { BuilderService } from './builder.service';
import { NavigationService } from './navigation.service';
import { SearchModule } from '../search/search.module';
import { BuilderAiController } from './ai/builder-ai.controller';
import { BuilderAiService } from './ai/builder-ai.service';
import { PageAutoTranslateService } from './page-autotranslate.service';
import { HomeRedesignUpgradeService } from './home-redesign-upgrade.service';

@Module({
  imports: [AuthModule, SearchModule],
  controllers: [BuilderController, BuilderAiController],
  providers: [BuilderService, NavigationService, BuilderAiService, PageAutoTranslateService, HomeRedesignUpgradeService],
  // ContentModule reads the public navigation tree, so it has to be exported.
  exports: [BuilderService, NavigationService],
})
export class BuilderModule {}
