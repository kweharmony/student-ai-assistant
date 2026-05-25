import React, { useEffect, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import RichTextEditor from '../RichTextEditor';
import { useExport } from '../../hooks/useExport';
import { useMLProcessor } from '../../hooks/useMLProcessor';
import { useAuth } from '../../contexts/AuthContext';
import { MLMode, MLModeInfo } from '../../types/ml';
import { marked } from 'marked';
import { fixBrokenFormulas, safeMdParse } from '../../utils/markdownUtils';
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface TextProcessingSectionProps {
  isLightTheme: boolean;
  editorInstance: any;
  setEditorInstance: (editor: any) => void;
  editorContent: string;
  setEditorContent: (content: string) => void;
  showTextEditor: boolean;
  setShowTextEditor: (show: boolean) => void;
  originalText: string;
  setOriginalText: (text: string) => void;
  processedText: string;
  setProcessedText: (text: string) => void;
  editorMode: 'original' | 'processed';
  setEditorMode: (mode: 'original' | 'processed') => void;
  lectureId?: string;
  lectureTitle?: string;
  onSaveLecture?: (text: string) => Promise<void>;
}

// Описания режимов ML для UI
const mlModes: MLModeInfo[] = [
  {
    id: 'summarize',
    name: 'Краткий конспект',
    description: 'Создаёт структурированный конспект (30% от исходного объёма)',
    icon: 'edit_note'
  },
  {
    id: 'extract_terms',
    name: 'Ключевые термины',
    description: 'Извлекает термины с определениями',
    icon: 'menu_book'
  },
  {
    id: 'expand_topic',
    name: 'Расширение темы',
    description: 'Подробное объяснение выбранной темы',
    icon: 'search',
    requiresTopic: true
  },
  {
    id: 'generate_questions',
    name: 'Вопросы для самопроверки',
    description: 'Генерирует 8-12 вопросов по материалу',
    icon: 'help_outline'
  },
  {
    id: 'detailed_notes',
    name: 'Расширенный конспект',
    description: 'Максимально подробное описание всех терминов',
    icon: 'auto_stories'
  },
  {
    id: 'cheat_sheet',
    name: 'Шпаргалка',
    description: 'Сжатая выжимка с формулами и ключевыми тезисами',
    icon: 'description'
  }
];

const TextProcessingSection: React.FC<TextProcessingSectionProps> = ({
  isLightTheme,
  editorInstance,
  setEditorInstance,
  editorContent,
  setEditorContent,
  showTextEditor,
  setShowTextEditor,
  originalText,
  setOriginalText,
  processedText,
  setProcessedText,
  editorMode,
  setEditorMode,
  lectureId,
  lectureTitle,
  onSaveLecture,
}) => {
  const { token, user } = useAuth();

  // Модалка выбора лекции
  const [showLectureModal, setShowLectureModal] = useState(false);
  const [userLectures, setUserLectures] = useState<any[]>([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [lectureSelectError, setLectureSelectError] = useState('');
  const [lectureLoadingId, setLectureLoadingId] = useState<string | null>(null);
  const [localLectureTitle, setLocalLectureTitle] = useState<string | null>(null);

  const openLectureModal = async () => {
    setShowLectureModal(true);
    setLectureSelectError('');
    setLecturesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/lectures/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Ошибка загрузки лекций');
      const data = await res.json();
      setUserLectures(data.filter((l: any) => l.has_text));
    } catch {
      setLectureSelectError('Не удалось загрузить лекции');
    } finally {
      setLecturesLoading(false);
    }
  };

  const handleSelectLecture = async (lectureId: string) => {
    setLectureLoadingId(lectureId);
    setLectureSelectError('');
    try {
      const res = await fetch(`${API_BASE}/api/lectures/${lectureId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Ошибка загрузки лекции');
      const data = await res.json();

      const transcriptions = (data.transcriptions || []).filter((t: any) => !t.is_deleted);
      if (!transcriptions.length) {
        setLectureSelectError('У этой лекции нет текста');
        return;
      }
      const latest = transcriptions.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      const text: string = latest.processed_text || latest.raw_text || '';
      if (!text.trim()) {
        setLectureSelectError('Текст лекции пустой');
        return;
      }

      const html = processTextContent(text, 'lecture.txt');
      setEditorContent(html);
      setShowTextEditor(true);
      setShowLectureModal(false);
      const selected = userLectures.find((l: any) => l.id === lectureId);
      setLocalLectureTitle(selected?.title || null);
    } catch {
      setLectureSelectError('Не удалось загрузить текст лекции');
    } finally {
      setLectureLoadingId(null);
    }
  };

  // Состояние ML обработки
  const [selectedMLMode, setSelectedMLMode] = useState<MLMode>('summarize');
  const [topicInput, setTopicInput] = useState<string>('');
  const [saveFormat, setSaveFormat] = useState('txt');
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [canSaveLecture, setCanSaveLecture] = useState(false);
  const [showEditorHelp, setShowEditorHelp] = useState(false);
  // Исходный Markdown от LLM (до конвертации в HTML) — нужен для MD-экспорта и PDF
  const [rawMarkdown, setRawMarkdown] = useState('');
  // История результатов ML по режиму (Q3)
  const [mlResults, setMlResults] = useState<Record<string, { html: string; rawMd: string }>>({});

  // ── Inline explain on selection ────────────────────────────────────────────
  const [explainTooltip, setExplainTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [explainResult, setExplainResult] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const explainPanelRef = useRef<HTMLDivElement>(null);

  // При смене режима — восстанавливаем сохранённый результат (Q3)
  const isMlModeFirstRender = useRef(true);
  useEffect(() => {
    if (isMlModeFirstRender.current) { isMlModeFirstRender.current = false; return; }
    const saved = mlResults[selectedMLMode];
    if (saved) {
      setProcessedText(saved.html);
      setRawMarkdown(saved.rawMd);
      setEditorMode('processed');
    } else {
      setProcessedText('');
      setEditorMode('original');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMLMode]);

  // Сохраняем черновик в sessionStorage при изменении (Q4)
  useEffect(() => {
    if (editorContent) {
      try {
        sessionStorage.setItem('mindesync_editor_draft', editorContent);
      } catch {
        // ignore storage errors
      }
    }
  }, [editorContent]);

  // Close explain panel when clicking outside editor+panel
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (editorWrapperRef.current?.contains(t) || explainPanelRef.current?.contains(t)) return;
      setExplainTooltip(null);
      setExplainResult(null);
      setExplainError(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const handleEditorSelect = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setExplainTooltip(null); return; }
    const text = sel.toString().trim();
    if (text.length < 5) { setExplainTooltip(null); return; }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const x = Math.min(rect.right, window.innerWidth - 16);
    const y = rect.bottom;
    setExplainTooltip({ text, x, y });
    setExplainResult(null);
    setExplainError(null);
  };

  const handleExplainClick = async () => {
    if (!explainTooltip) return;
    setExplainLoading(true);
    setExplainResult(null);
    setExplainError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ml/explain`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: explainTooltip.text }),
      });
      if (!res.ok) throw new Error('Не удалось получить объяснение');
      const data = await res.json();
      setExplainResult(data?.explanation || '');
    } catch (e: any) {
      setExplainError(e?.message || 'Ошибка');
    } finally {
      setExplainLoading(false);
    }
  };

  useEffect(() => {
    if (!lectureId || !onSaveLecture) {
      setCanSaveLecture(false);
      return;
    }

    if (!token) {
      setCanSaveLecture(false);
      return;
    }

    if (user?.role === 'admin') {
      setCanSaveLecture(true);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/lectures/${lectureId}/save-text-permission`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!isMounted) return;
        if (!res.ok) {
          setCanSaveLecture(false);
          return;
        }
        const data = await res.json();
        setCanSaveLecture(Boolean(data?.can_save));
      } catch {
        if (!isMounted) return;
        setCanSaveLecture(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [lectureId, onSaveLecture, token, user?.role]);

  // Хук для экспорта
  const { exportToTxt, exportToMarkdown, exportToDocx, exportToPdf } = useExport(editorInstance);

  const sanitizeFilename = (value: string): string => {
    const withoutForbidden = value.replace(/[<>:"/\\|?*]/g, ' ');
    const withoutControl = Array.from(withoutForbidden)
      .map((ch) => (ch.charCodeAt(0) < 32 ? ' ' : ch))
      .join('');
    return withoutControl.replace(/\s+/g, ' ').trim();
  };

  const buildExportFilename = (): string => {
    const base = sanitizeFilename(lectureTitle || localLectureTitle || '');
    if (base) return base;
    return `document_${new Date().toISOString().split('T')[0]}`;
  };

  // Хук для ML обработки
  const {
    isProcessing,
    error: mlError,
    processText,
    cancelProcessing
  } = useMLProcessor();

  // Конвертация Markdown в HTML с сохранением форматирования
  const convertMarkdownToHTML = (markdown: string): string => {
    if (!markdown) return '';

    const blockFormulas: string[] = [];
    const inlineFormulas: string[] = [];

    // Шаг 1: Вырезаем блочные $$...$$ формулы — плейсхолдеры без подчёркиваний,
    // чтобы marked не интерпретировал их как курсив.
    let text = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => {
      const idx = blockFormulas.length;
      blockFormulas.push(latex.trim());
      return `\n\nBLOCKMATHPH${idx}END\n\n`;
    });

    // Шаг 2: Вырезаем инлайн $...$ формулы — это ключевое исправление: без этого
    // marked может испортить LaTeX-содержимое (звёздочки, подчёркивания и т.д.).
    text = text.replace(/\$([^$\n]+?)\$/g, (_, latex) => {
      const idx = inlineFormulas.length;
      inlineFormulas.push(latex);
      return `INLINEMATHPH${idx}END`;
    });

    // Шаг 3: Конвертируем Markdown в HTML.
    let html = marked(text, { breaks: true }) as string;

    // Шаг 4: Восстанавливаем блочные формулы как data-latex элементы.
    // useEffect в RichTextEditor находит [data-type="block-math"] и рендерит через KaTeX.
    html = html.replace(/BLOCKMATHPH(\d+)END/g, (_, idxStr) => {
      const latex = blockFormulas[parseInt(idxStr)].replace(/"/g, '&quot;');
      return `<div data-type="block-math" data-latex="${latex}" class="math-block"></div>`;
    });

    // Шаг 5: Восстанавливаем инлайн формулы как data-latex span-элементы.
    // TipTap парсит их через InlineMath.parseHTML, preview рендерит через KaTeX useEffect.
    html = html.replace(/INLINEMATHPH(\d+)END/g, (_, idxStr) => {
      const latex = inlineFormulas[parseInt(idxStr)].replace(/"/g, '&quot;');
      return `<span data-type="inline-math" data-latex="${latex}"></span>`;
    });

    return html;
  };

  // Умная обработка текста - определяет, содержит ли текст Markdown синтаксис
  const processTextContent = (text: string, filename: string): string => {
    // Сначала исправляем сломанные формулы из AI-вывода (типы 1 и 2)
    const fixed = fixBrokenFormulas(text);

    // Если это MD файл, всегда конвертируем как Markdown
    if (filename.toLowerCase().endsWith('.md')) {
      return convertMarkdownToHTML(fixed);
    }

    // Проверяем, содержит ли текст Markdown синтаксис.
    // Флаг /m необходим: без него ^ совпадает только с началом ВСЕЙ строки,
    // а не с началом каждой строки — текст без заголовка в первой строке
    // ошибочно определялся как plain text и формулы не рендерились.
    // Также проверяем $$ — после fixBrokenFormulas в тексте могут появиться формулы.
    const hasMarkdownSyntax = /^#{1,6}\s|^\*\*|^\*[^*]|^- |^\d+\. |^```|^> |^\||\$\$/m.test(fixed);

    if (hasMarkdownSyntax) {
      return convertMarkdownToHTML(fixed);
    } else {
      return fixed
        .split('\n')
        .map(line => line.trim() === '' ? '<br>' : `<p>${line}</p>`)
        .join('');
    }
  };

  // Функция для обработки различных типов файлов
  const processFileContent = async (file: File): Promise<string> => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    try {
      switch (fileExtension) {
        case 'docx':
          const docxArrayBuffer = await file.arrayBuffer();
          const docxResult = await mammoth.extractRawText({ arrayBuffer: docxArrayBuffer });
          return docxResult.value;

        case 'pdf':
          try {
            const pdfArrayBuffer = await file.arrayBuffer();
            const pdfData = await pdfParse(pdfArrayBuffer);

            if (pdfData.text && pdfData.text.trim()) {
              return pdfData.text;
            } else {
              return 'PDF файл загружен, но текстовое содержимое не найдено. Возможно, это сканированный документ или изображение.';
            }
          } catch (error) {
            console.error('Ошибка при обработке PDF:', error);
            throw new Error('Не удалось обработать PDF файл. Убедитесь, что файл не поврежден.');
          }

        case 'md':
        case 'txt':
        default:
          return await file.text();
      }
    } catch (error) {
      console.error('Ошибка при обработке файла:', error);
      throw new Error(`Не удалось обработать файл ${file.name}. Убедитесь, что файл не поврежден.`);
    }
  };

  // Shared file upload handler (DRY the two duplicate onChange handlers)
  const handleFileUpload = async (file: File, acceptsPdf: boolean) => {
    // Ограничение размера файла
    const MAX_SIZE_MB = 10;
    const MB = 1024 * 1024;
    if (file.size > MAX_SIZE_MB * MB) {
      alert(`Файл слишком большой. Загрузите файл размером до ${MAX_SIZE_MB} МБ.`);
      return;
    }

    try {
      // Обрабатываем содержимое файла в зависимости от типа
      const text = await processFileContent(file);

      // Умная обработка контента с поддержкой Markdown
      const htmlContent = processTextContent(text, file.name);
      setShowTextEditor(true);
      setEditorContent(htmlContent);
    } catch (error) {
      console.error('Ошибка при чтении файла:', error);
      alert(`Ошибка при чтении файла: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  // Встроенные ошибки ML (вместо alert)
  const [mlInlineError, setMlInlineError] = useState<string | null>(null);

  // Функция обработки текста через ML API
  const handleMLProcess = async () => {
    setMlInlineError(null);

    if (!editorInstance) {
      setMlInlineError('Редактор не инициализирован. Перезагрузите страницу.');
      return;
    }

    const text = editorInstance.getText();

    if (!text.trim()) {
      setMlInlineError('Введите текст для обработки в редактор.');
      return;
    }

    const MAX_TEXT_LENGTH = 70000;
    if (text.length > MAX_TEXT_LENGTH) {
      setMlInlineError(
        `Текст слишком длинный: ${text.length.toLocaleString()} символов (максимум ${MAX_TEXT_LENGTH.toLocaleString()}). Сократите текст или разбейте на части.`
      );
      return;
    }

    if (selectedMLMode === 'expand_topic' && !topicInput.trim()) {
      setMlInlineError('Для режима "Расширение темы" необходимо указать тему.');
      return;
    }

    setOriginalText(editorInstance.getHTML());
    setEditorMode('original');

    try {
      const processedTextResult = await processText(
        text,
        selectedMLMode,
        selectedMLMode === 'expand_topic' ? topicInput : undefined
      );

      if (processedTextResult) {
        const fixedMarkdown = fixBrokenFormulas(processedTextResult);
        setRawMarkdown(fixedMarkdown);
        const htmlContent = convertMarkdownToHTML(fixedMarkdown);
        setProcessedText(htmlContent);
        // Сохраняем результат в историю по текущему режиму (Q3)
        setMlResults(prev => ({ ...prev, [selectedMLMode]: { html: htmlContent, rawMd: fixedMarkdown } }));
        setEditorMode('processed');
      }
    } catch (error) {
      console.error('❌ Ошибка обработки:', error);
      const errorMessage = error instanceof Error ? error.message
        : typeof error === 'string' ? error : 'Неизвестная ошибка';
      setMlInlineError(`Ошибка обработки текста: ${errorMessage}`);
    }
  };

  // Функция копирования текста в буфер обмена
  const handleCopyText = async () => {
    if (!editorInstance) {
      alert('❌ Редактор не инициализирован');
      return;
    }

    try {
      const text = editorInstance.getText();
      await navigator.clipboard.writeText(text);
      setIsCopied(true);

      // Сбросить состояние через 2 секунды
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Ошибка при копировании:', error);
      alert('Не удалось скопировать текст');
    }
  };

  return (
    <>
      {/* Заголовочный блок */}
      <div className="text-center mb-4 md:mb-8 px-4">
        <h1
          className="text-2xl md:text-3xl lg:text-4xl xl:text-4xl font-light mb-2 md:mb-3 lg:mb-4 tracking-wide"
          style={{ color: 'var(--text-primary)' }}
        >
          Обработка текста с помощью ИИ
        </h1>
        <p
          className="text-sm md:text-base lg:text-lg xl:text-lg opacity-70 max-w-3xl mx-auto leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          Используйте AI для создания конспектов, терминов, вопросов и многого другого
        </p>

        {/* Счетчик символов */}
        {editorInstance && (
          <div className="mt-4 text-xs opacity-60 text-center" style={{ color: 'var(--text-secondary)' }}>
            Символов в редакторе: {editorInstance.getText().length.toLocaleString()} / 70,000
            {editorInstance.getText().length > 70000 && (
              <span className="text-red-500 ml-2 flex items-center gap-1"><span className="material-symbols-outlined text-sm">warning</span> Превышен лимит!</span>
            )}
          </div>
        )}
      </div>

      {/* Секция загрузки файлов */}
      <div className="bg-transparent border rounded-2xl p-4 md:p-8 lg:p-12 xl:p-16 mb-8 md:mb-16" style={{ borderColor: 'var(--border-color)' }}>
        <div className="text-center">
          <div className="mb-8">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 22 22"
              strokeWidth="1"
              stroke="currentColor"
              className="w-16 h-16 mx-auto mb-4 transition-colors duration-300"
              style={{ color: 'var(--text-primary)' }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3
              className="text-xl font-normal mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              Загрузите файл или введите текст
            </h3>
            <p
              className="text-base opacity-80 mb-6"
              style={{ color: 'var(--text-secondary)' }}
            >
              Загрузите транскрибированную лекцию или текстовый файл для обработки с помощью ИИ
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={openLectureModal}
              className="btn-upload inline-flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">library_books</span>
              Выбрать из лекций
            </button>
            <label className="btn-upload inline-block cursor-pointer">
              <input
                type="file"
                accept=".txt,.md,.doc,.docx"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await handleFileUpload(file, false);
                  e.target.value = '';
                }}
              />
              <span>Загрузить файл лекции</span>
            </label>
            <label className="btn-upload inline-block cursor-pointer">
              <input
                type="file"
                accept=".txt,.md,.pdf,.doc,.docx"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await handleFileUpload(file, true);
                  e.target.value = '';
                }}
              />
              Загрузить текстовый файл
            </label>
          </div>
        </div>
      </div>

      {/* Онбординг: подсказка когда редактор не открыт (Q7) */}
      {!showTextEditor && (
        <div className="mb-8 p-5 rounded-2xl border" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span className="material-symbols-outlined text-sm">lightbulb</span>Как это работает
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {[
              { step: '1', text: 'Выберите лекцию из списка или загрузите текстовый файл' },
              { step: '2', text: 'Текст откроется в редакторе — отредактируйте при необходимости' },
              { step: '3', text: 'Выберите режим ИИ-обработки и нажмите «Обработать»' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-2 flex-1">
                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(181,132,136,0.2)', color: '#B58488' }}>{step}</span>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Редактор текста */}
      {showTextEditor && (
        <div className="mt-8">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex-1">
              <h3
                className="text-lg font-semibold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                Редактор текста
              </h3>
              <p
                className="text-sm opacity-70"
                style={{ color: 'var(--text-secondary)' }}
              >
                Используйте панель инструментов для форматирования текста
              </p>
            </div>
            <button
              onClick={() => setShowEditorHelp(true)}
              className="ml-4 p-2 rounded-full hover:bg-hover transition-all duration-300 flex-shrink-0"
              style={{
                color: 'var(--text-secondary)',
                background: 'var(--hover-bg)',
                border: '2px solid var(--border-color)'
              }}
              title="Помощь по редактору"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          <div ref={editorWrapperRef} onMouseUp={handleEditorSelect} onKeyUp={handleEditorSelect}>
            <RichTextEditor
              initialContent={editorContent}
              onContentChange={(content) => {
                setEditorContent(content);
              }}
              onEditorReady={(editor) => {
                setEditorInstance(editor);
              }}
              showModeSwitcher={true}
              originalText={originalText}
              processedText={processedText}
              currentMode={editorMode}
              onModeChange={setEditorMode}
              isProcessing={isProcessing}
            />
          </div>

          {/* Предупреждение о превышении лимита */}
          {editorInstance && editorInstance.getText().length > 70000 && (
            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
              <p className="text-red-800 dark:text-red-300 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined">warning</span>
                <strong>Внимание:</strong> Текст превышает лимит в 70,000 символов.
                Текущая длина: {editorInstance.getText().length.toLocaleString()} символов.
                Пожалуйста, сократите текст перед обработкой.
              </p>
            </div>
          )}

          {/* ── ML mode selector (Q6) ── */}
          <div className="mt-8 p-5 rounded-2xl border" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="material-symbols-outlined text-base">auto_awesome</span>
              Обработка с помощью ИИ
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {mlModes.map(mode => {
                const savedResult = mlResults[mode.id];
                return (
                  <button
                    key={mode.id}
                    onClick={() => { setSelectedMLMode(mode.id as MLMode); setMlInlineError(null); }}
                    className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all duration-200 text-sm relative ${
                      selectedMLMode === mode.id ? 'shadow-md' : ''
                    }`}
                    style={{
                      borderColor: selectedMLMode === mode.id ? '#B58488' : 'var(--border-color)',
                      background: selectedMLMode === mode.id ? 'rgba(181,132,136,0.1)' : 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span className="material-symbols-outlined text-base block mb-1" style={{ color: selectedMLMode === mode.id ? '#B58488' : 'var(--text-secondary)' }}>{mode.icon}</span>
                    <span className="font-medium leading-tight">{mode.name}</span>
                    {savedResult && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: '#22c55e' }} title="Есть сохранённый результат" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Topic input for expand_topic */}
            {selectedMLMode === 'expand_topic' && (
              <div className="mb-3">
                <input
                  type="text"
                  value={topicInput}
                  onChange={e => { setTopicInput(e.target.value); setMlInlineError(null); }}
                  placeholder="Укажите тему для расширения..."
                  className="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-all"
                  style={{
                    borderColor: 'var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            )}

            {/* Inline error (Q6) */}
            {mlInlineError && (
              <div className="mb-3 px-3 py-2.5 rounded-lg flex items-start gap-2 text-sm"
                style={{ background: 'rgba(181,132,136,0.12)', border: '1px solid rgba(181,132,136,0.3)', color: 'var(--text-primary)' }}>
                <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 16, color: '#B58488', marginTop: 1 }}>error</span>
                <span>{mlInlineError}</span>
              </div>
            )}

            <button
              onClick={handleMLProcess}
              disabled={isProcessing || (selectedMLMode === 'expand_topic' && !topicInput.trim())}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
              style={{
                background: isProcessing ? 'var(--hover-bg)' : 'var(--text-primary)',
                color: isProcessing ? 'var(--text-secondary)' : 'var(--bg-primary)',
                border: '2px solid var(--text-primary)',
              }}
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Обрабатывается...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">auto_awesome</span>
                  Обработать
                </>
              )}
            </button>
          </div>

          {/* Отображение ошибки и индикатора обработки */}
          <div className="mt-6 flex flex-col gap-4">
            {/* Отображение ошибки */}
            {mlError && (
              <div
                className="p-4 border-2 rounded-lg"
                style={{
                  borderColor: '#B58488',
                  background: isLightTheme ? 'rgba(181, 132, 136, 0.1)' : 'rgba(181, 132, 136, 0.15)',
                  color: 'var(--text-primary)'
                }}
              >
                <p className="flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span className="material-symbols-outlined" style={{ color: '#B58488' }}>error</span>
                  <strong>Ошибка:</strong> {mlError}
                </p>
              </div>
            )}

            {/* Индикатор обработки */}
            {isProcessing && (
              <div className="p-4 border rounded-lg"
                style={{
                  borderColor: 'var(--border-color)',
                  background: 'var(--hover-bg)'
                }}>
                <p className="flex items-center gap-2 font-medium"
                  style={{ color: 'var(--text-primary)' }}>
                  <span className="material-symbols-outlined">hourglass_empty</span>
                  Обработка может занять 30-90 секунд в зависимости от объёма текста и выбранного режима...
                </p>
              </div>
            )}
          </div>

          {/* Панель экспорта справа снизу */}
          <div className="mt-6 flex flex-col md:items-end gap-4 w-full">
            {/* Выбор формата экспорта */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full md:w-auto">
              <label className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                Формат экспорта:
              </label>
              <div className="grid grid-cols-4 md:flex md:flex-wrap gap-2 w-full md:w-auto">
                {[
                  { value: 'txt', label: 'TXT' },
                  { value: 'md', label: 'MD' },
                  { value: 'docx', label: 'DOCX' },
                  { value: 'pdf', label: 'PDF' }
                ].map((format) => (
                  <button
                    key={format.value}
                    onClick={() => setSaveFormat(format.value)}
                    className={`btn btn-sm border-2 transition-all duration-200 hover:-translate-y-1 ${
                      saveFormat === format.value
                        ? 'shadow-lg'
                        : ''
                    }`}
                    style={{
                      borderColor: saveFormat === format.value ? 'var(--text-primary)' : 'var(--border-color)',
                      background: saveFormat === format.value ? 'var(--text-primary)' : 'var(--hover-bg)',
                      color: saveFormat === format.value ? 'var(--bg-primary)' : 'var(--text-primary)',
                      minWidth: '60px'
                    }}
                  >
                    {format.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Кнопки действий */}
            <div className="flex flex-col md:flex-row md:flex-wrap gap-3 w-full md:w-auto">
              {/* Кнопка отмены обработки - показывается только во время обработки */}
              {isProcessing && (
                <button
                  onClick={cancelProcessing}
                  className="px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200 hover:-translate-y-1 flex items-center justify-center gap-2 w-full md:w-auto"
                  style={{
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                    background: 'var(--hover-bg)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--text-primary)';
                    e.currentTarget.style.color = 'var(--bg-primary)';
                    e.currentTarget.style.borderColor = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--hover-bg)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                  Отменить обработку
                </button>
              )}

              <button
                onClick={handleCopyText}
                className="btn btn-lg flex items-center justify-center gap-2 w-full md:w-auto"
              >
                {isCopied ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Скопировано!
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Скопировать текст
                  </>
                )}
              </button>
              <button
                onClick={async () => {
                  const filename = buildExportFilename();

                  try {
                    switch (saveFormat) {
                      case 'txt':
                        exportToTxt({ filename: `${filename}.txt` });
                        break;
                      case 'md':
                        // Экспортируем исходный Markdown от LLM (с правильными $$...$$)
                        if (editorMode === 'processed' && rawMarkdown) {
                          saveAs(new Blob([rawMarkdown], { type: 'text/markdown;charset=utf-8' }), `${filename}.md`);
                        } else {
                          exportToMarkdown({ filename: `${filename}.md` });
                        }
                        break;
                      case 'docx':
                        await exportToDocx({ filename: `${filename}.docx` });
                        break;
                      case 'pdf':
                        // Для обработанного текста — серверный рендеринг через Playwright
                        if (editorMode === 'processed' && rawMarkdown) {
                          const resp = await fetch('/api/export/pdf', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ markdown: rawMarkdown }),
                          });
                          if (resp.ok) {
                            const blob = await resp.blob();
                            saveAs(blob, `${filename}.pdf`);
                          } else {
                            // Fallback на клиентский экспорт
                            await exportToPdf({ filename: `${filename}.pdf` });
                          }
                        } else {
                          await exportToPdf({ filename: `${filename}.pdf` });
                        }
                        break;
                      default:
                        exportToTxt({ filename: `${filename}.txt` });
                    }

                    // Показываем индикацию успешного скачивания
                    setIsDownloaded(true);
                    setTimeout(() => {
                      setIsDownloaded(false);
                    }, 2000);
                  } catch (error) {
                    console.error('Ошибка при экспорте:', error);
                    alert('Ошибка при сохранении файла');
                  }
                }}
                className="btn-gradient btn-lg flex items-center justify-center gap-2 w-full md:w-auto"
              >
                {isDownloaded ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Скачано!
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Скачать файл
                  </>
                )}
              </button>

              {lectureId && onSaveLecture && canSaveLecture && (
                <button
                  onClick={async () => {
                    if (!editorInstance) return;
                    const text = editorInstance.getText();
                    setIsSaving(true);
                    try {
                      await onSaveLecture(text);
                      setIsSaved(true);
                      setTimeout(() => setIsSaved(false), 2000);
                    } catch (error) {
                      alert('Ошибка при сохранении в лекцию');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  disabled={isSaving}
                  className="btn btn-lg flex items-center justify-center gap-2 w-full md:w-auto"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Сохранение...
                    </>
                  ) : isSaved ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Сохранено!
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">save</span>
                      Сохранить в лекцию
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Всплывающее окно помощи по редактору */}
      {showEditorHelp && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEditorHelp(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              border: '2px solid'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Заголовок с кнопкой закрытия */}
            <div className="sticky top-0 flex items-center justify-between p-6 border-b" style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--border-color)'
            }}>
              <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Справка по редактору
              </h2>
              <button
                onClick={() => setShowEditorHelp(false)}
                className="p-2 rounded-lg hover:bg-hover transition-all duration-300"
                style={{
                  color: 'var(--text-secondary)',
                  background: 'transparent'
                }}
                title="Закрыть"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Содержимое */}
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                  Инструменты форматирования текста
                </h3>

                {/* Заголовки */}
                <div className="p-4 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
                  <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span className="material-symbols-outlined text-lg">list</span> Заголовки (H1, H2, H3)
                  </h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Используйте для структурирования текста. H1 — самый крупный заголовок, H3 — самый мелкий.
                  </p>
                </div>

                {/* Жирный текст */}
                <div className="p-4 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
                  <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span className="text-lg font-bold">B</span> Жирный текст
                  </h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Выделяет важные фрагменты текста полужирным начертанием.
                  </p>
                </div>

                {/* Курсив */}
                <div className="p-4 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
                  <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span className="text-lg italic">I</span> Курсив
                  </h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Применяет курсивное начертание к выделенному тексту.
                  </p>
                </div>

                {/* Маркированный список */}
                <div className="p-4 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
                  <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span className="text-lg">•</span> Маркированный список
                  </h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Создаёт список с маркерами (точками). Подходит для перечисления элементов без порядка.
                  </p>
                </div>

                {/* Нумерованный список */}
                <div className="p-4 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
                  <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span className="text-lg">1.</span> Нумерованный список
                  </h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Создаёт пронумерованный список. Используется для упорядоченного перечисления.
                  </p>
                </div>

                {/* Инлайн код */}
                <div className="p-4 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
                  <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span className="text-lg">&lt;/&gt;</span> Инлайн код
                  </h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Выделяет небольшие фрагменты кода внутри текста (например, имена переменных или команд).
                  </p>
                </div>

                {/* Блок кода */}
                <div className="p-4 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
                  <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span className="text-lg">```</span> Блок кода
                  </h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Создаёт многострочный блок для размещения программного кода с сохранением форматирования.
                  </p>
                </div>

                {/* Цитата */}
                <div className="p-4 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
                  <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span className="text-lg">"</span> Цитата
                  </h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Оформляет текст как цитату с характерным отступом и вертикальной линией слева.
                  </p>
                </div>

                {/* Горизонтальная линия */}
                <div className="p-4 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
                  <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span className="text-lg">—</span> Горизонтальная линия
                  </h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Вставляет горизонтальную разделительную линию для визуального разделения разделов текста.
                  </p>
                </div>

                {/* Отменить/Повторить */}
                <div className="p-4 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
                  <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span className="text-lg">↶ ↷</span> Отменить / Повторить
                  </h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Отменяет последнее действие или повторяет отменённое действие.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  <span className="material-symbols-outlined align-middle mr-1">lightbulb</span> Совет
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  При перемещении курсора или выделении текста кнопки инструментов автоматически показывают активные стили форматирования, как в Microsoft Word.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка выбора лекции */}
      {showLectureModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowLectureModal(false); }}
        >
          <div
            className="w-full max-w-lg rounded-xl shadow-xl flex flex-col"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              maxHeight: '80vh',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ color: '#B58488' }}>library_books</span>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Выбрать лекцию</h3>
              </div>
              <button
                onClick={() => setShowLectureModal(false)}
                className="p-1 rounded-lg hover:opacity-70 transition-opacity"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-5 py-4">
              {lecturesLoading ? (
                <div className="text-center py-10 opacity-50" style={{ color: 'var(--text-secondary)' }}>
                  <svg className="animate-spin h-6 w-6 mx-auto mb-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Загрузка лекций...
                </div>
              ) : lectureSelectError ? (
                <p className="text-center py-6 text-sm" style={{ color: '#e57373' }}>{lectureSelectError}</p>
              ) : userLectures.length === 0 ? (
                <div className="text-center py-10 opacity-50" style={{ color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-outlined text-4xl block mb-2">library_books</span>
                  <p className="text-sm">Нет лекций с готовым текстом</p>
                  <p className="text-xs mt-1 opacity-70">Сначала загрузите аудио и дождитесь транскрибации</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {userLectures.map((lecture) => (
                    <button
                      key={lecture.id}
                      onClick={() => handleSelectLecture(lecture.id)}
                      disabled={lectureLoadingId === lecture.id}
                      className="w-full text-left px-4 py-3 rounded-lg border transition-all duration-150 hover:opacity-80"
                      style={{
                        borderColor: 'var(--border-color)',
                        background: 'var(--hover-bg)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                            {lecture.title}
                          </p>
                          <p className="text-xs opacity-50 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            {lecture.subject ? `${lecture.subject} · ` : ''}
                            {new Date(lecture.created_at).toLocaleDateString('ru-RU')}
                            {lecture.is_ai_filtered && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(181,132,136,0.2)', color: '#B58488' }}>
                                AI-фильтр
                              </span>
                            )}
                          </p>
                        </div>
                        {lectureLoadingId === lecture.id ? (
                          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                        ) : (
                          <span className="material-symbols-outlined text-base shrink-0 opacity-40" style={{ color: 'var(--text-secondary)' }}>arrow_forward</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── Explain tooltip ── */}
      {explainTooltip && !explainResult && !explainLoading && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={handleExplainClick}
          style={{
            position: 'fixed',
            left: explainTooltip.x,
            top: explainTooltip.y + 8,
            transform: 'translateX(-100%)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 12px',
            borderRadius: 999,
            fontSize: 12,
            fontFamily: 'Georgia, serif',
            cursor: 'pointer',
            border: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            background: isLightTheme ? '#fffdf5' : '#1f1516',
            color: isLightTheme ? '#44292b' : '#f0e6d8',
            outline: '1px solid rgba(181,132,136,0.35)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
          Объяснить
        </button>
      )}

      {/* ── Explain loading pill ── */}
      {explainTooltip && explainLoading && (
        <div
          style={{
            position: 'fixed',
            left: explainTooltip.x,
            top: explainTooltip.y + 8,
            transform: 'translateX(-100%)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 999,
            fontSize: 12,
            fontFamily: 'Georgia, serif',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            background: isLightTheme ? '#fffdf5' : '#1f1516',
            color: 'var(--text-secondary)',
            outline: '1px solid rgba(181,132,136,0.35)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <svg style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25"/>
            <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Объясняю...
        </div>
      )}

      {/* ── Explain result panel ── */}
      {explainTooltip && (explainResult !== null || explainError) && (
        <div
          ref={explainPanelRef}
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: Math.min(explainTooltip.x, window.innerWidth - 348),
            top: Math.min(explainTooltip.y + 8, window.innerHeight - 300),
            transform: 'translateX(-100%)',
            zIndex: 1000,
            width: 320,
            maxHeight: 340,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            background: isLightTheme ? '#fffdf5' : '#1f1516',
            outline: '1px solid rgba(181,132,136,0.3)',
            fontFamily: 'Georgia, serif',
            overflow: 'hidden',
          }}
        >
          {/* Panel header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 14px 8px',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#B58488' }}>auto_awesome</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
              «{explainTooltip.text.slice(0, 60)}{explainTooltip.text.length > 60 ? '…' : ''}»
            </span>
            <button
              onClick={() => { setExplainTooltip(null); setExplainResult(null); setExplainError(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2, display: 'flex', borderRadius: 4, flexShrink: 0 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>

          {/* Panel body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 12px' }}>
            {explainError ? (
              <p style={{ fontSize: 12, color: '#B58488', margin: 0 }}>{explainError}</p>
            ) : (
              <div
                className="prose prose-sm max-w-none"
                style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-primary)' }}
                dangerouslySetInnerHTML={{ __html: safeMdParse(explainResult || '') }}
              />
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
};

export default TextProcessingSection;
