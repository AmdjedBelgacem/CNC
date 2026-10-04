import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { ConfigService } from '../../config/config.service';
import { DrizzleService } from '../../database/drizzle.service';
import {
  googleIntegrations,
  googleOauthStates,
  type GoogleIntegrationService,
} from '../../database/schema/payments-config';
import { SecretBoxService } from '../../common/security/secret-box.service';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const STATE_TTL_MINUTES = 10;

export type GoogleConnectionStatus =
  | 'connected'
  | 'expired'
  | 'revoked'
  | 'not_connected'
  | 'blocked';

export interface GoogleServiceDescriptor {
  service: GoogleIntegrationService;
  /** What the UI calls it. "Search Console" is the product name; the customer said "Site Manager". */
  label: string;
  customerLabel: string;
  description: string;
  /** Minimum scopes this integration needs, and why. */
  scopes: Array<{ scope: string; reason: string }>;
  /** The account/container/property id this surface exposes. */
  accountKind: string;
  /** Extra platform setup required beyond the OAuth client. */
  requiresDeveloperToken?: boolean;
}

export interface GoogleServiceStatus {
  service: GoogleIntegrationService;
  label: string;
  customerLabel: string;
  description: string;
  accountKind: string;
  requiresDeveloperToken: boolean;
  status: GoogleConnectionStatus;
  connectedEmail: string | null;
  externalAccountId: string | null;
  externalAccountIds: string[];
  scopes: string[];
  lastVerifiedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  connectedAt: string | null;
  /** Why the Connect button is unavailable, in words a super admin can act on. */
  blockedReason: string | null;
}

/**
 * The four Google surfaces, with the narrowest scopes each one actually needs.
 *
 * A single OAuth client is used for all four, but the scopes are per service and
 * a connection only ever stores the scopes it asked for — so linking Tag Manager
 * does not silently grant Search Console access.
 */
export const GOOGLE_SERVICES: GoogleServiceDescriptor[] = [
  {
    service: 'tag_manager',
    label: 'Tag Manager',
    customerLabel: 'Google Tag Manager',
    description: 'Web container used for analytics and marketing tags.',
    accountKind: 'Container ID (GTM-XXXXXX)',
    scopes: [
      {
        scope: 'https://www.googleapis.com/auth/tagmanager.readonly',
        reason: 'Read containers and their versions so the site snippet can be served.',
      },
    ],
  },
  {
    service: 'search_console',
    label: 'Search Console',
    customerLabel: 'Google Search Console',
    description: 'Verified properties for search performance reporting.',
    accountKind: 'Site property (sc-domain:… or URL prefix)',
    scopes: [
      {
        scope: 'https://www.googleapis.com/auth/webmasters.readonly',
        reason: 'List verified properties and read search performance.',
      },
    ],
  },
  {
    service: 'merchant_center',
    label: 'Merchant Center',
    customerLabel: 'Google Merchant Center',
    description: 'Product feeds for Shopping and free listings.',
    accountKind: 'Merchant account ID',
    scopes: [
      {
        scope: 'https://www.googleapis.com/auth/content',
        reason: 'Read the product catalogue and report link status.',
      },
    ],
  },
  {
    service: 'google_ads',
    label: 'Google Ads',
    customerLabel: 'Google Ads',
    description: 'Advertising accounts for campaigns and reporting.',
    accountKind: 'Customer ID (123-456-7890)',
    requiresDeveloperToken: true,
    scopes: [
      {
        scope: 'https://www.googleapis.com/auth/adwords',
        reason: 'Read campaigns, metrics and account health.',
      },
    ],
  },
];

const SERVICE_KEYS = new Set<string>(GOOGLE_SERVICES.map((entry) => entry.service));

@Injectable()
export class GoogleIntegrationsService {
  private readonly logger = new Logger(GoogleIntegrationsService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly config: ConfigService,
    private readonly secrets: SecretBoxService,
  ) {}

