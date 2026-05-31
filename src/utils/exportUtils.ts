import { saveAs } from 'file-saver';

export type ExportFormat = 'txt' | 'md' | 'pdf' | 'docx';

// Приводим разделители LaTeX из любого LLM-формата к стандартным $$...$$ и $...$
// Идемпотентна: уже чистый markdown проходит без изменений
const normalizeLatexDelimiters = (text: string): string => {
  const hasLatex = /\\[a-zA-Z]+|[\^_]/.test.bind(/\\[a-zA-Z]+|[\^_]/);

  let out = text.replace(/(?<!\\)\\\[([\s\S]+?)\\\]/g, (_m, inner) => `$$${inner}$$`);
  out = out.replace(/\\\((.+?)\\\)/g, (_m, inner) => `$${inner}$`);
  out = out.replace(/^(\[([^\[\]\n]+)\])$/mg, (_m, _full, inner) =>
    hasLatex(inner) ? `$$\n${inner.trim()}\n$$` : _m,
  );

  // Защищаем существующие $...$ и $$...$$ перед заменой (...)→$...$,
  // иначе формулы со скобками внутри ломаются: $P(\alpha)$ → $P$\alpha$$
  const saved: string[] = [];
  out = out.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, (m) => {
    saved.push(m);
    return `\x00M${saved.length - 1}\x00`;
  });
  out = out.replace(/\(([^()\n$]*(?:\([^()\n$]*\)[^()\n$]*)*)\)/g, (_m, inner) =>
    hasLatex(inner) ? `$${inner}$` : _m,
  );
  out = out.replace(/\x00M(\d+)\x00/g, (_, i) => saved[parseInt(i, 10)]);

  return out;
};

// Стрипаем Markdown-разметку и LaTeX для TXT-экспорта
const mdToPlainText = (markdown: string): string =>
  markdown
    .replace(/\$\$[\s\S]+?\$\$/g, '')
    .replace(/\$[^$\n]+?\$/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\|[^\n]+\|/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Единая точка экспорта для любого Markdown-текста.
 * Используется из редактора, каталога лекций и «Моих лекций».
 *
 * @param markdown  Текст в формате Markdown (формулы как $$...$$)
 * @param basename  Имя файла БЕЗ расширения
 * @param format    Целевой формат
 */
export async function exportMarkdownFile(
  markdown: string,
  basename: string,
  format: ExportFormat,
): Promise<void> {
  // Нормализуем разделители независимо от источника (редактор, каталог, лекции)
  const md = normalizeLatexDelimiters(markdown);

  if (format === 'txt') {
    saveAs(
      new Blob([mdToPlainText(md)], { type: 'text/plain;charset=utf-8' }),
      `${basename}.txt`,
    );
    return;
  }

  if (format === 'md') {
    saveAs(
      new Blob([md], { type: 'text/markdown;charset=utf-8' }),
      `${basename}.md`,
    );
    return;
  }

  if (format === 'pdf') {
    try {
      const resp = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: md }),
      });
      if (resp.ok) {
        saveAs(await resp.blob(), `${basename}.pdf`);
        return;
      }
      console.error('[export] pdf-service вернул ошибку:', resp.status);
    } catch (err) {
      console.error('[export] pdf-service недоступен:', err);
    }
    saveAs(
      new Blob([md], { type: 'text/markdown;charset=utf-8' }),
      `${basename}.md`,
    );
    return;
  }

  if (format === 'docx') {
    try {
      const resp = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: md, filename: `${basename}.docx` }),
      });
      if (resp.ok) {
        saveAs(await resp.blob(), `${basename}.docx`);
        return;
      }
      console.error('[export] pdf-service (docx) вернул ошибку:', resp.status);
    } catch (err) {
      console.error('[export] pdf-service (docx) недоступен:', err);
    }
    saveAs(
      new Blob([md], { type: 'text/markdown;charset=utf-8' }),
      `${basename}.md`,
    );
  }
}
