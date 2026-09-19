import { Injectable, UnauthorizedException, OnModuleInit, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '../../../config/config.service';
import { DrizzleService } from '../../../database/drizzle.service';
import { users } from '../../../database/schema/users';
import { eq } from 'drizzle-orm';
import { KeyManagementService } from '../services/key-management.service';
import { RedisService } from '../services/redis.service';
import { RbacService } from '../../rbac/rbac.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) implements OnModuleInit {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    config: ConfigService,
    private drizzle: DrizzleService,
    private keyManagement: KeyManagementService,
    private redisService: RedisService,
    private rbac: RbacService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => {
          if (!req?.cookies) return null;
          // Support both plain and __Host- prefixed cookies
          return (
            req.cookies['access-token'] ||
            req.cookies['__Host-access'] ||
            req.cookies['__Host-access-token'] ||
            null
          );
        },
      ]),
      ignoreExpiration: false,
      secretOrKeyProvider: async (
        _request: any,
        rawJwtToken: string,
        done: (err: any, secret: string) => void,
      ) => {
        try {
          const dotIndex = rawJwtToken.indexOf('.');
          if (dotIndex === -1) return done(null, config.get('JWT_ACCESS_SECRET'));
          const headerB64 = rawJwtToken.slice(0, dotIndex);
          const headerJson = Buffer.from(headerB64, 'base64url').toString('utf8');
          const header = JSON.parse(headerJson);
          const keyId = header.kid;

          if (keyId) {
            const keySecret = await keyManagement.getVerificationKey(keyId);
            if (keySecret) {
              return done(null, keySecret);
            }
          }

          const secret = config.get('JWT_ACCESS_SECRET');
          return done(null, secret);
        } catch {
          const secret = config.get('JWT_ACCESS_SECRET');
          return done(null, secret);
        }
      },
    });
  }

  async onModuleInit() {
    try {
      const secret = process.env.JWT_ACCESS_SECRET || '';
      if (secret) {
        await this.keyManagement.initializeFromEnv(secret);
      }
    } catch (e) {
      this.logger.warn('Could not initialize key management (non-fatal): ' + (e as Error).message);
    }
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    tenantId: string;
    type: string;
    jti?: string;
    impersonating?: boolean;
    impersonatedBy?: string;
  }) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Redis jti denylist check (instant logout)
    if (payload.jti) {
      try {
        const denylisted = await this.redisService.get(`jti:${payload.jti}`);
        if (denylisted) {
          throw new UnauthorizedException('Token has been revoked');
        }
      } catch (e) {
        if (e instanceof UnauthorizedException) throw e;
        // Redis failure should not block auth — log and continue
        this.logger.warn(`Redis jti check failed: ${(e as Error).message}`);
      }
    }

    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.accountStatus === 'deleted' || user.accountStatus === 'suspended') {
      throw new UnauthorizedException('Account is not accessible');
    }

    if (user.accountStatus === 'pending_verification') {
      throw new UnauthorizedException('Please verify your email address');
    }

    if (user.accountStatus === 'locked') {
      throw new UnauthorizedException('Account is temporarily locked');
    }

    const permissions = await this.rbac.resolvePermissions(user.id, user.role, payload.tenantId);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      tenantId: user.tenantId,
      accountStatus: user.accountStatus,
      twoFactorEnabled: user.twoFactorEnabled,
      emailVerifiedAt: user.emailVerifiedAt,
      impersonating: payload.impersonating || false,
      impersonatedBy: payload.impersonatedBy,
      permissions,
    };
  }
}
