import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { AdminCoursesController } from './admin-courses.controller';
import { CoursesService } from './courses.service';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { CertificationModule } from '../certification/certification.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SearchModule } from '../search/search.module';
import { CurrenciesController } from './currencies.controller';
import { FxRatesService } from './fx-rates.service';

@Module({
  imports: [AuthModule, StorageModule, CertificationModule, NotificationsModule, SearchModule],
  controllers: [CoursesController, AdminCoursesController, CurrenciesController],
  providers: [CoursesService, FxRatesService],
  exports: [CoursesService],
})
export class CoursesModule {}
