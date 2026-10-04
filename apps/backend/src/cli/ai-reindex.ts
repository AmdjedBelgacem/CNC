import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DrizzleService } from '../database/drizzle.service';
import { tenants } from '../database/schema/tenants';
import { AiCorpusService } from '../modules/ai/ai-corpus.service';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const tenantId = argument('--tenant-id');
  const tenantSlug = argument('--tenant-slug');
  if (!tenantId && !tenantSlug) {
    process.stderr.write('Usage: pnpm --filter backend ai:reindex -- --tenant-id <uuid> | --tenant-slug <slug>\n');
    process.exitCode = 1;
    return;
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const drizzle = app.get(DrizzleService);
    const corpus = app.get(AiCorpusService);
    const resolved = tenantId
      ? await drizzle.db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) })
      : await drizzle.db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug!) });
    if (!resolved) throw new Error('Tenant not found');
    const result = await corpus.reindexTenant(resolved.id);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'AI reindex failed';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
