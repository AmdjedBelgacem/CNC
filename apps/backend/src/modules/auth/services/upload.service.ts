import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;
  /**
   * Supabase Storage (S3-compatible). Avatars, covers and portfolio images were
   * already served publicly over HTTP, so the `uploads` bucket is public-read and the
   * stored URL points at Supabase's public object endpoint — behaviour is unchanged
   * from the browser's point of view, only the host moves.
   *
   * Falls back to local disk when S3 is not configured, so a developer machine with no
   * Supabase credentials still works.
   */
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    const apiUrl = process.env.API_URL || 'http://localhost:4000';
    this.baseUrl = process.env.UPLOAD_BASE_URL || `${apiUrl}/uploads`;
    this.bucket = process.env.S3_BUCKET || '';
    this.publicUrl = (process.env.S3_PUBLIC_URL || '').replace(/\/+$/, '');
    const endpoint = process.env.S3_ENDPOINT || '';
    const accessKey = process.env.S3_ACCESS_KEY || '';
    const secretKey = process.env.S3_SECRET_KEY || '';
    if (this.bucket && this.publicUrl && endpoint && accessKey && secretKey) {
      this.s3 = new S3Client({
        endpoint,
        region: process.env.S3_REGION || 'us-east-1',
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
        forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || 'false') === 'true',
      });
      this.logger.log(`Uploads -> Supabase Storage bucket ${this.bucket}`);
    } else {
      this.s3 = null;
      this.logger.warn('Uploads -> local disk (S3_PUBLIC_URL / S3_* not fully configured)');
    }
  }

  async saveAvatar(userId: string, imageData: string): Promise<string> {
    return this.saveImage(userId, imageData, 'avatars');
  }

  async saveCover(userId: string, imageData: string): Promise<string> {
    return this.saveImage(userId, imageData, 'covers');
  }

  async savePortfolioImage(userId: string, imageData: string): Promise<string> {
    return this.saveImage(userId, imageData, 'portfolio');
  }

  /**
   * Generic file upload used by admin tooling (course media, lesson attachments).
   * Accepts a base64 data URL and stores it under the given folder, returning a
   * public URL plus basic metadata.
   */
  async uploadGeneric(dataUrl: string, folder: string, originalName?: string): Promise<{ url: string; name: string; type: string; size: number }> {
    const match = /^data:([^;]*);base64,(.+)$/.exec(dataUrl);
    if (!match || !match[2]) {
      throw new BadRequestException('Invalid file data. Expected a base64 data URL.');
    }

    let mimeType = (match[1] || '').trim() || 'application/octet-stream';
    if (mimeType.includes(';')) mimeType = mimeType.split(';')[0]!.trim();
    const base64Data = match[2];
    const allowed = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
      'application/pdf',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'text/plain',
      'text/vtt',
      'application/zip',
    ]);
    if (!allowed.has(mimeType)) {
      throw new BadRequestException(`Unsupported file type: ${mimeType}.`);
    }

    const allowedFolders = new Set(['covers', 'trailers', 'og', 'lesson-images', 'attachments', 'lessons', 'resources', 'captions']);
    const safeFolder = allowedFolders.has(folder) ? folder : 'uploads';
    const maxSize = mimeType.startsWith('video/') ? 500 * 1024 * 1024 : mimeType.startsWith('image/') ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > maxSize) {
      throw new BadRequestException(`File too large. Max ${Math.round(maxSize / 1024 / 1024)}MB.`);
    }

    const ext = (mimeType.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'bin';
    const filename = `${randomUUID()}.${ext}`;
    const dirPath = join(this.uploadDir, safeFolder);
    if (!existsSync(dirPath)) await mkdir(dirPath, { recursive: true });
    await writeFile(join(dirPath, filename), buffer);

    const name = originalName?.trim() || filename;
    this.logger.log(`Saved ${safeFolder}/${filename} (${buffer.length} bytes)`);
    return { url: `/uploads/${safeFolder}/${filename}`, name, type: mimeType, size: buffer.length };
  }

  private async saveImage(userId: string, imageData: string, subDir: string): Promise<string> {
    const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match || !match[1] || !match[2]) throw new BadRequestException('Invalid image data. Expected base64 data URL.');

    const mimeType = match[1];
    const base64Data = match[2];

    if (!ALLOWED_TYPES.includes(mimeType)) {
      throw new BadRequestException(`Unsupported image type: ${mimeType}. Allowed: ${ALLOWED_TYPES.join(', ')}`);
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException(`Image too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
    }

    const ext = mimeType.split('/')[1];
    const filename = `${randomUUID()}.${ext}`;
    const dirPath = join(this.uploadDir, subDir);

    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }

    const objectKey = `${subDir}/${filename}`;

    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: buffer,
          ContentType: mimeType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      this.logger.log(`Stored ${objectKey} in ${this.bucket} for user ${userId}`);
      return `${this.publicUrl}/${objectKey}`;
    }

    const filePath = join(dirPath, filename);
    await writeFile(filePath, buffer);
    this.logger.log(`Saved ${objectKey} on local disk for user ${userId}`);

    return `${this.baseUrl}/${objectKey}`;
  }

  async deleteFile(url: string): Promise<void> {
    try {
      const pathPart = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '');
      if (!pathPart.startsWith('uploads/')) return;
      const filePath = join(this.uploadDir, pathPart);
      const normalizedRoot = join(this.uploadDir).replace(/[\\/]+$/, '');
      const normalizedFile = filePath.replace(/[\\/]+$/, '');
      if (!normalizedFile.startsWith(`${normalizedRoot}/`) && normalizedFile !== normalizedRoot) return;
      if (existsSync(filePath)) {
        await unlink(filePath);
        this.logger.log(`Deleted file: ${filePath}`);
      }
    } catch (err) {
      this.logger.warn(`Failed to delete file: ${url}`, err);
    }
  }
}
