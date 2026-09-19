import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '../../../config/config.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get('GITHUB_CLIENT_ID') || 'missing',
      clientSecret: config.get('GITHUB_CLIENT_SECRET') || 'missing',
      callbackURL: `${config.get('FRONTEND_URL') || 'http://localhost:3000'}/api/auth/github/callback`,
      scope: ['user:email'],
    } as any);
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: (err: any, user?: any) => void,
  ): Promise<any> {
    const email = profile.emails?.[0]?.value || `${profile.username}@github.com`;
    const user = {
      email,
      name: profile.displayName || profile.username || email.split('@')[0],
      avatarUrl: profile.photos?.[0]?.value,
      provider: 'github',
      providerAccountId: profile.id,
    };
    done(null, user);
  }
}
