import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const MAX_BYTES = 500 * 1024 * 1024;

export interface VideoMeta {
  key: string;
  size: number;
  contentType: string;
  filename: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly publicBucket: string;

  constructor() {
    /**
     * Lesson video lives in its own bucket, separate from public assets.
     *
     * S3_BUCKET is the public bucket (avatars, covers, course images) and is
     * public-read. Putting paid course video in the same bucket made every video
     * publicly fetchable by URL. S3_MEDIA_BUCKET must stay private so playback
     * continues to go through a short-lived signed URL.
     */
    this.bucket = process.env.S3_MEDIA_BUCKET || process.env.S3_BUCKET || '';
    this.publicUrl = process.env.S3_PUBLIC_URL || '';
    // The bucket that S3_PUBLIC_URL actually serves, used to decide whether a plain
    // URL is safe for the object at hand.
    this.publicBucket = process.env.S3_BUCKET || '';
    const endpoint = process.env.S3_ENDPOINT || '';
    const accessKey = process.env.S3_ACCESS_KEY || '';
    const secretKey = process.env.S3_SECRET_KEY || '';
    const region = process.env.S3_REGION || 'us-east-1';
    const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE || 'false') === 'true';

    this.localRoot =
      process.env.STORAGE_LOCAL_DIR ||
      join(process.cwd(), '.dev-logs', 'storage');

    if (this.bucket && endpoint && accessKey && secretKey) {
      this.client = new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
        forcePathStyle,
      });
      this.logger.log('S3 storage configured for bucket ' + this.bucket);
    } else {
      this.client = null;
      this.logger.warn(
        'S3 storage NOT configured (missing S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY). Video uploads disabled.',
      );
    }
  }

  /**
   * Local filesystem root for the non-S3 driver.
   *
   * S3 is the right answer in production, but a certificate is only real if a
   * file exists. Without a fallback, a workspace with an unreachable or
   * unconfigured bucket silently issues rows with no document, which is exactly
   * the failure this whole change set exists to remove. `putObject` therefore
   * falls back to disk, and download streams through the API so the browser is
   * never handed a storage path.
   */
  private readonly localRoot: string;
  private localFallbackWarned = false;

  get isConfigured(): boolean {
    // Either driver can store an object.
    return true;
  }

  private localPathFor(key: string): string {
    const root = resolve(this.localRoot);
    const target = resolve(join(root, normalize(key)));
    // Refuse traversal: keys are built server-side, but this is the only place
    // a caller-supplied string reaches the filesystem.
    if (target !== root && !target.startsWith(root + sep)) {
      throw new BadRequestException('Invalid storage key');
    }
    return target;
  }

  private async putLocal(key: string, body: Buffer): Promise<void> {
    if (!this.localFallbackWarned) {
      this.logger.warn(
        `S3 unavailable; storing objects on local disk at ${this.localRoot}. ` +
          `Set S3_ENDPOINT / S3_BUCKET for production.`,
      );
      this.localFallbackWarned = true;
    }
    const path = this.localPathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  /**
   * Read object bytes. Callers stream this to the client rather than exposing a
   * presigned URL, so a certificate download needs no capability token in the
   * browser and can be revoked instantly.
   */
  async getObjectBytes(key: string): Promise<Buffer | null> {
    if (this.client) {
      try {
        const res = await this.client.send(
          new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        );
        if (!res.Body) return null;
        const bytes = await res.Body.transformToByteArray();
        return Buffer.from(bytes);
      } catch (error: any) {
        this.logger.warn(`S3 get failed for ${key}: ${error?.message}`);
        // fall through to disk
      }
    }
    try {
      return await readFile(this.localPathFor(key));
    } catch {
      return null;
    }
  }

  async objectExists(key: string): Promise<boolean> {
    if (this.client) {
      try {
        await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        return true;
      } catch {
        /* try disk */
      }
    }
    try {
      await readFile(this.localPathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  /** Tenant-safe object key. Never includes raw user input beyond a sanitized extension. */
  buildKey(tenantId: string, courseId: string, lessonId: string, filename: string): string {
    const ext = (filename.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    return `tenants/${tenantId}/courses/${courseId}/lessons/${lessonId}/video/${randomUUID()}.${ext}`;
  }

  validateVideo(contentType: string, size: number): void {
    if (!contentType?.startsWith('video/')) {
      throw new BadRequestException(`Unsupported video type: ${contentType}. Allowed: video/*`);
    }
    if (!size || size > MAX_BYTES) {
      throw new BadRequestException(`Video too large. Max ${Math.round(MAX_BYTES / 1024 / 1024)}MB.`);
    }
  }

  private ensure(): S3Client {
    if (!this.client) {
      throw new BadRequestException('Storage is not configured on the server');
    }
    return this.client;
  }

  /** Presigned PUT URL for direct browser upload (large files). */
  async createPresignedPutUrl(key: string, contentType: string, size: number): Promise<string> {
    const client = this.ensure();
    this.validateVideo(contentType, size);
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    return getSignedUrl(client, cmd, { expiresIn: 900 });
  }

  /** Server-mediated upload (fallback when presigned PUT is unavailable). */
  /**
   * Store an object, preferring S3 and falling back to local disk.
   *
   * `ensure()` throws when no S3 client exists, and an S3 request can fail at
   * connect time. Both used to surface as "upload failed" with no file written;
   * now either driver can hold the object so a feature that writes documents is
   * never silently a no-op.
   */
  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.client) {
      try {
        const cmd = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        });
        await this.client.send(cmd);
        return;
      } catch (error: any) {
        this.logger.warn(
          `S3 put failed for ${key} (${error?.message}); falling back to local disk.`,
        );
      }
    }
    await this.putLocal(key, body);
  }

  /**
   * Resolve a stored key to a playable URL.
   *
   * The public base URL is only usable when this service's bucket IS the public asset
   * bucket. Lesson video lives in a separate private bucket, so returning the public
   * base URL there would hand out an unauthenticated link to paid content. When the
   * buckets differ we always sign.
   */
  async resolvePlaybackUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.client) {
      // No bucket: the object lives on local disk and is only reachable through
      // the API, which is what the certificate download routes do.
      this.logger.warn(`resolvePlaybackUrl has no S3 client for ${key}; use getObjectBytes`);
      return '';
    }
    if (this.publicUrl && this.bucket === this.publicBucket) {
      return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    }
    const client = this.ensure();
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(client, cmd, { expiresIn });
  }

  /** True when the value is an internal storage key (vs a legacy absolute URL). Narrows to string. */
  static isKey(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.startsWith('tenants/');
  }

  async deleteObject(key: string): Promise<void> {
    if (this.client) {
      try {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
        return;
      } catch (err) {
        this.logger.warn(`Failed to delete object ${key}`, err);
      }
    }
    try {
      await unlink(this.localPathFor(key));
    } catch {
      /* already gone */
    }
  }
}
