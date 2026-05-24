// eslint-disable-next-line @typescript-eslint/no-var-requires
const _marked = (require('marked') as { parse: (s: string) => string }).parse;

/**
 * Fixes two types of broken formula output from AI models:
 * Type 1: $...$  inside $$...$$ — strips inner $$ delimiters
 * Type 2: line with $...$ fragments mixed with raw LaTeX (\cmd) outside — wraps whole line in $$...$$
 *
 * Also de-indents $$...$$ formulas: if the AI outputs them with 4-space indent,
 * marked converts them to <code> blocks and KaTeX auto-render ignores them.
 */
export function fixBrokenFormulas(markdown: string): string {
  // Pre-step: remove leading whitespace from lines that start with $$
  // This prevents marked from treating indented $$...$$ as code blocks.
  let result = markdown.replace(/^[ \t]+(\$\$)/gm, '$1');

  // Type 1: strip $...$ inside $$...$$
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_, inner) => {
    const fixed = inner.replace(/\$([^$\n]+?)\$/g, '$1');
    return `$$${fixed}$$`;
  });

  // Type 2: lines with $...$ fragments + raw LaTeX commands outside → wrap in $$...$$
  result = result.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('$$') || !trimmed.includes('$')) return line;

    const hasInlineDollar = /\$[^$\n]+\$/.test(trimmed);
    if (!hasInlineDollar) return line;

    const afterStrip = trimmed.replace(/\$([^$\n]+?)\$/g, '$1');
    const hasLatexOutside = /\\[a-zA-Z]+/.test(afterStrip);

    if (hasLatexOutside) {
      const fixed = trimmed.replace(/\$([^$\n]+?)\$/g, '$1');
      return `$$${fixed}$$`;
    }
    return line;
  }).join('\n');

  return result;
}

/**
 * Safely renders Markdown with formula support: extracts formulas BEFORE marked
 * so marked doesn't corrupt them. Formulas are restored as $$...$$ / $...$ for
 * KaTeX auto-render (renderMathInElement) to pick up.
 */
export function safeMdParse(value: string): string {
  const fixed = fixBrokenFormulas(value);

  const mathStore: Array<{ type: 'block' | 'inline'; latex: string }> = [];
  let text = fixed;

  // Multi-line block formulas: $$ must be on its own line (backend-normalized format).
  // Using line-anchored regex prevents a stray unclosed $$ from eating all subsequent
  // content up to the next $$ occurrence.
  text = text.replace(/\$\$[ \t]*\n([\s\S]+?)\n[ \t]*\$\$/g, (_, latex) => {
    mathStore.push({ type: 'block', latex });
    return `\n\nMATHHOLDER${mathStore.length - 1}END\n\n`;
  });
  // Single-line block formulas: $$formula$$ on one line (no newlines inside).
  text = text.replace(/\$\$([^$\n]+?)\$\$/g, (_, latex) => {
    mathStore.push({ type: 'block', latex });
    return `\n\nMATHHOLDER${mathStore.length - 1}END\n\n`;
  });
  // Inline formulas: $formula$ — no newlines to prevent cross-line mismatches.
  text = text.replace(/\$([^$\n]+?)\$/g, (_, latex) => {
    mathStore.push({ type: 'inline', latex });
    return `MATHHOLDER${mathStore.length - 1}END`;
  });

  let html = _marked(text);

  html = html.replace(/MATHHOLDER(\d+)END/g, (_, idx) => {
    const { type, latex } = mathStore[Number(idx)];
    return type === 'block' ? `$$${latex}$$` : `$${latex}$`;
  });

  return html;
}
