'use client';

import { Fragment, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { safeExternalHref, safeInternalHref } from '@/lib/safe-href';
import { cn } from '@/lib/utils';

/**
 * Markdown for assistant answers.
 *
 * Two decisions worth stating:
 *
 *  1. It emits React elements, never an HTML string. There is no
 *     `dangerouslySetInnerHTML` anywhere, so a model that emits `<script>` or an
 *     `onerror` attribute renders as visible text instead of executing. No
 *     sanitizer to keep patched, no dependency to audit.
 *
 *  2. It covers the subset models actually produce — headings, emphasis, lists,
 *     quotes, code, tables, rules and links — and degrades anything else to
 *     plain text. Half-rendering an exotic construct is better than pretending
 *     to be a full CommonMark implementation.
 *
 * Citation markers `[1]` and `[W1]` become chips: the model's evidence is
 * tappable instead of being something a member has to eyeball.
 */

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h'; level: 2 | 3 | 4; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; language: string | null; code: string }
  | { kind: 'hr' }
  | { kind: 'table'; head: string[]; rows: string[][] };

const HEADINGS = /^(#{2,4})\s+(.*)$/;
const FENCE = /^```([A-Za-z0-9+#-]*)\s*$/;
const UNORDERED = /^[-*+]\s+(.*)$/;
const ORDERED = /^\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^([-*_])\s*(\1\s*){2,}$/;
const TABLE_DIVIDER = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

export function parseMarkdownBlocks(source: string): Block[] {
  const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line.trim());
    if (fence) {
      const language = fence[1] ? fence[1].toLowerCase() : null;
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE.test(lines[index]!.trim())) {
        body.push(lines[index]!);
        index += 1;
      }
      index += 1; // closing fence (or EOF)
      blocks.push({ kind: 'code', language, code: body.join('\n') });
      continue;
    }

    if (RULE.test(line.trim())) {
      blocks.push({ kind: 'hr' });
      index += 1;
      continue;
    }

    const heading = HEADINGS.exec(line.trim());
    if (heading) {
      blocks.push({
        kind: 'h',
        level: Math.min(heading[1]!.length, 4) as 2 | 3 | 4,
        text: heading[2]!.trim(),
      });
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index]!)) {
        body.push(QUOTE.exec(lines[index]!)![1] ?? '');
        index += 1;
      }
      blocks.push({ kind: 'quote', text: body.join(' ') });
      continue;
    }

    // Pipe table: a header row followed by a divider row.
    if (line.includes('|') && TABLE_DIVIDER.test(lines[index + 1]?.trim() ?? '')) {
      const cells = (row: string) =>
        row
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((cell) => cell.trim());
      const head = cells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index]!.includes('|') && lines[index]!.trim()) {
        rows.push(cells(lines[index]!));
        index += 1;
      }
      blocks.push({ kind: 'table', head, rows });
      continue;
    }

    if (UNORDERED.test(line.trim())) {
      const items: string[] = [];
      while (index < lines.length && UNORDERED.test(lines[index]!.trim())) {
        items.push(UNORDERED.exec(lines[index]!.trim())![1] ?? '');
        index += 1;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (ORDERED.test(line.trim())) {
      const items: string[] = [];
      while (index < lines.length && ORDERED.test(lines[index]!.trim())) {
        items.push(ORDERED.exec(lines[index]!.trim())![1] ?? '');
        index += 1;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    // Paragraph: consume until a blank line or the start of another block.
    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index]!;
      if (
        !current.trim() ||
        HEADINGS.test(current.trim()) ||
        FENCE.test(current.trim()) ||
        UNORDERED.test(current.trim()) ||
        ORDERED.test(current.trim()) ||
        QUOTE.test(current) ||
        RULE.test(current.trim())
      ) {
        break;
      }
      paragraph.push(current.trim());
      index += 1;
    }
    if (paragraph.length) blocks.push({ kind: 'p', text: paragraph.join(' ') });
  }

  return blocks;
}

const INLINE = new RegExp(
  [
    '\\[([^\\]]{1,80})\\]\\((https?:\\/\\/[^)\\s]+|\\/[^)\\s]*)\\)', // [text](href)
    '`([^`]+)`', // `code`
    '\\*\\*([^*]+)\\*\\*', // **bold**
    '(?<![*\\w])\\*([^*\\n]+)\\*(?![*\\w])', // *italic*
    '~~([^~]+)~~', // ~~strike~~
  ].join('|'),
  'g',
);

/** `[1]` and `[W2]` become evidence chips; anything else in brackets stays text. */
const CITATION = /^\[((?:W)?\d{1,3})\]$/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let ordinal = 0;

  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > cursor) out.push(text.slice(cursor, match.index));
    const key = `${keyPrefix}-${(ordinal += 1)}`;

    if (match[1] !== undefined && match[2] !== undefined) {
      const label = match[1];
      const href = match[2];
      const internal = safeInternalHref(href);
      const external = internal ? null : safeExternalHref(href);
      if (internal) {
        out.push(
          <a
            key={key}
            href={internal}
            className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary"
          >
            {label}
          </a>,
        );
      } else if (external) {
        out.push(
          <a
            key={key}
            href={external}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-baseline gap-0.5 font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary"
          >
            {label}
            <ExternalLink className="size-2.5 shrink-0 translate-y-px" aria-hidden />
          </a>,
        );
      } else {
        // A link the safety layer would reject is shown, never followed.
        out.push(
          <span key={key} className="font-medium text-muted-foreground underline decoration-dotted">
            {label}
          </span>,
        );
      }
    } else if (match[3] !== undefined) {
      out.push(
        <code
          key={key}
          className="rounded border border-border/70 bg-muted px-1 py-px font-mono text-[0.85em] text-foreground"
        >
          {match[3]}
        </code>,
      );
    } else if (match[4] !== undefined) {
      out.push(
        <strong key={key} className="font-semibold text-foreground">
          {match[4]}
        </strong>,
      );
    } else if (match[5] !== undefined) {
      out.push(
        <em key={key} className="italic">
          {match[5]}
        </em>,
      );
    } else if (match[6] !== undefined) {
      out.push(
        <span key={key} className="line-through opacity-70">
          {match[6]}
        </span>,
      );
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

/** Split on citation markers so each can become a chip. */
function renderWithCitations(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\[(?:W)?\d{1,3}\])/g);
  return parts.map((part, position) => {
    const citation = CITATION.exec(part.trim());
    if (!citation) {
      return part ? (
        <Fragment key={`${keyPrefix}-t${position}`}>{renderInline(part, `${keyPrefix}-t${position}`)}</Fragment>
      ) : null;
    }
    const label = citation[1]!;
    const isWeb = label.startsWith('W');
    return (
      <a
        key={`${keyPrefix}-c${position}`}
        href="#ai-evidence"
        title={isWeb ? 'Web source' : 'TITANS source'}
        className={cn(
          'mx-0.5 inline-flex translate-y-[-1px] items-center rounded border px-1 font-mono text-[0.68rem] font-semibold leading-4 no-underline transition-colors',
          isWeb
            ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
            : 'border-border bg-muted text-muted-foreground hover:bg-muted/70',
        )}
      >
        {label}
      </a>
    );
  });
}

