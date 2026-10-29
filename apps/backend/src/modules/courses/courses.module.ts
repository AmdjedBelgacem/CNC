import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { AdminCoursesController } from './admin-courses.controller';
import { LiveSessionsController } from './live-sessions.controller';
import { CoursesService } from './courses.service';
import { LiveSessionsService } from './live-sessions.service';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { CertificationModule } from '../certification/certification.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SearchModule } from '../search/search.module';
import { CurrenciesController } from './currencies.controller';
import { FxRatesService } from './fx-rates.service';

@Module({
  imports: [AuthModule, StorageModule, CertificationModule, NotificationsModule, SearchModule],
  controllers: [CoursesController, AdminCoursesController, LiveSessionsController, CurrenciesController],
  providers: [CoursesService, LiveSessionsService, FxRatesService],
  exports: [CoursesService, LiveSessionsService],
})
export class CoursesModule {}
