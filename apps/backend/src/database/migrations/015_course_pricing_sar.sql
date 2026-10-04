ALTER TABLE "courses" ALTER COLUMN "currency" SET DEFAULT 'SAR';
--> statement-breakpoint
UPDATE "courses" SET "currency" = 'SAR' WHERE "currency" IS NULL OR btrim("currency") = '';
