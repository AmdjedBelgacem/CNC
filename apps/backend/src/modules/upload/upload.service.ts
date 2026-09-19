import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '../../config/config.service';
import { randomUUID } from 'node:crypto';
import { ALLOWED_UPLOAD_CONTENT_TYPES, MAX_UPLOAD_BYTES } from './upload.constants';

@Injectable()
export class UploadService {
  private s3: S3Client;

  constructor(@Inject(ConfigService) private config: ConfigService) {
    this.s3 = new S3Client({
      region: config.get('S3_REGION'),
      endpoint: config.get('S3_ENDPOINT'),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY'),
        secretAccessKey: config.get('S3_SECRET_KEY'),
      },
      forcePathStyle: true,
    });
  }

  async getPresignedUploadUrl(key: string, contentType: string) {
    // Legacy – kept for internal callers that already scope keys (now delegates to tenant-scoped)
    const sanitized = key.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80) || randomUUID();
    const command = new PutObjectCommand({
      Bucket: this.config.get('S3_BUCKET'),
      Key: `uploads/${sanitized}`,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3, command, { expiresIn: 900 });
  }

  async getPresignedUploadUrlForTenant(
    tenantId: string,
    userId: string,
    key: string,
    contentType: string,
    folder?: string,
    maxBytes?: number,
  ) {
    if (!tenantId) throw new BadRequestException('Tenant context required');
    const safeFolder = (folder || 'uploads').replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'uploads';
    const allowedFolders = new Set(['uploads', 'courses', 'avatars', 'covers', 'attachments']);
    const finalFolder = allowedFolders.has(safeFolder) ? safeFolder : 'uploads';
    const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80);
    if (!safeKey) throw new BadRequestException('Invalid key');
    if (!contentType || !/^[a-z]+\/[a-z0-9.+\-]+$/i.test(contentType)) throw new BadRequestException('Invalid contentType');
    // Defence in depth: the controller also enforces this, but never trust a single layer.
    if (!ALLOWED_UPLOAD_CONTENT_TYPES.has(contentType.toLowerCase())) {
      throw new BadRequestException(`Unsupported content type "${contentType}"`);
    }
    // Short TTL – 15 minutes
    const objectKey = `tenants/${tenantId}/${finalFolder}/${userId}/${randomUUID()}-${safeKey}`;
    const command = new PutObjectCommand({
      Bucket: this.config.get('S3_BUCKET'),
      Key: objectKey,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.s3, command, { expiresIn: 900 });
    return { url, key: objectKey, expiresIn: 900, contentType, maxBytes: maxBytes ?? MAX_UPLOAD_BYTES };
  }

  async getPresignedDownloadUrl(key: string) {
    const command = new GetObjectCommand({
      Bucket: this.config.get('S3_BUCKET'),
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn: 900 });
  }

  async getAttachmentUrls(attachments: { url: string; name: string; type: string }[]) {
    return Promise.all(
      attachments.map(async (a) => ({
        ...a,
        signedUrl: a.url.startsWith('uploads/')
          ? await this.getPresignedDownloadUrl(a.url)
          : a.url,
      })),
    );
  }
}
