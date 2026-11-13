import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '../../config/config.service';
import { randomUUID } from 'node:crypto';
import { ALLOWED_UPLOAD_CONTENT_TYPES, MAX_UPLOAD_BYTES } from './upload.constants';

/**
 * Presigner options for a PUT. The v3 presigner treats `content-type` as UNSIGNABLE by
 * default, so without this a URL issued for `image/png` accepts `text/html` too and the
 * type allowlist is decorative. Signing it makes storage reject any other Content-Type.
 * (A `ContentLength` on the command is signed as `content-length` automatically.)
 */
export const presignedPutOptions = () => ({
  expiresIn: 900,
  signableHeaders: new Set(['content-type']),
});

@Injectable()
export class UploadService {
  private s3: S3Client;

  constructor(@Inject(ConfigService) private config: ConfigService) {
    this.s3 = new S3Client({
      region: config.get('S3_REGION'),
      endpoint: config.get('S3_ENDPOINT'),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY') ?? '',
        secretAccessKey: config.get('S3_SECRET_KEY') ?? '',
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
    return getSignedUrl(this.s3, command, presignedPutOptions());
  }

  async getPresignedUploadUrlForTenant(
    tenantId: string,
    userId: string,
    key: string,
    contentType: string,
    folder?: string,
    maxBytes?: number,
    size?: number,
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
    // When the client declares the size, enforce the ceiling and sign it, so the PUT
    // must carry exactly that many bytes. Without a declared size only the type is bound.
    const ceiling = Math.min(maxBytes ?? MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES);
    if (size !== undefined) {
      if (!Number.isSafeInteger(size) || size <= 0) throw new BadRequestException('Invalid size');
      if (size > ceiling) {
        throw new BadRequestException(`File too large. Max ${Math.round(ceiling / 1024 / 1024)}MB.`);
      }
    }
    // Short TTL – 15 minutes
    const objectKey = `tenants/${tenantId}/${finalFolder}/${userId}/${randomUUID()}-${safeKey}`;
    const command = new PutObjectCommand({
      Bucket: this.config.get('S3_BUCKET'),
      Key: objectKey,
      ContentType: contentType,
      ...(size !== undefined ? { ContentLength: size } : {}),
    });
    const url = await getSignedUrl(this.s3, command, presignedPutOptions());
    /**
     * `publicUrl` is the URL the object will be readable at once uploaded, so the caller
     * never has to reconstruct it from the key. Making the browser do that would mean
     * baking the storage host into the client build and getting it wrong silently.
     */
    const publicBase = (this.config.get('S3_PUBLIC_URL') || '').replace(/\/+$/, '');
    return {
      url,
      key: objectKey,
      publicUrl: publicBase ? `${publicBase}/${objectKey}` : '',
      expiresIn: 900,
      contentType,
      maxBytes: maxBytes ?? MAX_UPLOAD_BYTES,
    };
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
