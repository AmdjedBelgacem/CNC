import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');

/** Regression guards for defects a page-by-page audit found by using the product. */
describe('feed', () => {
  it('clears comments and votes before deleting a post, because their FKs are NO ACTION', () => {
    const service = read('modules/feed/feed.service.ts');
    const body = service.slice(service.indexOf('async deletePost'), service.indexOf('private async attachTags'));
    expect(body).toMatch(/transaction/);
    expect(body.indexOf('delete(comments)')).toBeGreaterThan(-1);
    expect(body.indexOf('delete(postVotes)')).toBeGreaterThan(-1);
    // Dependents first, the post last.
    expect(body.indexOf('delete(posts)')).toBeGreaterThan(body.indexOf('delete(comments)'));
    expect(body.indexOf('delete(posts)')).toBeGreaterThan(body.indexOf('delete(postVotes)'));
  });
});

describe('search', () => {
  it('asks Meilisearch for the type facet, or every tab count stays 0', () => {
    expect(read('modules/search/search.service.ts')).toMatch(/facets: \['type'\]/);
  });
});

describe('events', () => {
  it('identifies the signed-in user on the public detail route', () => {
    const controller = read('modules/events/events.controller.ts');
    const route = controller.slice(controller.indexOf("@Get(':slug')") - 400, controller.indexOf("@Get(':slug')"));
    expect(route).toMatch(/@UseGuards\(OptionalAuthGuard\)/);
  });
});

describe('profile follow', () => {
  it('returns the target id the follow button needs', () => {
    const controller = read('modules/auth/profile.controller.ts');
    expect(controller).toMatch(/targetUserId: target\.id/);
  });
});

describe('public routes that read the current user', () => {
  it('every one is behind a guard that actually sets it', () => {
    // A @Public() handler only skips auth. Without OptionalAuthGuard `@CurrentUser()` is
    // always undefined, which is how the event page lost its registration state.
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const name of readdirSync(dir)) {
        const full = resolve(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (name.endsWith('.controller.ts')) out.push(full);
      }
      return out;
    };
    const offenders: string[] = [];
    for (const file of walk(resolve(__dirname, '../src/modules'))) {
      const lines = readFileSync(file, 'utf8').split('\n');
      const classGuarded = lines.slice(0, 60).some((l) => /@UseGuards\(.*(OptionalAuthGuard|JwtAuthGuard)/.test(l));
      lines.forEach((line, i) => {
        if (!/^\s{2}@(Get|Post|Put|Patch|Delete)\(/.test(line)) return;
        let start = i;
        while (start > 0 && /^\s{2}@/.test(lines[start - 1])) start -= 1;
        let end = i;
        while (end + 1 < lines.length && /^\s{2}@/.test(lines[end + 1])) end += 1;
        const decorators = lines.slice(start, end + 1).join('\n');
        const signature = lines.slice(end + 1, end + 15).join(' ');
        if (
          /@Public\(\)/.test(decorators) &&
          /@CurrentUser\(/.test(signature.split('{')[0] ?? '') &&
          !/OptionalAuthGuard|JwtAuthGuard/.test(decorators) &&
          !classGuarded
        ) {
          offenders.push(`${file.split('/modules/')[1]}:${end + 2}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
