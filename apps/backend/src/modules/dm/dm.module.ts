import { Module } from '@nestjs/common';
import { DmService } from './dm.service';
import { DmController } from './dm.controller';
import { UserBlocksController } from './user-blocks.controller';
import { WsModule } from '../ws/ws.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [WsModule, NotificationsModule],
  controllers: [DmController, UserBlocksController],
  providers: [DmService],
  exports: [DmService],
})
export class DmModule {}
