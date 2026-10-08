# Arabic (i18n) completion contract

You are removing hardcoded English UI strings from a Next.js app so that an Arabic
(`ar`) reader sees a fully translated interface. The catalogs already exist and are at
100% key parity — your job is to route hardcoded English *through* the catalogs.

## Repo

`/Users/mac/programming/projects/cnc` — the app is `apps/frontend`.
Catalogs: `apps/frontend/messages/en.json` and `apps/frontend/messages/ar.json`.

## Hard rules

1. **DO NOT edit `messages/en.json` or `messages/ar.json`.** Two other agents are writing
   catalogs at the same time and concurrent writes would silently drop keys. Instead write
   your keys to the two fragment files named in your task, and the coordinator merges them.
2. **Do not change any logic.** No reordering of statements, no refactors, no prop
   changes, no behaviour changes. Only replace a literal with a catalog lookup.
3. **Every string you wrap must end up in BOTH fragments** with the identical key path.
4. Arabic must be **natural Arabic**, the way a native speaker writes it — not English word
   order with Arabic words, and not transliterated English. For UI nouns, product terms and
   marketing copy, prefer the terminology already used elsewhere in `ar.json`; be consistent
   with it. Read `ar.json` before translating.
5. `test/i18n-catalog.spec.ts` in `apps/backend` enforces that **every Arabic value
   contains Arabic characters** (there is a small explicit allow-list of non-translatables
   like brand names, `TITAN TV`, format codes). So do NOT leave an English string in the
   Arabic fragment. Brand names, "Google", "PDF", "Email" and similar may stay Latin only
   if the existing catalog already treats them that way — check first.
6. Keep placeholders exactly: `{n}`, `{count}`, `{name}` etc. must survive in both languages,
   with identical placeholder names.
7. Prefer descriptive camelCase keys. Reuse an existing key if the same English string
   already exists in your namespace.

## Client vs server components — get this right

- File starts with `'use client'` → use the hook:
  ```ts
  import { useTranslations } from 'next-intl';
  const t = useTranslations('account');        // namespace you were assigned
  ```
  If the component is a plain function component, this is fine anywhere.
- File does **NOT** start with `'use client'` (a server component) → use the server API:
  ```ts
  import { getTranslations } from 'next-intl/server';
  export default async function Page() {
    const t = await getTranslations('account');
  ```
  If the exported component is **not** `async` and you cannot make it async without
  restructuring, that is a real blocker for that string — **leave that string hardcoded and
  report it** in your final message rather than breaking the component.

## What counts as a hardcoded string to fix

- JSX text: `>Unable to load courses<`
- Props: `placeholder=`, `aria-label=`, `title=`, `alt=`, `label=`, `description=`,
  `heading=`, `emptyText=`, `helperText=`, `buttonText=`, `confirmText=`
- Object literals used purely for display: `{ title: 'No invoices yet', description: '...' }`
- `toast({ title: 'Saved' })` style display strings
- Error/empty/loading states shown to the user

## What to LEAVE ALONE

- Anything already wrapped in `t(...)`, `getTranslations`, or otherwise translated.
- Class names, CSS, Tailwind arbitrary values, ids, slugs, URLs, route paths, API field
  names, `console.*`, test ids, `data-*` attribute values, `aria-live` regions' structure.
- Strings that are genuinely proper nouns already Latin in the catalog.
- Do NOT translate keys of objects that get sent to the API (e.g. status values, role
  names, sort keys). Translating a value that is persisted or compared server-side breaks
  behaviour. Translate only the human-facing copy around it.

## Fragment file format

Write exactly two files, containing **only your assigned top-level namespace**:

`/tmp/frag-<group>-en.json`
```json
{ "account": { "security": { "pageTitle": "Security" } } }
```
`/tmp/frag-<group>-ar.json` — same shape, Arabic values.

## Verify before you finish

1. `cd apps/frontend && npx tsc --noEmit` — must be clean.
2. Re-read your edited files and grep them again for the patterns you were told to fix;
   they should now be zero.
3. Confirm en/ar fragment key parity yourself (walk both JSON trees).

Report: files changed, keys added per file, anything you deliberately left hardcoded and
why.