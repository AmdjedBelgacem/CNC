import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    const apiUrl = process.env.API_URL || 'http://localhost:4000';
    this.baseUrl = process.env.UPLOAD_BASE_URL || `${apiUrl}/uploads`;
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
    // Strip charset if present (e.g. text/plain;charset=utf-8)
    if (mimeType.includes(';')) mimeType = mimeType.split(';')[0]!.trim();
    const base64Data = match[2];

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'application/pdf',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/mov',
      'video/ogg',
      'video/x-matroska',
      'video/x-msvideo',
      'video/avi',
      'video/mpeg',
      'video/3gpp',
      'audio/mpeg',
      'audio/webm',
      'text/plain',
      'application/zip',
      'application/octet-stream',
    ];
    if (!allowed.includes(mimeType)) {
      throw new BadRequestException(`Unsupported file type: ${mimeType}.`);
    }

    const maxSize = 50 * 1024 * 1024;
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > maxSize) {
      throw new BadRequestException(`File too large. Max ${maxSize / 1024 / 1024}MB.`);
    }

    const ext = (mimeType.split('/')[1] || 'bin').replace('+xml', '').replace('svg', 'svg');
    const filename = `${randomUUID()}.${ext}`;
    const dirPath = join(this.uploadDir, folder);
    if (!existsSync(dirPath)) await mkdir(dirPath, { recursive: true });
    await writeFile(join(dirPath, filename), buffer);

    const name = originalName?.trim() || filename;
    this.logger.log(`Saved ${folder}/${filename} (${buffer.length} bytes)`);
    return { url: `${this.baseUrl}/${folder}/${filename}`, name, type: mimeType, size: buffer.length };
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

    const filePath = join(dirPath, filename);
    await writeFile(filePath, buffer);

    this.logger.log(`Saved ${subDir}/${filename} for user ${userId}`);

    return `${this.baseUrl}/${subDir}/${filename}`;
  }

  async deleteFile(url: string): Promise<void> {
    try {
      const pathPart = url.replace(this.baseUrl, '');
      const filePath = join(this.uploadDir, pathPart);
      if (existsSync(filePath)) {
        await unlink(filePath);
        this.logger.log(`Deleted file: ${filePath}`);
      }
    } catch (err) {
      this.logger.warn(`Failed to delete file: ${url}`, err);
    }
  }
}
