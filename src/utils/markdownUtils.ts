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

  // Type 0: \left$ / \right$ are unambiguously broken AI output — AI confuses the
  // LaTeX group delimiter with the math $ sign. Replace with \left\{ / \right\}.
  result = result.replace(/\\left\$/g, '\\left\\{').replace(/\\right\$/g, '\\right\\}');

  // Type 1: strip $...$ inside $$...$$
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_, inner) => {
    const fixed = inner.replace(/\$([^$\n]+?)\$/g, '$1');
    return `$$${fixed}$$`;
  });

  // Type 2: lines with $...$ fragments + raw LaTeX commands outside → wrap in $$...$$
  // Skip headings (#), table rows (|), blockquotes (>) — they're never pure math lines.
  result = result.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('$$') || trimmed.startsWith('#') ||
        trimmed.startsWith('|') || trimmed.startsWith('>') || !trimmed.includes('$')) return line;

    const hasInlineDollar = /\$[^$\n]+\$/.test(trimmed);
    if (!hasInlineDollar) return line;

    // Remove formula *content* entirely (not just delimiters) so LaTeX inside $...$
    // doesn't falsely register as "LaTeX outside".
    const afterStrip = trimmed.replace(/\$[^$\n]+?\$/g, '');
    const hasLatexOutside = /\\[a-zA-Z]+/.test(afterStrip);

    if (hasLatexOutside) {
      const fixed = trimmed.replace(/\$([^$\n]+?)\$/g, '$1');
      return `$$${fixed}$$`;
    }
    return line;
  }).join('\n');

  // Type 3: bare LaTeX lines — no $ at all, but 3+ LaTeX commands and minimal Cyrillic prose.
  // Catches AI-generated formula lines that were never wrapped in $$ (including lines
  // left after Type 0 stripped \left$/\right$ and the line still has no $ delimiter).
  result = result.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('|') ||
        trimmed.startsWith('>') || trimmed.includes('$')) return line;

    const latexCommands = trimmed.match(/\\[a-zA-Z]+/g) || [];
    if (latexCommands.length < 3) return line;

    // Allow at most 1 Cyrillic word sequence (e.g. \text{метка}) — more means prose.
    const cyrillicWords = trimmed.match(/[а-яёА-ЯЁ]{3,}/g) || [];
    if (cyrillicWords.length > 1) return line;

    return `$$${trimmed}$$`;
  }).join('\n');

  return result;
}

/**
 * Safely renders Markdown with formula support: extracts formulas BEFORE marked
 * so marked doesn't corrupt them. Formulas are restored as $$...$$ / $...$ for
 * KaTeX auto-render (renderMathInElement) to pick up.
 */
export function safeMdParse(value: string): string {
  const mathStore: Array<{ type: 'block' | 'inline'; latex: string }> = [];
  // Fix broken AI formula patterns, then extract before marked runs.
  let text = fixBrokenFormulas(value);

  // Block formulas: non-greedy match with a line-count safety cap to prevent a stray
  // unclosed $$ from eating dozens of lines of content as one "formula".
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, latex) => {
    const lineCount = (latex.match(/\n/g) || []).length;
    if (lineCount > 25) return match; // runaway match — leave for KaTeX auto-render
    mathStore.push({ type: 'block', latex });
    return `\n\nMATHHOLDER${mathStore.length - 1}END\n\n`;
  });
  // Inline formulas: no newlines allowed — inline math never spans multiple lines.
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
