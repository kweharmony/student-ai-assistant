/**
 * MindeSync PDF/DOCX Service
 * /render-pdf  — Playwright + KaTeX → PDF
 * /render-docx — Pandoc → DOCX (с нативными Word-формулами через OMML)
 */

const express = require('express');
const { chromium } = require('playwright');
const { marked } = require('marked');
const { spawn } = require('child_process');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Healthcheck для docker-compose / nginx
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Защищаем math-блоки от marked: заменяем на плейсхолдеры до парсинга,
// восстанавливаем в HTML после — иначе marked ломает $$ и < внутри формул.
function extractMath(markdown) {
  const blocks = [];

  let result = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (_m, math) => {
    const idx = blocks.length;
    blocks.push({ display: true, math: math.trim() });
    return `MATH_PLACEHOLDER_${idx}_END`;
  });

  result = result.replace(/\$([^$\n]+?)\$/g, (_m, math) => {
    const idx = blocks.length;
    blocks.push({ display: false, math: math.trim() });
    return `MATH_PLACEHOLDER_${idx}_END`;
  });

  return { result, blocks };
}

function restoreMath(html, blocks) {
  return html.replace(/MATH_PLACEHOLDER_(\d+)_END/g, (_m, idx) => {
    const { display, math } = blocks[parseInt(idx, 10)];
    return display
      ? `<span class="math-display">$$${math}$$</span>`
      : `<span class="math-inline">$${math}$</span>`;
  });
}

app.post('/render-pdf', async (req, res) => {
  const { markdown } = req.body;
  if (!markdown) {
    return res.status(400).json({ error: 'markdown is required' });
  }

  // Защищаем формулы до marked, восстанавливаем после
  const { result: safeMd, blocks } = extractMath(markdown);
  const rawHtml = marked.parse(safeMd, { gfm: true, breaks: true });
  const bodyHtml = restoreMath(rawHtml, blocks);

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
      padding: 20px;
      max-width: 100%;
      box-sizing: border-box;
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
    .math-display { display: block; text-align: center; margin: 16px 0; }
    .math-inline { display: inline; }
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

    // Viewport = ширина печатной области A4 (210mm − 2×15mm = 180mm ≈ 680px при 96dpi).
    // Это заставляет тело страницы рендериться ровно в ту ширину, которая попадёт в PDF,
    // и делает scrollWidth > clientWidth надёжным признаком переполнения.
    await page.setViewportSize({ width: 680, height: 900 });
    await page.setContent(pageHtml, { waitUntil: 'networkidle' });

    // Уменьшаем font-size формул, которые шире контейнера.
    // font-size (не transform) меняет layout-размер, поэтому PDF не клипает.
    // scrollWidth > clientWidth работает корректно при viewport = printable width.
    await page.evaluate(() => {
      document.querySelectorAll('.katex-display').forEach(el => {
        if (el.scrollWidth > el.clientWidth + 2) {
          const ratio = el.clientWidth / el.scrollWidth;
          el.style.fontSize = (ratio * 0.97 * 100).toFixed(1) + '%';
        }
      });
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
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

app.post('/render-docx', async (req, res) => {
  const { markdown, filename } = req.body;
  if (!markdown) {
    return res.status(400).json({ error: 'markdown is required' });
  }

  try {
    // pandoc читает Markdown из stdin, пишет DOCX в stdout
    // --mathml конвертирует LaTeX-формулы в MathML → Word открывает как нативные OMML-формулы
    const pandoc = spawn('pandoc', [
      '--from=markdown+tex_math_dollars+tex_math_single_backslash',
      '--to=docx',
      '--mathml',
      '--output=-',
    ]);

    const chunks = [];
    pandoc.stdout.on('data', (chunk) => chunks.push(chunk));

    pandoc.stderr.on('data', (data) => {
      console.error('[pdf-service] pandoc stderr:', data.toString());
    });

    pandoc.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: 'pandoc exited with code ' + code });
      }
      const docxBuffer = Buffer.concat(chunks);
      const outFilename = filename || 'document.docx';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${outFilename}"`);
      res.send(docxBuffer);
    });

    pandoc.on('error', (err) => {
      console.error('[pdf-service] Не удалось запустить pandoc:', err);
      res.status(500).json({ error: 'pandoc not available', detail: err.message });
    });

    // Подаём Markdown в stdin и закрываем поток
    pandoc.stdin.write(markdown);
    pandoc.stdin.end();
  } catch (err) {
    console.error('[pdf-service] Ошибка генерации DOCX:', err);
    res.status(500).json({ error: 'DOCX generation failed', detail: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[pdf-service] Listening on port ${PORT}`));
