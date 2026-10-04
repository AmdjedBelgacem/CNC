import type { AnalyticsIds } from '@/lib/analytics';
import { normalizeAnalyticsIds } from '@/lib/analytics';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Server-side resolution of analytics tag IDs.
 * Order: tenant settings → env fallback → disabled (empty strings).
 */
export async function resolveAnalyticsIds(tenantSlug: string): Promise<AnalyticsIds> {
  let tenantIds: AnalyticsIds = { gaMeasurementId: '', snapchatPixelId: '' };
  let tenantConfigured = false;

  try {
    const res = await fetch(`${API_BASE}/content/analytics`, {
      headers: { 'x-tenant-slug': tenantSlug },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      // Endpoint always returns both keys when tenant exists; empty string =
      // admin explicitly cleared (disable) for that vendor when config present.
      if (data && typeof data === 'object' && ('gaMeasurementId' in data || 'snapchatPixelId' in data)) {
        tenantConfigured = true;
        tenantIds = normalizeAnalyticsIds({
          gaMeasurementId: data.gaMeasurementId,
          snapchatPixelId: data.snapchatPixelId,
        });
      }
    }
  } catch {
    /* fall through to env */
  }

  // If tenant never saved analytics, fall back to env. If they saved (even empty),
  // respect their choice (empty disables — see mission resolution order).
  if (!tenantConfigured) {
    return normalizeAnalyticsIds({
      gaMeasurementId: process.env.NEXT_PUBLIC_GA_ID || '',
      snapchatPixelId: process.env.NEXT_PUBLIC_SNAPCHAT_PIXEL_ID || '',
    });
  }

  // Partial: only fill unset vendors from env when tenant left them blank AND
  // the other was never part of a full save — keep simple: blank → env only when
  // neither vendor was ever configured is handled above. When configured, blank
  // means disabled for that vendor (explicit admin intent).
  return tenantIds;
}
