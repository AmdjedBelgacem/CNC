# Adding a Block to the Layout Builder

Every block is defined **once** in the shared registry and is automatically
available to the Puck editor, the backend validation gate, and the public
renderer. Adding a new block touches three places (all on the shared
registry, plus one renderer registration).

## 1. Define the block in the shared registry

File: `packages/shared/src/blocks/registry.ts`

```ts
export const myBlockPropsSchema = z.object({
  id: z.string().optional(),
  title: z.string().max(300).optional(),
  items: z.array(z.object({ label: z.string().max(120).optional() })).max(12).default([]),
});
export type MyBlockProps = z.infer<typeof myBlockPropsSchema>;

export const myBlockDefaults: MyBlockProps = {
  title: 'My Block',
  items: [{ label: 'Example' }],
};

const myBlock: BlockDefinition = {
  type: 'my-block',            // kebab-case, used as the layout node type
  label: 'My Block',
  description: 'Short description shown in the Puck insert menu.',
  category: 'Content',         // Sections | Dynamic | Content | Layout
  schema: myBlockPropsSchema,  // backend validates props with this
  defaultProps: myBlockDefaults,
};
```

Then register it in `BLOCK_REGISTRY`:

```ts
export const BLOCK_REGISTRY = {
  // ...existing blocks
  'my-block': myBlock,
};
```

Notes:

- The `id` field is managed by the editor; keep it `optional` in the schema.
- Any value shape (text, numbers, arrays, nested objects) works — the
  backend only checks it against the zod schema.
- If the block is a container that nests other blocks (like `section`), give
  it `zones: ['content']` and read nested nodes from the top-level flat
  `layout.zones` map under the key `"<nodeId>:<zone>"` (Puck 0.20 data shape).

## 2. Add the renderer component

Create `apps/frontend/src/components/builder/blocks/my-block.tsx`:

```tsx
import type { MyBlockProps } from '@titan/shared';

export function MyBlock(props: MyBlockProps) {
  const { title, items } = props;
  if (!items?.length) return null; // empty states render nothing
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-24 md:px-10">
      <h2 className="font-display text-[44px] font-semibold text-foreground">{title}</h2>
      ...
    </section>
  );
}
```

The same component is used by **both** the public renderer and the Puck
editor preview — no separate editor component. If the block needs data from
the API (see `featured-courses-block.tsx`), use `useQuery` against
`/api/proxy/...` and always render a loading and an error state.

## 3. Register in the Puck editor config

File: `apps/frontend/src/lib/builder/puck-config.tsx`

```tsx
const myBlock: ComponentConfig = {
  label: 'My Block',
  defaultProps: myBlockDefaults,
  fields: {
    title: textField('Title'),
    items: {
      type: 'array',
      label: 'Items',
      getItemSummary: (item) => (item?.label as string) || 'Item',
      arrayFields: { label: textField('Label') },
    },
  },
  render: (props) => <MyBlock {...(props as any)} />,
};

// add to components:
export const puckConfig: Config = {
  components: {
    // ...
    'my-block': myBlock,
  },
  // ...
};
```

Helper field builders are at the top of the file (`textField`,
`textareaField`, `numberField`, `selectField`). Icons use `iconField`
(select of `ICON_KEYS`). Boolean props need **no** field — Puck renders a
checkbox automatically.

## 4. Register in the public renderer

File: `apps/frontend/src/components/builder/block-renderer.tsx`

```tsx
import { MyBlock } from '@/components/builder/blocks/my-block';

const BLOCK_COMPONENTS = {
  // ...
  'my-block': (p) => <MyBlock {...(p as any)} />,
};
```

Container blocks (`section`) are handled specially in `BlockRendererNode`
and never listed in `BLOCK_COMPONENTS`.

## What happens automatically

- **Validation** — `publish` runs `pageLayoutSchema` (which reads
  `BLOCK_REGISTRY`) on the backend; invalid props or unknown types are
  rejected before a page can go live.
- **Editor** — the block appears in the Puck insert menu under its category.
- **Defaults** — pages provisioned after the block exists start with the
  default layout; existing pages can use `Reset` or the editor's insert menu.
- **Fallback** — if a node's type is not registered, the renderer skips it
  (no crash).

## Checklist

1. Schema + defaults in `registry.ts`, registered in `BLOCK_REGISTRY`.
2. `apps/frontend/.../blocks/my-block.tsx` (server-renderable; guards empty states).
3. Puck config entry with fields + render.
4. Renderer map entry.
5. Verify: `pnpm --filter @titan/shared exec tsc`,
   `pnpm --filter frontend exec tsc --noEmit`,
   `pnpm --filter backend exec tsc --noEmit`.
