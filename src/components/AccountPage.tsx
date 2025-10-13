import React, { useState, useEffect } from 'react';
// @ts-ignore
import { Link } from 'react-router-dom';

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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<Record[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [showRecords, setShowRecords] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [activeView, setActiveView] = useState<'records' | 'schedule'>('records');
  const [expandedTexts, setExpandedTexts] = useState<{[key: string]: 'original' | 'processed' | null}>({});

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

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonthIndex);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonthIndex);
    const days = [];

    // Пустые ячейки для начала месяца
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8 md:h-12 md:w-12 lg:h-16 lg:w-16 xl:h-16 xl:w-16"></div>);
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
          className={`calendar-day h-8 w-8 md:h-12 md:w-12 lg:h-16 lg:w-16 xl:h-16 xl:w-16 flex items-center justify-center relative rounded-lg text-sm md:text-base lg:text-lg xl:text-lg text-center transition-all duration-300 hover:scale-105 ${
            isCurrentDay 
              ? 'today' 
              : isSelectedDay
              ? 'selected'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-lg'
          }`}
        >
          {day}
          {hasRecordsForDay && (
            <div className="absolute top-0.5 right-0.5 md:top-1 md:right-1 lg:top-2 lg:right-2 xl:top-2 xl:right-2 w-1.5 h-1.5 md:w-2 md:h-2 lg:w-3 lg:h-3 xl:w-3 xl:h-3 bg-red-500 rounded-full shadow-lg"></div>
          )}
          {hasScheduleForDay && (
            <div className="absolute top-0.5 left-0.5 md:top-1 md:left-1 lg:top-2 lg:left-2 xl:top-2 xl:left-2 w-1.5 h-1.5 md:w-2 md:h-2 lg:w-3 lg:h-3 xl:w-3 xl:h-3 bg-green-500 rounded-full shadow-lg"></div>
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

  return (
    <div className={`min-h-screen flex flex-col overflow-x-hidden relative transition-all duration-500 ${
      isLightTheme ? 'light-theme' : ''
    }`} style={{
      fontFamily: 'Georgia, Times New Roman, serif',
      lineHeight: '1.8',
      color: 'var(--text-primary)',
      background: 'var(--bg-primary)'
    }}>
      
      <header 
        className="bg-transparent px-15 sticky top-0 z-50 border-b"
        style={{ 
          borderColor: 'var(--border-color)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-25 relative z-10">
          <Link 
            to="/"
            className="text-3xl font-normal text-primary no-underline tracking-wider transition-opacity duration-500 hover:opacity-60 bg-transparent border-none cursor-pointer"
            style={{ 
              color: 'var(--text-primary)',
              fontFamily: 'Georgia, serif'
            }}
            aria-label="На главную"
          >
            MindeSync
          </Link>
          
          <div className="flex items-center gap-5 md:gap-15">
            <button 
              onClick={onToggleTheme}
              className="bg-transparent border text-secondary px-3 py-3 md:px-5 cursor-pointer text-base transition-all duration-500 opacity-60 hover:opacity-100 hover:bg-hover rounded-lg"
              style={{ 
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-color)',
                background: 'var(--hover-bg)'
              }}
            >
              {isLightTheme ? '☾' : '☀︎'}
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 px-4 md:px-8 lg:px-15 py-8 md:py-30 lg:py-40 max-w-7xl mx-auto w-full relative z-10">
        {/* Заголовочный блок */}
        <div className="text-center mb-8 md:mb-16 px-4">
          <h1 
            className="text-3xl md:text-5xl lg:text-6xl xl:text-6xl 2xl:text-7xl font-light mb-4 md:mb-8 lg:mb-12 tracking-wide"
            style={{ color: 'var(--text-primary)' }}
          >
            Система записей
          </h1>
          <p 
            className="text-base md:text-xl lg:text-2xl xl:text-2xl 2xl:text-3xl opacity-70 max-w-3xl mx-auto leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            Управляйте своими лекциями и записями с помощью удобного календаря
          </p>
        </div>

        {/* Секция профиля */}
        <div className="bg-transparent border rounded-2xl p-4 md:p-8 lg:p-12 xl:p-16 mb-8 md:mb-16" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8 lg:gap-12 xl:gap-16">
            <div className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 xl:w-24 xl:h-24 profile-avatar rounded-full flex items-center justify-center text-white text-xl md:text-2xl lg:text-3xl xl:text-3xl font-semibold">
              ИИ
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl md:text-2xl lg:text-3xl xl:text-3xl font-semibold mb-2 lg:mb-4" style={{ color: 'var(--text-primary)' }}>
                Иван Иванов
              </h3>
              <p className="text-base md:text-lg lg:text-xl xl:text-xl mb-2 lg:mb-4" style={{ color: 'var(--text-secondary)' }}>
                ivan.ivanov@example.com
              </p>
              <p className="text-sm md:text-base lg:text-lg xl:text-lg opacity-70 mb-4 lg:mb-6" style={{ color: 'var(--text-secondary)' }}>
                Зарегистрирован: 15 января 2025
              </p>
              <button 
                className="w-full md:w-auto px-4 md:px-6 lg:px-8 xl:px-8 py-2 md:py-3 lg:py-4 xl:py-4 bg-transparent border rounded-lg transition-all duration-300 hover:bg-hover text-sm md:text-base lg:text-lg xl:text-lg hover:scale-105"
                style={{ 
                  color: 'var(--text-secondary)',
                  borderColor: 'var(--border-color)',
                  background: 'var(--hover-bg)'
                }}
              >
                Изменить пароль
              </button>
            </div>
          </div>
        </div>

        {/* Календарная секция */}
        <div className="bg-transparent border rounded-2xl p-4 md:p-8 lg:p-12 xl:p-16 mb-8 md:mb-16" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex flex-col sm:flex-row items-center justify-between mb-6 md:mb-8 lg:mb-12 gap-4">
            <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-4xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Календарь
            </h2>
            <div className="flex items-center justify-center w-80 md:w-96 lg:w-112 xl:w-112">
              <button 
                onClick={() => navigateMonth('prev')}
                className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 xl:w-12 xl:h-12 flex items-center justify-center bg-transparent border rounded-lg hover:bg-hover transition-all duration-300 hover:scale-105 group flex-shrink-0"
                style={{ 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)',
                  background: 'var(--hover-bg)'
                }}
              >
                <span className="text-lg md:text-xl lg:text-2xl xl:text-2xl group-hover:-translate-x-1 transition-transform duration-300">←</span>
              </button>
              <span className="text-lg md:text-xl lg:text-2xl xl:text-2xl font-medium flex-1 text-center mx-4" style={{ color: 'var(--text-primary)' }}>
                {monthNames[currentMonthIndex]} {currentYear}
              </span>
              <button 
                onClick={() => navigateMonth('next')}
                className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 xl:w-12 xl:h-12 flex items-center justify-center bg-transparent border rounded-lg hover:bg-hover transition-all duration-300 hover:scale-105 group flex-shrink-0"
                style={{ 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)',
                  background: 'var(--hover-bg)'
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
                className="h-8 w-8 md:h-12 md:w-12 lg:h-16 lg:w-16 xl:h-16 xl:w-16 flex items-center justify-center text-xs md:text-sm lg:text-base xl:text-base font-medium opacity-70"
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
              <h2 className="text-xl md:text-3xl lg:text-4xl xl:text-4xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {activeView === 'records' ? 'Записи' : 'Расписание'} за {selectedDate.toLocaleDateString('ru-RU', { 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </h2>
              <button 
                onClick={handleClearSelection}
                className="w-full sm:w-auto px-4 md:px-6 lg:px-8 xl:px-8 py-2 md:py-3 lg:py-4 xl:py-4 bg-transparent border rounded-lg transition-all duration-300 hover:bg-hover text-sm md:text-base lg:text-lg xl:text-lg hover:scale-105"
                style={{ 
                  color: 'var(--text-secondary)',
                  borderColor: 'var(--border-color)',
                  background: 'var(--hover-bg)'
                }}
              >
                Очистить выбор
              </button>
            </div>

            {/* Кнопки переключения */}
            <div className="flex gap-2 mb-6 md:mb-8 lg:mb-12">
              <button
                onClick={() => handleViewChange('records')}
                className={`px-4 md:px-6 lg:px-8 xl:px-8 py-2 md:py-3 lg:py-4 xl:py-4 rounded-lg transition-all duration-300 text-sm md:text-base lg:text-lg xl:text-lg hover:scale-105 ${
                  activeView === 'records' 
                    ? 'bg-blue-500 text-white shadow-lg' 
                    : 'bg-transparent border hover:bg-hover'
                }`}
                style={{ 
                  color: activeView === 'records' ? 'white' : 'var(--text-secondary)',
                  borderColor: activeView === 'records' ? 'transparent' : 'var(--border-color)',
                  background: activeView === 'records' ? '#3b82f6' : 'var(--hover-bg)'
                }}
              >
                Записи
              </button>
              <button
                onClick={() => handleViewChange('schedule')}
                className={`px-4 md:px-6 lg:px-8 xl:px-8 py-2 md:py-3 lg:py-4 xl:py-4 rounded-lg transition-all duration-300 text-sm md:text-base lg:text-lg xl:text-lg hover:scale-105 ${
                  activeView === 'schedule' 
                    ? 'bg-blue-500 text-white shadow-lg' 
                    : 'bg-transparent border hover:bg-hover'
                }`}
                style={{ 
                  color: activeView === 'schedule' ? 'white' : 'var(--text-secondary)',
                  borderColor: activeView === 'schedule' ? 'transparent' : 'var(--border-color)',
                  background: activeView === 'schedule' ? '#3b82f6' : 'var(--hover-bg)'
                }}
              >
                Расписание
              </button>
            </div>

            <div className="space-y-4 md:space-y-6 lg:space-y-8 xl:space-y-10">
              {activeView === 'records' ? (
                <>
                  {getRecordsForSelectedDate().map(record => (
                    <div 
                      key={record.id} 
                      className="bg-transparent border rounded-xl p-4 md:p-6 lg:p-8 xl:p-10 record-card hover:shadow-2xl"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <h3 className="text-lg md:text-xl lg:text-2xl xl:text-2xl font-semibold mb-3 md:mb-4 lg:mb-6" style={{ color: 'var(--text-primary)' }}>
                        {record.title}
                      </h3>
                      <div className="space-y-4">
                        {/* Кнопки для переключения текстов */}
                        <div className="flex gap-2 mb-4">
                          <button
                            onClick={() => toggleTextExpansion(record.id, 'original')}
                            className={`px-4 md:px-6 lg:px-8 xl:px-8 py-2 md:py-3 lg:py-4 xl:py-4 rounded-lg transition-all duration-300 text-sm md:text-base lg:text-lg xl:text-lg hover:scale-105 ${
                              expandedTexts[record.id] === 'original' 
                                ? 'bg-blue-500 text-white shadow-lg' 
                                : 'bg-transparent border hover:bg-hover'
                            }`}
                            style={{ 
                              color: expandedTexts[record.id] === 'original' ? 'white' : 'var(--text-secondary)',
                              borderColor: expandedTexts[record.id] === 'original' ? 'transparent' : 'var(--border-color)',
                              background: expandedTexts[record.id] === 'original' ? '#3b82f6' : 'var(--hover-bg)'
                            }}
                          >
                            Оригинальный текст
                          </button>
                          <button
                            onClick={() => toggleTextExpansion(record.id, 'processed')}
                            className={`px-4 md:px-6 lg:px-8 xl:px-8 py-2 md:py-3 lg:py-4 xl:py-4 rounded-lg transition-all duration-300 text-sm md:text-base lg:text-lg xl:text-lg hover:scale-105 ${
                              expandedTexts[record.id] === 'processed' 
                                ? 'bg-blue-500 text-white shadow-lg' 
                                : 'bg-transparent border hover:bg-hover'
                            }`}
                            style={{ 
                              color: expandedTexts[record.id] === 'processed' ? 'white' : 'var(--text-secondary)',
                              borderColor: expandedTexts[record.id] === 'processed' ? 'transparent' : 'var(--border-color)',
                              background: expandedTexts[record.id] === 'processed' ? '#3b82f6' : 'var(--hover-bg)'
                            }}
                          >
                            Обработанный текст
                          </button>
                        </div>
                        
                        {/* Отображение выбранного текста */}
                        {expandedTexts[record.id] && (
                          <div className="bg-transparent border rounded-lg p-4 md:p-6 lg:p-8 xl:p-8" style={{ borderColor: 'var(--border-color)' }}>
                            <h4 className="text-base md:text-lg lg:text-xl xl:text-xl font-medium mb-3 md:mb-4 lg:mb-6" style={{ color: 'var(--text-secondary)' }}>
                              {expandedTexts[record.id] === 'original' ? 'Оригинальный текст' : 'Обработанный текст'}
                            </h4>
                            <p className="text-sm md:text-base lg:text-lg xl:text-lg leading-relaxed" style={{ color: 'var(--text-primary)' }}>
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
                      className="bg-transparent border rounded-xl p-4 md:p-6 lg:p-8 xl:p-10 record-card hover:shadow-2xl"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 md:mb-4 lg:mb-6 gap-2">
                        <h3 className="text-lg md:text-xl lg:text-2xl xl:text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {item.subject}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          item.type === 'lecture' ? 'bg-blue-100 text-blue-800' :
                          item.type === 'seminar' ? 'bg-green-100 text-green-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {item.type === 'lecture' ? 'Лекция' : 
                         item.type === 'seminar' ? 'Семинар' : 'Лабораторная'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 xl:gap-8">
                        <div>
                          <h4 className="text-base md:text-lg lg:text-xl xl:text-xl font-medium mb-2 md:mb-3 lg:mb-4" style={{ color: 'var(--text-secondary)' }}>
                            Время
                          </h4>
                          <p className="text-sm md:text-base lg:text-lg xl:text-lg" style={{ color: 'var(--text-primary)' }}>
                            {item.time}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-base md:text-lg lg:text-xl xl:text-xl font-medium mb-2 md:mb-3 lg:mb-4" style={{ color: 'var(--text-secondary)' }}>
                            Аудитория
                          </h4>
                          <p className="text-sm md:text-base lg:text-lg xl:text-lg" style={{ color: 'var(--text-primary)' }}>
                            {item.room}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-base md:text-lg lg:text-xl xl:text-xl font-medium mb-2 md:mb-3 lg:mb-4" style={{ color: 'var(--text-secondary)' }}>
                            Преподаватель
                          </h4>
                          <p className="text-sm md:text-base lg:text-lg xl:text-lg" style={{ color: 'var(--text-primary)' }}>
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
      </main>
      
      <footer 
        className="bg-transparent text-secondary py-10 px-15 mt-auto relative z-10 border-t"
        style={{ 
          color: 'var(--text-secondary)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-30 mb-20">
          <div className="md:col-span-2">
            <h3 
              className="text-sm mb-8 text-primary font-normal tracking-widest uppercase opacity-50"
              style={{ color: 'var(--text-primary)' }}
            >
              MindeSync
            </h3>
            <p 
              className="text-secondary mb-10 leading-8 opacity-50 text-lg max-w-lg font-light"
              style={{ color: 'var(--text-secondary)' }}
            >
              Мы создаём инструменты для преобразования звука в текст. Делаем информацию доступной, понятной и удобной для работы.
            </p>
            <div className="flex gap-4 mt-10">
              {['✈️', '⚡', '◆'].map((icon, index) => (
                <a 
                  key={index}
                  href="#" 
                  className="w-11 h-11 bg-transparent flex items-center justify-center text-secondary no-underline transition-all duration-500 border text-lg opacity-80 hover:opacity-100 hover:border-secondary hover:-translate-y-0.5 rounded-lg"
                  style={{ 
                    color: 'var(--text-secondary)',
                    borderColor: 'var(--border-color)'
                  }}
                  aria-label={`Social link ${index + 1}`}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>
          
          {[
            {
              title: 'Продукт',
              links: ['Как работает', 'Цены', 'API', 'Документация', 'Интеграции']
            },
            {
              title: 'Компания',
              links: ['О нас', 'Блог', 'Карьера', 'Контакты', 'Пресса']
            },
            {
              title: 'Поддержка',
              links: ['Справка', 'Статус', 'Безопасность', 'Конфиденциальность', 'Сообщество']
            }
          ].map((section, index) => (
            <div key={index}>
              <h3 
                className="text-sm mb-8 text-primary font-normal tracking-widest uppercase opacity-50"
                style={{ color: 'var(--text-primary)' }}
              >
                {section.title}
              </h3>
              <div className="flex flex-col gap-4">
                {section.links.map((link, linkIndex) => (
                  <a 
                    key={linkIndex}
                    href="#" 
                    className="text-secondary no-underline transition-all duration-500 text-base opacity-50 font-light tracking-wide hover:opacity-80 hover:pl-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div 
          className="max-w-7xl mx-auto pt-15 border-t flex flex-col md:flex-row justify-between items-center text-secondary text-sm opacity-40 tracking-wide gap-6"
          style={{ 
            color: 'var(--text-secondary)',
            borderColor: 'var(--border-color)'
          }}
        >
          <div>© 2025 MindeSync.</div>
          <div className="flex flex-col md:flex-row gap-4 md:gap-10 text-center md:text-left">
            {['Условия использования', 'Конфиденциальность', 'Cookies'].map((link, index) => (
              <a 
                key={index}
                href="#" 
                className="text-secondary no-underline transition-all duration-500 opacity-50 hover:opacity-80"
                style={{ color: 'var(--text-secondary)' }}
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AccountPage;
