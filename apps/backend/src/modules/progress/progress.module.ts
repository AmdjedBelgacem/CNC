import { Module, forwardRef } from '@nestjs/common';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { CertificationModule } from '../certification/certification.module';

@Module({
  imports: [forwardRef(() => CertificationModule)],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
