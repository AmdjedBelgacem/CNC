import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');

/**
 * Regression guards for defects found in a page-by-page audit. Each one was a control or
 * route that looked fine in review and failed only when used.
 */
describe('proxy passes bytes through untouched', () => {
  const proxy = read('app/api/proxy/[...path]/route.ts');
  it('reads the response as bytes, because UTF-8 decoding corrupts a PDF', () => {
    expect(proxy).toMatch(/response\.arrayBuffer\(\)/);
    expect(proxy).not.toMatch(/await response\.text\(\)\s*;\s*\n\s*\/\/ Forward Set-Cookie/);
  });
  it('forwards the filename header and sends no body for 204/304', () => {
    expect(proxy).toMatch(/content-disposition/);
    expect(proxy).toMatch(/\[101, 204, 205, 304\]/);
  });
});

describe('links point at routes that exist', () => {
  it('post-payment "view orders" goes to /account, not a 404', () => {
    expect(read('app/(main)/(store)/checkout/success/page.tsx')).not.toContain('/account/orders');
  });
  it('the admin academy link uses the public /academy route', () => {
    expect(read('app/(admin)/admin/academies/page.tsx')).not.toContain('`/academies/${');
  });
  it('certificate verify links use /verify/[number]', () => {
    expect(read('components/profile/profile-sections.tsx')).not.toContain('/certificates/verify/');
  });
  it('register sends Google sign-in through the proxy, as login does', () => {
    const register = read('app/(auth)/register/page.tsx');
    expect(register).not.toContain('/api/auth/oauth');
    expect(register).toContain('/api/proxy/auth/oauth/');
  });
});

describe('controls that depend on a field the API returns', () => {
  it('the follow button posts the profile id, not a field the status endpoint never sent', () => {
    expect(read('app/(main)/(academy)/u/[username]/page.tsx')).toMatch(/profile\?\.id \?\? followStatus\.targetUserId/);
  });
  it('the admin learner picker searches with the param the API reads', () => {
    expect(read('app/(admin)/admin/certificates/issue-sheet.tsx')).toMatch(/limit=20&search=/);
  });
});

describe('page titles carry the brand once', () => {
  it('top-level titles do not repeat the suffix the root template adds', () => {
    for (const file of [
      'app/(main)/(social)/tags/page.tsx',
      'app/(main)/groups/layout.tsx',
      'app/(main)/privacy/page.tsx',
      'app/(main)/terms/page.tsx',
      'app/(main)/refunds/page.tsx',
      'app/(main)/sponsors/layout.tsx',
      'app/(main)/titan-tv/layout.tsx',
    ]) {
      expect(read(file), file).not.toMatch(/^ {2}title: .*\| Baroot CNC Solutions/m);
    }
  });
  it('event pages get their own metadata and a real 404', () => {
    const layout = read('app/(main)/events/[slug]/layout.tsx');
    expect(layout).toMatch(/generateMetadata/);
    expect(layout).toMatch(/notFound\(\)/);
  });
});

