import React from 'react';

interface TranscriberSectionProps {
  handleAudioTranscription: (file: File) => Promise<void>;
}

const TranscriberSection: React.FC<TranscriberSectionProps> = ({ handleAudioTranscription }) => {
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
  );
};

export default TranscriberSection;
