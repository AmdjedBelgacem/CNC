'use client';

import { api } from '@/lib/api-client';

/**
 * Image uploads go straight to object storage.
 *
 * The previous path read the file into a base64 data URL and POSTed it as JSON, which meant:
 *
 *   * ~33% size inflation, so the wire payload was a third larger than the file;
 *   * the whole file buffered in app memory on every upload;
 *   * a hard ceiling of `JSON_BODY_LIMIT_BYTES` (2 MB in production) on the *encoded*
 *     body — about 1.5 MB of real image. Anything larger failed with
 *     `413 Request body is too large`, which is exactly what a 1.5 MB product photo hit.
 *
 * Asking for a presigned PUT and uploading the raw bytes to storage removes all three:
 * bytes never traverse the API, there is no inflation, and the ceiling becomes the
 * storage service's rather than a JSON parser's.
 */

/** Presigned uploads accept only what the backend allows; mirrored here to fail fast. */
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

/** Folders the backend will honour; anything else is silently demoted to `uploads`. */
const FOLDERS = ['covers', 'courses', 'avatars', 'attachments', 'resources', 'og'];

export interface UploadedFile {
  /** Public URL to store in the database. */
  url: string;
  key: string;
  name: string;
  type: string;
  size: number;
}

interface PresignedResponse {
  url: string;
  key: string;
  publicUrl?: string;
  contentType: string;
}

/** Defensive ceiling so a mis-picked 500 MB file fails before it is read into memory. */
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;

const safeName = (file: File) => {
  const base = file.name.replace(/[^A-Za-z0-9._-]/g, '').slice(-60) || 'upload';
  return base;
};

export async function uploadFileToStorage(
  file: File,
  folder = 'covers',
): Promise<UploadedFile> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || 'unknown'}`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `File is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum is ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB.`,
    );
  }

  const finalFolder = FOLDERS.includes(folder) ? folder : 'uploads';
  const ticket = await api.post<PresignedResponse>('/upload/presigned', {
    key: safeName(file),
    contentType: file.type,
    folder: finalFolder,
  });

  if (!ticket?.url || !ticket.key) throw new Error('Could not prepare the upload');

  // Raw bytes, straight to storage. No base64, no JSON, no size ceiling from the API.
  const put = await fetch(ticket.url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!put.ok) {
    throw new Error(`Upload failed (${put.status})`);
  }

  /**
   * Prefer the server's own public URL. Falling back to reconstructing it from the key is
   * only correct if the base really is the bucket's public root — which is why the backend
   * now returns it instead of leaving the client to guess.
   */
  const publicUrl = ticket.publicUrl || ticket.key;
  if (!publicUrl) throw new Error('Upload completed but no public URL was returned');

  return { url: publicUrl, key: ticket.key, name: file.name, type: file.type, size: file.size };
}

/** Convenience wrapper for images, where the folder is almost always `covers`. */
export const uploadImage = (file: File, folder = 'covers') => uploadFileToStorage(file, folder);