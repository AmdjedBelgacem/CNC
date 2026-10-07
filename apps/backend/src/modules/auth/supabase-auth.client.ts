import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';

export interface SupabaseSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  email: string | null;
}

export class SupabaseAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'SupabaseAuthError';
  }
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string; email?: string; email_confirmed_at?: string | null };
  /** Returned by `/admin/generate_link`. */
  id?: string;
  hashed_token?: string;
  verification_type?: string;
  error?: string;
  error_description?: string;
  msg?: string;
}

/**
 * Thin client for Supabase's GoTrue REST API.
 *
 * Supabase becomes the only credential authority and the only token issuer: this app
 * never verifies a password itself and never mints its own access token. The browser
 * still receives httpOnly cookies (so the existing CSRF and middleware behaviour is
 * unchanged), but those cookies now carry Supabase tokens, which `SupabaseAuthGuard`
 * validates against the project's JWKS.
 */
@Injectable()
export class SupabaseAuthClient {
  private readonly logger = new Logger(SupabaseAuthClient.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  get enabled(): boolean {
    const value: unknown = this.config.get('SUPABASE_AUTH_ENABLED');
    return value === true || value === 'true';
  }

  private get baseUrl(): string {
    const url = this.config.get('SUPABASE_URL');
    if (!url) throw new SupabaseAuthError('not_configured', 'SUPABASE_URL is not configured', 500);
    return String(url).replace(/\/+$/, '');
  }

  private get anonKey(): string {
    // The publishable key is safe to use server-side and is the correct key for the
    // user-facing endpoints (sign-in, refresh, signup, recover).
    const key = this.config.get('SUPABASE_PUBLISHABLE_KEY') ?? this.config.get('SUPABASE_ANON_KEY');
    if (!key) throw new SupabaseAuthError('not_configured', 'SUPABASE_PUBLISHABLE_KEY is not configured', 500);
    return String(key);
  }

  private get adminKey(): string {
    const key = this.config.get('SUPABASE_SECRET_KEY') ?? this.config.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!key) throw new SupabaseAuthError('not_configured', 'SUPABASE_SECRET_KEY is not configured', 500);
    return String(key);
  }

