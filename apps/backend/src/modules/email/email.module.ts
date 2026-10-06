import { Module, forwardRef } from '@nestjs/common';
import { AdminEmailController } from './admin-email.controller';
import { EmailProvider } from './email.provider';
import { EmailService } from './email.service';
import { EmailTemplatesService } from './email-templates.service';
import { EmailDispatchService } from './email-dispatch.service';
import { EmailOutboxDispatcherService } from './email-outbox-dispatcher.service';
import { AuthModule } from '../auth/auth.module';

/**
 * Exposes three providers deliberately:
 *
 *  - `EmailService`  the legacy named helpers (verification, reset, 2FA…) so the
 *                    auth flows keep working unchanged. Retargeted onto
 *                    `EmailProvider`, so there is exactly one transport.
 *  - `EmailDispatchService` for other modules to enqueue transactional mail.
 *  - `EmailProvider` for health checks and anything needing transport directly.
 *
 * `AuditService` lives in AuthModule, hence the forwardRef: the audit trail for a
 * template publish is not optional, so this module cannot be instantiated without it.
 */
@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [AdminEmailController],
  providers: [
    EmailProvider,
    EmailService,
    EmailTemplatesService,
    EmailDispatchService,
    EmailOutboxDispatcherService,
  ],
  exports: [EmailProvider, EmailService, EmailDispatchService, EmailOutboxDispatcherService],
})
export class EmailModule {}