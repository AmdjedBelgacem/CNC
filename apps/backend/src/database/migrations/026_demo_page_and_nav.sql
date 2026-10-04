-- 026: demo custom page and a dropdown navigation example
--
-- Gives a fresh install something to look at: one admin-created page that is
-- published, and a nav group with children. Idempotent, and tenant-scoped so a
-- second tenant is not affected.

-- A published custom page, so the dynamic public route has something to serve.
INSERT INTO "pages" (tenant_id, slug, title, layout, status, version, show_in_nav, template, updated_at)
SELECT
  t.id,
  'our-machines',
  'Our Machines',
  '{"root":{"props":{}},"content":[],"schemaVersion":2}'::jsonb,
  'published',
  1,
  true,
  'content',
  now()
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM pages p WHERE p.tenant_id = t.id AND p.slug = 'our-machines');

-- The published snapshot the public read path serves for the version above.
INSERT INTO "page_versions" (page_id, tenant_id, version, layout, status, note)
SELECT p.id, p.tenant_id, 1,
  '{"root":{"props":{}},"content":[
    {"type":"section","props":{"className":"border-b","paddingTop":64,"paddingBottom":48,"content":[
      {"type":"stack","props":{"direction":"column","gap":"lg","className":"container mx-auto px-4","content":[
        {"type":"heading","props":{"id":"mach-h1","as":"h1","size":"headline-lg","text":"Our Machines"}},
        {"type":"text","props":{"id":"mach-p1","size":"lg","color":"text-text-muted",
          "text":"Every machine in the shop, what it is good for, and how to book time on it."}}
      ]}}
    ]}},
    {"type":"section","props":{"className":"bg-secondary/10","paddingTop":48,"paddingBottom":48,"content":[
      {"type":"stack","props":{"direction":"column","gap":"md","className":"container mx-auto px-4","content":[
        {"type":"heading","props":{"id":"mach-h2","as":"h2","size":"headline-md","text":"What we run"}},
        {"type":"text","props":{"id":"mach-p2","size":"md",
          "text":"3-axis mills, a 5-axis machining centre, CNC turning and Swiss screw machines."}}
      ]}}
    ]}}
  ],"schemaVersion":2}'::jsonb,
  'published',
  'Seeded demo page'
FROM pages p
WHERE p.slug = 'our-machines'
  AND NOT EXISTS (
    SELECT 1 FROM page_versions v WHERE v.page_id = p.id AND v.version = 1
  );

-- A dropdown group with two children, so the tree editor has an example to edit.
WITH target AS (SELECT id FROM tenants ORDER BY created_at LIMIT 1),
grp AS (
  INSERT INTO "navigation_items" (tenant_id, label, label_ar, type, sort_order)
  SELECT target.id, 'Academy', 'الأكاديمية', 'group', 10
  FROM target
  WHERE NOT EXISTS (
    SELECT 1 FROM navigation_items n
    WHERE n.tenant_id = target.id AND n.type = 'group' AND n.label = 'Academy'
  )
  RETURNING id, tenant_id
)
INSERT INTO "navigation_items" (tenant_id, label, label_ar, type, page_slug, href, parent_id, sort_order)
SELECT grp.tenant_id, v.label, v.label_ar, 'page', v.slug, NULL, grp.id, v.ord
FROM grp
CROSS JOIN (VALUES
  ('Courses', 'الدورات', 'academy-landing', 0),
  ('Live sessions', 'الجلسات المباشرة', 'events', 1)
) AS v(label, label_ar, slug, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM navigation_items n
  WHERE n.tenant_id = grp.tenant_id AND n.parent_id = grp.id AND n.page_slug = v.slug
);
