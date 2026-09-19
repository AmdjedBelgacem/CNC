/**
 * Shared upload policy — imported by both the controller (request validation) and the
 * service (defence in depth) so the two can never drift apart.
 *
 * Deliberately EXCLUDES:
 *   - text/html, application/x-httpd-php, application/javascript — script execution surface
 *   - image/svg+xml — SVG is XML and can embed <script>; must not be served from the asset origin
 */
export const ALLOWED_UPLOAD_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

/** Hard ceiling for a single presigned upload (bytes). */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB
