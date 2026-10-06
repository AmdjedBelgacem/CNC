import { Module, forwardRef } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PlatformAlertsService } from './platform-alerts.service';
import { PlatformAlertsController } from './platform-alerts.controller';
import { WsModule } from '../ws/ws.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';

@Module({
  // forwardRef: AuthModule pulls in NotificationsModule for its own delivery,
  // and the platform alert service audits through AuthModule.
  imports: [WsModule, forwardRef(() => AuthModule), forwardRef(() => EmailModule)],
  controllers: [NotificationsController, PlatformAlertsController],
  providers: [NotificationsService, PlatformAlertsService],
  exports: [NotificationsService, PlatformAlertsService],
})
export class NotificationsModule {}
