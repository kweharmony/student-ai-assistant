// eslint-disable-next-line @typescript-eslint/no-var-requires
const _marked = (require('marked') as { parse: (s: string) => string }).parse;

/**
 * Безопасный рендер Markdown: извлекает формулы ДО marked,
 * чтобы тот не портил их `<br>`-тегами и другими преобразованиями.
 * После marked формулы возвращаются как $...$ / $$...$$ для KaTeX auto-render.
 */
export function safeMdParse(value: string): string {
  const mathStore: Array<{ type: 'block' | 'inline'; latex: string }> = [];
  let text = value;

  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => {
    mathStore.push({ type: 'block', latex });
    return `MATHHOLDER_${mathStore.length - 1}_END`;
  });
  text = text.replace(/\$([^$]+?)\$/g, (_, latex) => {
    mathStore.push({ type: 'inline', latex });
    return `MATHHOLDER_${mathStore.length - 1}_END`;
  });

  let html = _marked(text);

  html = html.replace(/MATHHOLDER_(\d+)_END/g, (_, idx) => {
    const { type, latex } = mathStore[Number(idx)];
    return type === 'block' ? `$$${latex}$$` : `$${latex}$`;
  });

  return html;
}
