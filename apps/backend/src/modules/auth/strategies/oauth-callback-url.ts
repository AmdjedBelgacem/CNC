import type { ConfigService } from '../../../config/config.service';

/**
 * Origin the OAuth provider should redirect back to.
 *
 * Providers call this API directly, so it must be the API's own public address.
 * Pointing it at FRONTEND_URL sends the browser to a Next.js path that does not
 * exist (the only Next route under /api is /api/proxy).
 */
export function callbackOrigin(config: ConfigService): string {
  const configured = config.get('API_PUBLIC_URL');
  if (configured) return String(configured).replace(/\/+$/, '');
  const port = config.get('PORT') || 4000;
  return `http://localhost:${port}`;
}