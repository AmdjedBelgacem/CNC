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
