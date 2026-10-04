ALTER TABLE "ai_documents" DROP CONSTRAINT IF EXISTS "ai_documents_audience_check";
--> statement-breakpoint
ALTER TABLE "ai_documents" ADD CONSTRAINT "ai_documents_audience_check" CHECK ("audience" IN ('public', 'free-preview', 'enrolled', 'admin'));
--> statement-breakpoint
ALTER TABLE "ai_document_chunks" DROP CONSTRAINT IF EXISTS "ai_document_chunks_audience_check";
--> statement-breakpoint
ALTER TABLE "ai_document_chunks" ADD CONSTRAINT "ai_document_chunks_audience_check" CHECK ("audience" IN ('public', 'free-preview', 'enrolled', 'admin'));
