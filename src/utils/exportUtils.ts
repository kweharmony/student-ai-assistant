import { saveAs } from 'file-saver';

export type ExportFormat = 'txt' | 'md' | 'pdf' | 'docx';

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
  if (format === 'txt') {
    saveAs(
      new Blob([mdToPlainText(markdown)], { type: 'text/plain;charset=utf-8' }),
      `${basename}.txt`,
    );
    return;
  }

  if (format === 'md') {
    saveAs(
      new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
      `${basename}.md`,
    );
    return;
  }

  if (format === 'pdf') {
    try {
      const resp = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown }),
      });
      if (resp.ok) {
        saveAs(await resp.blob(), `${basename}.pdf`);
        return;
      }
      console.error('[export] pdf-service вернул ошибку:', resp.status);
    } catch (err) {
      console.error('[export] pdf-service недоступен:', err);
    }
    // Fallback: отдаём MD — хоть что-то
    saveAs(
      new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
      `${basename}.md`,
    );
    return;
  }

  if (format === 'docx') {
    try {
      const resp = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown, filename: `${basename}.docx` }),
      });
      if (resp.ok) {
        saveAs(await resp.blob(), `${basename}.docx`);
        return;
      }
      console.error('[export] pdf-service (docx) вернул ошибку:', resp.status);
    } catch (err) {
      console.error('[export] pdf-service (docx) недоступен:', err);
    }
    // Fallback: отдаём MD
    saveAs(
      new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
      `${basename}.md`,
    );
  }
}
