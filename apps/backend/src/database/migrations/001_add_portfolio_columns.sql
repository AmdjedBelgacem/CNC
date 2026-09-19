-- Add missing columns to user_portfolio_items
ALTER TABLE user_portfolio_items ADD COLUMN IF NOT EXISTS project_url varchar(500);
ALTER TABLE user_portfolio_items ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE user_portfolio_items ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;

-- Add missing columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_image_url varchar(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio_enabled boolean DEFAULT true;

-- Add metadata column to verification_tokens
ALTER TABLE verification_tokens ADD COLUMN IF NOT EXISTS metadata jsonb;
