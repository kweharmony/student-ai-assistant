import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountPageProps, ActiveSection } from './types';
import Sidebar from './Sidebar';
import ProfileSection from './ProfileSection';
import CalendarSection from './CalendarSection';
import TranscriberSection, { LectureMeta } from './TranscriberSection';
import TextProcessingSection from './TextProcessingSection';
import TranscriptionModals from './TranscriptionModals';
import AdminDashboard from './AdminDashboard';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const filterBenefits = [
  'Орфографические ошибки распознавания',
  'Фразы-паразиты (эээ, ну, вот)',
  'Пунктуацию и форматирование',
  'Разделение на абзацы'
];

const errorRecoverySteps = [
  'Проверьте стабильность интернет-соединения',
  'Убедитесь, что формат файла поддерживается',
  'Попробуйте загрузить запись ещё раз'
];

const AccountPage: React.FC<AccountPageProps> = ({ onToggleTheme, isLightTheme }) => {
  const navigate = useNavigate();
  const { token } = useAuth();

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>('profile');
  const [showSidebarText, setShowSidebarText] = useState(false);

  // Editor state (shared between transcriber -> text-processing)
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [editorMode, setEditorMode] = useState<'original' | 'processed'>('original');
  const [originalText, setOriginalText] = useState<string>('');
  const [processedText, setProcessedText] = useState<string>('');

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState('');
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionMinimized, setTranscriptionMinimized] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);

  // Закрытие мобильного меню при изменении размера экрана
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
      // Обновляем состояние текста при изменении размера экрана
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        setShowSidebarText(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Управление появлением текста в боковой панели
  useEffect(() => {
    // Для мобильных устройств показываем только MS, без текста
    const isMobile = window.innerWidth < 1024;

    if (isMobile) {
      setShowSidebarText(false);
      return;
    }

    if (!sidebarCollapsed || mobileMenuOpen) {
      const timer = setTimeout(() => {
        setShowSidebarText(true);
      }, mobileMenuOpen ? 100 : 200); // Быстрее для мобильных
      return () => clearTimeout(timer);
    } else {
      // Задержка перед скрытием текста при закрытии
      const timer = setTimeout(() => {
        setShowSidebarText(false);
      }, mobileMenuOpen ? 50 : 100); // Быстрее для мобильных
      return () => clearTimeout(timer);
    }
  }, [sidebarCollapsed, mobileMenuOpen]);

  // Обработка переключения темы
  const handleThemeToggle = () => {
    onToggleTheme();
  };

  // Функция загрузки аудио + метаданных лекции на сервер
  const handleAudioTranscription = async (file: File, meta: LectureMeta) => {
    setIsTranscribing(true);
    setTranscriptionError(null);
    setTranscriptionProgress('Загрузка лекции на сервер...');
    setTranscriptionMinimized(false);

    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('title', meta.title);
      if (meta.subject) formData.append('subject', meta.subject);
      if (meta.description) formData.append('description', meta.description);
      if (meta.lecture_date) formData.append('lecture_date', meta.lecture_date);
      formData.append('is_public', String(meta.is_public));

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE}/api/transcribe/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Ошибка загрузки файла');
      }

      const result = await response.json();

      setTranscriptionProgress('Лекция создана и файл загружен!');

      setTimeout(() => {
        setIsTranscribing(false);
        setTranscriptionProgress('');
      }, 2500);

    } catch (error: any) {
      console.error('Ошибка загрузки:', error);
      setTranscriptionError(error.message || 'Произошла ошибка при загрузке');
      setIsTranscribing(false);
    }
  };

  // Функция для пропуска фильтрации (сразу в редактор)
  const handleSkipFilter = () => {
    setShowFilterModal(false);

    // Вставляем текст в редактор без фильтрации
    if (editorInstance) {
      editorInstance.commands.setContent(transcribedText);
    }
    setOriginalText(transcribedText);
    setEditorMode('original');

    // Переключаемся на раздел обработки текста
    setActiveSection('text-processing');
    setShowTextEditor(true);

    // Очищаем сохраненный текст
    setTranscribedText('');
  };

  // Функция для применения AI-фильтрации
  const handleApplyFilter = async () => {
    setIsFiltering(true);

    try {
      // Отправляем текст на фильтрацию
      const response = await fetch(`${API_BASE}/api/transcribe/filter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: transcribedText }),
      });

      if (!response.ok) {
        throw new Error('Ошибка фильтрации текста');
      }

      const result = await response.json();

      if (result.success) {
        // Вставляем отфильтрованный текст в редактор
        if (editorInstance) {
          editorInstance.commands.setContent(result.filtered_text);
        }
        setOriginalText(result.filtered_text);
        setEditorMode('original');

        // Закрываем модальное окно
        setShowFilterModal(false);
        setIsFiltering(false);

        // Переключаемся на раздел обработки текста
        setActiveSection('text-processing');
        setShowTextEditor(true);

        // Очищаем сохраненный текст
        setTranscribedText('');
      } else {
        console.error('❌ Фильтрация вернула success=false');
        throw new Error('Фильтрация не удалась');
      }
    } catch (error: any) {
      console.error('Ошибка фильтрации:', error);
      alert('Ошибка AI-фильтрации. Текст будет вставлен без обработки.');

      // В случае ошибки вставляем оригинальный текст
      handleSkipFilter();
    }
  };

  return (
    <div className={`min-h-screen overflow-x-hidden relative transition-all duration-500 ${
      isLightTheme ? 'light-theme' : ''
    }`} style={{
      fontFamily: 'Georgia, Times New Roman, serif',
      lineHeight: '1.8',
      color: 'var(--text-primary)',
      background: 'var(--bg-primary)'
    }}>
      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        showSidebarText={showSidebarText}
        isLightTheme={isLightTheme}
        onThemeToggle={handleThemeToggle}
        navigate={navigate}
      />

      {/* Мобильная кнопка меню */}
      {!mobileMenuOpen && (
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="fixed top-4 left-4 z-50 lg:hidden p-3 bg-transparent border rounded-lg hover:bg-hover transition-all duration-300"
          style={{
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
            background: 'var(--hover-bg)'
          }}
          aria-label="Открыть меню"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <main className="w-full px-4 md:px-8 lg:px-15 py-8 md:py-20 lg:py-20 relative z-10 lg:ml-0 " style={{ paddingBottom: '3rem' }}>
        <div className="max-w-5xl mx-auto">
        {/* Контент в зависимости от выбранной секции */}
        {activeSection === 'profile' && (
          <ProfileSection
            isLightTheme={isLightTheme}
            navigate={navigate}
          />
        )}

        {activeSection === 'calendar' && (
          <CalendarSection
            isLightTheme={isLightTheme}
          />
        )}

        {activeSection === 'transcriber' && (
          <TranscriberSection
            handleAudioTranscription={handleAudioTranscription}
          />
        )}

        {activeSection === 'text-processing' && (
          <TextProcessingSection
            isLightTheme={isLightTheme}
            editorInstance={editorInstance}
            setEditorInstance={setEditorInstance}
            editorContent={editorContent}
            setEditorContent={setEditorContent}
            showTextEditor={showTextEditor}
            setShowTextEditor={setShowTextEditor}
            originalText={originalText}
            setOriginalText={setOriginalText}
            processedText={processedText}
            setProcessedText={setProcessedText}
            editorMode={editorMode}
            setEditorMode={setEditorMode}
          />
        )}

        {activeSection === 'admin' && (
          <AdminDashboard />
        )}
        </div>
      </main>

      <TranscriptionModals
        isLightTheme={isLightTheme}
        isTranscribing={isTranscribing}
        transcriptionProgress={transcriptionProgress}
        transcriptionMinimized={transcriptionMinimized}
        setTranscriptionMinimized={setTranscriptionMinimized}
        transcriptionError={transcriptionError}
        setTranscriptionError={setTranscriptionError}
        errorRecoverySteps={errorRecoverySteps}
        showFilterModal={showFilterModal}
        handleApplyFilter={handleApplyFilter}
        handleSkipFilter={handleSkipFilter}
        isFiltering={isFiltering}
        filterBenefits={filterBenefits}
      />
    </div>
  );
};

export default AccountPage;
