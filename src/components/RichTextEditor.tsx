import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import HardBreak from '@tiptap/extension-hard-break';

interface RichTextEditorProps {
  onContentChange?: (content: string) => void;
  initialContent?: string;
  onEditorReady?: (editor: any) => void;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  onContentChange, 
  initialContent = '',
  onEditorReady
}) => {
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
    },
    onCreate: ({ editor }) => {
      onEditorReady?.(editor);
    },
  });

  // Обновляем содержимое редактора при изменении initialContent
  useEffect(() => {
    if (editor && initialContent !== undefined) {
      const currentContent = editor.getHTML();
      if (currentContent !== initialContent) {
        editor.commands.setContent(initialContent);
      }
    }
  }, [editor, initialContent]);


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
      className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 hover:scale-105 ${
        isActive
          ? 'bg-blue-500 text-white shadow-lg'
          : 'bg-transparent border hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      style={{
        borderColor: isActive ? 'transparent' : 'var(--border-color)',
        color: isActive ? 'white' : 'var(--text-secondary)',
        background: isActive ? '#3b82f6' : 'var(--hover-bg)'
      }}
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div className="w-full">
      {/* CSS стили для переносов строк как в Markdown */}
      <style>{`
        :root {
          --code-bg-light: #f3f4f6;
          --code-text-light: #374151;
          --code-bg-dark: #374151;
          --code-text-dark: #f3f4f6;
          --border-light: #e5e7eb;
          --border-dark: #4b5563;
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
        
        .ProseMirror {
          white-space: pre-wrap;
          line-height: 1.8;
        }
        .ProseMirror p {
          margin-bottom: 1rem;
          margin-top: 0;
        }
        .ProseMirror p:first-child {
          margin-top: 0;
        }
        .ProseMirror p:last-child {
          margin-bottom: 0;
        }
        .ProseMirror br {
          display: block;
          margin: 0.5rem 0;
          content: "";
          line-height: 1.8;
        }
        .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, 
        .ProseMirror h4, .ProseMirror h5, .ProseMirror h6 {
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          line-height: 1.4;
        }
        .ProseMirror h1:first-child, .ProseMirror h2:first-child, 
        .ProseMirror h3:first-child, .ProseMirror h4:first-child, 
        .ProseMirror h5:first-child, .ProseMirror h6:first-child {
          margin-top: 0;
        }
         .ProseMirror ul, .ProseMirror ol {
           margin: 0.75rem 0;
           padding-left: 1.5rem;
         }
         .ProseMirror li {
           margin: 0.25rem 0;
           display: list-item;
         }
         .ProseMirror ol li {
           list-style-type: decimal;
         }
         .ProseMirror ul li {
           list-style-type: disc;
         }
         .ProseMirror blockquote {
           margin: 1rem 0;
           padding-left: 1rem;
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
           margin: 1.5rem 0;
         }
      `}</style>
      
      {/* Панель инструментов */}
      <div className="flex flex-wrap gap-2 p-4 bg-transparent border rounded-t-lg" style={{ borderColor: 'var(--border-color)' }}>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Жирный текст"
        >
          <strong>B</strong>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Курсив"
        >
          <em>I</em>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Маркированный список"
        >
          <span>•</span>
        </ToolbarButton>
        
         <ToolbarButton
           onClick={() => editor.chain().focus().toggleOrderedList().run()}
           isActive={editor.isActive('orderedList')}
           title="Нумерованный список"
         >
           <span>1.</span>
         </ToolbarButton>
         
         <ToolbarButton
           onClick={() => editor.chain().focus().toggleCode().run()}
           isActive={editor.isActive('code')}
           title="Код"
         >
           <span>&lt;/&gt;</span>
         </ToolbarButton>
         
         <ToolbarButton
           onClick={() => editor.chain().focus().toggleBlockquote().run()}
           isActive={editor.isActive('blockquote')}
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

      {/* Область редактирования с кнопками прокрутки */}
      <div className="relative">
        {/* Фиксированные кнопки прокрутки */}
        <div className="fixed right-6 top-1/2 transform -translate-y-1/2 z-50 flex flex-col gap-3">
          <button
            onClick={() => {
              const editorElement = document.querySelector('.ProseMirror');
              if (editorElement) {
                editorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            className="w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110 flex items-center justify-center"
            style={{
              background: 'var(--button-bg, #3b82f6)',
              color: 'var(--button-text, white)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
            title="В начало редактора"
          >
            ↑
          </button>
          <button
            onClick={() => {
              const editorElement = document.querySelector('.ProseMirror');
              if (editorElement) {
                editorElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }
            }}
            className="w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110 flex items-center justify-center"
            style={{
              background: 'var(--button-bg, #3b82f6)',
              color: 'var(--button-text, white)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
            title="В конец редактора"
          >
            ↓
          </button>
        </div>

        {/* Область редактирования */}
        <div 
          className="min-h-96 p-8 bg-transparent border rounded-b-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
          style={{ 
            borderColor: 'var(--border-color)',
            background: 'var(--bg-primary)'
          }}
        >
          <EditorContent 
            editor={editor}
            style={{
              color: 'var(--text-primary)',
              lineHeight: '1.8',
              fontFamily: 'Georgia, Times New Roman, serif',
              outline: 'none',
              whiteSpace: 'pre-wrap',
              fontSize: '16px'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default RichTextEditor;
