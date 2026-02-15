import React from 'react';
import {
  getFilterModalSurface,
  getFilterBadgeStyles,
  getFilterInfoSurface,
  getPrimaryFilterButton,
  getSecondaryFilterButton,
  getErrorModalSurface,
  getErrorAccentBadge,
  getErrorInfoSurface,
  getErrorPrimaryButton,
  getThemeColors,
} from './types';

interface TranscriptionModalsProps {
  isLightTheme: boolean;
  // Transcription progress modal
  isTranscribing: boolean;
  transcriptionProgress: string;
  transcriptionMinimized: boolean;
  setTranscriptionMinimized: (minimized: boolean) => void;
  // Error modal
  transcriptionError: string | null;
  setTranscriptionError: (error: string | null) => void;
  errorRecoverySteps: string[];
  // Filter modal
  showFilterModal: boolean;
  handleApplyFilter: () => void;
  handleSkipFilter: () => void;
  isFiltering: boolean;
  filterBenefits: string[];
}

const TranscriptionModals: React.FC<TranscriptionModalsProps> = ({
  isLightTheme,
  isTranscribing,
  transcriptionProgress,
  transcriptionMinimized,
  setTranscriptionMinimized,
  transcriptionError,
  setTranscriptionError,
  errorRecoverySteps,
  showFilterModal,
  handleApplyFilter,
  handleSkipFilter,
  isFiltering,
  filterBenefits,
}) => {
  const filterModalSurface = getFilterModalSurface(isLightTheme);
  const filterBadgeStyles = getFilterBadgeStyles(isLightTheme);
  const filterInfoSurface = getFilterInfoSurface(isLightTheme);
  const primaryFilterButton = getPrimaryFilterButton(isLightTheme);
  const secondaryFilterButton = getSecondaryFilterButton(isLightTheme);
  const errorModalSurface = getErrorModalSurface(isLightTheme);
  const errorAccentBadge = getErrorAccentBadge(isLightTheme);
  const errorInfoSurface = getErrorInfoSurface(isLightTheme);
  const errorPrimaryButton = getErrorPrimaryButton(isLightTheme);
  const { headingColor: filterHeadingColor, bodyColor: filterBodyColor, mutedColor: filterMutedColor } = getThemeColors(isLightTheme);

  return (
    <>
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
    </>
  );
};

export default TranscriptionModals;
