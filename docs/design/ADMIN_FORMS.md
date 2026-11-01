# Admin create / edit screens

Every admin create and edit screen is built from two modules:

- `components/admin/admin-form.tsx` — the controls: `TextField`, `TextAreaField`,
  `SelectField`, `SwitchField`, `Field`, `FormSection`, `FieldGrid`.
- `components/admin/form-page.tsx` — the page around them: `FormLayout`,
  `SectionNav`, `SaveDock`, `StatusChip`, `SlugField`, `ColorField`, `useFormGuard`.

The reference implementation is `app/(admin)/admin/academies/new/page.tsx`.

## The scaffold

```tsx
<AdminCommandBar trail={…} live={false} />          // breadcrumb only, no Save here
<AdminPageHeader title description badge={<StatusChip tone="new">…</StatusChip>} />
<FormLayout aside={<SectionNav items={…} />}>
  <Reveal><FormSection id="basics" icon title description>…</FormSection></Reveal>
</FormLayout>
<SaveDock mode="create" | "edit" … />
```

## Rules

1. **Save lives in one place: `SaveDock`.** No Save in the command bar, no second
   sticky bar, no button row at the end of the form. Secondary actions that are not
   "save" (Publish, Unpublish, Delete, Preview) stay in the command bar's `actions`.
2. **Create vs edit.** `create`: dock always shown, Create disabled until `canSave`.
   `edit`: dock appears only while there is something to act on (dirty, saving, or a
   moment of "Saved"). Pass `dirty` from a real comparison against the loaded record,
   not a flag set on first keystroke. ⌘S and the leave-page guard come with the dock.
3. **Honest status.** A record that does not exist yet is `StatusChip tone="new"`;
   `AdminCommandBar live={false}`. Existing records show their real state
   (`draft` / `live` / `archived`). Never print "Live" over an unsaved form.
4. **Slugs use `SlugField`.** Create follows the title until hand-edited. Edit is
   locked behind an unlock button (a published slug breaks links). Never a disabled
   input.
5. **Colours use `ColorField`.** Default to brand clay `#B65433`, never an arbitrary
   hex.
6. **Required / optional.** Mark required fields with `required` (the `*` is drawn by
   `Field` — never put `*` in the label text). Label optional *sections* with
   `badge={t('optional')}`.
7. **Validation appears after the first attempt**, not on arrival. On a failed attempt
   scroll to the first invalid section and mark it in `SectionNav` (`invalid`).
8. **Long forms get a `SectionNav`** (anything with 3+ sections). Each `FormSection`
   needs a matching `id`. Short forms (≤2 sections) skip it.
9. **Controls come from the kit.** No hand-copied input class strings, no native
   `<select>` with browser chrome, no `bg-background` inputs next to `bg-card` ones.
10. **Motion**: `m` from framer-motion (never `motion` — `LazyMotion strict`),
    springs/eases from `@/lib/motion`, sections wrapped in `Reveal`. Respect reduced
    motion (the kit already does).
11. **i18n**: every string through `next-intl`, with `en` **and** `ar` added. Insert
    keys as plain text; never load-and-dump the JSON files (duplicate keys collapse).
    RTL must work: logical properties (`ps-`/`pe-`/`start`/`end`), `dir="ltr"` on
    URLs, hex and code.
12. **Behaviour is preserved.** Restyling must not change API calls, payloads,
    validation rules or what a field means.

## Checking a screen

Screenshot it in light and dark, at desktop width and at 390px, empty and filled, and
with a failed attempt. Look at the image — do not infer from the code.
