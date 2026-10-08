import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  controllers: [QuotesController],
  providers: [QuotesService],
  // A quote request is worthless if nobody is told about it, so the notification path is
  // a hard dependency rather than an optional one.
  imports: [NotificationsModule],
})
export class QuotesModule {}
