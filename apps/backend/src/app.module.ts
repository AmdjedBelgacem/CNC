import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { CoursesModule } from './modules/courses/courses.module';
import { AcademiesModule } from './modules/academies/academies.module';
import { ProgressModule } from './modules/progress/progress.module';
import { CertificationModule } from './modules/certification/certification.module';
import { FeedModule } from './modules/feed/feed.module';
import { EventsModule } from './modules/events/events.module';
import { SponsorsModule } from './modules/sponsors/sponsors.module';
import { SearchModule } from './modules/search/search.module';
import { UploadModule } from './modules/upload/upload.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProductsModule } from './modules/products/products.module';
import { SocialModule } from './modules/social/social.module';
import { RepairModule } from './modules/repair/repair.module';
import { WsModule } from './modules/ws/ws.module';
import { AdminModule } from './modules/admin/admin.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { TitanTvModule } from './modules/titan-tv/titan-tv.module';
import { StudyGroupsModule } from './modules/study-groups/study-groups.module';
import { ChatModule } from './modules/chat/chat.module';
import { DmModule } from './modules/dm/dm.module';
import { BuilderModule } from './modules/builder/builder.module';
import { ContentModule } from './modules/content/content.module';
import { TenantResolveGuard } from './common/guards/tenant-resolve.guard';
import { CsrfGuard } from './modules/auth/guards/csrf.guard';
import { RedisThrottlerStorage } from './modules/auth/providers/redis-throttler-storage';
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    DatabaseModule,
    AuthModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60000, limit: 100 }],
        storage: new RedisThrottlerStorage(config),
      }),
    }),
    TenantsModule,
    UsersModule,
    CoursesModule,
    AcademiesModule,
    ProgressModule,
    CertificationModule,
    FeedModule,
    EventsModule,
    SponsorsModule,
    SearchModule,
    UploadModule,
    PaymentsModule,
    NotificationsModule,
    ProductsModule,
    SocialModule,
    RepairModule,
    WsModule,
    AdminModule,
    QuotesModule,
    TitanTvModule,
    StudyGroupsModule,
    ChatModule,
    DmModule,
    BuilderModule,
    ContentModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantResolveGuard,
    },
    {
      // Global CSRF: covers every state-changing route, not just register/login.
      // Enforcement + exemptions are documented in csrf.guard.ts.
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule {}
