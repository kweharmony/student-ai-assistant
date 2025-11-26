import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import RichTextEditor from './RichTextEditor';
import { useExport } from '../hooks/useExport';
import { useMLProcessor } from '../hooks/useMLProcessor';
import { MLMode, MLModeInfo } from '../types/ml';
import { marked } from 'marked';
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

interface AccountPageProps {
  onToggleTheme: () => void;
  isLightTheme: boolean;
}

interface Record {
  id: string;
  title: string;
  originalText: string;
  processedText: string;
  date: string;
}

interface ScheduleItem {
  id: string;
  subject: string;
  time: string;
  room: string;
  teacher: string;
  type: 'lecture' | 'seminar' | 'lab';
  date: string;
}

const AccountPage: React.FC<AccountPageProps> = ({ onToggleTheme, isLightTheme }) => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<Record[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [showRecords, setShowRecords] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [activeView, setActiveView] = useState<'records' | 'schedule'>('records');
  const [expandedTexts, setExpandedTexts] = useState<{[key: string]: 'original' | 'processed' | null}>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'profile' | 'calendar' | 'transcriber' | 'text-processing'>('profile');
  const [showSidebarText, setShowSidebarText] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [saveFormat, setSaveFormat] = useState('txt');
  const [editorInstance, setEditorInstance] = useState<any>(null);
  
  // Состояние для переключения режимов редактора
  const [editorMode, setEditorMode] = useState<'original' | 'processed'>('original');
  const [originalText, setOriginalText] = useState<string>('');
  const [processedText, setProcessedText] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [showEditorHelp, setShowEditorHelp] = useState(false);
  
  
  // Хук для экспорта
  const { exportToTxt, exportToMarkdown, exportToDocx, exportToPdf } = useExport(editorInstance);
  
  // Хук для ML обработки
  const { 
    isProcessing, 
    result: mlResult, 
    error: mlError, 
    processText, 
    reset: resetML,
    cancelProcessing  // Добавляем функцию отмены
  } = useMLProcessor();
  
  // Состояние ML обработки
  const [selectedMLMode, setSelectedMLMode] = useState<MLMode>('summarize');
  const [topicInput, setTopicInput] = useState<string>('');
  
  // Состояние транскрибации
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState('');
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionMinimized, setTranscriptionMinimized] = useState(false);
  
  // Состояние AI-фильтрации транскрибированного текста
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);

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

  const filterModalSurface = isLightTheme
    ? {
        background: 'linear-gradient(145deg, rgba(255, 255, 240, 0.98), rgba(248, 235, 220, 0.96))',
        border: '1px solid rgba(68, 41, 43, 0.12)',
        boxShadow: '0 40px 140px rgba(31, 21, 22, 0.25)'
      }
    : {
        background: 'linear-gradient(145deg, rgba(33, 24, 25, 0.97), rgba(18, 12, 14, 0.92))',
        border: '1px solid rgba(255, 255, 240, 0.08)',
        boxShadow: '0 40px 140px rgba(0, 0, 0, 0.65)'
      };

  const filterBadgeStyles = isLightTheme
    ? {
        background: 'rgba(68, 41, 43, 0.08)',
        color: '#6d3d3f'
      }
    : {
        background: 'rgba(255, 255, 240, 0.08)',
        color: '#f5ead8'
      };

  const filterInfoSurface = isLightTheme
    ? {
        background: 'rgba(68, 41, 43, 0.04)',
        border: '1px solid rgba(68, 41, 43, 0.12)'
      }
    : {
        background: 'rgba(255, 255, 240, 0.03)',
        border: '1px solid rgba(255, 255, 240, 0.08)'
      };

  const primaryFilterButton = isLightTheme
    ? {
        background: '#44292b',
        color: '#fff9f1',
        boxShadow: '0 20px 45px rgba(68, 41, 43, 0.35)'
      }
    : {
        background: '#fff8f0',
        color: '#1f1516',
        boxShadow: '0 25px 45px rgba(0, 0, 0, 0.45)'
      };

  const secondaryFilterButton = isLightTheme
    ? {
        background: 'rgba(68, 41, 43, 0.06)',
        color: '#4e2e30',
        border: '1px solid rgba(68, 41, 43, 0.2)'
      }
    : {
        background: 'rgba(255, 255, 240, 0.02)',
        color: '#f1e6d7',
        border: '1px solid rgba(255, 255, 240, 0.08)'
      };

  const filterHeadingColor = isLightTheme ? '#2a1918' : '#fff7ec';
  const filterBodyColor = isLightTheme ? '#4b2d2f' : '#f3e7d8';
  const filterMutedColor = isLightTheme ? '#7a5a5c' : '#c6b7a7';

  const errorModalSurface = isLightTheme
    ? {
        background: 'linear-gradient(145deg, rgba(255, 255, 240, 0.98), rgba(250, 238, 230, 0.96))',
        border: '1px solid rgba(68, 41, 43, 0.15)',
        boxShadow: '0 40px 120px rgba(34, 23, 24, 0.35)'
      }
    : {
        background: 'linear-gradient(145deg, rgba(31, 21, 22, 0.96), rgba(15, 10, 12, 0.92))',
        border: '1px solid rgba(255, 255, 240, 0.1)',
        boxShadow: '0 45px 120px rgba(0, 0, 0, 0.65)'
      };

  const errorAccentBadge = isLightTheme
    ? {
        background: 'rgba(181, 132, 136, 0.15)',
        color: '#7f4c52'
      }
    : {
        background: 'rgba(255, 232, 225, 0.08)',
        color: '#f8d7cd'
      };

  const errorInfoSurface = isLightTheme
    ? {
        background: 'rgba(181, 132, 136, 0.08)',
        border: '1px solid rgba(181, 132, 136, 0.3)',
        color: '#4b2d2f'
      }
    : {
        background: 'rgba(255, 248, 240, 0.04)',
        border: '1px solid rgba(255, 232, 225, 0.15)',
        color: '#f3d6cf'
      };

  const errorPrimaryButton = isLightTheme
    ? {
        background: '#44292b',
        color: '#fff9f2',
        boxShadow: '0 20px 45px rgba(68, 41, 43, 0.35)'
      }
    : {
        background: '#fff8f0',
        color: '#1f1516',
        boxShadow: '0 25px 45px rgba(0, 0, 0, 0.45)'
      };
  
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

  // Моковые данные для демонстрации
  const mockRecords: Record[] = [
    {
      id: '1',
      title: 'Лекция по математическому анализу',
      originalText: 'Сегодня мы изучали пределы функций, их свойства и методы вычисления. Предел функции в точке - это значение, к которому стремится функция при приближении аргумента к данной точке.',
      processedText: 'Изучение пределов функций: свойства и методы вычисления. Предел функции в точке - значение, к которому стремится функция при приближении аргумента к точке.',
      date: '2025-10-15'
    },
    {
      id: '2',
      title: 'Семинар по физике',
      originalText: 'На семинаре разбирали задачи по механике, законы Ньютона, принципы сохранения энергии и импульса. Особое внимание уделили решению задач на движение тел под действием сил.',
      processedText: 'Семинар по механике: законы Ньютона, принципы сохранения энергии и импульса. Решение задач на движение тел под действием сил.',
      date: '2025-10-05'
    },
    {
      id: '3',
      title: 'Лекция по программированию',
      originalText: 'Рассматривали основы объектно-ориентированного программирования, принципы инкапсуляции, наследования и полиморфизма. Практические примеры на языке Python.',
      processedText: 'ООП: инкапсуляция, наследование, полиморфизм. Практические примеры на Python.',
      date: '2025-10-20'
    }
  ];

  // Моковые данные для расписания
  const mockSchedule: ScheduleItem[] = [
    {
      id: '1',
      subject: 'Математический анализ',
      time: '09:00 - 10:30',
      room: 'Ауд. 101',
      teacher: 'Проф. Петров А.А.',
      type: 'lecture',
      date: '2025-10-15'
    },
    {
      id: '2',
      subject: 'Физика',
      time: '11:00 - 12:30',
      room: 'Лаб. 205',
      teacher: 'Доц. Сидорова М.В.',
      type: 'lab',
      date: '2025-10-15'
    },
    {
      id: '3',
      subject: 'Программирование',
      time: '14:00 - 15:30',
      room: 'Ауд. 301',
      teacher: 'Ст. преп. Козлов И.С.',
      type: 'seminar',
      date: '2025-10-15'
    },
    {
      id: '4',
      subject: 'Английский язык',
      time: '10:00 - 11:30',
      room: 'Ауд. 201',
      teacher: 'Преп. Иванова Е.П.',
      type: 'seminar',
      date: '2025-10-05'
    },
    {
      id: '5',
      subject: 'История',
      time: '12:00 - 13:30',
      room: 'Ауд. 102',
      teacher: 'Проф. Смирнов В.И.',
      type: 'lecture',
      date: '2025-10-20'
    }
  ];

  useEffect(() => {
    setRecords(mockRecords);
    setSchedule(mockSchedule);
  }, []);

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

  const today = new Date();
  const currentYear = currentMonth.getFullYear();
  const currentMonthIndex = currentMonth.getMonth();

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };

  const hasRecords = (date: Date) => {
    const dateStr = formatDate(date);
    return records.some(record => record.date === dateStr);
  };

  const hasSchedule = (date: Date) => {
    const dateStr = formatDate(date);
    return schedule.some(item => item.date === dateStr);
  };

  const isSelected = (date: Date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString();
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowButtons(true);
    setShowRecords(true);
    setActiveView('records');
  };

  const handleClearSelection = () => {
    setSelectedDate(null);
    setShowRecords(false);
    setShowButtons(false);
    setActiveView('records');
  };

  // Функция транскрибации аудио
  const handleAudioTranscription = async (file: File) => {
    setIsTranscribing(true);
    setTranscriptionError(null);
    setTranscriptionProgress('Загрузка файла...');
    setTranscriptionMinimized(false);

    try {
      // Создаем FormData для отправки файла
      const formData = new FormData();
      formData.append('audio', file);

      // Отправляем файл на сервер
      const response = await fetch('http://localhost:8000/api/transcribe/audio', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Ошибка транскрибации');
      }

      // Файл загружен, начинаем обработку
      setTranscriptionProgress('Начало обработки...');

      // Ждем ответ от сервера (это может занять много времени)
      setTranscriptionProgress('Обработка аудио... Это может занять несколько минут.');
      
      const result = await response.json();

      if (result.success) {
        setTranscriptionProgress('Транскрибация завершена успешно!');
        
        // Сохраняем транскрибированный текст
        setTranscribedText(result.text);
        
        // Небольшая задержка и показываем модальное окно выбора
        setTimeout(() => {
          setIsTranscribing(false);
          setTranscriptionProgress('');
          setShowFilterModal(true); // Показываем модальное окно выбора
        }, 1000);
      } else {
        throw new Error('Транскрибация не удалась');
      }
    } catch (error: any) {
      console.error('Ошибка транскрибации:', error);
      setTranscriptionError(error.message || 'Произошла ошибка при транскрибации');
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
      console.log('🔄 Отправляем текст на фильтрацию:', transcribedText.substring(0, 200));
      
      // Отправляем текст на фильтрацию
      const response = await fetch('http://localhost:8000/api/transcribe/filter', {
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
      console.log('📥 Получен результат фильтрации:', {
        success: result.success,
        originalLength: result.original_length,
        filteredLength: result.filtered_length,
        firstChars: result.filtered_text.substring(0, 200)
      });

      if (result.success) {
        console.log('✅ Фильтрация успешна, текст изменился:', transcribedText !== result.filtered_text);
        
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

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(currentMonthIndex - 1);
    } else {
      newMonth.setMonth(currentMonthIndex + 1);
    }
    setCurrentMonth(newMonth);
  };

  const getRecordsForSelectedDate = () => {
    if (!selectedDate) return [];
    const dateStr = formatDate(selectedDate);
    return records.filter(record => record.date === dateStr);
  };

  const getScheduleForSelectedDate = () => {
    if (!selectedDate) return [];
    const dateStr = formatDate(selectedDate);
    return schedule.filter(item => item.date === dateStr);
  };

  const handleViewChange = (view: 'records' | 'schedule') => {
    setActiveView(view);
  };

  const toggleTextExpansion = (recordId: string, textType: 'original' | 'processed') => {
    setExpandedTexts(prev => ({
      ...prev,
      [recordId]: prev[recordId] === textType ? null : textType
    }));
  };

  // Функция обработки текста через ML API
  const handleMLProcess = async () => {
    // Проверяем наличие редактора
    if (!editorInstance) {
      alert('❌ Редактор не инициализирован. Пожалуйста, перезагрузите страницу.');
      return;
    }

    // Получаем текст из редактора
    const text = editorInstance.getText();

    if (!text.trim()) {
      alert('⚠️ Введите текст для обработки в редактор');
      return;
    }

    // Проверка длины текста (лимит API - 70000 символов)
    const MAX_TEXT_LENGTH = 70000;
    if (text.length > MAX_TEXT_LENGTH) {
      alert(
        `⚠️ Текст слишком длинный!\n\n` +
        `Текущая длина: ${text.length.toLocaleString()} символов\n` +
        `Максимум: ${MAX_TEXT_LENGTH.toLocaleString()} символов\n` +
        `Превышение: ${(text.length - MAX_TEXT_LENGTH).toLocaleString()} символов\n\n` +
        `Пожалуйста, сократите текст или разбейте на части.`
      );
      return;
    }

    // Проверка темы для expand_topic
    if (selectedMLMode === 'expand_topic' && !topicInput.trim()) {
      alert('⚠️ Для режима "Расширение темы" нужно указать тему');
      return;
    }

    console.log('🚀 Начало обработки текста:', {
      mode: selectedMLMode,
      textLength: text.length,
      topic: selectedMLMode === 'expand_topic' ? topicInput : undefined
    });

    // Сохраняем исходный текст
    setOriginalText(editorInstance.getHTML());
    setEditorMode('original');

    try {
      // Вызов ML API
      const processedTextResult = await processText(
        text,
        selectedMLMode,
        selectedMLMode === 'expand_topic' ? topicInput : undefined
      );

      if (processedTextResult) {
        // Сохраняем обработанный текст
        const htmlContent = convertMarkdownToHTML(processedTextResult);
        setProcessedText(htmlContent);
        
        // Переключаемся на режим обработанного текста
        setEditorMode('processed');
        
        console.log('✅ Обработка успешна, результат получен');
      } else {
        // Если результат null, проверяем наличие ошибки в состоянии
        console.warn('⚠️ Обработка вернула null, проверьте ошибки в консоли');
      }
    } catch (error) {
      console.error('❌ Ошибка обработки:', error);
      
      // Правильная обработка разных типов ошибок
      let errorMessage = 'Неизвестная ошибка';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }
      
      alert(`❌ Ошибка обработки текста: ${errorMessage}`);
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

  // Конвертация Markdown в HTML с сохранением форматирования
  const convertMarkdownToHTML = (markdown: string): string => {
    if (!markdown) return '';
    
    // Настройка marked для корректного отображения
    marked.setOptions({
      breaks: true, // Преобразовать переносы строк в <br>
      gfm: true, // GitHub Flavored Markdown
    });
    
    return marked(markdown) as string;
  };

  // Умная обработка текста - определяет, содержит ли текст Markdown синтаксис
  const processTextContent = (text: string, filename: string): string => {
    // Если это MD файл, всегда конвертируем как Markdown
    if (filename.toLowerCase().endsWith('.md')) {
      return convertMarkdownToHTML(text);
    }
    
    // Проверяем, содержит ли текст Markdown синтаксис
    const hasMarkdownSyntax = /^#{1,6}\s|^\*\*|^\*[^*]|^\- |^\d+\. |^```|^> |^\|/.test(text.split('\n').join('\n'));
    
    if (hasMarkdownSyntax) {
      // Если содержит Markdown синтаксис, конвертируем как Markdown
      return convertMarkdownToHTML(text);
    } else {
      // Иначе обрабатываем как обычный текст
      return text
        .split('\n')
        .map(line => line.trim() === '' ? '<br>' : `<p>${line}</p>`)
        .join('');
    }
  };


  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonthIndex);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonthIndex);
    const days = [];

    // Пустые ячейки для начала месяца
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-6 w-6 sm:h-8 sm:w-8 md:h-12 md:w-12 lg:h-16 lg:w-16 xl:h-16 xl:w-16"></div>);
    }

    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonthIndex, day);
      const isCurrentDay = isToday(date);
      const hasRecordsForDay = hasRecords(date);
      const hasScheduleForDay = hasSchedule(date);
      const isSelectedDay = isSelected(date);

      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(date)}
          className={`calendar-day h-6 w-6 sm:h-8 sm:w-8 md:h-12 md:w-12 lg:h-16 lg:w-16 xl:h-16 xl:w-16 flex items-center justify-center relative rounded-lg text-xs sm:text-sm md:text-base lg:text-lg xl:text-lg text-center transition-all duration-300 hover:scale-105 ${
            isCurrentDay 
              ? 'today' 
              : isSelectedDay
              ? 'selected'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-lg'
          }`}
        >
          {day}
          {hasRecordsForDay && (
            <div className="absolute top-0.5 right-0.5 sm:top-0.5 sm:right-0.5 md:top-1 md:right-1 lg:top-2 lg:right-2 xl:top-2 xl:right-2 w-1 h-1 sm:w-1.5 sm:h-1.5 md:w-2 md:h-2 lg:w-3 lg:h-3 xl:w-3 xl:h-3 bg-red-500 rounded-full shadow-lg"></div>
          )}
          {hasScheduleForDay && (
            <div className="absolute top-0.5 left-0.5 sm:top-0.5 sm:left-0.5 md:top-1 md:left-1 lg:top-2 lg:left-2 xl:top-2 xl:left-2 w-1 h-1 sm:w-1.5 sm:h-1.5 md:w-2 md:h-2 lg:w-3 lg:h-3 xl:w-3 xl:h-3 bg-green-500 rounded-full shadow-lg"></div>
          )}
        </button>
      );
    }

    return days;
  };

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const renderSidebar = () => (
    <>
      {/* Мобильное меню - оверлей */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      {/* Боковая панель */}
       <div 
         className={`fixed left-0 top-0 h-full border-r transition-all duration-700 ease-in-out z-50 ${
           sidebarCollapsed ? 'w-24' : 'w-70'
         } ${
           mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
         }`}
        style={{ 
          borderColor: 'var(--border-color)',
          background: 'var(--bg-primary)',
          backdropFilter: 'blur(10px)'
        }}
        onMouseEnter={() => !mobileMenuOpen && setSidebarCollapsed(false)}
        onMouseLeave={() => !mobileMenuOpen && setSidebarCollapsed(true)}
      >
      <div className="flex flex-col h-full">
        {/* Заголовок */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <div 
            className="text-3xl font-normal text-primary no-underline tracking-wider transition-all duration-700 ease-in-out hover:opacity-60 bg-transparent border-none cursor-pointer relative block pb-10"
            style={{ 
              color: 'var(--text-primary)',
              fontFamily: 'Georgia, serif'
            }}
            onClick={(e) => {
              // Предотвращаем переход на мобильных устройствах при открытии меню
              if (window.innerWidth < 1024 && mobileMenuOpen) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              // Переход на главную страницу только на десктопе или когда меню закрыто
              navigate('/');
              window.scrollTo(0, 0);
            }}
          >
            <span className={`absolute transition-opacity duration-0 delay-0 ${!showSidebarText ? 'opacity-0' : 'opacity-100'}`}>
              MindeSync
            </span>
            <span className={`absolute transition-opacity duration-200 delay-0 ${!showSidebarText ? 'opacity-100' : 'opacity-0'}`}>
              MS
            </span>
          </div>
          
        </div>

        {/* Навигационные элементы */}
        <div className="flex-1 p-4 space-y-3">
          {/* Профиль */}
          <button
            onClick={() => {
              setActiveSection('profile');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-4 p-4 rounded-lg transition-all duration-700 ease-in-out h-16 ${
              activeSection === 'profile' ? '' : 'hover:bg-hover'
            }`}
            style={{ 
              background: activeSection === 'profile' ? 'var(--text-primary)' : 'var(--hover-bg)',
              color: activeSection === 'profile' ? 'var(--bg-primary)' : 'var(--text-secondary)'
            }}
            title={sidebarCollapsed ? 'Профиль' : ''}
          >
            <span className="material-symbols-outlined text-2xl">account_circle</span>
            <span className={`text-lg font-medium transition-all duration-300 delay-100 ${
              !showSidebarText ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
            }`}>
              Профиль
            </span>
          </button>

          {/* Календарь */}
          <button
            onClick={() => {
              setActiveSection('calendar');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-4 p-4 rounded-lg transition-all duration-700 ease-in-out h-16 ${
              activeSection === 'calendar' ? '' : 'hover:bg-hover'
            }`}
            style={{ 
              background: activeSection === 'calendar' ? 'var(--text-primary)' : 'var(--hover-bg)',
              color: activeSection === 'calendar' ? 'var(--bg-primary)' : 'var(--text-secondary)'
            }}
            title={sidebarCollapsed ? 'Календарь' : ''}
          >
            <span className="material-symbols-outlined text-2xl">calendar_today</span>
            <span className={`text-lg font-medium transition-all duration-300 delay-100 ${
              !showSidebarText ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
            }`}>
              Календарь
            </span>
          </button>

          {/* Транскрибатор */}
          <button
            onClick={() => {
              setActiveSection('transcriber');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-4 p-4 rounded-lg transition-all duration-700 ease-in-out h-16 ${
              activeSection === 'transcriber' ? '' : 'hover:bg-hover'
            }`}
            style={{ 
              background: activeSection === 'transcriber' ? 'var(--text-primary)' : 'var(--hover-bg)',
              color: activeSection === 'transcriber' ? 'var(--bg-primary)' : 'var(--text-secondary)'
            }}
            title={sidebarCollapsed ? 'Транскрибатор' : ''}
          >
            <span className="material-symbols-outlined text-2xl">mic</span>
            <span className={`text-lg font-medium transition-all duration-300 delay-100 ${
              !showSidebarText ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
            }`}>
              Транскрибатор
            </span>
          </button>

          {/* Обработка текста */}
          <button
            onClick={() => {
              setActiveSection('text-processing');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-4 p-4 rounded-lg transition-all duration-700 ease-in-out h-16 ${
              activeSection === 'text-processing' ? '' : 'hover:bg-hover'
            }`}
            style={{ 
              background: activeSection === 'text-processing' ? 'var(--text-primary)' : 'var(--hover-bg)',
              color: activeSection === 'text-processing' ? 'var(--bg-primary)' : 'var(--text-secondary)'
            }}
            title={sidebarCollapsed ? 'Обработка текста' : ''}
          >
            <span className="material-symbols-outlined text-2xl">edit_note</span>
            <span className={`text-lg font-medium transition-all duration-300 delay-100 ${
              !showSidebarText ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
            }`}>
              Обработка текста
            </span>
          </button>

          {/* Кнопка выхода */}
          <button 
            onClick={() => {
              navigate('/');
              window.scrollTo(0, 0);
            }}
            className={`w-full flex items-center gap-4 p-4 rounded-lg transition-all duration-700 ease-in-out h-16`}
            style={{ 
              color: 'var(--text-secondary)',
              background: 'var(--hover-bg)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--hover-bg)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--hover-bg)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title={sidebarCollapsed ? 'Выход' : ''}
          >
            <span className="material-symbols-outlined text-2xl">close</span>
            <span className={`text-lg font-medium transition-all duration-300 delay-100 ${
              !showSidebarText ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
            }`}>
              Выход
            </span>
          </button>
        </div>

        {/* Переключатель темы */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <button 
            onClick={handleThemeToggle}
            className={`w-full flex items-center p-4 hover:bg-hover rounded-lg transition-all duration-300 h-16 ${
              sidebarCollapsed ? 'justify-center' : 'gap-4'
            }`}
            style={{ 
              color: 'var(--text-secondary)',
              background: 'var(--hover-bg)'
            }}
            title={sidebarCollapsed ? 'Тема' : ''}
          >
            <span className="text-2xl">{isLightTheme ? '☾' : '☀︎'}</span>
            <span className={`text-lg font-medium transition-all duration-300 delay-100 ${
              !showSidebarText ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
            }`}>
              Тема
            </span>
          </button>
        </div>
      </div>
      </div>
    </>
  );

  return (
    <div className={`min-h-screen overflow-x-hidden relative transition-all duration-500 ${
      isLightTheme ? 'light-theme' : ''
    }`} style={{
      fontFamily: 'Georgia, Times New Roman, serif',
      lineHeight: '1.8',
      color: 'var(--text-primary)',
      background: 'var(--bg-primary)'
    }}>
      {renderSidebar()}
      
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
          <>
            {/* Заголовочный блок */}
            <div className="text-center mb-4 md:mb-6 px-4">
              <h1 
                className="text-2xl md:text-3xl lg:text-4xl font-light mb-2 md:mb-3 tracking-wide"
                style={{ color: 'var(--text-primary)' }}
              >
                Профиль
              </h1>
              <p 
                className="text-sm md:text-base lg:text-lg opacity-70 max-w-2xl mx-auto"
                style={{ color: 'var(--text-secondary)' }}
              >
                Управляйте своим профилем и настройками
              </p>
            </div>

        {/* Секция профиля */}
         <div className="bg-transparent border rounded-xl p-4 md:p-6 lg:p-8 mb-6 md:mb-10" style={{ borderColor: 'var(--border-color)' }}>
           
           {/* Информация о пользователе сверху */}
           <div className="text-center mb-6">
             <div 
               className="w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full flex items-center justify-center text-2xl md:text-3xl lg:text-4xl font-semibold mx-auto mb-4 relative"
               style={{
                 background: 'var(--text-primary)',
                 color: 'var(--bg-primary)',
                 boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
               }}
             >
               <span className="material-symbols-outlined text-3xl md:text-4xl lg:text-5xl">account_circle</span>
             </div>
             <h3 className="text-xl md:text-2xl lg:text-3xl font-semibold mb-2 md:mb-3" style={{ color: 'var(--text-primary)' }}>
               Иван Иванов
             </h3>
             <p className="text-base md:text-lg lg:text-xl mb-2" style={{ color: 'var(--text-secondary)' }}>
               ivan.ivanov@example.com
             </p>
             <p className="text-xs md:text-sm lg:text-base opacity-70" style={{ color: 'var(--text-secondary)' }}>
               Зарегистрирован: 15 января 2025
             </p>
           </div>

           {/* Остальная информация */}
           <div className="space-y-4 md:space-y-5">

             {/* Информация о подписке */}
             <div className="border rounded-lg p-4 md:p-5"
               style={{
                 background: 'var(--hover-bg)',
                 borderColor: '#B58488'
               }}>
               <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2">
                   <span className="material-symbols-outlined" style={{ color: '#B58488' }}>workspace_premium</span>
                   <h4 className="text-base md:text-lg font-semibold" style={{ color: '#B58488' }}>Премиум подписка</h4>
                 </div>
                 <div className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ background: '#B58488', color: '#fffff0' }}>
                   Активна
                 </div>
               </div>
               <div className="space-y-2">
                 <div className="flex justify-between items-center">
                   <span className="text-xs md:text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>Действует до:</span>
                   <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>15 марта 2025</span>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-xs md:text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>Осталось:</span>
                   <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>47 дней</span>
                 </div>
               </div>
               <div className="mt-3 flex justify-end">
                 <Link
                   to="/pricing"
                   className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-all duration-300"
                   style={{
                     background: '#B58488',
                     borderColor: '#B58488',
                     color: '#fffff0'
                   }}
                 >
                   <span>Посмотреть планы</span>
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                   </svg>
                 </Link>
               </div>
             </div>


             {/* Кнопки действий */}
             <div className="flex flex-col sm:flex-row gap-3 justify-center">
               <button 
                 className="btn"
               >
                 Изменить пароль
               </button>
               <button 
                 onClick={() => {
                   navigate('/');
                   window.scrollTo(0, 0);
                 }}
                 className="btn-gradient transition-all duration-300"
               >
                 Выйти из профиля
               </button>
               
             </div>
           </div>
         </div>
          </>
        )}

        {activeSection === 'calendar' && (
          <>
            {/* Заголовочный блок */}
            <div className="text-center mb-6 md:mb-10 lg:mb-12 px-4">
              <h1 
                className="text-2xl md:text-3xl lg:text-4xl xl:text-4xl font-light mb-2 md:mb-3 lg:mb-4 tracking-wide"
                style={{ color: 'var(--text-primary)' }}
              >
                Календарь
              </h1>
              <p 
                className="text-sm md:text-base lg:text-lg xl:text-lg opacity-70 max-w-3xl mx-auto leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                Управляйте своими записями и расписанием
              </p>
            </div>

        {/* Календарная секция */}
        <div className="bg-transparent border rounded-2xl p-6 md:p-10 lg:p-14 xl:p-18 mb-10 md:mb-20" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex flex-col sm:flex-row items-center justify-between mb-8 md:mb-10 lg:mb-14 gap-4">
            <h2 className="text-xl md:text-2xl lg:text-3xl xl:text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Календарь
            </h2>
            <div className="flex items-center justify-center w-80 md:w-96 lg:w-112 xl:w-112">
              <button 
                onClick={() => navigateMonth('prev')}
                className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 xl:w-12 xl:h-12 flex items-center justify-center bg-transparent border-0 rounded-lg hover:bg-hover transition-all duration-300 hover:scale-105 group flex-shrink-0 hover:shadow-lg"
                style={{ 
                  color: 'var(--text-secondary)',
                  background: 'var(--hover-bg)',
                  border: '2px solid var(--border-color)'
                }}
              >
                <span className="text-lg md:text-xl lg:text-2xl xl:text-2xl group-hover:-translate-x-1 transition-transform duration-300">←</span>
              </button>
              <span className="text-base md:text-lg lg:text-xl xl:text-xl font-medium flex-1 text-center mx-4" style={{ color: 'var(--text-primary)' }}>
                {monthNames[currentMonthIndex]} {currentYear}
              </span>
              <button 
                onClick={() => navigateMonth('next')}
                className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 xl:w-12 xl:h-12 flex items-center justify-center bg-transparent border-0 rounded-lg hover:bg-hover transition-all duration-300 hover:scale-105 group flex-shrink-0 hover:shadow-lg"
                style={{ 
                  color: 'var(--text-secondary)',
                  background: 'var(--hover-bg)',
                  border: '2px solid var(--border-color)'
                }}
              >
                <span className="text-lg md:text-xl lg:text-2xl xl:text-2xl group-hover:translate-x-1 transition-transform duration-300">→</span>
              </button>
            </div>
          </div>

          {/* Календарная сетка */}
          <div className="grid grid-cols-7 gap-1 md:gap-2 lg:gap-3 xl:gap-4">
            {dayNames.map(day => (
              <div 
                key={day} 
                className="h-6 w-6 sm:h-8 sm:w-8 md:h-12 md:w-12 lg:h-16 lg:w-16 xl:h-16 xl:w-16 flex items-center justify-center text-xs sm:text-xs md:text-sm lg:text-base xl:text-base font-medium opacity-70"
                style={{ color: 'var(--text-secondary)' }}
              >
                {day}
              </div>
            ))}
            {renderCalendar()}
          </div>
        </div>

        {/* Секция с кнопками и контентом */}
        {showButtons && selectedDate && (
          <div id="records-section" className="bg-transparent border rounded-2xl p-4 md:p-8 lg:p-12 xl:p-16" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8 lg:mb-12 gap-4">
              <h2 className="text-lg md:text-2xl lg:text-3xl xl:text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {activeView === 'records' ? 'Записи' : 'Расписание'} за {selectedDate.toLocaleDateString('ru-RU', { 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </h2>
              <button 
                onClick={handleClearSelection}
                className="w-full sm:w-auto px-4 md:px-6 lg:px-8 xl:px-8 py-2 md:py-3 lg:py-4 xl:py-4 bg-transparent border-0 rounded-lg transition-all duration-300 hover:bg-hover text-sm md:text-base lg:text-lg xl:text-lg"
                style={{ 
                  color: 'var(--text-secondary)',
                  background: 'var(--hover-bg)',
                  border: '2px solid var(--border-color)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--text-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                <span>Очистить выбор</span>
              </button>
            </div>

            {/* Кнопки переключения */}
            <div className="flex gap-2 mb-6 md:mb-8 lg:mb-12">
              <button
                onClick={() => handleViewChange('records')}
                className={`px-4 md:px-6 lg:px-8 xl:px-8 py-2 md:py-3 lg:py-4 xl:py-4 rounded-lg border-2 transition-all duration-200 hover:-translate-y-1 text-sm md:text-base lg:text-lg xl:text-lg ${
                  activeView === 'records' 
                    ? 'shadow-lg' 
                    : ''
                }`}
                style={{
                  borderColor: activeView === 'records' ? 'var(--text-primary)' : 'var(--border-color)',
                  background: activeView === 'records' ? 'var(--text-primary)' : 'var(--hover-bg)',
                  color: activeView === 'records' ? 'var(--bg-primary)' : 'var(--text-primary)'
                }}
              >
                <span>Записи</span>
              </button>
              <button
                onClick={() => handleViewChange('schedule')}
                className={`px-4 md:px-6 lg:px-8 xl:px-8 py-2 md:py-3 lg:py-4 xl:py-4 rounded-lg border-2 transition-all duration-200 hover:-translate-y-1 text-sm md:text-base lg:text-lg xl:text-lg ${
                  activeView === 'schedule' 
                    ? 'shadow-lg' 
                    : ''
                }`}
                style={{
                  borderColor: activeView === 'schedule' ? 'var(--text-primary)' : 'var(--border-color)',
                  background: activeView === 'schedule' ? 'var(--text-primary)' : 'var(--hover-bg)',
                  color: activeView === 'schedule' ? 'var(--bg-primary)' : 'var(--text-primary)'
                }}
              >
                <span>Расписание</span>
              </button>
            </div>

            <div className="space-y-4 md:space-y-6 lg:space-y-8 xl:space-y-10">
              {activeView === 'records' ? (
                <>
                  {getRecordsForSelectedDate().map(record => (
                    <div 
                      key={record.id} 
                      className="bg-transparent border rounded-xl p-4 md:p-6 lg:p-8 xl:p-10 record-card"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <h3 className="text-base md:text-lg lg:text-xl xl:text-xl font-semibold mb-2 md:mb-3 lg:mb-4" style={{ color: 'var(--text-primary)' }}>
                        {record.title}
                      </h3>
                      <div className="space-y-4">
                        {/* Кнопки для переключения текстов */}
                        <div className="flex gap-2 mb-4">
                          <button
                            onClick={() => toggleTextExpansion(record.id, 'original')}
                            className={`px-4 md:px-6 lg:px-8 xl:px-8 py-2 md:py-3 lg:py-4 xl:py-4 rounded-lg border-2 transition-all duration-200 hover:-translate-y-1 text-sm md:text-base lg:text-lg xl:text-lg ${
                              expandedTexts[record.id] === 'original' 
                                ? 'shadow-lg' 
                                : ''
                            }`}
                            style={{
                              borderColor: expandedTexts[record.id] === 'original' ? 'var(--text-primary)' : 'var(--border-color)',
                              background: expandedTexts[record.id] === 'original' ? 'var(--text-primary)' : 'var(--hover-bg)',
                              color: expandedTexts[record.id] === 'original' ? 'var(--bg-primary)' : 'var(--text-primary)'
                            }}
                          >
                            <span>Оригинальный текст</span>
                          </button>
                          <button
                            onClick={() => toggleTextExpansion(record.id, 'processed')}
                            className={`px-4 md:px-6 lg:px-8 xl:px-8 py-2 md:py-3 lg:py-4 xl:py-4 rounded-lg border-2 transition-all duration-200 hover:-translate-y-1 text-sm md:text-base lg:text-lg xl:text-lg ${
                              expandedTexts[record.id] === 'processed' 
                                ? 'shadow-lg' 
                                : ''
                            }`}
                            style={{
                              borderColor: expandedTexts[record.id] === 'processed' ? 'var(--text-primary)' : 'var(--border-color)',
                              background: expandedTexts[record.id] === 'processed' ? 'var(--text-primary)' : 'var(--hover-bg)',
                              color: expandedTexts[record.id] === 'processed' ? 'var(--bg-primary)' : 'var(--text-primary)'
                            }}
                          >
                            <span>Обработанный текст</span>
                          </button>
                        </div>
                        
                        {/* Отображение выбранного текста */}
                        {expandedTexts[record.id] && (
                          <div className="bg-transparent border rounded-lg p-4 md:p-6 lg:p-8 xl:p-8" style={{ borderColor: 'var(--border-color)' }}>
                            <h4 className="text-sm md:text-base lg:text-lg xl:text-lg font-medium mb-2 md:mb-3 lg:mb-4" style={{ color: 'var(--text-secondary)' }}>
                              {expandedTexts[record.id] === 'original' ? 'Оригинальный текст' : 'Обработанный текст'}
                            </h4>
                            <p className="text-xs md:text-sm lg:text-base xl:text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                              {expandedTexts[record.id] === 'original' ? record.originalText : record.processedText}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {getRecordsForSelectedDate().length === 0 && (
                    <div className="text-center py-8 md:py-12 lg:py-16 xl:py-20">
                      <p className="text-base md:text-lg lg:text-xl xl:text-xl opacity-70" style={{ color: 'var(--text-secondary)' }}>
                        На выбранную дату записей не найдено
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {getScheduleForSelectedDate().map(item => (
                    <div 
                      key={item.id} 
                      className="bg-transparent border rounded-xl p-4 md:p-6 lg:p-8 xl:p-10 record-card"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 md:mb-4 lg:mb-6 gap-2">
                        <h3 className="text-base md:text-lg lg:text-xl xl:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {item.subject}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium`}
                          style={{
                            background: 'var(--text-primary)',
                            color: 'var(--bg-primary)'
                          }}>
                          {item.type === 'lecture' ? 'Лекция' : 
                         item.type === 'seminar' ? 'Семинар' : 'Лабораторная'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 xl:gap-8">
                        <div>
                          <h4 className="text-sm md:text-base lg:text-lg xl:text-lg font-medium mb-1 md:mb-2 lg:mb-3" style={{ color: 'var(--text-secondary)' }}>
                            Время
                          </h4>
                          <p className="text-xs md:text-sm lg:text-base xl:text-base" style={{ color: 'var(--text-primary)' }}>
                            {item.time}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm md:text-base lg:text-lg xl:text-lg font-medium mb-1 md:mb-2 lg:mb-3" style={{ color: 'var(--text-secondary)' }}>
                            Аудитория
                          </h4>
                          <p className="text-xs md:text-sm lg:text-base xl:text-base" style={{ color: 'var(--text-primary)' }}>
                            {item.room}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm md:text-base lg:text-lg xl:text-lg font-medium mb-1 md:mb-2 lg:mb-3" style={{ color: 'var(--text-secondary)' }}>
                            Преподаватель
                          </h4>
                          <p className="text-xs md:text-sm lg:text-base xl:text-base" style={{ color: 'var(--text-primary)' }}>
                            {item.teacher}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {getScheduleForSelectedDate().length === 0 && (
                    <div className="text-center py-8 md:py-12 lg:py-16 xl:py-20">
                      <p className="text-base md:text-lg lg:text-xl xl:text-xl opacity-70" style={{ color: 'var(--text-secondary)' }}>
                        На выбранную дату пар не запланировано
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
          </>
        )}

        {activeSection === 'transcriber' && (
          <>
            {/* Заголовочный блок */}
            <div className="text-center mb-4 md:mb-8 px-4">
              <h1 
                className="text-2xl md:text-3xl lg:text-4xl xl:text-4xl font-light mb-2 md:mb-3 lg:mb-4 tracking-wide"
                style={{ color: 'var(--text-primary)' }}
              >
                Транскрибатор
              </h1>
              <p 
                className="text-sm md:text-base lg:text-lg xl:text-lg opacity-70 max-w-3xl mx-auto leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                Загружайте аудиофайлы для транскрибации
              </p>
            </div>

            {/* Секция транскрибатора */}
            <div className="bg-transparent border rounded-2xl p-4 md:p-8 lg:p-12 xl:p-16 mb-8 md:mb-16" style={{ borderColor: 'var(--border-color)' }}>
              <div className="text-center">
                <div className="mb-8">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 48 48"
                    strokeWidth="2"
                    stroke="currentColor"
                    className="w-16 h-16 mx-auto mb-4 transition-colors duration-300"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 33v4.5A4.5 4.5 0 0 0 10.5 42h27A4.5 4.5 0 0 0 42 37.5V33M33 24l-9 9m0 0-9-9m9 9V6"
                    />
                  </svg>
                  <h3 
                    className="text-xl font-normal mb-3"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Загрузите аудиофайл
                  </h3>
                  <p 
                    className="text-base opacity-80 mb-6"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Выберите аудиофайл до 90 минут для транскрибации
                  </p>
                </div>
                
                <label
                  className="btn-upload inline-block cursor-pointer"
                >
                  <input
                    type="file"
                    accept="audio/*,video/*,.mp3,.wav,.m4a,.flac,.ogg,.opus,.mp4,.mov,.avi,.mkv,.webm"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      // Проверка ограничения размера (например, 90 минут по ~1МБ/мин = 90МБ лимит, ориентировочно)
                      const MAX_MINUTES = 90;
                      const MAX_SIZE_MB = 100; // например, 100МБ с запасом
                      const MB = 1024 * 1024;

                      if (file.size > MAX_SIZE_MB * MB) {
                        alert(
                          `Файл слишком большой. Загрузите аудиофайл длительностью до ${MAX_MINUTES} минут (до ${MAX_SIZE_MB} МБ).`
                        );
                        return;
                      }

                      // Запускаем транскрибацию
                      await handleAudioTranscription(file);
                      
                      // Сбрасываем input для возможности загрузки того же файла снова
                      e.target.value = '';
                    }}
                  />
                  Выбрать файл
                </label>
              </div>
            </div>
          </>
        )}

        {activeSection === 'text-processing' && (
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

            {/* Выбор режима ML обработки */}
            <div className="mb-8">
              <label className="block text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
                Выберите режим обработки:
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mlModes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedMLMode(mode.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all duration-200 hover:-translate-y-1 ${
                      selectedMLMode === mode.id
                        ? 'shadow-lg'
                        : ''
                    }`}
                    style={{
                      borderColor: selectedMLMode === mode.id ? 'var(--text-primary)' : 'var(--border-color)',
                      background: selectedMLMode === mode.id ? 'var(--text-primary)' : 'var(--hover-bg)',
                      color: selectedMLMode === mode.id ? (isLightTheme ? '#fffff0' : '#1f1516') : 'var(--text-primary)'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="material-symbols-outlined text-2xl" style={{ color: selectedMLMode === mode.id ? (isLightTheme ? '#fffff0' : '#1f1516') : 'var(--text-primary)' }}>{mode.icon}</span>
                      <h3 className="font-semibold" style={{ color: selectedMLMode === mode.id ? (isLightTheme ? '#fffff0' : '#1f1516') : 'var(--text-primary)' }}>
                        {mode.name}
                      </h3>
                    </div>
                    <p className="text-sm opacity-80" style={{ color: selectedMLMode === mode.id ? (isLightTheme ? '#fffff0' : '#1f1516') : 'var(--text-secondary)' }}>
                      {mode.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Поле для темы (только для expand_topic) */}
            {selectedMLMode === 'expand_topic' && (
              <div className="mb-8">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Тема для расширения: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder="Например: нейронные сети, квантовая физика, алгоритмы сортировки"
                  className="w-full px-4 py-3 border rounded-lg transition-all duration-200"
                  style={{
                    borderColor: 'var(--border-color)',
                    background: 'var(--hover-bg)',
                    color: 'var(--text-primary)'
                  }}
                />
                <p className="mt-2 text-xs opacity-70" style={{ color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-outlined text-sm align-middle mr-1">lightbulb</span> Укажите конкретную тему из вашего текста, которую хотите подробно изучить
                </p>
              </div>
            )}

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
                
                <div className="space-y-4">
                  <label
                    className="btn-upload inline-block cursor-pointer"
                  >
                    <input
                      type="file"
                      accept=".txt,.md,.doc,.docx"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

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
                          
                          // Сбрасываем input для возможности повторной загрузки того же файла
                          e.target.value = '';
                        } catch (error) {
                          console.error('Ошибка при чтении файла:', error);
                          alert(`Ошибка при чтении файла: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
                        }
                      }}
                    />
                    <span>Выбрать лекцию</span>
                  </label>
                  <label
                    className="btn-upload inline-block cursor-pointer ml-4"
                  >
                    <input
                      type="file"
                      accept=".txt,.md,.pdf,.doc,.docx"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
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
                          
                          // Сбрасываем input для возможности повторной загрузки того же файла
                          e.target.value = '';
                        } catch (error) {
                          console.error('Ошибка при чтении файла:', error);
                          alert(`Ошибка при чтении файла: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
                        }
                      }}
                    />
                    Загрузить текстовый файл
                  </label>
                </div>
              </div>
            </div>

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
                
                <RichTextEditor 
                  initialContent={editorContent}
                  onContentChange={(content) => {
                    setEditorContent(content);
                    console.log('Content updated:', content);
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
                      onClick={handleMLProcess}
                      disabled={isProcessing || !editorInstance}
                      className={`btn-ai btn-lg flex items-center justify-center gap-2 w-full md:w-auto ${
                        isProcessing || !editorInstance
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                      }`}
                    >
                      {isProcessing ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Обработка...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">psychology</span>
                          Обработать с ИИ
                        </>
                      )}
                    </button>
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
                        const filename = `document_${new Date().toISOString().split('T')[0]}`;
                        
                        try {
                          switch (saveFormat) {
                            case 'txt':
                              exportToTxt({ filename: `${filename}.txt` });
                              break;
                            case 'md':
                              exportToMarkdown({ filename: `${filename}.md` });
                              break;
                            case 'docx':
                              await exportToDocx({ filename: `${filename}.docx` });
                              break;
                            case 'pdf':
                              await exportToPdf({ filename: `${filename}.pdf` });
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
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </main>
      
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

      {/* Модальное окно транскрибации */}
      {isTranscribing && !transcriptionMinimized && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              // Предотвращаем закрытие при клике на фон во время обработки
            }
          }}
        >
          <div 
            className="rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 relative"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)'
            }}
          >
            {/* Кнопки управления */}
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={() => setTranscriptionMinimized(true)}
                className="p-2 rounded-full transition-colors"
                style={{
                  color: 'var(--text-secondary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--hover-bg)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                title="Свернуть"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Заголовок */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                style={{ background: 'var(--hover-bg)' }}
              >
                <svg 
                  className="w-8 h-8 animate-spin" 
                  fill="none" 
                  viewBox="0 0 24 24"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <h3 
                className="text-xl font-semibold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                Транскрибация аудио
              </h3>
              <p 
                className="text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                Пожалуйста, подождите
              </p>
            </div>

            {/* Текст прогресса */}
            <div className="mb-6">
              <div 
                className="text-sm text-center py-4 px-4 rounded-lg"
                style={{
                  background: 'var(--hover-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)'
                }}
              >
                {transcriptionProgress}
              </div>
            </div>

            {/* Информационное сообщение */}
            <div 
              className="text-xs text-center p-3 rounded-lg"
              style={{
                background: 'var(--hover-bg)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
                border: '1px solid'
              }}
            >
              <span className="material-symbols-outlined align-middle mr-1">lightbulb</span> Транскрибация может занять несколько минут в зависимости от длины аудио. Модель Whisper анализирует вашу запись...
            </div>
          </div>
        </div>
      )}

      {/* Свернутое окно транскрибации (справа снизу) */}
      {isTranscribing && transcriptionMinimized && (
        <div 
          className="fixed bottom-4 right-4 z-50 rounded-xl shadow-2xl p-4 w-80 cursor-pointer transition-all duration-300"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
          onClick={() => setTranscriptionMinimized(false)}
        >
          <div className="flex items-center gap-3">
            {/* Анимированная иконка */}
            <div className="flex-shrink-0">
              <svg 
                className="w-8 h-8 animate-spin" 
                fill="none" 
                viewBox="0 0 24 24"
                style={{ color: 'var(--text-primary)' }}
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>

            {/* Информация */}
            <div className="flex-1 min-w-0">
              <h4 
                className="text-sm font-semibold mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                Транскрибация аудио
              </h4>
              
              <p 
                className="text-xs truncate"
                style={{ color: 'var(--text-secondary)' }}
              >
                {transcriptionProgress}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно ошибки транскрибации */}
      {transcriptionError && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setTranscriptionError(null)}
        >
          <div
            className="relative max-w-lg w-full rounded-[32px] border px-8 py-10 overflow-hidden"
            style={errorModalSurface}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="absolute inset-x-10 top-6 h-px opacity-35"
              style={{
                background: isLightTheme
                  ? 'linear-gradient(90deg, transparent, rgba(181, 132, 136, 0.5), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(255, 232, 225, 0.4), transparent)'
              }}
            />

            <button
              onClick={() => setTranscriptionError(null)}
              className="absolute top-5 right-5 p-2 rounded-full transition-all duration-300"
              style={errorAccentBadge}
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <div className="flex flex-col items-center text-center mb-8">
              <div
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs tracking-[0.3em] uppercase mb-5"
                style={errorAccentBadge}
              >
                <span className="material-symbols-outlined text-base">warning</span>
                Ошибка
              </div>
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={errorAccentBadge}
              >
                <span className="material-symbols-outlined text-3xl">error</span>
              </div>
              <h3
                className="text-2xl font-semibold mb-3 tracking-tight"
                style={{ color: filterHeadingColor }}
              >
                Ошибка транскрибации
              </h3>
              <p className="text-base max-w-md" style={{ color: filterBodyColor }}>
                Не удалось обработать запись. Попробуйте снова или воспользуйтесь рекомендациями ниже.
              </p>
            </div>

            <div className="mb-6">
              <div
                className="rounded-2xl p-5 border text-sm leading-relaxed"
                style={errorInfoSurface}
              >
                {transcriptionError}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm font-semibold mb-3" style={{ color: filterMutedColor }}>
                Что можно сделать:
              </p>
              <ul className="space-y-2">
                {errorRecoverySteps.map((step) => (
                  <li
                    key={step}
                    className="flex items-start gap-3 text-sm"
                    style={{ color: filterBodyColor }}
                  >
                    <span
                      className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
                      style={errorAccentBadge}
                    >
                      !
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => setTranscriptionError(null)}
              className="w-full py-3.5 rounded-2xl font-semibold transition-all duration-300 hover:-translate-y-0.5"
              style={errorPrimaryButton}
            >
              Попробовать снова
            </button>
          </div>
        </div>
      )}
      
      {/* Модальное окно выбора фильтрации транскрибированного текста */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="relative max-w-xl w-full rounded-[32px] border px-8 py-10 overflow-hidden"
            style={filterModalSurface}
          >
            <div
              className="absolute inset-x-10 top-6 h-px opacity-40"
              style={{
                background: isLightTheme
                  ? 'linear-gradient(90deg, transparent, rgba(68, 41, 43, 0.35), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(255, 255, 240, 0.35), transparent)'
              }}
            />

            <div className="flex flex-col items-center text-center relative">
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs tracking-[0.2em] uppercase mb-5"
                style={filterBadgeStyles}
              >
                <span className="material-symbols-outlined text-base">auto_fix_high</span>
                AI-фильтр
              </div>
              <h3
                className="text-2xl font-semibold mb-3 tracking-tight"
                style={{ color: filterHeadingColor }}
              >
                Транскрибация завершена!
              </h3>
              <p className="text-base mb-8 max-w-md" style={{ color: filterBodyColor }}>
                Хотите дополнительно обработать текст с помощью ИИ для исправления ошибок транскрибации?
              </p>
            </div>

            <div className="p-5 rounded-2xl mb-6 border" style={filterInfoSurface}>
              <p
                className="text-sm font-semibold mb-3 flex items-center justify-center gap-2"
                style={{ color: filterMutedColor }}
              >
                🤖 AI-фильтр исправит
              </p>
              <ul className="space-y-2">
                {filterBenefits.map((benefit) => (
                  <li
                    key={benefit}
                    className="flex items-start gap-3 text-sm leading-relaxed"
                    style={{ color: filterBodyColor }}
                  >
                    <span
                      className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                      style={filterBadgeStyles}
                    >
                      ✦
                    </span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleApplyFilter}
                disabled={isFiltering}
                className={`w-full py-3.5 px-5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all duration-300 ${
                  isFiltering ? 'opacity-80 cursor-not-allowed' : 'hover:-translate-y-0.5'
                }`}
                style={primaryFilterButton}
              >
                {isFiltering ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5"
                      style={{ color: primaryFilterButton.color }}
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Обработка...
                  </span>
                ) : (
                  <>
                    <span className="text-lg" aria-hidden="true">
                      ✨
                    </span>
                    Обработать с помощью ИИ
                  </>
                )}
              </button>

              <button
                onClick={handleSkipFilter}
                disabled={isFiltering}
                className={`w-full py-3.5 px-5 rounded-2xl font-semibold transition-all duration-300 ${
                  isFiltering ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-0.5'
                }`}
                style={secondaryFilterButton}
              >
                Пропустить обработку
              </button>
            </div>

            <p className="text-xs text-center mt-5" style={{ color: filterMutedColor }}>
              Обработка займет 5-15 секунд
            </p>
          </div>
        </div>
      )}
      
      {/* Модальное окно ошибки транскрибации */}
      {transcriptionError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div 
            className={`max-w-md w-full rounded-2xl shadow-2xl p-8 ${
              isLightTheme 
                ? 'bg-white' 
                : 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700'
            }`}
          >
            {/* Иконка ошибки */}
            <div className="flex justify-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isLightTheme 
                  ? 'bg-red-100' 
                  : 'bg-red-900/30'
              }`}>
                <svg 
                  className={`w-8 h-8 ${isLightTheme ? 'text-red-600' : 'text-red-400'}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
              </div>
            </div>
            <h3 
              className={`text-xl font-semibold mb-2 ${
                isLightTheme ? 'text-gray-900' : 'text-white'
              }`}
            >
              Ошибка транскрибации
            </h3>

            {/* Сообщение об ошибке */}
            <div 
              className={`text-sm mb-6 p-4 rounded-lg border ${
                isLightTheme 
                  ? 'bg-red-50 text-red-800 border-red-200' 
                  : 'bg-red-900/20 text-red-300 border-red-800/30'
              }`}
            >
              {transcriptionError}
            </div>

            {/* Кнопка закрытия */}
            <button
              onClick={() => setTranscriptionError(null)}
              className="btn-upload w-full"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default AccountPage;