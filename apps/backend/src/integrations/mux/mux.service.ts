import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class MuxService {
  private baseUrl = 'https://api.mux.com';
  private tokenId: string;
  private tokenSecret: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.tokenId = config.get('MUX_TOKEN_ID') || '';
    this.tokenSecret = config.get('MUX_TOKEN_SECRET') || '';
  }

  private get authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.tokenId}:${this.tokenSecret}`).toString('base64');
  }

  async createUpload(): Promise<{ url: string; id: string }> {
    if (!this.tokenId) {
      return { url: '/mock-upload', id: 'mock-upload-id' };
    }
    const res = await fetch(`${this.baseUrl}/video/v1/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: this.authHeader },
      body: JSON.stringify({
        new_asset_settings: { playback_policy: ['signed'], encoding_tier: 'smart' },
        cors_origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      }),
    });
    const data = await res.json() as { data?: { url: string; id: string } };
    return data.data || { url: '', id: '' };
  }

  async getPlaybackId(assetId: string): Promise<string | null> {
    if (!this.tokenId) return 'mock-playback-id';
    const res = await fetch(`${this.baseUrl}/video/v1/assets/${assetId}`, {
      headers: { Authorization: this.authHeader },
    });
    const data = await res.json() as { data?: { playback_ids?: { id: string }[] } };
    return data.data?.playback_ids?.[0]?.id || null;
  }

  async createAssetTrack(assetId: string) {
    if (!this.tokenId) return { status: 'mock' };
    const res = await fetch(`${this.baseUrl}/video/v1/assets/${assetId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: this.authHeader },
      body: JSON.stringify({ type: 'text', text_type: 'subtitles' }),
    });
    return res.json();
  }
}