  private async post(path: string, body: unknown, useAdminKey = false): Promise<TokenResponse> {
    const res = await fetch(`${this.baseUrl}/auth/v1${path}`, {
      method: 'POST',
      headers: {
        apikey: useAdminKey ? this.adminKey : this.anonKey,
        Authorization: `Bearer ${useAdminKey ? this.adminKey : this.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: TokenResponse = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new SupabaseAuthError('invalid_response', 'Supabase returned a non-JSON response', res.status);
    }
    if (!res.ok) {
      const message = json.error_description || json.msg || json.error || 'Supabase request failed';
      this.logger.warn(`Supabase ${path} -> ${res.status}: ${message}`);
      throw new SupabaseAuthError(json.error || 'request_failed', message, res.status);
    }
    return json;
  }

  private toSession(json: TokenResponse): SupabaseSession {
    if (!json.access_token || !json.refresh_token) {
      throw new SupabaseAuthError('no_session', 'Supabase did not return a session', 502);
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresIn: json.expires_in ?? 3600,
      userId: json.user?.id ?? '',
      email: json.user?.email ?? null,
    };
  }

  /** Password grant. Replaces this application's own password verification. */
  async signInWithPassword(email: string, password: string): Promise<SupabaseSession> {
    return this.toSession(await this.post('/token?grant_type=password', { email, password }));
  }

  async refreshSession(refreshToken: string): Promise<SupabaseSession> {
    return this.toSession(await this.post('/token?grant_type=refresh_token', { refresh_token: refreshToken }));
  }

  /** Creates a confirmed account. Email confirmation is skipped: the address is our own record. */
  async createUser(params: { email: string; password: string; name?: string; username?: string }): Promise<string> {
    const json = await this.post(
      '/admin/users',
      {
        email: params.email,
        password: params.password,
        email_confirm: true,
        user_metadata: { name: params.name, username: params.username },
      },
      true,
    );
    /**
     * `/admin/users` returns the created user at the TOP level
     * (`{ id, aud, role, email, email_confirmed_at, ... }`), not wrapped in a `user` key.
     * Reading `json.user?.id` therefore always yielded undefined and threw `no_user` (502),
     * which surfaced to the register form as a generic "Registration is unavailable" even
     * though Supabase had in fact created the account — leaving an orphaned auth user and
     * making every retry fail with "already registered".
     *
     * Both shapes are accepted so this keeps working if the response is ever enveloped.
     */
    const created = (json.user ?? json) as { id?: string };
    if (!created.id) throw new SupabaseAuthError('no_user', 'Supabase did not return a user id', 502);
    return created.id;
  }

  async setPassword(userId: string, password: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        apikey: this.adminKey,
        Authorization: `Bearer ${this.adminKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      throw new SupabaseAuthError('update_failed', 'Could not set the Supabase password', res.status);
    }
  }

  /**
   * Revokes a session server-side.
   *
   * Needed wherever a session is minted *before* a check that can still reject the
   * login (see the 2FA gate in `POST /auth/login`): without this, the credentials for a
   * login that was refused would stay valid until they expired, held by nobody.
   */
  async signOut(refreshToken: string): Promise<void> {
    await this.post('/logout', { refresh_token: refreshToken }).catch(() => undefined);
  }

  /** Sends Supabase's password-setup/reset email for a user. */
  async sendRecoveryEmail(email: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/auth/v1/recover`, {
      method: 'POST',
      headers: { apikey: this.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok && res.status !== 422 && res.status !== 429) {
      const body = await res.text().catch(() => '');
      throw new SupabaseAuthError('recover_failed', body.slice(0, 200) || 'Could not send recovery email', res.status);
    }
  }

  /**
   * Issue a Supabase session for an address a federated provider has already proven.
   *
   * Google/GitHub sign-in proved control of the mailbox, but this deployment is
   * Supabase-exclusive: `JwtAuthGuard` validates only Supabase tokens and
   * `SupabaseAuthGuard` resolves the caller by `users.auth_user_id`. So an OAuth
   * callback that returned this application's own JWT left the browser holding a
   * cookie the guard rejects — `/auth/me` 401 and `/auth/refresh` answered
   * `Refresh token is not valid`, no matter how many times the flow was retried.
   *
   * The link is generated with the admin API and redeemed immediately, so no email is
   * sent and **the account's password is never read, reset or replaced**. That last
   * property is why this is not the obvious "provision a user with a random password
   * and sign in with it" approach: that silently invalidates a password the person
   * may be relying on. `should_create_user` covers first-time OAuth sign-ins, and
   * redeeming the link confirms the address, which the provider already did.
   */
  async mintSessionForVerifiedEmail(params: { email: string }): Promise<SupabaseSession> {
    const email = params.email?.trim();
    if (!email) throw new SupabaseAuthError('invalid_email', 'An email address is required', 400);

    const link = await this.post(
      '/admin/generate_link',
      { type: 'magiclink', email, should_create_user: true },
      true,
    );

    /**
     * `/admin/generate_link` answers with the user object flattened and the link
     * fields at the top level (`hashed_token`, `verification_type`), not wrapped in a
     * `properties` key like supabase-js surfaces it. Reading `properties` returned
     * undefined and the retry with an empty token failed with
     * "Verify requires either a token or a token hash".
     */
    const tokenHash = link.hashed_token;
    const verificationType = link.verification_type || 'magiclink';
    if (!tokenHash) {
      throw new SupabaseAuthError('no_link', 'Supabase did not return a verification token', 502);
    }

    /**
     * `token_hash` is the hash embedded in `action_link`; `token` is the bare value,
     * which this GoTrue version rejects for this flow ("Only an email address or
     * phone number should be provided on verify"). Redemption is anonymous by
     * design: the link is the credential.
     */
    const verified = await this.post('/verify', {
      type: verificationType,
      token_hash: tokenHash,
    });

    return this.toSession(verified);
  }
}