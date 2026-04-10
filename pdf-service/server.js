/**
 * MindeSync PDF Service
 * Принимает Markdown (с LaTeX $$...$$), рендерит через Playwright + KaTeX, отдаёт PDF.
 */

const express = require('express');
const { chromium } = require('playwright');
const { marked } = require('marked');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Healthcheck для docker-compose / nginx
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/render-pdf', async (req, res) => {
  const { markdown } = req.body;
  if (!markdown) {
    return res.status(400).json({ error: 'markdown is required' });
  }

  // Конвертируем Markdown → HTML на сервере (marked работает в Node.js)
  const bodyHtml = marked.parse(markdown, { gfm: true, breaks: true });

  // Полная HTML-страница: KaTeX загружается с CDN, auto-render обходит body
  const pageHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    body {
      font-family: "Times New Roman", serif;
      font-size: 14px;
      line-height: 1.7;
      color: #1a1a1a;
      margin: 0;
      padding: 40px 50px;
      max-width: 800px;
    }
    h1 { font-size: 22px; margin: 28px 0 12px; }
    h2 { font-size: 18px; margin: 24px 0 10px; }
    h3 { font-size: 16px; margin: 20px 0 8px; }
    h4, h5, h6 { font-size: 14px; margin: 16px 0 6px; }
    p  { margin-bottom: 10px; text-align: justify; }
    ul, ol { padding-left: 24px; margin-bottom: 10px; }
    li { margin-bottom: 4px; }
    code { font-family: monospace; background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 13px; }
    pre  { background: #f4f4f4; padding: 12px; border-radius: 4px; overflow-x: auto; }
    blockquote { border-left: 3px solid #ccc; margin: 0 0 10px; padding-left: 16px; color: #555; font-style: italic; }
    .katex-display { margin: 16px 0; overflow-x: auto; }
    hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 10px; }
    th, td { border: 1px solid #ddd; padding: 6px 10px; }
    th { background: #f4f4f4; font-weight: bold; }
  </style>
</head>
<body>
  ${bodyHtml}
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <script>
    renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true  },
        { left: '$',  right: '$',  display: false },
        { left: '\\\\[', right: '\\\\]', display: true  },
        { left: '\\\\(', right: '\\\\)', display: false },
      ],
      throwOnError: false,
    });
  </script>
</body>
</html>`;

  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();

    // networkidle — ждём пока CDN-ресурсы (KaTeX) загрузятся и выполнятся
    await page.setContent(pageHtml, { waitUntil: 'networkidle' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '40px', bottom: '40px', left: '50px', right: '50px' },
      printBackground: true,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=document.pdf');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[pdf-service] Ошибка генерации PDF:', err);
    res.status(500).json({ error: 'PDF generation failed', detail: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[pdf-service] Listening on port ${PORT}`));
