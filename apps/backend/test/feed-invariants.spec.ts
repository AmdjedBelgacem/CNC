import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Feed invariants.
 *
 * The three that bite hardest, and that no amount of clicking would reliably
 * catch:
 *
 *  1. TENANT SCOPE. `toggleLike`, `addComment` and `getComments` used to look
 *     posts up by id alone, so any authenticated member could read, vote on or
 *     comment on another tenant's post by guessing a UUID. Every read and write
 *     now goes through a tenant-filtered lookup.
 *
 *  2. VOTE ARITHMETIC. One row per (post, user) with a direction, and counters
 *     derived from the rows rather than blind ±1, so a crash cannot leave a score
 *     that disagrees with the votes. Self-voting is refused outright: it is never
 *     information and it is how scores get gamed.
 *
 *  3. THREAD INTEGRITY. A reply must belong to the same post as its parent, depth
 *     is capped, and deletion is soft so a subtree is never orphaned.
 *
 * Plus the author-identity bug: the API sent `user` while the UI read `author`,
 * so every post rendered as "Unknown" with a profile link containing no id.
 */
describe('feed tenant isolation', () => {
  const service = readFileSync(resolve(__dirname, '../src/modules/feed/feed.service.ts'), 'utf8');

  it('scopes the post lookup to the tenant', () => {
    expect(service).toMatch(
      /private async findPost\(tenantId: string, postId: string\)[\s\S]{0,320}eq\(posts\.id, postId\), eq\(posts\.tenantId, tenantId\)/,
    );
  });

  it('never looks a post up by id alone', () => {
    // A bare `eq(posts.id, postId)` with no tenant companion is the old bug.
    const bare = service.match(/where:\s*eq\(posts\.id, postId\)/g);
    expect(bare).toBeNull();
  });

  it('routes every vote and comment through the scoped lookup', () => {
    expect(service).toMatch(/const post = await this\.findPost\(tenantId, postId\)/);
    expect(service).toMatch(/await this\.findPost\(tenantId, postId\);\n\s*const sort/);
  });

  it('checks the comment post belongs to the tenant', () => {
    expect(service).toMatch(/comment\.post\?\.tenantId && String\(comment\.post\.tenantId\) !== String\(tenantId\)/);
  });

  it('scopes the tag index to the tenant', () => {
    expect(service).toMatch(/from\(tags\)\s*\n\s*\.where\(eq\(tags\.tenantId, tenantId\)\)/);
  });
});

