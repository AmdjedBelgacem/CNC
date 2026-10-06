/**
 * The variable grammar for email templates.
 *
 * This is deliberately NOT Handlebars. Two reasons, both security-relevant:
 *
 *  1. Handlebars' safety depends on the helper set in use, and its ecosystem has
 *     a long history of template-injection CVEs (`lookup`, prototype access,
 *     `{{#with}}` over `__proto__`). Our variable surface is small and closed,
 *     so a ~200 line grammar we fully control is cheaper than auditing a
 *     dependency's helpers.
 *  2. We need to REJECT unknown tokens rather than silently render an empty
 *     string, because a receipt with a missing total is worse than a failed
 *     send. Retrofitting that onto Handlebars means post-processing its parse
 *     tree, which is where the interesting bugs live.
 *
 * Supported forms:
 *   {{path.to.value}}
 *   {{path.to.value | "fallback"}}
 *   {{#if path}}…{{/if}}
 *   {{#unless path}}…{{/unless}}
 *   {{#each path}}…{{/each}}      exposes {{this}}, {{this.field}}, {{@index}},
 *                                  {{@first}}, {{@last}}
 *
 * Not supported, by design: helpers, subexpressions, partials, comments,
 * triple braces, and any raw-HTML block helper.
 */

/** Keys that must never be walked, even as an own property. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const TOKEN_RE = /\{\{\s*([#/]?)\s*([^{}]*?)\s*\}\}/g;

export class EmailRenderError extends Error {
  constructor(
    message: string,
    readonly token?: string,
  ) {
    super(message);
    this.name = 'EmailRenderError';
    Object.setPrototypeOf(this, EmailRenderError.prototype);
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface InterpolateOptions {
  /** Applied to every substituted value. Identity for the plain-text stage. */
  escape: (value: string) => string;
  /**
   * Closed allowlist of permitted root paths. When provided, any token outside it
   * throws. This is what makes a template bound to `order.paid` unable to read
   * `course.title`: the token is not in the trigger's contract, so it is a
   * programming error rather than a runtime surprise.
   *
   * When omitted (admin preview against a template with no binding yet) every
   * well-formed token is allowed and simply resolves to empty.
   */
  allowedPaths?: readonly string[];
}

interface Scope {
  values: Record<string, unknown>;
  /** Path this scope was bound to, for `@root`-less loops. */
  eachPath?: string;
}

/**
 * Walk a dotted path across the scope stack. Returns `undefined` when absent so
 * callers can decide between "soft" (a conditional testing for presence) and
 * "strict" (a substitution that must produce a value).
 */
