/**
 * Session-free state store for passport-oauth2.
 *
 * passport-oauth2 always needs a state store: without `options.store` or a truthy
 * `options.state` it installs `NullStore`, whose `store()` throws ("OAuth2Strategy
 * requires a session to store the state"). Its real stores (StateStore/NonceStore)
 * all persist into `req.session`, which this app never provides — it is stateless,
 * using JWT cookies and no session middleware. The result was a 500
 * ("res.setHeader is not a function") on every Google/GitHub connect attempt.
 *
 * This store only mints and echoes an opaque nonce. CSRF protection is NOT weakened:
 * the authoritative check is AuthController.finishOauth, which consumes the state
 * from the `oauth_states` table (and Redis) through consumeOauthState and rejects
 * anything unknown or expired. Callers mint a real state via GET /auth/oauth/state
 * first, then pass it as `?state=`.
 */
export class StatelessOAuthStateStore {
  /**
   * Passport branches on `.length`, so these arities must stay exactly 3 and 4.
   * store.length === 3 -> store(req, meta, callback)
   * verify.length === 4 -> verify(req, state, meta, callback)
   */
  store(_req: unknown, _meta: unknown, callback: (err: unknown, state: string) => void): void {
    callback(null, '');
  }

  verify(
    _req: unknown,
    state: string | undefined,
    _meta: unknown,
    callback: (err: unknown, ok?: boolean, info?: unknown) => void,
  ): void {
    // The caller's state travels to the provider untouched so finishOauth can
    // validate it against the persisted record.
    callback(null, true, state);
  }
}