describe('post votes', () => {
  const service = readFileSync(resolve(__dirname, '../src/modules/feed/feed.service.ts'), 'utf8');
  const schema = readFileSync(resolve(__dirname, '../src/database/schema/posts.ts'), 'utf8');
  const migration = readFileSync(
    resolve(__dirname, '../src/database/migrations/019_feed_votes_comments_tags.sql'),
    'utf8',
  );

  it('holds one vote per member per post, in one direction', () => {
    expect(schema).toMatch(/pk: primaryKey\(\{ columns: \[table\.postId, table\.userId\] \}\)/);
    expect(schema).toMatch(/valueCheck: check\('post_likes_value_check', sql`\$\{table\.value\} IN \(-1, 1\)`\)/);
    expect(migration).toMatch(/CHECK \("value" IN \(-1, 1\)\)/);
  });

  it('refuses a self-vote on a post and on a comment', () => {
    expect(service).toMatch(/You cannot vote on your own post/);
    expect(service).toMatch(/You cannot vote on your own comment/);
  });

  it('derives counters from the vote rows, not from a blind increment', () => {
    expect(service).toMatch(/private async refreshPostCounters/);
    expect(service).toMatch(/set like_count = agg\.up,\s*\n?\s*downvote_count = agg\.down,\s*\n?\s*score = agg\.up - agg\.down/);
    // The write and the recount must share a transaction.
    expect(service).toMatch(/transaction\(async \(tx\) => \{[\s\S]{0,600}refreshPostCounters/);
  });

  it('switches and withdraws rather than accumulating rows', () => {
    expect(service).toMatch(/target: \[postVotes\.postId, postVotes\.userId\]/);
    expect(service).toMatch(/if \(value === 0\) \{[\s\S]{0,200}delete\(postVotes\)/);
  });

  it('validates the vote value', () => {
    expect(service).toMatch(/if \(!\[1, -1, 0\]\.includes\(value\)\) throw new BadRequestException/);
  });

  it('notifies on a new upvote only', () => {
    // A downvote must not notify; a re-upvote must not notify twice.
    expect(service).toMatch(/if \(value === 1 && \(!previous \|\| previous\.value !== 1\)\)/);
  });
});

describe('comment threads', () => {
  const service = readFileSync(resolve(__dirname, '../src/modules/feed/feed.service.ts'), 'utf8');
  const schema = readFileSync(resolve(__dirname, '../src/database/schema/posts.ts'), 'utf8');

  it('requires a reply parent to be on the same post', () => {
    expect(service).toMatch(
      /const parent = await this\.drizzle\.db\.query\.comments\.findFirst\(\{\s*\n\s*where: and\(eq\(comments\.id, parentId\), eq\(comments\.postId, postId\)\)/,
    );
    expect(service).toMatch(/Parent comment not found on this post/);
  });

  it('caps reply depth', () => {
    expect(service).toMatch(/export const MAX_COMMENT_DEPTH = 6/);
    expect(service).toMatch(/depth = Math\.min\(parent\.depth \+ 1, MAX_COMMENT_DEPTH\)/);
    expect(schema).toMatch(/depthCheck: check\('comments_depth_check', sql`\$\{table\.depth\} >= 0 AND \$\{table\.depth\} <= 8`\)/);
  });

  it('soft deletes so replies keep their place', () => {
    expect(service).toMatch(/isRemoved: true, content: '', score: 0/);
    // A removed comment gives away neither body nor author.
    expect(service).toMatch(/content: removed \? '' : comment\.content/);
    expect(service).toMatch(/author: removed\s*\n\s*\? null/);
  });

  it('keeps a reply whose parent fell outside the page limit', () => {
    // Truncating a parent must not silently drop its child.
    expect(service).toMatch(/if \(parent && parent\.id !== node\.id\) parent\.replies\.push\(node\);\s*\n\s*else roots\.push\(node\)/);
  });

  it('orders siblings by the requested sort', () => {
    expect(service).toMatch(/sort === 'old' \? \[asc\(comments\.createdAt\)\]/);
    expect(service).toMatch(/\[desc\(comments\.score\), asc\(comments\.createdAt\)\]/);
  });
});

describe('tags', () => {
  const service = readFileSync(resolve(__dirname, '../src/modules/feed/feed.service.ts'), 'utf8');
  const migration = readFileSync(
    resolve(__dirname, '../src/database/migrations/019_feed_votes_comments_tags.sql'),
    'utf8',
  );

  it('normalises a tag to one canonical form', () => {
    expect(service).toMatch(/private normalizeTag\(value: string\): string/);
    expect(service).toMatch(/lower\(btrim|\.toLowerCase\(\)/);
    expect(service).toMatch(/replace\(\/\\s\+\/g, '-'\)/);
  });

  it('deduplicates and bounds the tags on a post', () => {
    expect(service).toMatch(/if \(slug && !out\.includes\(slug\)\) out\.push\(slug\)/);
    expect(service).toMatch(/if \(out\.length >= MAX_TAGS_PER_POST\) break/);
  });

  it('creates missing tags and links them idempotently', () => {
    expect(service).toMatch(/onConflictDoNothing\(\{ target: \[tags\.tenantId, tags\.slug\] \}\)/);
    expect(service).toMatch(/insert\(postTags\)[\s\S]{0,80}onConflictDoNothing\(\)/);
  });

  it('keeps usage counts honest after attach and delete', () => {
    expect(service).toMatch(/private async refreshTagCounts/);
    expect(service).toMatch(/await this\.refreshTagCounts\(tenantId\)/);
  });

  it('backfills the existing free-text tags', () => {
    expect(migration).toMatch(/INSERT INTO "tags" \("tenant_id", "slug", "label"\)/);
    expect(migration).toMatch(/INSERT INTO "post_tags" \("post_id", "tag_id"\)/);
  });

  it('returns nothing for an unknown tag rather than the whole feed', () => {
    // Silently ignoring the filter would show posts that lack the tag.
    expect(service).toMatch(/if \(tagSlug && tagIds\.length === 0\) \{[\s\S]{0,200}data: \[\], total: 0/);
  });
});

describe('author identity', () => {
  const service = readFileSync(resolve(__dirname, '../src/modules/feed/feed.service.ts'), 'utf8');
  const card = readFileSync(
    resolve(__dirname, '../../frontend/src/components/feed/post-card.tsx'),
    'utf8',
  );

  it('sends the field the card actually reads', () => {
    expect(service).toMatch(/author: post\.user/);
    // The old payload nested the person under `user`, which the card ignored.
    expect(card).toMatch(/const author: FeedAuthor \| null = post\.author \?\? null/);
  });

  it('includes username so the profile link is real', () => {
    expect(service).toMatch(/username: true/);
    expect(card).toMatch(/author\?\.username \? `\/u\/\$\{author\.username\}`/);
  });

  it('shows the role, headline and handle', () => {
    expect(card).toMatch(/ROLE_BADGE/);
    expect(card).toMatch(/authorHandle/);
    expect(card).toMatch(/author\?\.headline/);
  });
});

describe('wire snapshot tag coercion', () => {
  const wire = readFileSync(resolve(__dirname, '../../frontend/src/lib/feed.ts'), 'utf8');

  it('never stringifies a tag object', () => {
    // `String(raw)` on a `{ slug, label }` tag publishes the literal
    // "[object Object]" as a topic, which is what the topic index showed.
    expect(wire).not.toMatch(/String\(raw\)\.trim\(\)\.toLowerCase\(\)/);
    expect(wire).toMatch(/typeof raw === 'string'/);
    expect(wire).toMatch(/String\(raw\?\.slug \?\? raw\?\.label \?\? ''\)/);
  });

  it('reads upvotes, not the removed likeCount, for the shell stat', () => {
    expect(wire).toMatch(/likeCount \+= p\.upvotes \?\? p\.likeCount \?\? 0/);
  });

  it('reads the author from `author`, with `user` as the legacy fallback', () => {
    expect(wire).toMatch(/const authorId = p\.author\?\.id \?\? p\.user\?\.id/);
  });

  it('links the topic index at the tag pages', () => {
    const islands = readFileSync(
      resolve(__dirname, '../../frontend/src/components/feed/feed-islands.tsx'),
      'utf8',
    );
    expect(islands).toMatch(/href=\{`\/tags\/\$\{encodeURIComponent\(topic\.tag\)\}`\}/);
  });
});
