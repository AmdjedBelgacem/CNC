import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { ConfigService } from '../../../config/config.service';

@Injectable()
export class CsrfService implements OnModuleInit {
  private secret: string = '';

  constructor(private config: ConfigService) {}

  onModuleInit() {
    // P1: stable secret derived from AUTH_SECRET (survives restarts / multi-instance)
    // Fallback to random if not configured, but warn.
    const authSecret = this.config.get('AUTH_SECRET') || process.env.AUTH_SECRET;
    if (authSecret && authSecret !== 'cookie-secret-change-me' && authSecret.length >= 16) {
      this.secret = createHash('sha256').update(`csrf:${authSecret}`).digest('hex');
    } else {
      this.secret = randomBytes(32).toString('hex');
    }
  }

  generateToken(): string {
    const token = randomBytes(32).toString('hex');
    const hmac = this.sign(token);
    return `${token}.${hmac}`;
  }

  validateToken(token: string): boolean {
    const dotIndex = token.indexOf('.');
    if (dotIndex === -1) return false;
    const value = token.slice(0, dotIndex);
    const sig = token.slice(dotIndex + 1);
    if (!value || !sig) return false;
    const expectedSig = this.sign(value);
    return this.constantTimeEqual(sig, expectedSig);
  }

  private sign(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('hex');
  }

  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      let result = a.length ^ b.length;
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
      }
      return result === 0;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}
