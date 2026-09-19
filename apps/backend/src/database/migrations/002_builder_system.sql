-- Builder system: pages, page_versions, themes (rebuild), theme_versions
-- The old `themes` table (is_dark / css_variables / font_family / border_radius) was never
-- referenced by any service or controller, so it is safely rebuilt with the token-based model.

-- Pages
CREATE TABLE IF NOT EXISTS pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug varchar(100) NOT NULL,
  title varchar(255) NOT NULL,
  layout jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 0,
  published_at timestamp,
  published_by_id uuid REFERENCES users(id),
  updated_by_id uuid REFERENCES users(id),
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS pages_tenant_slug_idx ON pages (tenant_id, slug);
CREATE INDEX IF NOT EXISTS pages_tenant_idx ON pages (tenant_id);

-- Immutable page version history (snapshot per publish)
CREATE TABLE IF NOT EXISTS page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version integer NOT NULL,
  layout jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'published',
  note varchar(500),
  changed_by_id uuid REFERENCES users(id),
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS page_versions_page_version_idx ON page_versions (page_id, version);
CREATE INDEX IF NOT EXISTS page_versions_tenant_idx ON page_versions (tenant_id);

-- Themes (rebuild — old table unused)
DROP TABLE IF EXISTS themes;

CREATE TABLE themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL DEFAULT 'Default Theme',
  tokens jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  published_at timestamp,
  published_by_id uuid REFERENCES users(id),
  updated_by_id uuid REFERENCES users(id),
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- Immutable theme version history
CREATE TABLE IF NOT EXISTS theme_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version integer NOT NULL,
  tokens jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'published',
  changed_by_id uuid REFERENCES users(id),
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS theme_versions_theme_version_idx ON theme_versions (theme_id, version);
CREATE INDEX IF NOT EXISTS theme_versions_tenant_idx ON theme_versions (tenant_id);
