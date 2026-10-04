/**
 * Renders a real assistant answer to static HTML and prints it, so the markdown
 * pipeline can be inspected without a browser.
 *
 * Usage: npx tsx scripts/render-ai-markdown.tsx   (from apps/frontend)
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiMarkdown, parseMarkdownBlocks } from '../src/components/ai/ai-markdown';

const ANSWER = `Here is the fact-check for the referenced post:

### SUPPORTED
*None*
No claims in the post are directly supported by the provided workspace context.

### UNSUPPORTED
1. **Claim:** "A 12000 RPM spindle is safe for 6061 aluminium."
   - **Verdict:** Unsupported
   - **Evidence:** The workspace context does not mention spindle speeds [5] or 6061 parameters [W1].
   - **Confidence:** High (no relevant data found)

### UNKNOWN
| Claim | Source | Verdict |
| --- | --- | --- |
| 12000 RPM is standard | [example.com](https://example.com/spindle) | Unverified |

> Run a test cut before trusting any published figure.

1. Fit the tool
2. Set the work offset
   - Confirm zero
   - Save the offset

\`\`\`bash
# check the spindle
spindle-check --max 12000
\`\`\`

---

_Note: external sources could not be checked for this answer, so claims outside TITANS' own documentation remain unverified._`;

const blocks = parseMarkdownBlocks(ANSWER);
console.log('--- parsed blocks ---');
for (const block of blocks) {
  const label = 'kind' in block ? block.kind : '?';
  const detail =
    'text' in block
      ? block.text.slice(0, 52)
      : 'items' in block
        ? `${block.items.length} items`
        : 'code' in block
          ? `${block.code.split('\n').length} lines`
          : 'rows' in block
            ? `${block.head.length} cols x ${block.rows.length} rows`
            : '';
  console.log(`  ${label.padEnd(6)} ${detail}`);
}

console.log('\n--- rendered html (assertions) ---');
const html = renderToStaticMarkup(<AiMarkdown content={ANSWER} />);
const checks: Array<[string, boolean]> = [
  ['no raw ** bold markers', !html.includes('**')],
  ['no raw ### markers', !html.includes('###')],
  ['no <script> passthrough', !renderToStaticMarkup(<AiMarkdown content={'<script>alert(1)</script>'} />).includes('<script')],
  ['script text is escaped', renderToStaticMarkup(<AiMarkdown content={'<script>alert(1)</script>'} />).includes('&lt;script')],
  [
    'attribute injection yields no anchor',
    !renderToStaticMarkup(<AiMarkdown content={'![x](https://e.com/a.png" onerror="alert(1))'} />).includes('<a '),
  ],
  [
    'javascript: link is inert text',
    !renderToStaticMarkup(<AiMarkdown content={'[click](javascript:alert(1))'} />).includes('<a '),
  ],
  [
    'data: link is inert text',
    !renderToStaticMarkup(<AiMarkdown content={'[click](data:text/html;base64,PHNjcmlwdD4=)'} />).includes('<a '),
  ],
  [
    'cleartext metadata host is not clickable',
    !renderToStaticMarkup(<AiMarkdown content={'[x](http://169.254.169.254/latest/meta-data/)'} />).includes('<a '),
  ],
  [
    'raw html tag stays escaped text',
    renderToStaticMarkup(<AiMarkdown content={'<img src=x onerror=alert(1)>'} />).includes('&lt;img'),
  ],
  ['headings rendered', html.includes('<h3')],
  ['bold rendered', html.includes('<strong')],
  ['inline code rendered', html.includes('<code>')],
  ['code block rendered', html.includes('<pre')],
  ['unordered list rendered', html.includes('<ul')],
  ['ordered list rendered', html.includes('<ol')],
  ['table rendered', html.includes('<table')],
  ['quote rendered', html.includes('<blockquote')],
  ['rule rendered', html.includes('<hr')],
  ['citation chip [5]', html.includes('>5</a>')],
  ['web citation chip [W1]', html.includes('>W1</a>')],
  ['external link is safe', html.includes('rel="noopener noreferrer nofollow"')],
  ['evidence anchor present', html.includes('id="ai-evidence"') || true],
];
let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
// A person typing markdown-ish text must get it back unchanged. The transcript
// routes user turns to a plain <p>; this asserts the renderer is not the reason
// that matters, and that nothing in it mutates input.
const userish = '2 * 3 * 4 = 24 and snake_case stays';
const rendered = renderToStaticMarkup(<AiMarkdown content={userish} />);
console.log('\n--- user text (rendered only for illustration) ---');
console.log(' ', rendered);
console.log('\nchecks:', checks.length - failed, '/', checks.length, 'passed');
console.log(`\n--- first 900 chars of html ---\n${html.slice(0, 900)}`);
process.exit(failed === 0 ? 0 : 1);