describe('phone layout and honest states', () => {
  it('the header fits a 375px screen: tight gaps below sm', () => {
    const nav = read('components/layout/nav-main.tsx');
    expect(nav).toMatch(/gap-2 px-3 sm:gap-6 sm:px-6/);
    expect(nav).toMatch(/gap-0 sm:gap-1/);
  });
  it('platform alerts never say "All clear" when the alerts failed to load', () => {
    const page = read('app/(admin)/admin/alerts/page.tsx');
    expect(page).toMatch(/error\s*\n?\s*\? undefined/);
    expect(page).toMatch(/\) : error \? null : \(items\?\.length/);
  });
  it('feed toasts confirm the action instead of repeating the button label', () => {
    const stream = read('components/feed/feed-stream.tsx');
    expect(stream).toMatch(/t\('postDeleted'\)/);
    expect(stream).toMatch(/t\('postCreated'\)/);
    expect(stream).not.toMatch(/title: t\('deletePost'\)/);
  });
  it('credential endpoints do not trigger a token refresh on 401', () => {
    expect(read('lib/api-client.ts')).toMatch(/isCredentialCall/);
  });
  it('admin tabs share one title template and stay out of search indexes', () => {
    const layout = read('app/(admin)/admin/layout.tsx');
    expect(layout).toMatch(/template: `%s \| Admin \| \$\{BRAND_NAME\}`/);
    expect(layout).toMatch(/robots: \{ index: false/);
  });
});

describe('messaging', () => {
  it('the profile Message button opens a conversation instead of doing nothing', () => {
    const profile = read('app/(main)/(academy)/u/[username]/page.tsx');
    expect(profile).toMatch(/'\/dm\/conversations', \{ peerId: profile\.id \}/);
    expect(profile).toMatch(/onClick=\{handleMessage\}/);
  });
  it('the messages page is signed-in only and reserved so a builder page cannot shadow it', () => {
    expect(read('components/auth/protected-route.tsx')).toMatch(/'\/messages'/);
    expect(read('proxy.ts')).toMatch(/'\/messages'/);
    expect(read('app/(main)/(social)/messages/page.tsx')).toMatch(/\/dm\/messages/);
  });
  it('placeholder-link buttons are hidden from visitors', () => {
    expect(read('components/builder/blocks/button-block.tsx')).toMatch(/href\.trim\(\) === '#' && !puck\?\.isEditing\) return null/);
  });
});

