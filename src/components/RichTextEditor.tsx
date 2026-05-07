import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import HardBreak from '@tiptap/extension-hard-break';
import CodeBlock from '@tiptap/extension-code-block';
import 'katex/dist/katex.min.css';
import './RichTextEditor.css';

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
  // Рендеринг LaTeX-формул прямо в редакторе (в обработанном режиме)
  useEffect(() => {
    if (currentMode !== 'processed' || !editor?.view?.dom) return;
    import('katex/contrib/auto-render').then(({ default: renderMathInElement }) => {
      if (!editor?.view?.dom) return;
      renderMathInElement(editor.view.dom, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
    });
  }, [currentMode, editor, processedText]);

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
      onContentChange?.(html);
      
      // Обновляем активные форматы при изменении контента
      updateActiveFormats(editor);

      if (currentMode === 'processed' && editor?.view?.dom) {
        import('katex/contrib/auto-render').then(({ default: renderMathInElement }) => {
          if (!editor?.view?.dom) return;
          renderMathInElement(editor.view.dom, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\(', right: '\\)', display: false },
            ],
            throwOnError: false,
          });
        });
      }
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

  // При переключении на оригинал — восстанавливаем в TipTap
  useEffect(() => {
    if (editor && showModeSwitcher && currentMode === 'original') {
      if (originalText) {
        editor.commands.setContent(originalText);
      }
    }
  }, [editor, currentMode, originalText, showModeSwitcher]);


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
