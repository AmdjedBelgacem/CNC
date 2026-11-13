import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AcademiesService, imageBytesMatchMime } from '../src/modules/academies/academies.service';
import { uploadResponseHeaders } from '../src/main';
import { UploadService } from '../src/modules/upload/upload.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { HealthController, healthDetailAllowed } from '../src/modules/health/health.controller';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const GIF = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(16)]);
const WEBP = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), Buffer.from('WEBPVP8 ', 'latin1'), Buffer.alloc(8)]);
const AVIF = Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from('ftypavif', 'latin1'), Buffer.alloc(16)]);
const HTML = Buffer.from('<html><script>alert(document.cookie)</script></html>');
const dataUrl = (mime: string, buf: Buffer) => `data:${mime};base64,${buf.toString('base64')}`;

describe('academy image upload: no client-controlled extension, no SVG, magic bytes checked', () => {
  it('recognises each allowed format by its magic bytes', () => {
    expect(imageBytesMatchMime(PNG, 'image/png')).toBe(true);
    expect(imageBytesMatchMime(JPEG, 'image/jpeg')).toBe(true);
    expect(imageBytesMatchMime(GIF, 'image/gif')).toBe(true);
    expect(imageBytesMatchMime(WEBP, 'image/webp')).toBe(true);
    expect(imageBytesMatchMime(AVIF, 'image/avif')).toBe(true);
  });

  it('rejects bytes that do not match the declared type', () => {
    expect(imageBytesMatchMime(HTML, 'image/png')).toBe(false);
    expect(imageBytesMatchMime(JPEG, 'image/png')).toBe(false);
    expect(imageBytesMatchMime(PNG, 'image/svg+xml')).toBe(false);
  });

  let dir: string;
  const env = { ...process.env };
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'academy-upload-'));
    process.env.UPLOAD_DIR = dir;
    process.env.UPLOAD_BASE_URL = 'http://api.test/uploads';
    delete process.env.S3_BUCKET;
    delete process.env.S3_ENDPOINT;
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    process.env = env;
  });

  const service = () => {
    const chain: any = {
      set: () => chain,
      where: () => chain,
      returning: async () => [{ id: 'a1' }],
    };
    const svc = new AcademiesService({ db: { update: () => chain } } as any);
    vi.spyOn(svc, 'getBySlug').mockResolvedValue({ id: 'a1', heroImageUrl: null } as any);
    vi.spyOn(svc as any, 'courseCount').mockResolvedValue(0);
    return svc;
  };

  it('refuses SVG outright', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await expect(service().uploadImage('t1', 'acad', 'hero', dataUrl('image/svg+xml', svg), 'x.svg')).rejects.toThrow(
      /Unsupported image type/,
    );
  });

  it('refuses HTML labelled as a PNG', async () => {
    await expect(service().uploadImage('t1', 'acad', 'hero', dataUrl('image/png', HTML), 'x.png')).rejects.toThrow(
      /does not match/,
    );
  });

  it('derives the extension from the MIME type, ignoring the client filename', async () => {
    const res = await service().uploadImage('t1', 'acad', 'hero', dataUrl('image/png', PNG), 'evil.html');
    expect(res.url).toMatch(/^http:\/\/api\.test\/uploads\/academies\/a1\/hero\/[0-9a-f-]+\.png$/);
    expect(readdirSync(join(dir, 'academies', 'a1', 'hero'))).toEqual([expect.stringMatching(/\.png$/)]);
  });
});

describe('/uploads static responses cannot execute as a page', () => {
  it('always sends nosniff and a script-free sandboxed CSP', () => {
    const h = uploadResponseHeaders('/data/uploads/a/b.png');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Content-Security-Policy']).toBe("default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
    expect(h['Content-Disposition']).toBeUndefined();
  });

  it('forces anything that is not an image, video or PDF to download', () => {
    for (const f of ['x.html', 'x.svg', 'x.js', 'x.xml', 'noext']) {
      expect(uploadResponseHeaders(`/u/${f}`)['Content-Disposition']).toBe('attachment');
    }
    for (const f of ['x.jpg', 'x.webp', 'x.mp4', 'x.webm', 'x.pdf']) {
      expect(uploadResponseHeaders(`/u/${f}`)['Content-Disposition']).toBeUndefined();
    }
  });

  it('keeps PDFs viewable (no sandbox, which blocks the browser PDF viewer) but script-free', () => {
    const csp = uploadResponseHeaders('/u/doc.pdf')['Content-Security-Policy'];
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain('sandbox');
  });

  it('main.ts wires the headers into @fastify/static and trusts exactly one proxy hop', () => {
    const main = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
    expect(main).toMatch(/setHeaders: \(reply, filePath\) =>/);
    expect(main).toMatch(/trustProxy: 1,/);
    expect(main).not.toMatch(/trustProxy: true/);
  });
});

const signedHeaders = (url: string) => (new URL(url).searchParams.get('X-Amz-SignedHeaders') || '').split(';');

