import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../..', import.meta.url).pathname;
const FRONTEND = join(ROOT, 'apps/frontend');
const read = (rel: string) => readFileSync(join(FRONTEND, rel), 'utf8');

const en = JSON.parse(read('messages/en.json'));
const ar = JSON.parse(read('messages/ar.json'));

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.next', '.turbo'].includes(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
};

const resolve = (catalog: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, catalog);

/**
 * Keys built at runtime.
 *
 * `t(\`canvas.${viewport.labelKey}\`)` cannot be checked by scanning for string
 * literals, so the standing catalog audit classified it as unresolvable and
 * skipped it. The three `builder.canvas.viewport*` labels were deleted from the
 * catalog by a later rewrite and nothing noticed: the parent block still existed,
 * so it looked fine, and the failure only appeared as a console warning at
 * runtime.
 *
 * These assertions close that hole by taking the key sets from the source data
 * that produces them, not from the catalog.
 */
describe('runtime-built message keys', () => {
  describe('builder viewports', () => {
    // The labelKeys are declared in VIEWPORTS and read by two components.
    const header = read('src/components/builder/editor-header.tsx');
    const labelKeys = [...header.matchAll(/labelKey:\s*'([\w]+)'/g)].map((m) => m[1]!);
    const templates = [
      ...header.matchAll(/tb\(\s*`canvas\.\$\{/g),
      ...read('src/components/builder/canvas-controls.tsx').matchAll(/tb\(\s*`canvas\.\$\{/g),
    ];

    it('the viewport switcher really is built from a template key', () => {
      // Guards the premise: if this ever stops being a template lookup, these
      // assertions are no longer the right check and the test should be revisited.
      expect(templates.length).toBeGreaterThan(0);
      expect(labelKeys).toEqual(['viewportDesktop', 'viewportTablet', 'viewportMobile']);
    });

    it('has a label for every viewport in both locales', () => {
      for (const key of labelKeys) {
        const path = `builder.canvas.${key}`;
        expect(typeof resolve(en, path), `${path} missing from en`).toBe('string');
        expect(typeof resolve(ar, path), `${path} missing from ar`).toBe('string');
        expect(resolve(ar, path), `${path} is not translated`).not.toBe(resolve(en, path));
      }
    });

    it('keeps the width in the tooltip, which is a pure template', () => {
      // `{label} ({width})` is a value composition; it must exist in both locales
      // so the tooltip never falls back to a key path.
      for (const [catalog, locale] of [[en, 'en'], [ar, 'ar']] as const) {
        expect(resolve(catalog, 'builder.canvas.viewportTitle'), `viewportTitle missing in ${locale}`).toBeTypeOf(
          'string',
        );
      }
    });
  });

  describe('every template lookup has a real parent block', () => {
    const sources = walk(join(FRONTEND, 'src')).map((file) => ({
      file: file.replace(`${FRONTEND}/`, ''),
      source: readFileSync(file, 'utf8'),
    }));

    it('reports no lookup whose parent key is absent', () => {
      const missing: string[] = [];
      for (const { file, source } of sources) {
        const varNs = new Map<string, string>();
        for (const call of source.matchAll(/(?:useTranslations|getTranslations)\(\s*['"]([^'"]+)['"]\s*\)/g)) {
          const window = source.slice(Math.max(0, call.index - 90), call.index + call[0].length);
          const nearest = window.match(
            /const\s+(\w+)\s*=\s*(?:useTranslations|getTranslations)\s*\(\s*['"][^'"]+['"]\s*\)/g,
          )?.at(-1);
          if (nearest) varNs.set(nearest.match(/const\s+(\w+)/)![1]!, call[1]!);
        }
        for (const [variable, namespace] of varNs) {
          for (const call of source.matchAll(
            new RegExp(`\\b${variable}\\(\\s*\`([^\`]*\\$\\{[^}]+\\}[^\`]*)\``, 'g'),
          )) {
            const head = call[1]!.split('${')[0]!.replace(/\.$/, '');
            const parent = head ? `${namespace}.${head}` : namespace;
            const block = resolve(en, parent);
            if (block === undefined) missing.push(`${parent}  (${file})`);
            else if (typeof block !== 'object') missing.push(`${parent} is not a block  (${file})`);
          }
        }
      }
      expect(missing, 'template lookups pointing at a missing parent').toEqual([]);
    });
  });

  describe('role and status lookups', () => {
    const staff = read('src/app/(admin)/admin/staff/page.tsx');
    const drawer = read('src/app/(admin)/admin/staff/staff-drawer.tsx');

    it('has a label for every role in roleMeta', () => {
      // Slice exactly the roleMeta object. A fixed window runs into the
      // `statusStyle` map that follows and picks up its keys as roles.
      const start = staff.indexOf('const roleMeta');
      const end = staff.indexOf('const statusStyle');
      const block = staff.slice(start, end === -1 ? start + 4000 : end);
      const roles = [...block.matchAll(/^  (\w+): \{/gm)].map((m) => m[1]!);
      expect(roles.length).toBeGreaterThanOrEqual(5);
      for (const role of roles) {
        for (const path of [`admin.role.${role}`, `admin.roleTag.${role}`, `admin.roleSecurity.${role}`, `admin.roleDept.${role}.title`, `admin.roleDept.${role}.sub`]) {
          expect(resolve(en, path), `${path} missing from en`).toBeTypeOf('string');
          expect(resolve(ar, path), `${path} missing from ar`).toBeTypeOf('string');
        }
      }
    });

    it('has a label for every tab in the staff drawer', () => {
      const tabs = [...drawer.slice(drawer.indexOf('const TABS'), drawer.indexOf('const TABS') + 600).matchAll(/key: '(\w+)'/g)]
        .map((m) => m[1]!);
      expect(tabs.length).toBeGreaterThanOrEqual(5);
      for (const tab of tabs) {
        expect(resolve(en, `admin.tabs.${tab}`), `admin.tabs.${tab} missing from en`).toBeTypeOf('string');
        expect(resolve(ar, `admin.tabs.${tab}`), `admin.tabs.${tab} missing from ar`).toBeTypeOf('string');
      }
    });

    it('has a label for every tab in the learner drawer', () => {
      // The learner drawer resolves tab labels as `tabs.${tab.key}` but its
      // TABS table was never covered by the check above, so `purchases` and
      // `learning` shipped untranslated and logged MISSING_MESSAGE on every
      // render of the drawer.
      const learnerDrawer = read('src/app/(admin)/admin/users/learner-drawer.tsx');
      const start = learnerDrawer.indexOf('const TABS');
      const tabs = [
        ...learnerDrawer
          .slice(start, start + 600)
          .matchAll(/key: '(\w+)'/g),
      ].map((m) => m[1]!);
      expect(tabs.length).toBeGreaterThanOrEqual(5);
      for (const tab of tabs) {
        expect(resolve(en, `admin.tabs.${tab}`), `admin.tabs.${tab} missing from en`).toBeTypeOf('string');
        expect(resolve(ar, `admin.tabs.${tab}`), `admin.tabs.${tab} missing from ar`).toBeTypeOf('string');
      }
    });

    it('has a label for every role in the learner drawer', () => {
      // Same blind spot for `role.${user.role}`. The catalog declared six roles
      // but the database also uses `learner` and `student`, so a learner
      // account rendered the raw key in three places in this drawer.
      const learnerDrawer = read('src/app/(admin)/admin/users/learner-drawer.tsx');
      const start = learnerDrawer.indexOf('const roleLabel');
      const end = learnerDrawer.indexOf('const roleBadge');
      const roles = [
        ...learnerDrawer
          .slice(start, end === -1 ? start + 400 : end)
          .matchAll(/^  (\w+):/gm),
      ].map((m) => m[1]!);
      expect(roles.length).toBeGreaterThanOrEqual(6);
      for (const role of roles) {
        expect(resolve(en, `admin.role.${role}`), `admin.role.${role} missing from en`).toBeTypeOf('string');
        expect(resolve(ar, `admin.role.${role}`), `admin.role.${role} missing from ar`).toBeTypeOf('string');
      }
    });

    it('has a status label for the academy and course badge maps', () => {
      for (const namespace of ['admin.academiesPage.status', 'admin.coursesPage.status']) {
        for (const status of ['draft', 'published', 'archived']) {
          expect(resolve(en, `${namespace}.${status}`), `${namespace}.${status} missing from en`).toBeTypeOf('string');
          expect(resolve(ar, `${namespace}.${status}`), `${namespace}.${status} missing from ar`).toBeTypeOf('string');
        }
      }
    });
  });
});
