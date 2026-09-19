import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DrizzleService } from '../../database/drizzle.service';
import { users } from '../../database/schema/users';
import { eq } from 'drizzle-orm';

@Injectable()
export class AuthService {
  constructor(
    private drizzle: DrizzleService,
    private jwt: JwtService,
  ) {}

  async validateUser(email: string, _password: string) {
    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwt.sign(payload),
      refreshToken: this.jwt.sign(payload, { expiresIn: '7d' }),
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwt.verify(token, { ignoreExpiration: false });
      return this.login({ id: payload.sub, email: payload.email, role: payload.role });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
