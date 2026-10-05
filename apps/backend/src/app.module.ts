import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { PublicCacheModule } from './common/cache/public-cache.module';
import { HealthModule } from './modules/health/health.module';
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
import { IntegrationsModule } from './modules/integrations/integrations.module';
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
import { AiAssistantModule } from './modules/ai/ai-assistant.module';
import { TenantResolveGuard } from './common/guards/tenant-resolve.guard';
import { CsrfGuard } from './modules/auth/guards/csrf.guard';
import { RedisThrottlerStorage } from './modules/auth/providers/redis-throttler-storage';
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    DatabaseModule,
    PublicCacheModule,
    HealthModule,
    AuthModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        /**
         * Global abuse ceiling.
         *
         * These were hardcoded, which made the limit impossible to tune without a code
         * change and made load testing impossible from a single IP: at 100 requests per
         * minute per address, every run 429s after the first hundred. It is also a real
         * production constraint — 100 req/min per IP throttles any client behind carrier
         * NAT or a corporate proxy, where thousands of users share one address.
         *
         * Defaults are unchanged, so behaviour is identical unless these are set. Raise
         * THROTTLE_LIMIT for load testing, or to match the real per-client request rate.
         */
        throttlers: [
          {
            ttl: config.get('THROTTLE_TTL_MS') ?? 60_000,
            limit: config.get('THROTTLE_LIMIT') ?? 100,
          },
        ],
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
    IntegrationsModule,
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
    AiAssistantModule,
  ],
  providers: [
    // The throttler is registered globally. `THROTTLER_ENABLED=false` removes it entirely
    // and exists for local load testing only: the guard counts per client IP, so every
    // request from a single load generator shares one bucket and the run measures the
    // limiter rather than the application. Mirrors the seed script's ALLOW_PROD_SEED
    // affordance — explicit, off by default, never set in a deployed environment.
    ...(process.env.THROTTLER_ENABLED === 'false'
      ? []
      : [{ provide: APP_GUARD, useClass: ThrottlerGuard }]),
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
