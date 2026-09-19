import { Module } from '@nestjs/common';
import { CertificationController } from './certification.controller';
import { AdminCertificationsController } from './admin-certifications.controller';
import { AdminCertTemplatesController } from './admin-cert-templates.controller';
import { CertificationService } from './certification.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [CertificationController, AdminCertificationsController, AdminCertTemplatesController],
  providers: [CertificationService],
  exports: [CertificationService],
})
export class CertificationModule {}
