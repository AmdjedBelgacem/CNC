import { describe, expect, it } from 'vitest';
import { redactConnectionString, redactSecrets, safeErrorText } from '../src/common/security/redact';

describe('redactConnectionString', () => {
  it('masks the password but keeps host and database', () => {
    expect(redactConnectionString('postgresql://user:hunter2@db.host:5432/mydb')).toBe(
      'postgresql://user:***@db.host:5432/mydb',
    );
  });

  it('handles a URL-encoded password', () => {
    expect(redactConnectionString('postgresql://postgres.p:Baroot%40cnc2026%21@aws-0-eu-west-1.pooler.supabase.com:5432/postgres')).toBe(
      'postgresql://postgres.p:***@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
    );
  });

  it('leaves a credential-free URL untouched', () => {
    expect(redactConnectionString('https://api.supabase.co/health')).toBe('https://api.supabase.co/health');
  });
});

describe('redactSecrets', () => {
  it('removes Supabase secret and publishable keys', () => {
    const out = redactSecrets('key=sb_secret_abcdefghijklmnop and sb_publishable_zyxwvu123456');
    expect(out).not.toContain('sb_secret_abcdefghijklmnop');
    expect(out).not.toContain('sb_publishable_zyxwvu123456');
  });

  it('removes Resend keys', () => {
    expect(redactSecrets('RESEND_API_KEY=re_D7U7diFS_P5JrzoAvAk6J')).not.toContain('re_D7U7diFS_P5JrzoAvAk6J');
  });

  it('removes AWS access key ids', () => {
    expect(redactSecrets('AKIAIOSFODNN7EXAMPLE')).toBe('AKIA[redacted]');
  });

  it('removes JWTs', () => {
    const jwt = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123signature';
    const out = redactSecrets(`token is ${jwt}`);
    expect(out).not.toContain('eyJhbGciOiJFUzI1NiJ9');
    expect(out).toContain('[jwt-redacted]');
  });

  it('masks password/token/api-key fields in JSON-ish payloads', () => {
    const out = redactSecrets(JSON.stringify({ password: 'hunter2', apiKey: 'abc', role: 'admin' }));
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('abc');
    expect(out).toContain('admin');
  });

  it('masks a database URL embedded in an error message', () => {
    const out = redactSecrets('connect failed: postgresql://u:topsecret@localhost:5432/cncm unreachable');
    expect(out).not.toContain('topsecret');
    expect(out).toContain('localhost:5432/cncm');
  });

  it('is safe on non-string input', () => {
    expect(redactSecrets(42)).toBe('42');
    expect(() => redactSecrets(undefined)).not.toThrow();
  });
});

describe('safeErrorText', () => {
  it('keeps the error name and message but strips credentials', () => {
    const err = new Error('auth failed for postgresql://u:pw@host:5432/db');
    const out = safeErrorText(err);
    expect(out).toContain('Error:');
    expect(out).not.toContain(':pw@');
  });

  it('handles a circular object without throwing', () => {
    const a: Record<string, unknown> = { name: 'loop' };
    a.self = a;
    expect(() => safeErrorText(a)).not.toThrow();
  });
});