describe('presigned PUT URLs bind the content type (and size when known)', () => {
  const config = {
    get: (k: string) =>
      ({
        S3_REGION: 'us-east-1',
        S3_ENDPOINT: 'http://storage.test',
        S3_ACCESS_KEY: 'AKIATEST',
        S3_SECRET_KEY: 'secret',
        S3_BUCKET: 'bucket',
        S3_PUBLIC_URL: 'http://cdn.test',
      })[k],
  };

  it('signs content-type on the tenant upload URL', async () => {
    const svc = new UploadService(config as any);
    const res = await svc.getPresignedUploadUrlForTenant('t1', 'u1', 'a.png', 'image/png', 'covers');
    expect(signedHeaders(res.url)).toContain('content-type');
    expect(signedHeaders(res.url)).not.toContain('content-length');
  });

  it('signs content-length when the client declares a size, and enforces the ceiling', async () => {
    const svc = new UploadService(config as any);
    const res = await svc.getPresignedUploadUrlForTenant('t1', 'u1', 'a.png', 'image/png', 'covers', undefined, 1234);
    expect(signedHeaders(res.url)).toEqual(expect.arrayContaining(['content-type', 'content-length']));
    await expect(
      svc.getPresignedUploadUrlForTenant('t1', 'u1', 'a.png', 'image/png', 'covers', 1000, 1001),
    ).rejects.toThrow(/too large/i);
  });

  it('signs content-type and content-length on the lesson video URL', async () => {
    const env = { ...process.env };
    Object.assign(process.env, {
      S3_MEDIA_BUCKET: 'media',
      S3_ENDPOINT: 'http://storage.test',
      S3_ACCESS_KEY: 'AKIATEST',
      S3_SECRET_KEY: 'secret',
      S3_REGION: 'us-east-1',
    });
    try {
      const storage = new StorageService();
      const url = await storage.createPresignedPutUrl('tenants/t/v.mp4', 'video/mp4', 4096);
      expect(signedHeaders(url)).toEqual(expect.arrayContaining(['content-type', 'content-length']));
    } finally {
      process.env = env;
    }
  });
});

describe('health endpoints disclose detail only to an operator token', () => {
  const TOKEN = 'a-long-operator-token-123';

  it('compares the token in constant time and fails closed when unset or short', () => {
    expect(healthDetailAllowed(TOKEN, TOKEN)).toBe(true);
    expect(healthDetailAllowed('wrong', TOKEN)).toBe(false);
    expect(healthDetailAllowed(undefined, TOKEN)).toBe(false);
    expect(healthDetailAllowed(TOKEN, undefined)).toBe(false);
    expect(healthDetailAllowed('short', 'short')).toBe(false);
  });

  const controller = (state: 'up' | 'down') => {
    const c = new HealthController({} as any, {} as any);
    vi.spyOn(c as any, 'collect').mockResolvedValue({
      status: state,
      checks: { database: { state }, auth: { state: 'up' }, redis: { state: 'degraded', detail: 'ECONNREFUSED 10.0.0.5' } },
    });
    return c;
  };

  it('public callers get { status } only, with 503 when not ready', async () => {
    const env = { ...process.env };
    process.env.HEALTH_DETAIL_TOKEN = TOKEN;
    try {
      const reply = { status: vi.fn() };
      expect(await controller('down').ready(undefined, reply)).toEqual({ status: 'down' });
      expect(reply.status).toHaveBeenCalledWith(503);
      expect(await controller('up').health(undefined)).toEqual({ status: 'up' });
      expect(await controller('up').health('nope')).toEqual({ status: 'up' });
    } finally {
      process.env = env;
    }
  });

  it('the operator token unlocks the full report', async () => {
    const env = { ...process.env };
    process.env.HEALTH_DETAIL_TOKEN = TOKEN;
    try {
      const reply = { status: vi.fn() };
      const res: any = await controller('up').ready(TOKEN, reply);
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(res.ready).toBe(true);
      expect(res.checks.redis.detail).toContain('ECONNREFUSED');
    } finally {
      process.env = env;
    }
  });
});

describe('infrastructure config', () => {
  const root = resolve(__dirname, '../../..');
  const read = (p: string) => readFileSync(join(root, p), 'utf8');

  it('dev compose binds every published port to loopback', () => {
    const ports = [...read('docker-compose.yml').matchAll(/^\s+- '([^']+:\d+)'$/gm)].map((m) => m[1]);
    expect(ports.length).toBeGreaterThan(0);
    for (const p of ports) expect(p).toMatch(/^127\.0\.0\.1:/);
  });

  it('deploy scripts pin host keys on first use instead of ignoring them', () => {
    for (const f of ['scripts/lightsail/push-backend.sh', 'scripts/lightsail/push-frontend.sh']) {
      const s = read(f);
      expect(s).not.toContain('StrictHostKeyChecking=no');
      expect(s).toContain('StrictHostKeyChecking=accept-new');
    }
  });

  it('Caddy denies framing except the builder preview, and caps request bodies', () => {
    const caddy = read('deploy/lightsail/Caddyfile');
    expect(caddy.match(/X-Frame-Options SAMEORIGIN/g)).toHaveLength(1);
    expect(caddy).toMatch(/@frameable path \/preview\/\*/);
    expect(caddy).toMatch(/header @frameable \{\s*X-Frame-Options SAMEORIGIN\s*defer\s*\}/);
    expect(caddy).toMatch(/header @not_frameable \{\s*X-Frame-Options DENY\s*defer\s*\}/);
    expect(caddy).toMatch(/request_body \{\s*max_size 70MB\s*\}/);
    expect(caddy).toMatch(/@auth_body path \/api\/proxy\/auth\/\*\s*request_body @auth_body \{\s*max_size 1MB\s*\}/);
    // Braces must balance or Caddy refuses to load the file.
    const stripped = caddy.replace(/#.*$/gm, '').replace(/\{\$[A-Z_]+\}|\{[a-z_.]+\}/g, '');
    expect((stripped.match(/\{/g) || []).length).toBe((stripped.match(/\}/g) || []).length);
  });
});
