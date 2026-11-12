import { Throttle } from '@nestjs/throttler';
import { Controller, Get, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './services/auth.service';
import { OptionalAuthGuard } from './guards/optional-auth.guard';

/**
 * "Is anybody signed in?", answered without ever failing.
 *
 * The client asks this on every page load to restore its session. Pointed at `/auth/me`, an
 * anonymous visitor got a 401 — which the API client then answered with a `/auth/refresh` that
 * 401'd as well: two doomed requests and two console errors on every public page load, purely to
 * learn something the server already knew. A 401 for "nobody is logged in" is also semantically
 * wrong, since the question was answered correctly.
 *
 * This lives in its own controller rather than as a route on `AuthController`, because Nest runs
 * controller-level guards *in addition to* method-level ones: `@UseGuards(OptionalAuthGuard)`
 * beside `AuthController`'s `@UseGuards(JwtAuthGuard, …)` still 401s. `/auth/me` keeps its 401
 * for callers that genuinely need a subject.
 */
@ApiTags('auth')
@Controller('auth')
// No tenant guard: this resolves the caller by user id, and requiring `X-Tenant-Slug` on a
// probe that runs on every anonymous page load would turn it into a 403 for anyone whose
// tenant header has not resolved yet — the same console noise in a different shape.
@UseGuards(OptionalAuthGuard)
export class AuthSessionController {
  constructor(private readonly auth: AuthService) {}

  // Called on every page view; its own ceiling keeps a busy page from reading as signed out.
  @Throttle({ default: { ttl: 60_000, limit: 300 } })
  @Get('session')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report whether a session is active, without failing when it is not' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        authenticated: { type: 'boolean' },
        user: { type: 'object', additionalProperties: true, nullable: true },
        refreshable: {
          type: 'boolean',
          description: 'No valid access token, but a refresh cookie is present: refresh before treating the caller as signed out.',
        },
      },
    },
  })
  async getSession(@CurrentUser() user: any, @Req() req: { cookies?: Record<string, string | undefined> }) {
    if (!user?.id) {
      // An expired access token with a live refresh cookie is a session that needs rotating,
      // not an anonymous visitor. Saying so lets the client refresh only when it can succeed,
      // instead of probing a 401 route and refreshing blind on every page load.
      const refreshable = Boolean(
        req.cookies?.['refresh-token'] || req.cookies?.['__Host-refresh'] || req.cookies?.['__refresh-fallback'],
      );
      return { authenticated: false, user: null, refreshable };
    }
    return { authenticated: true, user: await this.auth.getProfile(user.id), refreshable: false };
  }
}
