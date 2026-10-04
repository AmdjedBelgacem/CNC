/**
 * Secret redaction for log lines and error messages.
 *
 * The app holds several long-lived credentials (Supabase secret key, S3 secret key,
 * Resend API key, JWT secrets, and the database password embedded in DATABASE_URL).
 * Any of them can reach a log line through a thrown error, a driver message, or an
 * echoed config value. Redacting at the point of output is cheaper than auditing every
 * log call site.
 */

/** Keys whose values are always secret, matched case-insensitively on the key name. */
const SECRET_KEY_PATTERN =
  /(pass(word)?|secret|token|api[_-]?key|apikey|authorization|credential|private[_-]?key|access[_-]?key|refresh)/i;

/**
 * Strips credentials from a connection string so host/db stay useful in logs.
 * postgresql://user:pass@host/db -> postgresql://user:***@host/db
 */
export function redactConnectionString(value: string): string {
  return value.replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+):[^\s@/]*@/gi, '$1:***@');
}

/** Replaces anything that looks like a known credential shape with a marker. */
export function redactSecrets(input: unknown): string {
  let text = typeof input === 'string' ? input : safeStringify(input);
  text = redactConnectionString(text);
  text = text
    .replace(/\bsb_secret_[\w-]+/g, 'sb_secret_[redacted]')
    .replace(/\bsb_publishable_[\w-]+/g, 'sb_publishable_[redacted]')
    .replace(/\bre_[\w-]{20,}/g, 're_[redacted]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, 'AKIA[redacted]')
    .replace(/\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}\b/g, '[jwt-redacted]')
    // key=value / key: value inside free text and JSON-ish log payloads
    .replace(
      /("(?:[^"]*)"|'[^']*'|\b[\w.-]+)(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&)}\]]+)/g,
      (match: string, key: string, sep: string) =>
        SECRET_KEY_PATTERN.test(key) ? `${key}${sep}"[redacted]"` : match,
    );
  return text;
}

function safeStringify(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
  } catch {
    return String(value);
  }
}

/** Convenience for logging an unknown thrown value safely. */
export function safeErrorText(error: unknown): string {
  if (error instanceof Error) {
    return redactSecrets(`${error.name}: ${error.message}`);
  }
  return redactSecrets(error);
}
