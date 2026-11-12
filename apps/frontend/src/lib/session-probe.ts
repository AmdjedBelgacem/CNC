import { api, refreshSessionOutcome } from '@/lib/api-client';

interface SessionResponse {
  authenticated: boolean;
  user: (Record<string, unknown> & { id?: string }) | null;
  /** No valid access token, but a refresh cookie exists. */
  refreshable?: boolean;
}

export type SessionUser = (Record<string, unknown> & { id?: string }) | null;

let inFlight: Promise<SessionUser> | null = null;

async function readSession(): Promise<SessionUser> {
  let session = await api.get<SessionResponse>('/auth/session');
  if (session.authenticated) return session.user;
  // Only rotate when there is something to rotate. A truly anonymous visitor makes one
  // request that answers 200, so nothing fails and nothing is logged.
  if (session.refreshable) {
    const outcome = await refreshSessionOutcome();
    // A busy or unreachable server is not a sign-out: reject, so callers keep the current user
    // and try again, instead of clearing the session and bouncing to /login.
    if (outcome === 'unavailable') throw new Error('Session check unavailable');
    if (outcome === 'renewed') {
      session = await api.get<SessionResponse>('/auth/session');
      if (session.authenticated) return session.user;
    }
  }
  return null;
}

/**
 * "Who is signed in?" for the browser, answered without a failing request.
 *
 * Concurrent callers share one probe, so mounting several consumers on a page never
 * multiplies the requests. Rejects only on a transport failure (network, 5xx), which is the
 * one case where retrying makes sense.
 */
export function probeSession(): Promise<SessionUser> {
  if (!inFlight) {
    inFlight = readSession().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
