import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import HardBreak from '@tiptap/extension-hard-break';
import CodeBlock from '@tiptap/extension-code-block';

interface RichTextEditorProps {
  onContentChange?: (content: string) => void;
  initialContent?: string;
  onEditorReady?: (editor: any) => void;
  showModeSwitcher?: boolean;
  originalText?: string;
  processedText?: string;
  currentMode?: 'original' | 'processed';
  onModeChange?: (mode: 'original' | 'processed') => void;
  isProcessing?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  onContentChange, 
  initialContent = '',
  onEditorReady,
  showModeSwitcher = false,
  originalText = '',
  processedText = '',
  currentMode = 'original',
  onModeChange,
  isProcessing = false
}) => {
  // Состояние для отслеживания активных форматов
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    code: false,
    heading1: false,
    heading2: false,
    heading3: false,
    bulletList: false,
    orderedList: false,
    blockquote: false,
    codeBlock: false,
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: {
          HTMLAttributes: {
            class: 'mb-3',
          },
        },
        hardBreak: {
          HTMLAttributes: {
            class: 'break-line',
          },
        },
      }),
      HardBreak,
      CodeBlock,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-80',
        style: 'outline: none; white-space: pre-wrap;'
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      console.log('Editor content changed:', html);
      onContentChange?.(html);
      
      // Обновляем активные форматы при изменении контента
      updateActiveFormats(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      // Обновляем активные форматы при изменении позиции курсора
      updateActiveFormats(editor);
    },
    onCreate: ({ editor }) => {
      onEditorReady?.(editor);
      // Инициализируем активные форматы
      updateActiveFormats(editor);
    },
  });

  // Функция для обновления активных форматов
  const updateActiveFormats = (editor: any) => {
    if (!editor) return;
    
    setActiveFormats({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      code: editor.isActive('code'),
      heading1: editor.isActive('heading', { level: 1 }),
      heading2: editor.isActive('heading', { level: 2 }),
      heading3: editor.isActive('heading', { level: 3 }),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      blockquote: editor.isActive('blockquote'),
      codeBlock: editor.isActive('codeBlock'),
    });
  };

  // Обновляем содержимое редактора при изменении initialContent
  useEffect(() => {
    if (editor && initialContent !== undefined) {
      const currentContent = editor.getHTML();
      if (currentContent !== initialContent) {
        editor.commands.setContent(initialContent);
      }
    }
  }, [editor, initialContent]);

  // Логика переключения между исходным и обработанным текстом
  useEffect(() => {
    if (editor && showModeSwitcher) {
      const contentToShow = currentMode === 'original' ? originalText : processedText;
      if (contentToShow) {
        editor.commands.setContent(contentToShow);
      }
    }
  }, [editor, currentMode, originalText, processedText, showModeSwitcher]);


  if (!editor) {
    return null;
  }

  const ToolbarButton: React.FC<{
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
  }> = ({ onClick, isActive, children, title }) => (
    <button
      onClick={onClick}
      className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-xs md:text-sm font-medium rounded-md transition-all duration-200 hover:scale-110 ${
        isActive
          ? 'shadow-lg transform scale-105'
          : 'bg-transparent border hover:bg-hover'
      }`}
      style={{
        borderColor: isActive ? 'transparent' : 'var(--border-color)',
        color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)',
        background: isActive ? 'var(--text-primary)' : 'var(--hover-bg)',
        boxShadow: isActive ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
        fontWeight: isActive ? '600' : '500'
      }}
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div className="w-full">
      {/* Переключатель режимов */}
      {showModeSwitcher && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => onModeChange?.('original')}
            className={`px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200 hover:-translate-y-1 ${
              currentMode === 'original'
                ? 'shadow-lg'
                : ''
            }`}
            style={{
              borderColor: currentMode === 'original' ? 'var(--text-primary)' : 'var(--border-color)',
              color: currentMode === 'original' ? 'var(--bg-primary)' : 'var(--text-primary)',
              background: currentMode === 'original' ? 'var(--text-primary)' : 'var(--hover-bg)'
            }}
          >
            Исходный текст
          </button>
          <button
            onClick={() => onModeChange?.('processed')}
            disabled={!processedText || isProcessing}
            className={`px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200 ${
              currentMode === 'processed'
                ? 'shadow-lg hover:-translate-y-1'
                : 'hover:-translate-y-1'
            } ${!processedText || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{
              borderColor: currentMode === 'processed' ? 'var(--text-primary)' : 'var(--border-color)',
              color: currentMode === 'processed' ? 'var(--bg-primary)' : 'var(--text-primary)',
              background: currentMode === 'processed' ? 'var(--text-primary)' : 'var(--hover-bg)'
            }}
          >
            {isProcessing ? 'Обрабатывается...' : 'Обработанный текст'}
          </button>
        </div>
      )}

      {/* CSS стили для переносов строк как в Markdown */}
      <style>{`
        :root {
          --code-bg-light: #f6f8fa;
          --code-text-light: #24292e;
          --code-bg-dark: #2d3748;
          --code-text-dark: #e2e8f0;
          --border-light: #d1d5da;
          --border-dark: #4a5568;
        }
        
        .light-theme {
          --code-bg: var(--code-bg-light);
          --code-text: var(--code-text-light);
          --border-color: var(--border-light);
        }
        
        .dark-theme {
          --code-bg: var(--code-bg-dark);
          --code-text: var(--code-text-dark);
          --border-color: var(--border-dark);
        }
        
        /* Дополнительные стили для инлайн кода */
        .ProseMirror code {
          transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        
        .ProseMirror {
          white-space: pre-wrap;
          line-height: 1.5;
          font-size: 16px;
          color: var(--text-primary);
          word-wrap: break-word;
          word-break: break-word;
          overflow-wrap: break-word;
          max-width: 100%;
        }
        .ProseMirror p {
          margin: 0 0 16px 0;
        }
        .ProseMirror p:first-child {
          margin-top: 0;
        }
        .ProseMirror p:last-child {
          margin-bottom: 0;
        }
        .ProseMirror br {
          display: block;
          margin: 0;
          content: "";
          line-height: 1.5;
        }
        .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, 
        .ProseMirror h4, .ProseMirror h5, .ProseMirror h6 {
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }
        .ProseMirror h1:first-child, .ProseMirror h2:first-child, 
        .ProseMirror h3:first-child, .ProseMirror h4:first-child, 
        .ProseMirror h5:first-child, .ProseMirror h6:first-child {
          margin-top: 0;
        }
         .ProseMirror ul, .ProseMirror ol {
           margin: 0.5rem 0;
           padding-left: 1.25rem;
         }
         .ProseMirror li {
           margin: 0.125rem 0;
           display: list-item;
         }
         .ProseMirror ol li {
           list-style-type: decimal;
         }
         .ProseMirror ul li {
           list-style-type: disc;
         }
         .ProseMirror blockquote {
           margin: 0.5rem 0;
           padding-left: 0.75rem;
           border-left: 3px solid #e5e7eb;
           color: #6b7280;
         }
         .ProseMirror code {
           background-color: var(--code-bg, #f3f4f6);
           color: var(--code-text, #374151);
           padding: 0.125rem 0.25rem;
           border-radius: 0.25rem;
           font-family: 'Courier New', monospace;
           font-size: 0.875rem;
         }
         .ProseMirror hr {
           border: none;
           border-top: 2px solid var(--border-color, #e5e7eb);
           margin: 1rem 0;
         }
         
         /* Дополнительные стили для улучшения читаемости */
         .ProseMirror {
           font-size: 16px;
           color: var(--text-primary);
         }
         
         .ProseMirror:focus {
           outline: none;
           box-shadow: none;
         }
         
         .ProseMirror:focus-visible {
           outline: none;
           box-shadow: none;
         }
         
         /* Отключение фокуса для контейнера редактора */
         .editor-container:focus,
         .editor-container:focus-within,
         .editor-container:focus-visible {
           outline: none;
           box-shadow: none;
           border-color: var(--border-color);
         }
         
         .ProseMirror strong {
           font-weight: 600;
         }
         
         .ProseMirror em {
           font-style: italic;
         }
         
         .ProseMirror u {
           text-decoration: underline;
         }
         
         /* Стили для Markdown-подобного отображения */
         .ProseMirror h1 {
           font-size: 2em;
           font-weight: 600;
           color: var(--text-primary);
           border-bottom: 1px solid #eaecef;
           padding-bottom: 0.3em;
           margin: 0.67em 0;
           line-height: 1.25;
           word-wrap: break-word;
           word-break: break-word;
           overflow-wrap: break-word;
         }
         
         .ProseMirror h2 {
           font-size: 1.5em;
           font-weight: 600;
           color: var(--text-primary);
           border-bottom: 1px solid #eaecef;
           padding-bottom: 0.3em;
           margin: 0.83em 0;
           line-height: 1.25;
           word-wrap: break-word;
           word-break: break-word;
           overflow-wrap: break-word;
         }
         
         .ProseMirror h3 {
           font-size: 1.25em;
           font-weight: 600;
           color: var(--text-primary);
           margin: 1em 0;
           line-height: 1.25;
           word-wrap: break-word;
           word-break: break-word;
           overflow-wrap: break-word;
         }
         
         .ProseMirror h4 {
           font-size: 1em;
           font-weight: 600;
           color: var(--text-primary);
           margin: 1.33em 0;
           line-height: 1.25;
           word-wrap: break-word;
           word-break: break-word;
           overflow-wrap: break-word;
         }
         
         .ProseMirror h5 {
           font-size: 0.875em;
           font-weight: 600;
           color: var(--text-primary);
           margin: 1.67em 0;
           line-height: 1.25;
           word-wrap: break-word;
           word-break: break-word;
           overflow-wrap: break-word;
         }
         
         .ProseMirror h6 {
           font-size: 0.85em;
           font-weight: 600;
           color: #6a737d;
           margin: 1.67em 0;
           line-height: 1.25;
           word-wrap: break-word;
           word-break: break-word;
           overflow-wrap: break-word;
         }
         
         /* Улучшенные стили для списков */
         .ProseMirror ul {
           list-style-type: disc;
           margin: 0;
           padding-left: 2em;
         }
         
         .ProseMirror ol {
           list-style-type: decimal;
           margin: 0;
           padding-left: 2em;
         }
         
         .ProseMirror ul ul {
           list-style-type: circle;
           margin: 0;
         }
         
         .ProseMirror ul ul ul {
           list-style-type: square;
           margin: 0;
         }
         
         .ProseMirror li {
           margin: 0;
           line-height: 1.5;
           word-wrap: break-word;
           word-break: break-word;
           overflow-wrap: break-word;
         }
         
         .ProseMirror li > p {
           margin: 0;
         }
         
         /* Стили для кода */
         .ProseMirror pre {
           background-color: var(--code-bg, #f6f8fa);
           color: var(--code-text, #24292e);
           padding: 16px;
           overflow: auto;
           font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
           font-size: 85%;
           line-height: 1.45;
           margin: 0 0 16px 0;
           border-radius: 6px;
           border: 1px solid var(--border-color, #d1d5da);
           transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
         }
         
         .ProseMirror code {
           background-color: var(--code-bg, #f6f8fa);
           color: var(--code-text, #24292e);
           padding: 0.2em 0.4em;
           border-radius: 3px;
           font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
           font-size: 85%;
           border: 1px solid var(--border-color, #d1d5da);
         }
         
         /* Стили для цитат */
         .ProseMirror blockquote {
           border-left: 4px solid #dfe2e5;
           color: #6a737d;
           padding: 0 1em;
           margin: 0 0 16px 0;
         }
         
         .ProseMirror blockquote > :first-child {
           margin-top: 0;
         }
         
         .ProseMirror blockquote > :last-child {
           margin-bottom: 0;
         }
         
         /* Стили для таблиц */
         .ProseMirror table {
           border-collapse: collapse;
           width: 100%;
           margin: 0 0 16px 0;
         }
         
         .ProseMirror th,
         .ProseMirror td {
           border: 1px solid #d1d5da;
           padding: 6px 13px;
           text-align: left;
         }
         
         .ProseMirror th {
           background-color: #f6f8fa;
           font-weight: 600;
         }
         
         .ProseMirror tr:nth-child(even) {
           background-color: #f6f8fa;
         }
         
         /* Общие улучшения для текста */
         .ProseMirror p {
           margin: 0 0 16px 0;
           line-height: 1.5;
           word-wrap: break-word;
           word-break: break-word;
           overflow-wrap: break-word;
         }
         
         .ProseMirror strong {
           font-weight: 600;
         }
         
         .ProseMirror em {
           font-style: italic;
         }
         
         .ProseMirror a {
           color: #0366d6;
           text-decoration: none;
         }
         
         .ProseMirror a:hover {
           text-decoration: underline;
         }
         
         /* Горизонтальные линии */
         .ProseMirror hr {
           border: none;
           border-top: 1px solid #eaecef;
           margin: 24px 0;
         }
         
         /* Стили для скролла */
         .ProseMirror::-webkit-scrollbar {
           width: 8px;
         }
         
         .ProseMirror::-webkit-scrollbar-track {
           background: var(--bg-primary);
           border-radius: 4px;
         }
         
         .ProseMirror::-webkit-scrollbar-thumb {
           background: var(--border-color);
           border-radius: 4px;
         }
         
         .ProseMirror::-webkit-scrollbar-thumb:hover {
           background: var(--text-secondary);
         }
         
         /* Стили для скролла панели инструментов */
         .toolbar-panel::-webkit-scrollbar {
           width: 6px;
         }
         
         .toolbar-panel::-webkit-scrollbar-track {
           background: var(--bg-primary);
           border-radius: 3px;
         }
         
         .toolbar-panel::-webkit-scrollbar-thumb {
           background: var(--border-color);
           border-radius: 3px;
         }
         
         .toolbar-panel::-webkit-scrollbar-thumb:hover {
           background: var(--text-secondary);
         }
         
         /* Мобильные стили */
         @media (max-width: 768px) {
           .editor-container {
             padding: 12px !important;
             font-size: 14px !important;
           }
           
           .toolbar-panel {
             display: grid !important;
             grid-template-columns: repeat(7, 1fr) !important;
             gap: 6px !important;
             padding: 8px !important;
             min-height: auto !important;
             max-height: none !important;
             overflow-x: visible !important;
             overflow-y: visible !important;
             box-sizing: border-box !important;
           }
           
           .toolbar-panel button {
             width: 100% !important;
             height: 42px !important;
             min-width: 40px !important;
             max-width: 100% !important;
             font-size: 14px !important;
             padding: 8px 4px !important;
             box-sizing: border-box !important;
           }
           
           /* Мобильные стили для кнопок */
           .btn-ai {
             width: 100% !important;
             padding: 14px 16px !important;
             font-size: 15px !important;
             justify-content: center !important;
             min-height: 48px !important;
           }
           
           .btn {
             width: 100% !important;
             padding: 12px 16px !important;
             font-size: 14px !important;
             justify-content: center !important;
             min-height: 44px !important;
           }
           
           .btn-gradient {
             width: 100% !important;
             padding: 12px 16px !important;
             font-size: 14px !important;
             justify-content: center !important;
             min-height: 44px !important;
           }
           
           .btn-sm {
             padding: 8px 10px !important;
             font-size: 13px !important;
             min-height: 38px !important;
           }
           
           .btn-lg {
             padding: 14px 16px !important;
             font-size: 15px !important;
             min-height: 48px !important;
           }
         }
      `}</style>
      
      {/* Область редактирования с панелью инструментов справа */}
      <div className="flex flex-col md:flex-row h-[500px] md:h-[600px] w-full">
        {/* Область редактирования */}
        <div className="flex-1 md:flex-1 flex flex-col overflow-hidden w-full">
          <div 
            className="editor-container flex-1 p-4 md:p-8 bg-transparent border rounded-lg md:rounded-l-lg overflow-y-auto w-full"
            style={{ 
              borderColor: 'var(--border-color)',
              background: 'var(--bg-primary)',
              maxHeight: '100%'
            }}
          >
            <EditorContent 
              editor={editor}
              style={{
                color: 'var(--text-primary)',
                lineHeight: '1.4',
                fontFamily: 'Georgia, Times New Roman, serif',
                outline: 'none',
                whiteSpace: 'pre-wrap',
                fontSize: '16px',
                width: '100%'
              }}
            />
          </div>
        </div>

        {/* Вертикальная панель инструментов справа */}
        <div className="toolbar-panel flex flex-row md:flex-col gap-2 p-2 md:p-4 bg-transparent border border-t-0 md:border-t-1 md:border-l-0 rounded-b-lg md:rounded-r-lg h-auto md:h-full overflow-x-auto md:overflow-y-auto w-full md:w-auto" style={{ 
          borderColor: 'var(--border-color)',
          background: 'var(--bg-primary)',
          minWidth: 'auto',
          minHeight: '60px',
          maxWidth: '100%'
        }}>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={activeFormats.heading1}
          title="Заголовок 1"
        >
          H1
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={activeFormats.heading2}
          title="Заголовок 2"
        >
          H2
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={activeFormats.heading3}
          title="Заголовок 3"
        >
          H3
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={activeFormats.bold}
          title="Жирный текст"
        >
          <strong>B</strong>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={activeFormats.italic}
          title="Курсив"
        >
          <em>I</em>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={activeFormats.bulletList}
          title="Маркированный список"
        >
          <span>•</span>
        </ToolbarButton>
        
         <ToolbarButton
           onClick={() => editor.chain().focus().toggleOrderedList().run()}
           isActive={activeFormats.orderedList}
           title="Нумерованный список"
         >
           <span>1.</span>
         </ToolbarButton>
         
         <ToolbarButton
           onClick={() => editor.chain().focus().toggleCode().run()}
           isActive={activeFormats.code}
           title="Инлайн код"
         >
           <span>&lt;/&gt;</span>
         </ToolbarButton>
         
         <ToolbarButton
           onClick={() => editor.chain().focus().toggleCodeBlock().run()}
           isActive={activeFormats.codeBlock}
           title="Блок кода"
         >
           <span>```</span>
         </ToolbarButton>
         
         <ToolbarButton
           onClick={() => editor.chain().focus().toggleBlockquote().run()}
           isActive={activeFormats.blockquote}
           title="Цитата"
         >
           <span>"</span>
         </ToolbarButton>
         
         <ToolbarButton
           onClick={() => editor.chain().focus().setHorizontalRule().run()}
           title="Горизонтальная линия"
         >
           <span>—</span>
         </ToolbarButton>
         
         <ToolbarButton
           onClick={() => editor.chain().focus().undo().run()}
           title="Отменить"
         >
           ↶
         </ToolbarButton>
         
         <ToolbarButton
           onClick={() => editor.chain().focus().redo().run()}
           title="Повторить"
         >
           ↷
         </ToolbarButton>
        </div>
      </div>

    </div>
  );
};

export default RichTextEditor;
