import { Module, forwardRef } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PlatformAlertsService } from './platform-alerts.service';
import { PlatformAlertsController } from './platform-alerts.controller';
import { WsModule } from '../ws/ws.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  // forwardRef: AuthModule pulls in NotificationsModule for its own delivery,
  // and the platform alert service audits through AuthModule.
  imports: [WsModule, forwardRef(() => AuthModule)],
  controllers: [NotificationsController, PlatformAlertsController],
  providers: [NotificationsService, PlatformAlertsService],
  exports: [NotificationsService, PlatformAlertsService],
})
export class NotificationsModule {}
