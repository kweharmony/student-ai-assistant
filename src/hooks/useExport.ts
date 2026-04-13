import { useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import htmlDocx from 'html-docx-js/dist/html-docx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Функция для загрузки шрифта
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

// Инициализируем pdfMake
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || {};

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
    
    // Простая конвертация HTML в Markdown
    const convertHtmlToMarkdown = (html: string): string => {
      return html
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
        .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
        .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n')
        .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
        .replace(/<ul[^>]*>(.*?)<\/ul>/gi, (match: string, content: string) => {
          return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
        })
        .replace(/<ol[^>]*>(.*?)<\/ol>/gi, (match: string, content: string) => {
          return content.replace(/<li[^>]*>(.*?)<\/li>/gi, (match: string, item: string, index: number) => `${index + 1}. ${item}\n`);
        })
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&gt;/gi, '>')
        .replace(/&lt;/gi, '<')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
    };
    
    const markdown = convertHtmlToMarkdown(html);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    downloadFile(blob, filename);
  }, [editor]);

  // Экспорт в DOCX с полным форматированием
  const exportToDocx = useCallback(async (options: ExportOptions = {}) => {
    if (!editor) return;

    const html = editor.getHTML();
    const filename = options.filename || `document_${new Date().toISOString().split('T')[0]}.docx`;
    
    try {
      // Создаем HTML документ с правильной структурой для DOCX
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Document</title>
    <style>
        body { 
            font-family: 'Times New Roman', serif; 
            margin: 20px; 
            line-height: 1.6;
            color: #000;
        }
        h1, h2, h3, h4, h5, h6 { 
            color: #000; 
            margin-top: 20px;
            margin-bottom: 10px;
            font-weight: bold;
        }
        h1 { font-size: 24px; }
        h2 { font-size: 20px; }
        h3 { font-size: 18px; }
        h4 { font-size: 16px; }
        h5 { font-size: 14px; }
        h6 { font-size: 12px; }
        p { 
            margin-bottom: 10px; 
        }
        ul, ol {
            margin-bottom: 10px;
            padding-left: 20px;
        }
        strong, b { font-weight: bold; }
        em, i { font-style: italic; }
    </style>
</head>
<body>
    ${html}
</body>
</html>`;
      
      // Конвертируем HTML в настоящий DOCX файл
      const docxBlob = htmlDocx.asBlob(htmlContent);
      downloadFile(docxBlob, filename);
    } catch (error) {
      console.error('Ошибка при создании DOCX:', error);
    }
  }, [editor]);

  // Экспорт в PDF с поддержкой кириллицы через pdfmake
  const exportToPdf = useCallback(async (options: ExportOptions = {}) => {
    if (!editor) return;

    const html = editor.getHTML();
    const filename = options.filename || `document_${new Date().toISOString().split('T')[0]}.pdf`;
    
    try {
      // Загружаем шрифт Roboto
      const robotoFont = await loadFont('/Roboto-Regular.ttf');
      if (robotoFont) {
        (pdfMake as any).vfs['Roboto-Regular.ttf'] = robotoFont;
      }
      
      // Функция для конвертации HTML в структурированный контент для pdfmake
      const convertHtmlToPdfContent = (html: string) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const content: any[] = [];
        
        const processNode = (node: Node, isFirstInBlock = false) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) {
              content.push({
                text: text,
                fontSize: 12,
                lineHeight: 1.5,
                margin: isFirstInBlock ? [0, 0, 0, 8] : [0, 0, 0, 4]
              });
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const tagName = element.tagName.toLowerCase();
            
            // Обрабатываем только блочные элементы
            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'blockquote', 'ul', 'ol', 'li'].includes(tagName)) {
              const text = element.textContent?.trim();
              
              if (text) {
                switch (tagName) {
                  case 'h1':
                    content.push({
                      text: text,
                      fontSize: 20,
                      bold: true,
                      margin: [0, 20, 0, 12],
                      color: '#1a1a1a'
                    });
                    break;
                  case 'h2':
                    content.push({
                      text: text,
                      fontSize: 18,
                      bold: true,
                      margin: [0, 16, 0, 10],
                      color: '#2c2c2c'
                    });
                    break;
                  case 'h3':
                    content.push({
                      text: text,
                      fontSize: 16,
                      bold: true,
                      margin: [0, 14, 0, 8],
                      color: '#3c3c3c'
                    });
                    break;
                  case 'h4':
                    content.push({
                      text: text,
                      fontSize: 14,
                      bold: true,
                      margin: [0, 12, 0, 6],
                      color: '#4c4c4c'
                    });
                    break;
                  case 'h5':
                  case 'h6':
                    content.push({
                      text: text,
                      fontSize: 13,
                      bold: true,
                      margin: [0, 10, 0, 5],
                      color: '#5c5c5c'
                    });
                    break;
                  case 'p':
                    content.push({
                      text: text,
                      fontSize: 12,
                      lineHeight: 1.6,
                      margin: [0, 0, 0, 10],
                      alignment: 'justify'
                    });
                    break;
                  case 'blockquote':
                    content.push({
                      text: text,
                      fontSize: 12,
                      lineHeight: 1.5,
                      margin: [20, 8, 0, 8],
                      color: '#666666',
                      italics: true
                    });
                    break;
                  case 'ul':
                  case 'ol':
                    // Обрабатываем списки
                    const listItems = element.querySelectorAll('li');
                    listItems.forEach((li, index) => {
                      const itemText = li.textContent?.trim();
                      if (itemText) {
                        const bullet = tagName === 'ul' ? '•' : `${index + 1}.`;
                        content.push({
                          text: `${bullet} ${itemText}`,
                          fontSize: 12,
                          lineHeight: 1.5,
                          margin: [0, 0, 0, 4]
                        });
                      }
                    });
                    break;
                  case 'li':
                    // Пропускаем, так как обрабатываем в ul/ol
                    break;
                  default:
                    if (text) {
                      content.push({
                        text: text,
                        fontSize: 12,
                        lineHeight: 1.5,
                        margin: [0, 0, 0, 6]
                      });
                    }
                }
              }
            } else {
              // Для inline элементов просто добавляем текст
              const text = element.textContent?.trim();
              if (text) {
                const style: any = {
                  text: text,
                  fontSize: 12,
                  lineHeight: 1.5
                };
                
                // Обрабатываем стили
                if (tagName === 'strong' || tagName === 'b') {
                  style.bold = true;
                }
                if (tagName === 'em' || tagName === 'i') {
                  style.italics = true;
                }
                if (tagName === 'u') {
                  style.decoration = 'underline';
                }
                
                content.push(style);
              }
            }
            
            // Обрабатываем дочерние элементы только для inline элементов
            if (!['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'blockquote', 'ul', 'ol', 'li'].includes(tagName)) {
              for (const child of Array.from(element.childNodes)) {
                processNode(child);
              }
            }
          }
        };
        
        // Обрабатываем все дочерние элементы корневого div
        for (const child of Array.from(tempDiv.childNodes)) {
          processNode(child, true);
        }
        
        return content;
      };
      
      // Конвертируем HTML в структурированный контент
      const pdfContent = convertHtmlToPdfContent(html);
      
       // Создаем документ pdfmake
       const docDefinition = {
         pageSize: 'A4',
         pageMargins: [50, 60, 50, 60],
         content: pdfContent,
         defaultStyle: {
           font: 'Roboto',
           fontSize: 12,
           lineHeight: 1.5,
           color: '#333333'
         },
         styles: {
           header: {
             fontSize: 18,
             bold: true,
             margin: [0, 0, 0, 10]
           },
           subheader: {
             fontSize: 16,
             bold: true,
             margin: [0, 10, 0, 5]
           },
           quote: {
             italics: true,
             margin: [20, 10, 0, 10],
             color: '#666666'
           },
           small: {
             fontSize: 8
           }
         },
         fonts: {
           Roboto: {
             normal: 'Roboto-Regular.ttf',
             bold: 'Roboto-Regular.ttf',
             italics: 'Roboto-Regular.ttf',
             bolditalics: 'Roboto-Regular.ttf'
           }
         }
       };
      
      // Создаем PDF
      if (typeof (pdfMake as any).createPdf === 'function') {
        const pdfDoc = (pdfMake as any).createPdf(docDefinition);
        pdfDoc.download(filename);
      } else {
        // Fallback: используем jsPDF если pdfMake не работает
        console.warn('pdfMake не доступен, используем jsPDF');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        
        // Простое добавление текста
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const text = tempDiv.textContent || tempDiv.innerText || '';
        const lines = (pdf as any).splitTextToSize(text, 180);
        
        let y = 20;
        for (const line of lines) {
          if (y > 280) {
            pdf.addPage();
            y = 20;
          }
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
