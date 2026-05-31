import { useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import htmlDocx from 'html-docx-js/dist/html-docx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

const loadFont = async (fontPath: string): Promise<string> => {
  try {
    const response = await fetch(fontPath);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    const base64 = btoa(binary);
    return `data:font/truetype;charset=utf-8;base64,${base64}`;
  } catch (error) {
    console.warn('Не удалось загрузить шрифт:', error);
    return '';
  }
};

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || {};

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

// Заменяем KaTeX-ноды Tiptap на читаемые текстовые представления LaTeX для DOCX
const preprocessHtmlForDocx = (html: string): string => {
  return html
    .replace(/<div[^>]*data-type="block-math"[^>]*data-latex="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
      (_m, latex) => `<p style="font-family:'Courier New',monospace;font-size:11pt;text-align:center;margin:12px 0;background:#f5f5f5;padding:8px;">$$${latex.replace(/&quot;/g, '"')}$$</p>`)
    .replace(/<span[^>]*data-type="inline-math"[^>]*data-latex="([^"]*)"[^>]*>[\s\S]*?<\/span>/gi,
      (_m, latex) => `<code>$${latex.replace(/&quot;/g, '"')}$</code>`);
};

interface ExportOptions {
  filename?: string;
  title?: string;
}

interface UseExportReturn {
  exportToTxt: (options?: ExportOptions) => void;
  exportToMarkdown: (options?: ExportOptions) => void;
  exportToDocx: (options?: ExportOptions) => Promise<void>;
  exportToPdf: (options?: ExportOptions) => Promise<void>;
}

export const useExport = (editor: Editor | null): UseExportReturn => {

  // Функция для скачивания файла
  const downloadFile = (blob: Blob, filename: string) => {
    saveAs(blob, filename);
  };

  // Экспорт в TXT (простой текст без разметки)
  const exportToTxt = useCallback((options: ExportOptions = {}) => {
    if (!editor) return;

    const content = editor.getText();
    const filename = options.filename || `document_${new Date().toISOString().split('T')[0]}.txt`;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    downloadFile(blob, filename);
  }, [editor]);


  // Экспорт в Markdown
  const exportToMarkdown = useCallback((options: ExportOptions = {}) => {
    if (!editor) return;

    const html = editor.getHTML();
    const filename = options.filename || `document_${new Date().toISOString().split('T')[0]}.md`;
    const markdown = convertHtmlToMarkdown(html);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    downloadFile(blob, filename);
  }, [editor]);

  // Экспорт в DOCX: приоритет — серверный Pandoc (нативные Word-формулы)
  const exportToDocx = useCallback(async (options: ExportOptions = {}) => {
    if (!editor) return;

    const html = editor.getHTML();
    const filename = options.filename || `document_${new Date().toISOString().split('T')[0]}.docx`;

    // Конвертируем в Markdown — формулы восстанавливаются из data-latex
    const markdown = convertHtmlToMarkdown(html);

    try {
      const resp = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown, filename }),
      });
      if (resp.ok) {
        const blob = await resp.blob();
        saveAs(blob, filename);
        return;
      }
    } catch {
      // pdf-service недоступен — fallback на html-docx-js с LaTeX как текстом
    }

    try {
      // Заменяем KaTeX-ноды на текстовое представление LaTeX (Word не поддерживает KaTeX HTML)
      const processedHtml = preprocessHtmlForDocx(html);

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Document</title>
    <style>
        body { font-family: 'Times New Roman', serif; margin: 20px; line-height: 1.6; color: #000; }
        h1, h2, h3, h4, h5, h6 { color: #000; margin-top: 20px; margin-bottom: 10px; font-weight: bold; }
        h1 { font-size: 24px; } h2 { font-size: 20px; } h3 { font-size: 18px; }
        h4 { font-size: 16px; } h5 { font-size: 14px; } h6 { font-size: 12px; }
        p { margin-bottom: 10px; }
        ul, ol { margin-bottom: 10px; padding-left: 20px; }
        strong, b { font-weight: bold; }
        em, i { font-style: italic; }
        code { font-family: 'Courier New', monospace; font-size: 11pt; }
    </style>
</head>
<body>
    ${processedHtml}
</body>
</html>`;

      const docxBlob = htmlDocx.asBlob(htmlContent);
      downloadFile(docxBlob, filename);
    } catch (error) {
      console.error('Ошибка при создании DOCX:', error);
    }
  }, [editor]);

  // Экспорт в PDF: приоритет — серверный рендеринг через Playwright+KaTeX (pdf-service)
  const exportToPdf = useCallback(async (options: ExportOptions = {}) => {
    if (!editor) return;

    const html = editor.getHTML();
    const filename = options.filename || `document_${new Date().toISOString().split('T')[0]}.pdf`;

    // Конвертируем в Markdown — формулы восстанавливаются из data-latex
    const markdown = convertHtmlToMarkdown(html);

    try {
      const resp = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown }),
      });
      if (resp.ok) {
        const blob = await resp.blob();
        saveAs(blob, filename);
        return;
      }
    } catch {
      // pdf-service недоступен, переходим к fallback
    }

    // Fallback: pdfMake — формулы показываем как LaTeX-текст
    try {
      const robotoFont = await loadFont('/Roboto-Regular.ttf');
      if (robotoFont) {
        (pdfMake as any).vfs['Roboto-Regular.ttf'] = robotoFont;
      }

      // Конвертируем Markdown в простую структуру pdfmake с LaTeX как текстом
      const lines = markdown.split(/\r?\n/);
      const content: any[] = lines.map((line) => {
        const trimmed = line.trim();
        if (/^#{1} /.test(trimmed))   return { text: trimmed.replace(/^# /, ''),   fontSize: 20, bold: true, margin: [0, 16, 0, 10] };
        if (/^#{2} /.test(trimmed))   return { text: trimmed.replace(/^## /, ''),  fontSize: 17, bold: true, margin: [0, 14, 0, 8] };
        if (/^#{3} /.test(trimmed))   return { text: trimmed.replace(/^### /, ''), fontSize: 14, bold: true, margin: [0, 12, 0, 6] };
        if (/^\$\$/.test(trimmed))    return { text: trimmed, font: 'Roboto', fontSize: 11, italics: true, margin: [20, 6, 20, 6], color: '#555555' };
        return { text: line || ' ', fontSize: 12, lineHeight: 1.5, margin: [0, 0, 0, 4] };
      });

      const docDefinition = {
        pageSize: 'A4',
        pageMargins: [50, 60, 50, 60],
        content,
        defaultStyle: { font: 'Roboto', fontSize: 12, lineHeight: 1.5 },
        fonts: {
          Roboto: {
            normal: 'Roboto-Regular.ttf',
            bold: 'Roboto-Regular.ttf',
            italics: 'Roboto-Regular.ttf',
            bolditalics: 'Roboto-Regular.ttf',
          },
        },
      };

      if (typeof (pdfMake as any).createPdf === 'function') {
        (pdfMake as any).createPdf(docDefinition).download(filename);
      } else {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const lines = (pdf as any).splitTextToSize(markdown, 180);
        let y = 20;
        for (const line of lines) {
          if (y > 280) { pdf.addPage(); y = 20; }
          (pdf as any).text(line, 15, y);
          y += 7;
        }
        pdf.save(filename);
      }
    } catch (error) {
      console.error('Ошибка при создании PDF:', error);
    }
  }, [editor]);

  return {
    exportToTxt,
    exportToMarkdown,
    exportToDocx,
    exportToPdf
  };
};
