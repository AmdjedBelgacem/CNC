-- Widen certifications.pdf_url from varchar(500) to text.
--
-- A presigned Supabase/S3 URL is ~700 characters once its signature query parameters are
-- appended. The 500-char limit made Postgres reject the insert with
-- `22001 string_data_right_truncation`, so every certificate issuance failed with a 500
-- even though the PDF had been rendered and uploaded successfully.
--
-- Idempotent, so it is safe to run against a database already migrated.
ALTER TABLE certifications
  ALTER COLUMN pdf_url TYPE text;
