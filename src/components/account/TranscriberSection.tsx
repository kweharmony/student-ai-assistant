import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface TranscriberSectionProps {
  handleAudioTranscription: (file: File, meta: LectureMeta) => Promise<void>;
}

export interface LectureMeta {
  title: string;
  subject: string;
  description: string;
  lecture_date: string;
  is_public: boolean;
}

const TranscriberSection: React.FC<TranscriberSectionProps> = ({ handleAudioTranscription }) => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [meta, setMeta] = useState<LectureMeta>({
    title: '',
    subject: '',
    description: '',
    lecture_date: new Date().toISOString().split('T')[0],
    is_public: false,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE_MB = 100;
    const MB = 1024 * 1024;

    if (file.size > MAX_SIZE_MB * MB) {
      alert(`Файл слишком большой. Максимальный размер: ${MAX_SIZE_MB} МБ.`);
      return;
    }

    setSelectedFile(file);

    // Автозаполнение названия из имени файла (без расширения)
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    setMeta(prev => ({
      ...prev,
      title: prev.title || nameWithoutExt,
    }));

    setShowModal(true);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!selectedFile || !meta.title.trim()) return;

    setIsUploading(true);
    try {
      await handleAudioTranscription(selectedFile, meta);
      // Сбросить форму
      setShowModal(false);
      setSelectedFile(null);
      setMeta({
        title: '',
        subject: '',
        description: '',
        lecture_date: new Date().toISOString().split('T')[0],
        is_public: false,
      });
    } catch {
      // Ошибка обработается в AccountPage
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setSelectedFile(null);
  };

  const inputStyle = (field: string) => ({
    color: 'var(--text-primary)',
    borderColor: focusedField === field ? 'var(--text-secondary)' : 'var(--border-color)',
    background: 'var(--hover-bg)',
    fontFamily: 'Georgia, serif',
  });

  const inputClass = "w-full px-4 py-3 bg-transparent border text-base transition-all duration-300 rounded-lg focus:outline-none";
  const labelClass = "flex items-center gap-2 text-sm font-normal mb-2 tracking-wide opacity-80";

  // Подсказка по предмету на основе профиля
  const subjectPlaceholder = user?.role === 'teacher' && user.teacher_profile?.department
    ? `Например: ${user.teacher_profile.department}`
    : 'Математика, Физика, История...';

  return (
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
          Загружайте аудиофайлы лекций для транскрибации
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
              Загрузите аудиофайл лекции
            </h3>
            <p
              className="text-base opacity-80 mb-6"
              style={{ color: 'var(--text-secondary)' }}
            >
              Выберите аудиофайл до 100 МБ — после загрузки укажите информацию о лекции
            </p>
          </div>

          <label className="btn-upload inline-block cursor-pointer">
            <input
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.flac,.ogg,.opus,.mp4,.mov,.avi,.mkv,.webm"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            Выбрать файл
          </label>
        </div>
      </div>

      {/* ====== Модальное окно: информация о лекции ====== */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !isUploading) handleClose(); }}
        >
          <div
            className="w-full max-w-lg mx-4 p-6 md:p-8 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              fontFamily: 'Georgia, serif',
            }}
          >
            {/* Заголовок */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2
                  className="text-xl md:text-2xl font-light"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Информация о лекции
                </h2>
                <p className="text-sm opacity-60 mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Заполните данные перед загрузкой
                </p>
              </div>
              {!isUploading && (
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg transition-all duration-300 hover:opacity-70"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>

            {/* Выбранный файл */}
            <div
              className="flex items-center gap-3 p-3 rounded-xl mb-6"
              style={{
                background: 'var(--hover-bg)',
                border: '1px solid var(--border-color)',
              }}
            >
              <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)', fontSize: '20px' }}>
                audio_file
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                  {selectedFile?.name}
                </div>
                <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                  {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} МБ` : ''}
                </div>
              </div>
            </div>

            {/* Форма */}
            <div className="space-y-4">
              {/* Название лекции * */}
              <div>
                <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>title</span>
                  <span>Название лекции <span style={{ color: '#B58488' }}>*</span></span>
                </label>
                <input
                  type="text"
                  value={meta.title}
                  onChange={(e) => setMeta(prev => ({ ...prev, title: e.target.value }))}
                  onFocus={() => setFocusedField('title')}
                  onBlur={() => setFocusedField(null)}
                  className={inputClass}
                  style={inputStyle('title')}
                  placeholder="Введение в линейную алгебру"
                  maxLength={300}
                  required
                />
              </div>

              {/* Предмет */}
              <div>
                <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>menu_book</span>
                  <span>Предмет</span>
                </label>
                <input
                  type="text"
                  value={meta.subject}
                  onChange={(e) => setMeta(prev => ({ ...prev, subject: e.target.value }))}
                  onFocus={() => setFocusedField('subject')}
                  onBlur={() => setFocusedField(null)}
                  className={inputClass}
                  style={inputStyle('subject')}
                  placeholder={subjectPlaceholder}
                  maxLength={100}
                />
              </div>

              {/* Дата лекции */}
              <div>
                <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>calendar_today</span>
                  <span>Дата лекции</span>
                </label>
                <input
                  type="date"
                  value={meta.lecture_date}
                  onChange={(e) => setMeta(prev => ({ ...prev, lecture_date: e.target.value }))}
                  onFocus={() => setFocusedField('date')}
                  onBlur={() => setFocusedField(null)}
                  className={inputClass}
                  style={inputStyle('date')}
                />
              </div>

              {/* Описание */}
              <div>
                <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>description</span>
                  <span>Описание</span>
                </label>
                <textarea
                  value={meta.description}
                  onChange={(e) => setMeta(prev => ({ ...prev, description: e.target.value }))}
                  onFocus={() => setFocusedField('description')}
                  onBlur={() => setFocusedField(null)}
                  className={inputClass}
                  style={{ ...inputStyle('description'), resize: 'vertical', minHeight: '80px' }}
                  placeholder="Краткое описание содержания лекции..."
                  rows={3}
                />
              </div>

              {/* Публичная лекция */}
              <div
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300"
                style={{
                  background: meta.is_public ? 'rgba(130, 170, 130, 0.1)' : 'transparent',
                  border: `1px solid ${meta.is_public ? 'rgba(130, 170, 130, 0.3)' : 'var(--border-color)'}`,
                }}
                onClick={() => setMeta(prev => ({ ...prev, is_public: !prev.is_public }))}
              >
                <div
                  className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-300"
                  style={{
                    borderColor: meta.is_public ? '#82AA82' : 'var(--border-color)',
                    background: meta.is_public ? '#82AA82' : 'transparent',
                  }}
                >
                  {meta.is_public && (
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'white' }}>check</span>
                  )}
                </div>
                <div>
                  <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    Сделать лекцию публичной
                  </div>
                  <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                    После модерации лекция появится в публичном каталоге
                  </div>
                </div>
              </div>

              {/* Информация о загрузчике */}
              {user && (
                <div
                  className="text-xs p-3 rounded-lg opacity-60"
                  style={{
                    background: 'var(--hover-bg)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>person</span>
                  Загружает: {user.full_name || user.login}
                  {user.role === 'student' && user.student_profile?.group_name && (
                    <> | Группа: {user.student_profile.group_name}</>
                  )}
                  {user.role === 'student' && user.student_profile?.faculty && (
                    <> | {user.student_profile.faculty}</>
                  )}
                  {user.role === 'teacher' && user.teacher_profile?.department && (
                    <> | {user.teacher_profile.department}</>
                  )}
                  {user.role === 'teacher' && user.teacher_profile?.position && (
                    <> | {user.teacher_profile.position}</>
                  )}
                </div>
              )}
            </div>

            {/* Кнопки */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleClose}
                disabled={isUploading}
                className="flex-1 px-4 py-3 rounded-lg border text-base transition-all duration-300 disabled:opacity-30"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)',
                  background: 'transparent',
                  fontFamily: 'Georgia, serif',
                }}
              >
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                disabled={isUploading || !meta.title.trim()}
                className="btn flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upload</span>
                    Загрузить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TranscriberSection;
