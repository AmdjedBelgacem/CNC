import { Module, forwardRef } from '@nestjs/common';
import { CertificationController } from './certification.controller';
import { AdminCertificationsController } from './admin-certifications.controller';
import { AdminCertTemplatesController } from './admin-cert-templates.controller';
import { CertificationService } from './certification.service';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { CertificateRendererService } from './certificate-renderer';

@Module({
  imports: [AuthModule, NotificationsModule, StorageModule, forwardRef(() => EmailModule)],
  controllers: [CertificationController, AdminCertificationsController, AdminCertTemplatesController],
  // The renderer and storage are what turn an issued row into a real file, so
  // they are part of this module rather than optional extras.
  providers: [CertificationService, CertificateRendererService],
  exports: [CertificationService, CertificateRendererService],
})
export class CertificationModule {}
