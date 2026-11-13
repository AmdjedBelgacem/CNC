import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = resolve(__dirname, '../src');
const read = (p: string) => readFileSync(resolve(src, p), 'utf8');
const replicas = () => read('components/skeletons/public-page-replicas.tsx');

/** The single component a loading.tsx returns. */
function renderedSkeleton(loadingFile: string): string {
  const match = read(loadingFile).match(/return\s*<(\w+)/);
  expect(match, loadingFile).not.toBeNull();
  return match?.[1] ?? '';
}

/** The body of an exported function in the replicas file, up to the next export. */
function exported(name: string): string {
  const file = replicas();
  const start = file.indexOf(`export function ${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  const next = file.indexOf('\nexport function ', start + 1);
  return file.slice(start, next === -1 ? undefined : next);
}

/**
 * Routes measured at 1440x900 whose skeleton height did not match the page: each now has its
 * own replica instead of inheriting a parent's or sharing a generic one.
 */
describe('route skeletons that used to be inherited or generic', () => {
  const routes: Array<[string, string]> = [
    ['app/(main)/(academy)/account/partner/loading.tsx', 'AccountPartnerPageSkeleton'],
    ['app/(main)/groups/mine/loading.tsx', 'MyGroupsPageSkeleton'],
    ['app/(main)/groups/new/loading.tsx', 'NewGroupPageSkeleton'],
    ['app/(main)/(social)/notifications/loading.tsx', 'NotificationsPageSkeleton'],
    ['app/(main)/(social)/repair/loading.tsx', 'RepairPageSkeleton'],
    ['app/(main)/sponsors/loading.tsx', 'SponsorsPageSkeleton'],
    ['app/(main)/(academy)/settings/preferences/notifications/loading.tsx', 'NotificationPreferencesSkeleton'],
  ];

  it.each(routes)('%s renders %s', (file, component) => {
    expect(existsSync(resolve(src, file)), file).toBe(true);
    expect(renderedSkeleton(file)).toBe(component);
    expect(exported(component)).toContain('<SkeletonRegion');
  });

  it('copies each page container', () => {
    expect(exported('AccountPartnerPageSkeleton')).toContain('mx-auto max-w-3xl space-y-6 px-6 py-12 md:py-16');
    expect(exported('MyGroupsPageSkeleton')).toContain('container mx-auto px-4 py-10 md:py-14');
    expect(exported('NewGroupPageSkeleton')).toContain('mx-auto max-w-3xl px-4 py-10 md:py-14');
    expect(exported('NotificationsPageSkeleton')).toContain('mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14');
    expect(exported('RepairPageSkeleton')).toContain('lg:h-[70vh]');
    expect(exported('SponsorsPageSkeleton')).toContain('border-b border-border/70 py-20 text-center md:py-28');
  });

  it('the settings replica does not put space-y on the region (its sr-only label is a sibling)', () => {
    expect(exported('NotificationPreferencesSkeleton')).toMatch(/<SkeletonRegion>\s*<div className="space-y-6">/);
  });
});

describe('in-page loading branches draw the same replicas and record their size', () => {
  it('account partner waits for its list and remembers its length', () => {
    const page = read('app/(main)/(academy)/account/partner/page.tsx');
    expect(page).toContain('if (!loaded) return <AccountPartnerPageSkeleton />;');
    expect(page).toContain("rememberListCount('public-account-partner'");
  });

  it('my groups keeps the skeleton while auth hydrates and while the list loads', () => {
    const page = read('app/(main)/groups/mine/page.tsx');
    expect(page).toContain('if (!hydrated) return <MyGroupsPageSkeleton />;');
    expect(page).toContain('{isLoading && <MyGroupsLoading />}');
    expect(page).not.toContain('h-64');
    expect(page).toContain("rememberListCount('public-my-groups'");
    expect(exported('MyGroupsLoading')).toContain('<EmptyStateSkeleton');
  });

  it('new group keeps the skeleton while auth hydrates', () => {
    expect(read('app/(main)/groups/new/page.tsx')).toContain('if (!hydrated) return <NewGroupPageSkeleton />;');
  });

  it('notifications records the inbox shape and draws it while loading', () => {
    const page = read('app/(main)/(social)/notifications/page.tsx');
    expect(page).toContain('return <NotificationsPageSkeleton />;');
    expect(page).toContain('<NotificationRowsLoading />');
    for (const key of ['public-notifications', 'public-notification-days', 'public-notification-bodies', 'public-notifications-more']) {
      expect(page).toContain(`rememberListCount('${key}'`);
    }
  });

  it('repair and sponsors draw their list replicas', () => {
    const repair = read('app/(main)/(social)/repair/page.tsx');
    expect(repair).toContain('<RepairShopsLoading />');
    expect(repair).toContain("rememberListCount('public-repair'");
    const sponsors = read('app/(main)/sponsors/page.tsx');
    expect(sponsors).toContain('{isLoading && <SponsorsLoading />}');
    expect(sponsors).toContain("rememberListCount('public-sponsors'");
  });

  it('notification preferences replaces both placeholder branches', () => {
    const page = read('app/(main)/(academy)/settings/preferences/notifications/page.tsx');
    expect(page.match(/return <NotificationPreferencesSkeleton \/>;/g)).toHaveLength(2);
    expect(page).not.toContain('h-64');
  });
});

describe('/events board', () => {
  it('is seeded with the server upcoming list instead of loading in the browser', () => {
    expect(read('app/(main)/events/page.tsx')).toContain('initialEvents={upcoming}');
    expect(read('components/events/events-islands.tsx')).toContain('<EventsBoard initialEvents={initialEvents} />');
    const board = read('components/events/events-board.tsx');
    expect(board).toContain('useState(!initialEvents)');
    expect(board).toContain("initialEvents ? 'All-true' : null");
  });

  it('formats dates only in the browser, so the seeded HTML hydrates cleanly', () => {
    const board = read('components/events/events-board.tsx');
    expect(board).toContain('useSyncExternalStore(noSubscription, () => true, () => false)');
    expect(board).toMatch(/isClient\s*\?\s*`\$\{formatDay\(event\.startDate, locale\)\}/);
  });
});
