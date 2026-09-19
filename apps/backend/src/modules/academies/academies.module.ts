import { Module } from '@nestjs/common';
import { AcademiesController } from './academies.controller';
import { AdminAcademiesController } from './admin-academies.controller';
import { AcademiesService } from './academies.service';

@Module({
  controllers: [AcademiesController, AdminAcademiesController],
  providers: [AcademiesService],
  exports: [AcademiesService],
})
export class AcademiesModule {}
