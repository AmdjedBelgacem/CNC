import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BuilderController } from './builder.controller';
import { BuilderService } from './builder.service';
import { NavigationService } from './navigation.service';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [AuthModule, SearchModule],
  controllers: [BuilderController],
  providers: [BuilderService, NavigationService],
  // ContentModule reads the public navigation tree, so it has to be exported.
  exports: [BuilderService, NavigationService],
})
export class BuilderModule {}
