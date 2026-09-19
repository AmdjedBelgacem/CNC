import { Module } from '@nestjs/common';
import { DmService } from './dm.service';
import { DmController } from './dm.controller';
import { UserBlocksController } from './user-blocks.controller';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [WsModule],
  controllers: [DmController, UserBlocksController],
  providers: [DmService],
  exports: [DmService],
})
export class DmModule {}
