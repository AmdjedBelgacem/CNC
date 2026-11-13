import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');

/**
 * Pages that fetch in the browser never show their route skeleton: their shell renders at once.
 * What shows while their data arrives is the page's own loading branch, so that is what has to
 * match. Measured on production, these jumped by 114px to 2,300px when the data arrived.
 */
describe('in-page loading states', () => {
  it('account security draws session rows, not a line of text', () => {
    const page = read('app/(main)/(academy)/account/security/page.tsx');
    expect(page).toMatch(/sessionsLoading \? \(\s*<SessionRowsLoading \/>/);
  });

  it('profile settings draws the portfolio shape and records its size', () => {
    const page = read('app/(main)/(academy)/settings/profile/page.tsx');
    expect(page).toMatch(/portfolioLoading \? \(\s*<PortfolioLoading \/>/);
    expect(page).toContain("rememberListCount('settings-portfolio'");
    expect(read('components/skeletons/public-page-replicas.tsx')).toContain("useRememberedListCount('settings-portfolio'");
  });

  it('Titan TV shares the route skeleton series rows', () => {
    expect(read('app/(main)/titan-tv/page.tsx')).toContain('{isLoading && <TitanTvSeriesSkeleton />}');
  });

  it('the courses fallbacks follow the remembered library size', () => {
    const page = read('app/(main)/(academy)/courses/page.tsx');
    expect(page).toContain('<CourseFilterLoading />');
    expect(page).toContain('<CoursesGridLoading />');
  });
});

describe('course filter while academies load', () => {
  it('follows the remembered academy count instead of always drawing chips', () => {
    const filter = read('components/academy/category-filter.tsx');
    expect(filter).toMatch(/if \(isLoading\) \{\s*return <CourseFilterLoading \/>;/);
    expect(filter).not.toContain('<CourseFilterSkeleton />');
  });
});
