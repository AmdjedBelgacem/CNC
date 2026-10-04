import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { SearchModule } from '../search/search.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SearchModule, NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
