import { Injectable, Logger } from '@nestjs/common';
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ConfigService } from '../../../config/config.service';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Legacy dev marker: `fallback-hash:<password>`.
 *
 * It stored the password in cleartext. Every row written while this existed is
 * readable by anyone with database or backup access, and `verify` additionally
 * accepted a bare plaintext hash (`h === p`), so a plaintext column value
 * authenticated. Both behaviours are gone. The prefix is still *recognised* so
 * existing accounts can log in once and be transparently rehashed.
 */
const LEGACY_PREFIX = 'fallback-hash:';

/** scrypt parameters. N=2^15 with r=8 needs ~32MB per hash — tuned for a server. */
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };

/** argon2id, used when the native binding is available. Preferred. */
let argon2: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  argon2 = require('argon2');
} catch {
  argon2 = null;
}

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private readonly timeCost: number;
  private readonly memoryCost: number;
  private readonly parallelism: number;

  constructor(config: ConfigService) {
    this.timeCost = Number(config.get('ARGON2_TIME_COST') ?? 3);
    this.memoryCost = Number(config.get('ARGON2_MEMORY_COST') ?? 65536);
    this.parallelism = Number(config.get('ARGON2_PARALLELISM') ?? 4);
    if (!argon2) {
      this.logger.warn(
        '[auth] argon2 native binding unavailable — using scrypt (N=32768,r=8,p=1). ' +
          'Still a memory-hard KDF; install argon2 for the preferred backend.',
      );
    }
  }

  /** Which KDF actually produced a stored hash. */
  private kind(hash: string): 'argon2' | 'scrypt' | 'legacy' | 'plaintext' | 'unknown' {
    if (typeof hash !== 'string' || !hash) return 'unknown';
    if (hash.startsWith(LEGACY_PREFIX)) return 'legacy';
    if (hash.startsWith('$argon2')) return 'argon2';
    if (hash.startsWith('scrypt$')) return 'scrypt';
    // A bare value that is not a hash of any recognised form. Treated as plaintext
    // by verify() and therefore always rejected.
    return 'plaintext';
  }

  async hash(password: string): Promise<string> {
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('Refusing to hash an empty password');
    }
    if (argon2?.hash) {
      return String(
        await argon2.hash(password, {
          type: argon2.argon2id,
          timeCost: this.timeCost,
          memoryCost: this.memoryCost,
          parallelism: this.parallelism,
        }),
      );
    }
    const salt = randomBytes(16);
    const derived = await scrypt(password, salt, SCRYPT.keylen, SCRYPT);
    return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${derived.toString('base64')}`;
  }

  async verify(hash: string, password: string): Promise<boolean> {
    if (typeof hash !== 'string' || typeof password !== 'string' || !hash) return false;
    const kind = this.kind(hash);
    try {
      switch (kind) {
        case 'argon2':
          return argon2 ? await argon2.verify(hash, password) : false;
        case 'scrypt': {
          const parts = hash.split('$');
          // scrypt$N$r$p$salt$hash
          if (parts.length !== 6) return false;
          const N = Number(parts[1]);
          const r = Number(parts[2]);
          const p = Number(parts[3]);
          if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
          // Bound the cost parameters: a stored hash must not be able to demand
          // an unbounded allocation and become a memory-exhaustion vector.
          if (N < 2 || N > 1 << 20 || r < 1 || r > 32 || p < 1 || p > 16) return false;
          const salt = Buffer.from(parts[4]!, 'base64');
          const expected = Buffer.from(parts[5]!, 'base64');
          if (salt.length === 0 || expected.length === 0) return false;
          const actual = await scrypt(password, salt, expected.length, {
            N,
            r,
            p,
            maxmem: 512 * 1024 * 1024,
          });
          return actual.length === expected.length && timingSafeEqual(actual, expected);
        }
        case 'legacy':
          // Cleartext from the old dev fallback. Verifying it is the only way
          // existing accounts are not locked out; callers must rehash on success
          // (needsRehash() returns true for these) so the cleartext is replaced
          // the first time it is used. Never accepted in production.
          if ((process.env.NODE_ENV || 'development') === 'production') return false;
          return timingSafeEqual(
            Buffer.from(hash.slice(LEGACY_PREFIX.length).padEnd(64, '\0').slice(0, 64)),
            Buffer.from(password.padEnd(64, '\0').slice(0, 64)),
          );
        case 'plaintext':
        case 'unknown':
        default:
          // The old `h === p` comparison lived here. A password column that
          // contains a bare value is not a hash and must never authenticate.
          return false;
      }
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    const kind = this.kind(hash);
    if (kind === 'legacy' || kind === 'plaintext' || kind === 'unknown') return true;
    if (kind === 'scrypt' && !argon2) return true; // upgrade to argon2 when available
    if (kind === 'argon2' && argon2?.needsRehash) {
      try {
        return argon2.needsRehash(hash, {
          type: argon2.argon2id,
          timeCost: this.timeCost,
          memoryCost: this.memoryCost,
          parallelism: this.parallelism,
        });
      } catch {
        return false;
      }
    }
    return false;
  }
}
