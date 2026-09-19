import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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

  constructor() {
    this.bucket = process.env.S3_BUCKET || '';
    this.publicUrl = process.env.S3_PUBLIC_URL || '';
    const endpoint = process.env.S3_ENDPOINT || '';
    const accessKey = process.env.S3_ACCESS_KEY || '';
    const secretKey = process.env.S3_SECRET_KEY || '';
    const region = process.env.S3_REGION || 'us-east-1';
    const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE || 'false') === 'true';

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

  get isConfigured(): boolean {
    return this.client !== null;
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
  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    const client = this.ensure();
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType });
    await client.send(cmd);
  }

  /** Resolve a stored key to a playable URL: public base URL if configured, else a signed GET URL. */
  async resolvePlaybackUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.isConfigured) return key;
    if (this.publicUrl) return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    const client = this.ensure();
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(client, cmd, { expiresIn });
  }

  /** True when the value is an internal storage key (vs a legacy absolute URL). Narrows to string. */
  static isKey(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.startsWith('tenants/');
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.isConfigured) return;
    try {
      await this.client!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`Failed to delete object ${key}`, err);
    }
  }
}
