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
  user?: { id?: string; email?: string };
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
    if (!json.user?.id) throw new SupabaseAuthError('no_user', 'Supabase did not return a user id', 502);
    return json.user.id;
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
}