// eslint-disable-next-line @typescript-eslint/no-var-requires
const _marked = (require('marked') as { parse: (s: string) => string }).parse;

/**
 * Fixes two types of broken formula output from AI models:
 * Type 1: $...$  inside $$...$$ — strips inner $$ delimiters
 * Type 2: line with $...$ fragments mixed with raw LaTeX (\cmd) outside — wraps whole line in $$...$$
 */
export function fixBrokenFormulas(markdown: string): string {
  // Type 1: strip $...$ inside $$...$$
  let result = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (_, inner) => {
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

  // Placeholders without underscores to avoid marked italic parsing
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => {
    mathStore.push({ type: 'block', latex });
    return `MATHHOLDER${mathStore.length - 1}END`;
  });
  text = text.replace(/\$([^$]+?)\$/g, (_, latex) => {
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
