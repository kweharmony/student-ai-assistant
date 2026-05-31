import { useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { saveAs } from 'file-saver';
import { exportMarkdownFile } from '../utils/exportUtils';

// Конвертация HTML редактора в Markdown с сохранением формул через data-latex
const convertHtmlToMarkdown = (html: string): string => {
  let result = html
    .replace(/<div[^>]*data-type="block-math"[^>]*data-latex="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
      (_m, latex) => `\n\n$$${latex.replace(/&quot;/g, '"')}$$\n\n`)
    .replace(/<span[^>]*data-type="inline-math"[^>]*data-latex="([^"]*)"[^>]*>[\s\S]*?<\/span>/gi,
      (_m, latex) => `$${latex.replace(/&quot;/g, '"')}$`);

  result = result.replace(/<table[\s\S]*?<\/table>/gi, (tableHtml) => {
    const rows: string[][] = [];
    const rowMatches = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
    for (const rowMatch of rowMatches) {
      const cells: string[] = [];
      const cellMatches = Array.from(rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi));
      for (const cell of cellMatches) {
        cells.push(cell[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim());
      }
      if (cells.length) rows.push(cells);
    }
    if (!rows.length) return '';
    const header = `| ${rows[0].join(' | ')} |`;
    const separator = `| ${rows[0].map(() => '---').join(' | ')} |`;
    const body = rows.slice(1).map(row => `| ${row.join(' | ')} |`).join('\n');
    return `\n\n${header}\n${separator}\n${body}\n\n`;
  });

  return result
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, content) =>
      content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n'))
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, content) => {
      let i = 1;
      return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, item: string) => `${i++}. ${item}\n`);
    })
    .replace(/<hr[^>]*>/gi, '\n---\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&gt;/gi, '>')
    .replace(/&lt;/gi, '<')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const dateStamp = () => new Date().toISOString().split('T')[0];
const stripExt = (filename: string) => filename.replace(/\.\w+$/, '');

interface ExportOptions {
  filename?: string;
}

interface UseExportReturn {
  exportToTxt: (options?: ExportOptions) => void;
  exportToMarkdown: (options?: ExportOptions) => void;
  exportToDocx: (options?: ExportOptions) => Promise<void>;
  exportToPdf: (options?: ExportOptions) => Promise<void>;
}

export const useExport = (editor: Editor | null): UseExportReturn => {

  const exportToTxt = useCallback((options: ExportOptions = {}) => {
    if (!editor) return;
    const basename = stripExt(options.filename || `document_${dateStamp()}.txt`);
    const blob = new Blob([editor.getText()], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${basename}.txt`);
  }, [editor]);

  const exportToMarkdown = useCallback((options: ExportOptions = {}) => {
    if (!editor) return;
    const basename = stripExt(options.filename || `document_${dateStamp()}.md`);
    const markdown = convertHtmlToMarkdown(editor.getHTML());
    saveAs(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), `${basename}.md`);
  }, [editor]);

  const exportToDocx = useCallback(async (options: ExportOptions = {}) => {
    if (!editor) return;
    const basename = stripExt(options.filename || `document_${dateStamp()}.docx`);
    const markdown = convertHtmlToMarkdown(editor.getHTML());
    await exportMarkdownFile(markdown, basename, 'docx');
  }, [editor]);

  const exportToPdf = useCallback(async (options: ExportOptions = {}) => {
    if (!editor) return;
    const basename = stripExt(options.filename || `document_${dateStamp()}.pdf`);
    const markdown = convertHtmlToMarkdown(editor.getHTML());
    await exportMarkdownFile(markdown, basename, 'pdf');
  }, [editor]);

  return { exportToTxt, exportToMarkdown, exportToDocx, exportToPdf };
};
