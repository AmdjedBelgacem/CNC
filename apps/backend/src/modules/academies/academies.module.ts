import { Module } from '@nestjs/common';
import { AcademiesController } from './academies.controller';
import { AdminAcademiesController } from './admin-academies.controller';
import { AcademiesService } from './academies.service';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SearchModule],
  controllers: [AcademiesController, AdminAcademiesController],
  providers: [AcademiesService],
  exports: [AcademiesService],
})
export class AcademiesModule {}