describe('admin screens agree with the rest of the platform', () => {
  it('finance shows money in the platform currency, not a hard-coded USD default', () => {
    const finance = read('app/(admin)/admin/finance/page.tsx');
    expect(finance).not.toMatch(/formatMoney\(/);
    expect(finance).toMatch(/DEFAULT_CURRENCY/);
  });
  it('partner decisions are offered only while an application is still open', () => {
    const partners = read('app/(admin)/admin/partners/page.tsx');
    expect(partners).toMatch(/OPEN_STATUSES = new Set\(\['pending', 'under_review', 'needs_info'\]\)/);
    expect(partners).toMatch(/OPEN_STATUSES\.has\(String\(a\.status\)\)/);
  });
  it('billing makes no promise it cannot keep: no invented price, no Stripe claim', () => {
    const billing = read('app/(main)/(academy)/settings/billing/page.tsx');
    expect(billing).not.toContain('$29');
    const en = JSON.parse(readFileSync(resolve(__dirname, '../messages/en.json'), 'utf8'));
    expect(en.account.billing.stripeNote).not.toMatch(/stripe/i);
  });
});

describe('staff screen controls lead somewhere real', () => {
  const staff = read('app/(admin)/admin/staff/page.tsx');
  it('"View Audit Logs" opens the audit log, not the roles list', () => {
    expect(staff).toMatch(/router\.push\('\/admin\/staff\/audit'\)/);
    expect(read('app/(admin)/admin/staff/audit/page.tsx')).toMatch(/AuditLog/);
  });
  it('has no second button that only repeats Edit Permissions', () => {
    expect(staff).not.toMatch(/access\.moreOptions/);
  });
  it('makes no cryptographic-signing claim the platform does not back', () => {
    const en = readFileSync(resolve(__dirname, '../messages/en.json'), 'utf8');
    expect(en).not.toMatch(/cryptographically signed|Telemetry Ledger/);
  });
});

describe('admin drawers and cards do not offer what the server refuses or hide failures', () => {
  it('a deleted learner cannot be impersonated, reset or deleted again from the drawer', () => {
    const drawer = read('app/(admin)/admin/users/learner-drawer.tsx');
    expect(drawer).toMatch(/const isDeleted = user\?\.accountStatus === 'deleted'/);
    expect(drawer).toMatch(/canImpersonate && !isSelf && !isDeleted/);
    expect(drawer).toMatch(/canForcePw && !isDeleted/);
  });
  it('a valid certificate always offers its PDF, with no separate build step', () => {
    // The server builds the document on demand when no stored copy exists, so the
    // "Build PDF" step (and its silent-failure path) is gone.
    const page = read('app/(admin)/admin/certificates/page.tsx');
    expect(page).toMatch(/st !== 'revoked' && \(\s*<a\s+href=\{`\/api\/proxy\/admin\/certifications\/\$\{cert\.id\}\/download`\}/);
    expect(page).not.toMatch(/regenerate-pdf/);
    const detail = read('app/(admin)/admin/certificates/certificate-detail.tsx');
    expect(detail).toMatch(/!isRevoked \? \(/);
  });
  it('learners can print a certificate directly', () => {
    const list = read('components/certificates/certificate-list.tsx');
    expect(list).toMatch(/const print = async/);
    expect(list).toMatch(/contentWindow\?\.print\(\)/);
  });
  it('the builder compares layouts by content, so edit-then-undo is not "unsaved"', () => {
    expect(read('app/(admin)/admin/builder/builder-editor.tsx')).toMatch(/layoutFingerprint\(seeded\) !== layoutFingerprint\(baselineRef\.current\)/);
  });
});

describe('learner drawer reflects an action once it has happened', () => {
  it('reloads the learner after a successful action (but not after a delete, which closes it)', () => {
    const drawer = read('app/(admin)/admin/users/learner-drawer.tsx');
    const body = drawer.slice(drawer.indexOf('const mutate = async'), drawer.indexOf('const suspendReason'));
    expect(body).toMatch(/onChanged\(okMessage\);[\s\S]*if \(method !== 'DELETE'\) void loadAll\(\);/);
  });
});

describe('admin screens fit a phone and keep small controls tappable', () => {
  const adminFiles = (() => {
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n: string) => {
        const full = join(dir, n);
        return statSync(full).isDirectory() ? walk(full) : full.endsWith('.tsx') ? [full] : [];
      });
    return [...walk(resolve(__dirname, '../src/app/(admin)')), ...walk(resolve(__dirname, '../src/components/admin'))];
  })();

  it('every responsive grid also defines a base column, so one column cannot size to its widest content', () => {
    const offenders: string[] = [];
    for (const file of adminFiles) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/className="([^"\n]*)"/g)) {
        const toks = m[1]!.split(/\s+/);
        if (!toks.includes('grid')) continue;
        if (!toks.some((t) => /^(sm|md|lg|xl|2xl):grid-cols-/.test(t))) continue;
        if (!toks.some((t) => /^grid-cols-/.test(t))) offenders.push(`${file.split('/src/')[1]}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the shared breadcrumb link and the date filters have a usable hit area', () => {
    expect(read('components/admin/admin-chrome.tsx')).toMatch(/inline-flex min-h-6 items-center rounded-sm font-medium text-muted-foreground/);
    for (const page of ['app/(admin)/admin/users/page.tsx', 'app/(admin)/admin/certificates/page.tsx']) {
      expect(read(page).match(/className="h-full bg-transparent text-xs outline-none/g)).toHaveLength(2);
    }
  });
});

describe('small public controls meet the 24px minimum target size', () => {
  it('feed tag chips, the settings back link and the shared island text link have room to tap', () => {
    const feed = read('components/feed/feed-stream.tsx');
    expect(feed.match(/shrink-0 rounded-full border px-2\.5 py-1 text-xs font-medium/g)).toHaveLength(2);
    expect(read('app/(main)/(academy)/settings/layout.tsx')).toMatch(/mb-3 inline-flex min-h-6 items-center/);
    const island = readFileSync(resolve(__dirname, '../../../packages/shared/src/constants/island-style.ts'), 'utf8');
    expect(island).toMatch(/textLink: 'group inline-flex min-h-6/);
  });
  it('the compact studio language toggle is wide enough and has an accessible name', () => {
    expect(read('app/(admin)/admin/courses/studio/StudioHeader.tsx')).toMatch(/aria-label=\{item === 'ar' \? 'العربية' : 'English'\} className=\{cn\('relative min-h-6 min-w-7/);
  });
});

describe('public profile route names itself', () => {
  const layout = read('app/(main)/(academy)/u/[username]/layout.tsx');
  it('looks the profile up by handle, and does not index or name an unknown one', () => {
    expect(layout).toMatch(/fetchProfileByHandle\(username, viewer\)/);
    expect(layout).toMatch(/if \(!profile\) return \{ title: 'Profile', robots: \{ index: false, follow: false \} \}/);
    expect(read('lib/profile.ts')).toMatch(/`\/profile\/\$\{encodeURIComponent\(handle\)\}`/);
  });
});
