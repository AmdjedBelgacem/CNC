import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '../../../config/config.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID') || 'missing',
      clientSecret: config.get('GOOGLE_CLIENT_SECRET') || 'missing',
      callbackURL: `${config.get('FRONTEND_URL') || 'http://localhost:3000'}/api/auth/google/callback`,
      scope: ['email', 'profile'],
    } as any);
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: (err: any, user?: any) => void,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const user = {
      email: emails?.[0]?.value,
      name: name?.givenName
        ? `${name.givenName} ${name.familyName || ''}`.trim()
        : emails?.[0]?.value?.split('@')[0] || 'User',
      avatarUrl: photos?.[0]?.value,
      provider: 'google',
      providerAccountId: profile.id,
    };
    done(null, user);
  }
}
