import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '../../../config/config.service';
import { callbackOrigin } from './oauth-callback-url';
import { StatelessOAuthStateStore } from './stateless-oauth-state.store';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get('GITHUB_CLIENT_ID') || 'missing',
      clientSecret: config.get('GITHUB_CLIENT_SECRET') || 'missing',
      callbackURL: `${callbackOrigin(config)}/auth/oauth/github/callback`,
      scope: ['user:email'],
      // See google.strategy.ts — no req.session in this app, so passport needs a store.
      store: new StatelessOAuthStateStore(),
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
