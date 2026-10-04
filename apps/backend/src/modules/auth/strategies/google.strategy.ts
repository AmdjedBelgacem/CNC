import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '../../../config/config.service';
import { callbackOrigin } from './oauth-callback-url';
import { StatelessOAuthStateStore } from './stateless-oauth-state.store';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID') || 'missing',
      clientSecret: config.get('GOOGLE_CLIENT_SECRET') || 'missing',
      callbackURL: `${callbackOrigin(config)}/auth/oauth/google/callback`,
      scope: ['email', 'profile'],
      // Required: without a store (or a truthy `state`) passport installs NullStore,
      // which throws because this app has no req.session. See the store's doc comment.
      store: new StatelessOAuthStateStore(),
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
