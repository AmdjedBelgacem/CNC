import { Global, Module } from '@nestjs/common';
import { PublicCacheService } from './public-cache.service';

/**
 * Global so read-heavy services (courses, products, academies, search) can inject the cache
 * without each module importing it, and so a single Redis connection is shared.
 */
@Global()
@Module({
  providers: [PublicCacheService],
  exports: [PublicCacheService],
})
export class PublicCacheModule {}
