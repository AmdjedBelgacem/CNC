import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminIntegrationsController } from './admin-integrations.controller';
import { GoogleIntegrationsService } from './google-integrations.service';
import { SecretBoxService } from '../../common/security/secret-box.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminIntegrationsController],
  providers: [GoogleIntegrationsService, SecretBoxService],
  exports: [GoogleIntegrationsService],
})
export class IntegrationsModule {}
