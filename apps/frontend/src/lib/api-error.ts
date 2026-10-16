/**
 * Turn a non-2xx API response into a message worth showing an operator.
 *
 * The builder used `body?.message || 'Publish failed'`, which throws away the only two
 * things that make a failure diagnosable:
 *
 *   * Nest returns `message` as an **array** for validation failures, so `body.message`
 *     interpolated into a string as `"a,b"` with no spaces and no status;
 *   * an unhandled server fault returns `{"statusCode":500,"message":"Internal server
 *     error"}`, which tells the operator nothing except that it was not them — and
 *     critically, it does not say *which* request failed, so save and publish were
 *     indistinguishable in the UI.
 *
 * This keeps the status code in the text so a generic 500 is at least attributable, and
 * normalises the array form into a readable sentence.
 */
export async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  let body: { message?: unknown; error?: unknown } | null = null;
  try {
    body = (await response.json()) as { message?: unknown; error?: unknown };
  } catch {
    // A non-JSON body (proxy HTML error page, empty 502) leaves body null.
  }

  const raw = body?.message ?? body?.error;

  if (Array.isArray(raw)) {
    const joined = raw.filter((entry) => typeof entry === 'string').join('; ');
    if (joined) return joined;
  }

  if (typeof raw === 'string' && raw.trim() && raw !== 'Internal server error') {
    return raw;
  }

  // Either there was no message, or it was Nest's catch-all. Attach the status so the
  // operator can tell a 400 from a 500 from a gateway failure.
  return `${fallback} (HTTP ${response.status})`;
}
