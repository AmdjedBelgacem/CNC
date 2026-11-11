import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

/**
 * The provider sends the browser to our callback, so a failure there (the user pressed "Deny",
 * the code expired, the state did not match, the address was unverified) lands on a page the
 * person is looking at. A JSON 500 is not an answer to a person: send them back to the sign-in
 * screen with a reason it can show.
 */
export type OauthFailureReason = 'denied' | 'invalid_state' | 'unverified_email' | 'failed';

export function oauthFailureReason(exception: unknown, query: Record<string, unknown> = {}): OauthFailureReason {
  if (query.error === 'access_denied') return 'denied';
  const message = exception instanceof HttpException ? JSON.stringify(exception.getResponse()) : String((exception as Error)?.message ?? '');
  if (/state/i.test(message)) return 'invalid_state';
  if (/verified email/i.test(message)) return 'unverified_email';
  return 'failed';
}

export function oauthFailureUrl(frontend: string, reason: OauthFailureReason | 'unavailable'): string {
  const url = new URL('/login', frontend);
  url.searchParams.set('error', `oauth_${reason}`);
  return url.toString();
}

@Catch()
export class OauthFailureFilter implements ExceptionFilter {
  private readonly log = new Logger('OauthFailureFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<{ query?: Record<string, unknown> }>();
    const reply = http.getResponse<{ redirect: (url: string, status?: number) => unknown }>();
    const reason = oauthFailureReason(exception, request.query ?? {});
    this.log.warn(`OAuth callback failed (${reason}): ${(exception as Error)?.message ?? exception}`);
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    return reply.redirect(oauthFailureUrl(frontend, reason), 302);
  }
}
