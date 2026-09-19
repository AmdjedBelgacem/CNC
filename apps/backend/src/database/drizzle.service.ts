import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ConfigService } from '../config/config.service';
import * as schema from './schema';

@Injectable()
export class DrizzleService implements OnModuleInit {
  public db!: PostgresJsDatabase<typeof schema>;
  private client!: postgres.Sql;

  constructor(@Inject(ConfigService) private config: ConfigService) {}

  async onModuleInit() {
    this.client = postgres(this.config.get('DATABASE_URL'), { prepare: false });
    this.db = drizzle(this.client, { schema });
    // Ensure branding/SEO image columns exist — idempotent for fresh clones that haven't run 005_* migration yet.
    try {
      await this.client.unsafe(`ALTER TABLE "academies" ADD COLUMN IF NOT EXISTS "seo_image_url" varchar(500)`);
    } catch (err) {
      // Non-fatal: migration will be applied via drizzle-kit on next deploy
      console.warn('[DrizzleService] ensure seo_image_url column failed (non-fatal)', err);
    }
  }

  async onModuleDestroy() {
    if (this.client) await this.client.end();
  }
}
