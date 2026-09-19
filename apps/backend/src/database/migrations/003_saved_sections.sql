-- Tenant-scoped library of reusable section subtrees.
-- node  = the saved container block (usually a section)
-- zones = every zone entry the subtree owns, keyed "<nodeId>:<zone>"

CREATE TABLE IF NOT EXISTS saved_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  node jsonb NOT NULL,
  zones jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_id uuid REFERENCES users(id),
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS saved_sections_tenant_idx ON saved_sections (tenant_id);
