import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { PartnersAdminController } from './partners-admin.controller';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EmailModule, NotificationsModule],
  providers: [PartnersService],
  controllers: [PartnersController, PartnersAdminController],
  exports: [PartnersService],
})
export class PartnersModule {}