  descriptor(service: string): GoogleServiceDescriptor {
    const found = GOOGLE_SERVICES.find((entry) => entry.service === service);
    if (!found) throw new NotFoundException(`Unknown integration: ${service}`);
    return found;
  }

  // -------------------------------------------------------------------------
  // Platform-level configuration
  // -------------------------------------------------------------------------

  oauthClient(): { clientId: string; clientSecret: string; redirectUri: string } | null {
    const clientId = (this.config.get('GOOGLE_OAUTH_CLIENT_ID') as string | undefined) ?? '';
    const clientSecret = (this.config.get('GOOGLE_OAUTH_CLIENT_SECRET') as string | undefined) ?? '';
    const redirectUri = (this.config.get('GOOGLE_OAUTH_REDIRECT_URI') as string | undefined) ?? '';
    if (!clientId || !clientSecret || !redirectUri) return null;
    return { clientId, clientSecret, redirectUri };
  }

  developerToken(): string | null {
    return (this.config.get('GOOGLE_ADS_DEVELOPER_TOKEN') as string | undefined) ?? null;
  }

  /** Why a service cannot be connected right now, if it cannot. */
  blockedReason(service: GoogleIntegrationService): string | null {
    if (!this.oauthClient()) {
      return (
        'GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI are not set on this server.'
      );
    }
    const descriptor = this.descriptor(service);
    if (descriptor.requiresDeveloperToken && !this.developerToken()) {
      return 'GOOGLE_ADS_DEVELOPER_TOKEN is not set, so Google Ads API calls cannot be authorised.';
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  async listStatuses(): Promise<GoogleServiceStatus[]> {
    const rows = await this.drizzle.db.select().from(googleIntegrations);
    const byService = new Map(rows.map((row) => [row.service, row]));

    return GOOGLE_SERVICES.map((descriptor) => {
      const row = byService.get(descriptor.service);
      const blocked = this.blockedReason(descriptor.service);
      const base = {
        service: descriptor.service,
        label: descriptor.label,
        customerLabel: descriptor.customerLabel,
        description: descriptor.description,
        accountKind: descriptor.accountKind,
        requiresDeveloperToken: Boolean(descriptor.requiresDeveloperToken),
        connectedEmail: row?.connectedEmail ?? null,
        externalAccountId: row?.externalAccountId ?? null,
        externalAccountIds: Array.isArray(row?.externalAccountIds) ? row.externalAccountIds : [],
        // Before connecting there is no stored grant, so the requested scopes come
        // from the descriptor: the panel must be able to show what would be asked.
        scopes: Array.isArray(row?.scopes) && row.scopes.length > 0
          ? row.scopes
          : descriptor.scopes.map((entry) => entry.scope),
        lastVerifiedAt: row?.lastVerifiedAt?.toISOString() ?? null,
        lastErrorCode: row?.lastErrorCode ?? null,
        lastErrorMessage: row?.lastErrorMessage ?? null,
        connectedAt: row?.connectedAt?.toISOString() ?? null,
      };
      if (!row?.encryptedRefreshToken) {
        return { ...base, status: blocked ? ('blocked' as const) : ('not_connected' as const), blockedReason: blocked };
      }
      return { ...base, status: (row.status as GoogleConnectionStatus) ?? 'connected', blockedReason: null };
    });
  }

  async getStatus(service: GoogleIntegrationService): Promise<GoogleServiceStatus> {
    const all = await this.listStatuses();
    const found = all.find((entry) => entry.service === service);
    if (!found) throw new NotFoundException('Unknown integration');
    return found;
  }

  // -------------------------------------------------------------------------
  // OAuth: start
  // -------------------------------------------------------------------------

  /**
   * Begin the consent flow.
   *
   * The state row is the CSRF defence: the callback is only honoured when the
   * state matches a live row that this super admin created, and the row is
   * consumed on use. `access_type=offline` is what yields a refresh token at
   * all — without it Google only returns a one-hour access token.
   */
  async startOAuth(params: {
    service: GoogleIntegrationService;
    initiatedBy: string;
    csrfToken: string;
    returnTo?: string;
  }): Promise<{ authorizeUrl: string; state: string; redirectUri: string }> {
    const client = this.oauthClient();
    if (!client) {
      throw new BadRequestException(
        'Google OAuth is not configured on this server (GOOGLE_OAUTH_CLIENT_ID / _SECRET / _REDIRECT_URI).',
      );
    }
    const descriptor = this.descriptor(params.service);
    const state = randomBytes(32).toString('base64url');
    const stateHash = createHash('sha256').update(state).digest('hex');

    await this.drizzle.db.insert(googleOauthStates).values({
      stateHash,
      service: params.service,
      initiatedBy: params.initiatedBy,
      csrfToken: params.csrfToken,
      returnTo: params.returnTo ?? null,
      redirectUri: client.redirectUri,
      expiresAt: new Date(Date.now() + STATE_TTL_MINUTES * 60_000),
    });

    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set('client_id', client.clientId);
    url.searchParams.set('redirect_uri', client.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', descriptor.scopes.map((entry) => entry.scope).join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);

    return { authorizeUrl: url.toString(), state, redirectUri: client.redirectUri };
  }

  // -------------------------------------------------------------------------
  // OAuth: callback
  // -------------------------------------------------------------------------

  /**
   * Exchange the code, store the refresh token encrypted, and probe the API so
   * the connection status reflects reality rather than the fact that a redirect
   * happened.
   */
  async completeOAuth(params: {
    service: GoogleIntegrationService;
    state: string;
    code: string;
    connectedBy: string;
    /** The browser must echo the token minted when the flow started. */
    csrfToken?: string | null;
  }): Promise<{ ok: boolean; status: GoogleServiceStatus; error?: string }> {
    const client = this.oauthClient();
    if (!client) {
      return { ok: false, status: await this.getStatus(params.service), error: 'oauth_not_configured' };
    }

    const stateHash = createHash('sha256').update(params.state).digest('hex');
    const [stateRow] = await this.drizzle.db
      .select()
      .from(googleOauthStates)
      .where(eq(googleOauthStates.stateHash, stateHash))
      .limit(1);

    if (!stateRow) {
      return { ok: false, status: await this.getStatus(params.service), error: 'unknown_state' };
    }
    if (stateRow.consumedAt) {
      // A replayed callback: the code was already spent.
      return { ok: false, status: await this.getStatus(params.service), error: 'state_already_used' };
    }
    if (stateRow.expiresAt.getTime() < Date.now()) {
      return { ok: false, status: await this.getStatus(params.service), error: 'state_expired' };
    }
    if (stateRow.service !== params.service) {
      return { ok: false, status: await this.getStatus(params.service), error: 'service_mismatch' };
    }
    if (stateRow.initiatedBy !== params.connectedBy) {
      // Somebody else's flow: refuse rather than rebind the connection.
      return { ok: false, status: await this.getStatus(params.service), error: 'initiator_mismatch' };
    }
    if (params.csrfToken && !this.csrfMatches(params.csrfToken, stateRow.csrfToken)) {
      return { ok: false, status: await this.getStatus(params.service), error: 'csrf_mismatch' };
    }

    await this.drizzle.db
      .update(googleOauthStates)
      .set({ consumedAt: new Date() })
      .where(eq(googleOauthStates.id, stateRow.id));

    const descriptor = this.descriptor(params.service);
    const token = await this.exchangeCode(params.code, stateRow.redirectUri);
    if (!token.refreshToken) {
      // Google omits the refresh token when the user has already granted access.
      // Without one there is nothing to store, and a connection we cannot
      // refresh is not a connection.
      await this.markStatus(params.service, 'revoked', {
        errorCode: 'no_refresh_token',
        errorMessage:
          'Google did not return a refresh token. Revoke the app grant and reconnect.',
      });
      return { ok: false, status: await this.getStatus(params.service), error: 'no_refresh_token' };
    }

    const encrypted = this.secrets.encryptOrThrow(token.refreshToken, 'platform', `google:${params.service}`);

    await this.drizzle.db
      .insert(googleIntegrations)
      .values({
        service: params.service,
        encryptedRefreshToken: encrypted,
        connectedEmail: token.email,
        scopes: descriptor.scopes.map((entry) => entry.scope),
        status: 'connected',
        lastErrorCode: null,
        lastErrorMessage: null,
        connectedBy: params.connectedBy,
        connectedAt: new Date(),
        disconnectedAt: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: googleIntegrations.service,
        set: {
          encryptedRefreshToken: encrypted,
          connectedEmail: token.email,
          scopes: descriptor.scopes.map((entry) => entry.scope),
          status: 'connected',
          lastErrorCode: null,
          lastErrorMessage: null,
          connectedBy: params.connectedBy,
          connectedAt: new Date(),
          disconnectedAt: null,
          updatedAt: new Date(),
        },
      });

    // Probe so "connected" means the API answered, not that a redirect happened.
    const probe = await this.probe(params.service);
    await this.applyProbe(params.service, probe);
    return { ok: true, status: await this.getStatus(params.service) };
  }

  private async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<{ refreshToken: string | null; accessToken: string | null; email: string | null }> {
    const client = this.oauthClient()!;
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: client.clientId,
        client_secret: client.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => {
      throw new BadRequestException('Could not reach Google to exchange the authorization code');
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.warn(`Google token exchange failed: ${response.status} ${detail.slice(0, 200)}`);
      throw new BadRequestException('Google rejected the authorization code');
    }

    const body = (await response.json()) as Record<string, unknown>;
    return {
      refreshToken: typeof body['refresh_token'] === 'string' ? body['refresh_token'] : null,
      accessToken: typeof body['access_token'] === 'string' ? body['access_token'] : null,
      email: null,
    };
  }

  // -------------------------------------------------------------------------
  // Access + probes
  // -------------------------------------------------------------------------

  /** Exchange a stored refresh token for a short-lived access token. */
  async getAccessToken(service: GoogleIntegrationService): Promise<string | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(googleIntegrations)
      .where(eq(googleIntegrations.service, service))
      .limit(1);
    if (!row?.encryptedRefreshToken) return null;
    if (!this.secrets.configured) {
      await this.markStatus(service, 'expired', {
        errorCode: 'encryption_unavailable',
        errorMessage: 'The server cannot decrypt the stored refresh token.',
      });
      return null;
    }
    const client = this.oauthClient();
    if (!client) return null;

    let refreshToken: string;
    try {
      refreshToken = this.secrets.decrypt(row.encryptedRefreshToken, 'platform', `google:${service}`);
    } catch {
      await this.markStatus(service, 'revoked', {
        errorCode: 'decrypt_failed',
        errorMessage: 'Stored refresh token could not be decrypted.',
      });
      return null;
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        client_id: client.clientId,
        client_secret: client.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);

    if (!response) {
      await this.markStatus(service, 'expired', { errorCode: 'network', errorMessage: 'Google was unreachable.' });
      return null;
    }
    if (response.status === 400 || response.status === 401) {
      // Google invalid_grant: the grant was revoked by the user or the app.
      await this.markStatus(service, 'revoked', {
        errorCode: 'invalid_grant',
        errorMessage: 'The Google grant was revoked. Reconnect this integration.',
      });
      return null;
    }
    if (!response.ok) {
      await this.markStatus(service, 'expired', {
        errorCode: `http_${response.status}`,
        errorMessage: 'Google refused to refresh the access token.',
      });
      return null;
    }
    const body = (await response.json()) as Record<string, unknown>;
    await this.markStatus(service, 'connected', {});
    return typeof body['access_token'] === 'string' ? body['access_token'] : null;
  }

  /**
   * A lightweight, read-only call per service. This is the "test connection"
   * button, and it is the only thing that can move a status to `connected`.
   */
  async probe(
    service: GoogleIntegrationService,
  ): Promise<{ ok: boolean; accountId?: string; accountIds?: string[]; detail?: string; code?: string }> {
    const blocked = this.blockedReason(service);
    if (blocked) return { ok: false, detail: blocked, code: 'not_configured' };

    const accessToken = await this.getAccessToken(service);
    if (!accessToken) return { ok: false, detail: 'No usable access token.', code: 'no_access_token' };

    try {
      switch (service) {
        case 'tag_manager': {
          const response = await this.googleFetch(
            'https://www.googleapis.com/tagmanager/v2/accounts',
            accessToken,
          );
          if (!response.ok) return { ok: false, detail: await this.readError(response), code: `http_${response.status}` };
          const body = (await response.json()) as { account?: Array<{ accountId?: string; name?: string; container?: Array<{ containerId?: string; name?: string }> }> };
          const accounts = body.account ?? [];
          const containers = (accounts[0]?.container ?? []).map((container) => container.containerId ?? '').filter(Boolean);
          return {
            ok: true,
            accountId: containers[0] ?? accounts[0]?.accountId ?? undefined,
            accountIds: containers,
            detail: `${accounts.length} account(s), ${containers.length} container(s)`,
          };
        }
        case 'search_console': {
          const response = await this.googleFetch(
            'https://www.googleapis.com/webmasters/v3/sites',
            accessToken,
          );
          if (!response.ok) return { ok: false, detail: await this.readError(response), code: `http_${response.status}` };
          const body = (await response.json()) as { siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> };
          const sites = (body.siteEntry ?? [])
            .filter((entry) => entry.permissionLevel === 'SITE_OWNER')
            .map((entry) => entry.siteUrl ?? '')
            .filter(Boolean);
          return {
            ok: true,
            accountId: sites[0] ?? undefined,
            accountIds: sites,
            detail: `${sites.length} verified propert(ies)`,
          };
        }
        case 'merchant_center': {
          const response = await this.googleFetch(
            'https://shoppingcontent.googleapis.com/content/v2.1/accounts',
            accessToken,
          );
          if (!response.ok) return { ok: false, detail: await this.readError(response), code: `http_${response.status}` };
          const body = (await response.json()) as { accounts?: Array<{ id?: string; name?: string; primaryContactEmail?: string }> };
          const accounts = body.accounts ?? [];
          return {
            ok: true,
            accountId: accounts[0]?.id ?? undefined,
            accountIds: accounts.map((account) => account.id ?? '').filter(Boolean),
            detail: `${accounts.length} merchant account(s)`,
          };
        }
        case 'google_ads': {
          const developerToken = this.developerToken();
          if (!developerToken) {
            return { ok: false, detail: 'GOOGLE_ADS_DEVELOPER_TOKEN is not set.', code: 'no_developer_token' };
          }
          const response = await fetch(
            'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers',
            {
              headers: {
                accept: 'application/json',
                authorization: `Bearer ${accessToken}`,
                'developer-token': developerToken,
              },
              signal: AbortSignal.timeout(15000),
            },
          ).catch(() => null);
          if (!response) return { ok: false, detail: 'Google Ads API was unreachable.', code: 'network' };
          if (!response.ok) {
            return { ok: false, detail: await this.readError(response), code: `http_${response.status}` };
          }
          const body = (await response.json()) as { resourceNames?: string[] };
          const ids = (body.resourceNames ?? []).map((name) => name.replace('customers/', ''));
          return {
            ok: true,
            accountId: ids[0] ?? undefined,
            accountIds: ids,
            detail: `${ids.length} accessible customer(s)`,
          };
        }
        default:
          return { ok: false, detail: 'Unknown service', code: 'unknown' };
      }
    } catch (error) {
      return { ok: false, detail: (error as Error).message.slice(0, 200), code: 'probe_failed' };
    }
  }

  private async googleFetch(url: string, accessToken: string): Promise<Response> {
    return fetch(url, {
      headers: { accept: 'application/json', authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    });
  }

  private async readError(response: Response): Promise<string> {
    const text = await response.text().catch(() => '');
    return `Google returned ${response.status}: ${text.slice(0, 160)}`;
  }

  private async applyProbe(
    service: GoogleIntegrationService,
    probe: { ok: boolean; accountId?: string; accountIds?: string[]; detail?: string; code?: string },
  ): Promise<void> {
    if (!probe.ok) {
      await this.markStatus(service, 'expired', {
        errorCode: probe.code ?? 'probe_failed',
        errorMessage: probe.detail ?? 'The connection test failed.',
      });
      return;
    }
    const patch: Record<string, unknown> = {
      status: 'connected',
      lastVerifiedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
      updatedAt: new Date(),
    };
    if (probe.accountId) patch['externalAccountId'] = probe.accountId;
    if (probe.accountIds) patch['externalAccountIds'] = probe.accountIds;
    await this.drizzle.db
      .update(googleIntegrations)
      .set(patch)
      .where(eq(googleIntegrations.service, service));
  }

  /** Run a probe and persist the outcome. Used by the "Test connection" button. */
  async testConnection(service: GoogleIntegrationService): Promise<{
    ok: boolean;
    detail: string;
    code?: string;
    accountId?: string;
  }> {
    const probe = await this.probe(service);
    await this.applyProbe(service, probe);
    return {
      ok: probe.ok,
      detail: probe.detail ?? (probe.ok ? 'Connected' : 'Failed'),
      code: probe.code,
      accountId: probe.accountId,
    };
  }

  // -------------------------------------------------------------------------
  // Disconnect
  // -------------------------------------------------------------------------

  async disconnect(service: GoogleIntegrationService, disconnectedBy: string): Promise<{ disconnected: boolean }> {
    // The refresh token is destroyed locally. Google's grant is revoked in the
    // user's own Google account, which only they can do.
    await this.drizzle.db
      .update(googleIntegrations)
      .set({
        encryptedRefreshToken: null,
        connectedEmail: null,
        externalAccountId: null,
        externalAccountIds: [],
        scopes: [],
        status: 'not_connected',
        connectedAt: null,
        connectedBy: null,
        disconnectedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(googleIntegrations.service, service));
    this.logger.log(`Google integration ${service} disconnected by ${disconnectedBy}`);
    return { disconnected: true };
  }

  private async markStatus(
    service: GoogleIntegrationService,
    status: GoogleConnectionStatus,
    detail: { errorCode?: string | null; errorMessage?: string | null },
  ): Promise<void> {
    await this.drizzle.db
      .update(googleIntegrations)
      .set({
        status,
        lastVerifiedAt: status === 'connected' ? new Date() : undefined,
        lastErrorCode: detail.errorCode ?? null,
        lastErrorMessage: (detail.errorMessage ?? null)?.slice(0, 500) ?? null,
        updatedAt: new Date(),
      })
      .where(eq(googleIntegrations.service, service));
  }

  /** Which services are safe to read right now. Used by the status endpoint. */
  listServices(): GoogleServiceDescriptor[] {
    return GOOGLE_SERVICES;
  }

  isKnownService(service: string): service is GoogleIntegrationService {
    return SERVICE_KEYS.has(service);
  }

  /** Constant-time compare for the CSRF token echoed back through the browser. */
  csrfMatches(provided: string | undefined, expected: string): boolean {
    if (!provided) return false;
    const left = Buffer.from(provided);
    const right = Buffer.from(expected);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  /** Remove spent and expired state rows so the table cannot grow unbounded. */
  async purgeExpiredStates(): Promise<number> {
    const deleted = await this.drizzle.db
      .delete(googleOauthStates)
      .where(sql`${googleOauthStates.expiresAt} < now() or ${googleOauthStates.consumedAt} is not null`)
      .returning({ id: googleOauthStates.id });
    return deleted.length;
  }
}