function resolvePath(path: string, stack: Scope[]): unknown {
  const segments = path.split('.').filter((s) => s.length > 0);
  if (segments.length === 0) return undefined;
  for (const seg of segments) {
    if (FORBIDDEN_KEYS.has(seg)) {
      throw new EmailRenderError(`Refusing to resolve forbidden path segment "${seg}"`, path);
    }
  }

  let current: unknown;
  let consumed = 0;
  let found = false;

  for (const scope of stack) {
    if (!(segments[0]! in scope.values)) continue;
    current = scope.values[segments[0]!];
    consumed = 1;
    found = true;
    break;
  }
  if (!found) return undefined;

  for (let i = consumed; i < segments.length; i++) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    const key = segments[i]!;
    if (FORBIDDEN_KEYS.has(key)) {
      throw new EmailRenderError(`Refusing to resolve forbidden path segment "${key}"`, path);
    }
    // Own properties only: never traverse the prototype chain, so a payload
    // cannot expose Object.prototype members to a template.
    if (!Object.prototype.hasOwnProperty.call(current, key)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function isTruthy(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  // 0 is falsy here, deliberately diverging from Handlebars: a conditional on a
  // discount or quantity should not render "Discount: 0".
  if (typeof value === 'number') return !Number.isNaN(value) && value !== 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return Boolean(value);
}

/** Human-facing rendering of a resolved value. Formatting is the emitter's job. */
function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(stringify).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

interface Token {
  kind: 'var' | 'open' | 'close';
  /** For `var`: the expression. For `open`/`close`: the block name. */
  value: string;
  raw: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let cursor = 0;
  while ((match = TOKEN_RE.exec(input)) !== null) {
    if (match.index > cursor) {
      tokens.push({ kind: 'var', value: input.slice(cursor, match.index), raw: input.slice(cursor, match.index) });
    }
    const sigil = match[1] ?? '';
    const body = match[2] ?? '';
    if (sigil === '#') {
      const name = body.split(/\s+/)[0] ?? '';
      tokens.push({ kind: 'open', value: name, raw: match[0] });
    } else if (sigil === '/') {
      tokens.push({ kind: 'close', value: body.trim(), raw: match[0] });
    } else {
      tokens.push({ kind: 'var', value: body, raw: match[0] });
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < input.length) {
    tokens.push({ kind: 'var', value: input.slice(cursor), raw: input.slice(cursor) });
  }
  return tokens;
}

/** Split `path | "fallback"` into its parts. Only literal quoted fallbacks. */
function parseExpression(expr: string): { path: string; fallback?: string } {
  const pipe = expr.indexOf('|');
  if (pipe === -1) return { path: expr.trim() };
  const path = expr.slice(0, pipe).trim();
  const rawFallback = expr.slice(pipe + 1).trim();
  const match = /^(["'])([\s\S]*)\1$/.exec(rawFallback);
  return { path, fallback: match ? match[2] : rawFallback };
}

function assertAllowed(path: string, allowed?: readonly string[]): void {
  if (!allowed) return;
  if (!allowed.includes(path)) {
    throw new EmailRenderError(
      `Unknown variable "${path}". Declared for this template: ${allowed.join(', ') || '(none)'}`,
      path,
    );
  }
}

/**
 * Render `template` against `data`.
 *
 * Strictness is intentional: a missing variable with no fallback throws rather
 * than rendering an empty string. Conditionals resolve softly (so they can test
 * for absence), substitutions do not.
 */
export function interpolate(
  template: string,
  data: Record<string, unknown>,
  options: InterpolateOptions,
): string {
  const root: Scope = { values: data };
  return renderTokens(tokenize(template), [root], options, null);
}

/** Consume tokens from `i` until the matching close tag for `block`. */
function renderTokens(
  tokens: Token[],
  stack: Scope[],
  options: InterpolateOptions,
  openBlock: string | null,
): string {
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.kind === 'close') {
      // A close that does not belong to us: emit nothing and let the caller
      // handle it. Returning here would silently swallow unbalanced markup.
      if (openBlock === null || token.value !== openBlock) {
        throw new EmailRenderError(`Unexpected {{/${token.value}}}`, token.raw);
      }
      return out;
    }
    if (token.kind === 'open') {
      const name = token.value;
      if (name !== 'if' && name !== 'unless' && name !== 'each') {
        throw new EmailRenderError(`Unknown block {{#${name}}}`, token.raw);
      }
      // Find the matching close, honouring nesting of the same tag name.
      let depth = 1;
      let j = i + 1;
      while (j < tokens.length) {
        const t = tokens[j]!;
        if (t.kind === 'open' && t.value === name) depth++;
        else if (t.kind === 'close' && t.value === name) {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }
      if (depth !== 0) throw new EmailRenderError(`Unclosed {{#${name}}}`, token.raw);

      const inner = tokens.slice(i + 1, j);
      const header = openTagArgument(token.raw, name);
      out += renderBlock(name, header, inner, stack, options);
      i = j;
      continue;
    }

    // Plain text (no braces) passes through untouched.
    if (!token.raw.includes('{{')) {
      out += token.value;
      continue;
    }

    const { path, fallback } = parseExpression(token.value);
    assertAllowed(path, options.allowedPaths);
    const resolved = resolvePath(path, stack);
    if (resolved === undefined || resolved === null) {
      if (fallback !== undefined) {
        out += options.escape(fallback);
        continue;
      }
      throw new EmailRenderError(
        `Missing value for "${path}". Add a fallback like {{${path} | "—"}} or fix the payload.`,
        token.raw,
      );
    }
    out += options.escape(stringify(resolved));
  }
  return out;
}

/**
 * Pull the ARGUMENT out of an open tag, discarding the block name.
 * `{{#if order.hasInvoice}}` -> `order.hasInvoice`, not `if order.hasInvoice`.
 */
function openTagArgument(raw: string, name: string): string {
  return raw
    .replace(/^\{\{\s*#\s*/, '')
    .replace(/\s*\}\}$/, '')
    .trim()
    .replace(new RegExp(`^${name}\\s+`), '')
    .trim();
}

function renderBlock(
  name: string,
  header: string,
  bodyTokens: Token[],
  stack: Scope[],
  options: InterpolateOptions,
): string {
  if (name === 'if' || name === 'unless') {
    const { path } = parseExpression(header);
    assertAllowed(path, options.allowedPaths);
    // Soft: a conditional must be able to ask "is this absent?" without throwing.
    const truthy = isTruthy(resolvePath(path, stack));
    return (name === 'if') === truthy ? renderTokens(bodyTokens, stack, options, name) : '';
  }

  const { path } = parseExpression(header);
  assertAllowed(path, options.allowedPaths);
  const target = resolvePath(path, stack);
  const items = Array.isArray(target) ? target : [];
  return items
    .map((item, index) => {
      const child: Scope = {
        values: {
          this: item,
          '@index': index,
          '@first': index === 0,
          '@last': index === items.length - 1,
          '@length': items.length,
        },
        eachPath: path,
      };
      return renderTokens(bodyTokens, [...stack, child], options, null);
    })
    .join('');
}

/**
 * Every distinct variable token in a template, used to lint a draft in the
 * editor before it is ever published. Returns the paths as written.
 */
export function extractTokens(template: string): string[] {
  const found = new Set<string>();
  for (const token of tokenize(template)) {
    if (token.kind === 'open') {
      found.add(parseExpression(openTagArgument(token.raw, token.value)).path);
      continue;
    }
    if (token.kind !== 'var' || !token.raw.includes('{{')) continue;
    found.add(parseExpression(token.value).path);
  }
  return [...found].filter((t) => t.length > 0).sort();
}