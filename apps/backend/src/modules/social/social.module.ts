import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [NotificationsModule, SearchModule],
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
