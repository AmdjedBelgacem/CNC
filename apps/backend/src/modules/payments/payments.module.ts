import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MoyasarService } from './moyasar.service';
import { MoyasarController } from './moyasar.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { CoursesModule } from '../courses/courses.module';
import { EventsModule } from '../events/events.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { SecretBoxService } from '../../common/security/secret-box.service';

@Module({
  imports: [AuthModule, NotificationsModule, CoursesModule, EventsModule, EmailModule],
  controllers: [PaymentsController, MoyasarController, AdminPaymentsController],
  providers: [PaymentsService, MoyasarService, SecretBoxService],
  exports: [PaymentsService, MoyasarService, SecretBoxService],
})
export class PaymentsModule {}