export function AiMarkdown({ content, className }: { content: string; className?: string }) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className={cn('space-y-3 text-sm leading-relaxed text-foreground', className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.kind) {
          case 'h': {
            const level = block.level;
            // Fact-check answers lead with SUPPORTED / UNSUPPORTED / UNKNOWN, so
            // these headings are the structure a member actually scans.
            const tone =
              /supported|مدعوم/i.test(block.text) && !/un|غير/i.test(block.text)
                ? 'text-success'
                : /unsupported|غير مدعوم/i.test(block.text)
                  ? 'text-destructive'
                  : /unknown|غير معروف/i.test(block.text)
                    ? 'text-muted-foreground'
                    : 'text-foreground';
            return level === 2 ? (
              <h2
                key={key}
                className={cn('mt-1 font-display text-base font-semibold tracking-tight', tone)}
              >
                {renderWithCitations(block.text, key)}
              </h2>
            ) : level === 3 ? (
              <h3
                key={key}
                className={cn(
                  'mt-1 flex items-center gap-2 font-mono text-2xs font-semibold uppercase tracking-[0.14em]',
                  tone,
                )}
              >
                <span className="inline-block h-3 w-0.5 rounded-full bg-current opacity-60" aria-hidden />
                {renderWithCitations(block.text, key)}
              </h3>
            ) : (
              <h4 key={key} className="mt-1 font-display text-sm font-semibold text-foreground">
                {renderWithCitations(block.text, key)}
              </h4>
            );
          }
          case 'ul':
            return (
              <ul key={key} className="space-y-1.5 ps-1">
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`} className="flex gap-2">
                    <span className="mt-[0.45em] size-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
                    <span className="min-w-0 flex-1">{renderWithCitations(item, `${key}-${itemIndex}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} className="space-y-1.5">
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`} className="flex gap-2.5">
                    <span className="mt-px inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[0.65rem] font-semibold text-primary">
                      {itemIndex + 1}
                    </span>
                    <span className="min-w-0 flex-1">{renderWithCitations(item, `${key}-${itemIndex}`)}</span>
                  </li>
                ))}
              </ol>
            );
          case 'quote':
            return (
              <blockquote
                key={key}
                className="border-s-2 border-primary/40 bg-primary/5 px-3 py-2 text-muted-foreground"
              >
                {renderWithCitations(block.text, key)}
              </blockquote>
            );
          case 'code':
            return (
              <pre
                key={key}
                dir="ltr"
                className="overflow-x-auto rounded-lg border border-border bg-surface-sunken p-3 font-mono text-xs leading-relaxed text-foreground"
              >
                <code>{block.code}</code>
              </pre>
            );
          case 'hr':
            return <hr key={key} className="border-border/70" />;
          case 'table':
            return (
              <div key={key} className="overflow-x-auto">
                <table className="w-full border-collapse text-start text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {block.head.map((cell, cellIndex) => (
                        <th
                          key={`${key}-h${cellIndex}`}
                          className="whitespace-nowrap px-2 py-1.5 text-start font-mono text-2xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {renderWithCitations(cell, `${key}-h${cellIndex}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={`${key}-r${rowIndex}`} className="border-b border-border/50 last:border-0">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${key}-${rowIndex}-${cellIndex}`}
                            className="px-2 py-1.5 align-top"
                          >
                            {renderWithCitations(cell, `${key}-${rowIndex}-${cellIndex}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'p':
          default:
            return <p key={key}>{renderWithCitations(block.text, key)}</p>;
        }
      })}
    </div>
  );
}
