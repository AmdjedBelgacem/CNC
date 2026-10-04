import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The privacy page once sent privacyVisibility/privacyMessages/privacyFollows while
 * the columns are profileVisibility/whoCanMessage/whoCanFollow. Because the route
 * takes `@Body() body: any`, the global ValidationPipe is skipped entirely and
 * UserPreferencesService.update spreads the payload straight into `.set()`. Drizzle
 * drops unknown keys silently, so the save returned 200 and changed nothing.
 *
 * This test pins the two sides together so the drift cannot come back quietly.
 */
const SETTINGS_DIR = join(process.cwd(), 'src/app/(main)/(academy)/settings');
const PRIVACY_PAGE = join(SETTINGS_DIR, 'preferences/privacy/page.tsx');

const USER_PREFERENCE_COLUMNS = [
  'theme',
  'density',
  'profileVisibility',
  'whoCanMessage',
  'whoCanFollow',
  'emailNotifications',
  'inAppNotifications',
  'themeTokens',
] as const;

describe('user preferences field-name contract', () => {
  it('privacy page sends only real user_preferences columns', () => {
    const source = readFileSync(PRIVACY_PAGE, 'utf8');
    const put = source.slice(source.indexOf('handleSave'));
    const body = put.slice(put.indexOf('JSON.stringify({'), put.indexOf('})'));
    const keys = [...body.matchAll(/(\w+):\s*(visibility|messages|follows)/g)].map((m) => m[1]!);

    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(USER_PREFERENCE_COLUMNS).toContain(key);
    }
  });

  it('privacy page hydrates from the real column names', () => {
    const source = readFileSync(PRIVACY_PAGE, 'utf8');
    expect(source).toContain('data?.profileVisibility');
    expect(source).toContain('data?.whoCanMessage');
    expect(source).toContain('data?.whoCanFollow');
    expect(source).not.toMatch(/data\?\.privacy(Visibility|Messages|Follows)/);
  });

  it('never reintroduces the phantom privacy* names', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          if (/privacyVisibility|privacyMessages|privacyFollows/.test(readFileSync(full, 'utf8'))) {
            offenders.push(full);
          }
        }
      }
    };
    walk(SETTINGS_DIR);
    expect(offenders).toEqual([]);
  });

  it('reports a failed save instead of always showing success', () => {
    const source = readFileSync(PRIVACY_PAGE, 'utf8');
    // Guards on res.ok, then re-reads the echoed row to confirm the values applied.
    expect(source).toContain('res.ok');
    expect(source).toContain('setError');
    expect(source).toContain('were not applied');
  });
});

describe('appearance page honours res.ok', () => {
  const appearance = join(SETTINGS_DIR, 'preferences/appearance/page.tsx');

  it('checks the response and surfaces failures', () => {
    const source = readFileSync(appearance, 'utf8');
    expect(source).toContain('res.ok');
    expect(source).toContain('setError');
    expect(source).toContain('were not applied');
  });

  it('no longer swallows every error with an empty catch', () => {
    const save = readFileSync(appearance, 'utf8');
    const body = save.slice(save.indexOf('const handleSave'));
    expect(body).not.toMatch(/\}\s*catch\s*\{\s*\}/);
  });
});

describe('portfolio form can clear fields', () => {
  const profile = join(SETTINGS_DIR, 'profile/page.tsx');

  it('always sends description, projectUrl and tags', () => {
    const source = readFileSync(profile, 'utf8');
    const body = source.slice(source.indexOf('const handlePortfolioSubmit'));
    for (const field of ['description:', 'projectUrl:', 'tags:']) {
      expect(body.slice(0, body.indexOf('JSON.stringify'))).toContain(field);
    }
  });

  it('does not gate those keys behind a truthiness check', () => {
    const source = readFileSync(profile, 'utf8');
    const body = source.slice(source.indexOf('const handlePortfolioSubmit'));
    expect(body).not.toMatch(/if \(pfForm\.description\)/);
    expect(body).not.toMatch(/if \(pfForm\.projectUrl\)/);
  });
});

describe('connected accounts uses a reachable endpoint', () => {
  const page = join(SETTINGS_DIR, 'connected-accounts/page.tsx');

  it('does not navigate to the non-existent /api/auth route', () => {
    const source = readFileSync(page, 'utf8');
    expect(source).not.toMatch(/window\.location\.href = `\/api\/auth\//);
  });

  it('mints state before connecting', () => {
    const source = readFileSync(page, 'utf8');
    expect(source).toContain('/api/proxy/auth/oauth/state');
  });
});

describe('email change forwards the verified password', () => {
  const page = join(SETTINGS_DIR, 'account/security/page.tsx');

  it('no longer hardcodes an empty password', () => {
    const source = readFileSync(page, 'utf8');
    expect(source).not.toMatch(/changeEmail\(emailForm\.newEmail,\s*''\)/);
  });

  it('passes the password the reauth modal verified', () => {
    const source = readFileSync(page, 'utf8');
    expect(source).toMatch(/executeEmailChange\(verifiedPassword\)/);
    expect(source).toMatch(/onVerified=\{\(verifiedPassword\)/);
  });
});

describe('danger zone enforces deletion server-side', () => {
  const danger = join(SETTINGS_DIR, 'account/danger/page.tsx');

  it('sends the typed confirmation to the server, not just to a client-side check', () => {
    const source = readFileSync(danger, 'utf8');
    const call = source.slice(source.indexOf('delete-account'));
    expect(call).toMatch(/confirmation:\s*'DELETE'/);
  });

  it('sends a password so the server can re-authenticate', () => {
    const source = readFileSync(danger, 'utf8');
    const call = source.slice(source.indexOf('delete-account'));
    expect(call).toMatch(/password:\s*deletePassword/);
  });

  it('no longer posts a bodyless delete request', () => {
    const source = readFileSync(danger, 'utf8');
    expect(source).not.toMatch(/delete-account',\s*\{\s*method:\s*'POST'\s*\}\s*\)/);
  });

  it('asks for the password it claims is required', () => {
    const source = readFileSync(danger, 'utf8');
    expect(source).toContain('setDeletePassword');
    expect(source).toMatch(/type="password"/);
  });
});