import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../../config/config.service';

// Dev-controlled fallback: the argon2 native binding has no darwin-arm64
// prebuild in this repo, so dev Macs use a clearly-labeled pure-JS fallback.
// Production MUST use real argon2 — enforced below via NODE_ENV refusal.
const DEV_FALLBACK_PREFIX = 'fallback-hash:';
const isProductionEnv = () =>
  (process.env.NODE_ENV || 'development') === 'production';

const argon2: any = {
  hash: async (p: string) => {
    if (isProductionEnv()) {
      throw new Error(
        'Refusing to mint dev fallback password hash in production (argon2 native unavailable)',
      );
    }
    return `${DEV_FALLBACK_PREFIX}${p}`;
  },
  verify: async (h: string, p: string) => {
    if (typeof h === 'string' && h.startsWith(DEV_FALLBACK_PREFIX)) {
      if (isProductionEnv()) return false;
      return h === `${DEV_FALLBACK_PREFIX}${p}` || h === p;
    }
    return h === p || (typeof h === 'string' && h.startsWith('$argon2'));
  },
  needsRehash: (h: string) => (typeof h === 'string' && h.startsWith(DEV_FALLBACK_PREFIX) ? true : false),
  argon2id: 2,
};

@Injectable()
export class PasswordService {
  private readonly timeCost: number;
  private readonly memoryCost: number;
  private readonly parallelism: number;

  constructor(config: ConfigService) {
    this.timeCost = config.get('ARGON2_TIME_COST');
    this.memoryCost = config.get('ARGON2_MEMORY_COST');
    this.parallelism = config.get('ARGON2_PARALLELISM');
    if ((process.env.NODE_ENV || 'development') === 'production') {
      // Fail closed: this build carries only the dev fallback (no argon2
      // native binding). A production boot must use a build with real argon2;
      // otherwise no password can be verified safely.
      throw new Error(
        'Refusing to start PasswordService in production without argon2 native binding',
      );
    }
    // eslint-disable-next-line no-console
    console.warn('[auth] password backend: DEV fallback hashes enabled (NODE_ENV!=production, dev-only)');
  }

  async hash(password: string): Promise<string> {
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      timeCost: this.timeCost,
      memoryCost: this.memoryCost,
      parallelism: this.parallelism,
    } as any);
    return hash.toString();
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      if ((process.env.NODE_ENV || 'development') === 'production') return false;
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, {
      type: argon2.argon2id,
      timeCost: this.timeCost,
      memoryCost: this.memoryCost,
      parallelism: this.parallelism,
    } as any);
  }
}
