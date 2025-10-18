import React from 'react';
import { useFileUpload } from '../hooks/useFileUpload';
// @ts-ignore
import { useNavigate } from 'react-router-dom';

const UploadDemo: React.FC = () => {
  const { isUploading, uploadProgress, error, success, uploadFile } = useFileUpload();
  const navigate = useNavigate();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleUploadClick = () => {
    navigate('/account');
    // Прокрутка к началу страницы после навигации
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  return (
    <section 
      className="mt-40 max-w-4xl mx-auto py-20 px-15 border text-center rounded-xl"
      style={{ 
        borderColor: 'var(--border-color)',
        background: 'var(--hover-bg)'
      }}
    >
      <div className="mb-8 flex flex-col items-center justify-center">
        <label>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 48 48"
            strokeWidth="2"
            stroke="currentColor"
            className="w-16 h-16 text-primary transition-colors duration-300 group-hover:text-blue-500 group-hover:scale-110"
            style={{ color: 'var(--text-primary)' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 33v4.5A4.5 4.5 0 0 0 10.5 42h27A4.5 4.5 0 0 0 42 37.5V33M33 24l-9 9m0 0-9-9m9 9V6"
            />
          </svg>
        </label>
      </div>

      <h3 
        className="text-3xl font-normal opacity-80 text-primary mb-5 transition-all duration-200 hover:opacity-100 cursor-pointer"
        style={{ color: 'var(--text-primary)' }}
        tabIndex={0}
      >
        Попробуйте прямо сейчас
      </h3>
      
      <p 
        className="text-lg text-secondary opacity-80 mb-10 transition-all duration-200 hover:opacity-100 cursor-pointer"
        style={{ color: 'var(--text-secondary)' }}
        title="Загрузите файл, чтобы увидеть результат"
      >
        Загрузите аудиофайл и получите транскрипцию бесплатно
      </p>
      
      <button
        onClick={handleUploadClick}
        className={`inline-block px-12 py-5 text-lg font-normal bg-transparent text-primary border-2 no-underline transition-all duration-500 tracking-wider cursor-pointer hover:border-primary hover:bg-hover rounded-lg custom-upload-btn ${
          isUploading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        style={{ 
          color: 'var(--text-primary)',
          borderColor: 'var(--border-color)',
          background: 'var(--hover-bg)'
        }}
      >
        {isUploading ? `Загрузка... ${uploadProgress}%` : success ? 'Файл загружен!' : 'Выбрать файл'}
      </button>
      
      <style>
        {`
          .custom-upload-btn {
            transition: transform 0.2s, filter 0.2s, opacity 0.2s;
          }
          .custom-upload-btn:hover, .custom-upload-btn:focus-visible {
            transform: scale(1.05);
            opacity: 1 !important;
            filter: brightness(1.1);
            z-index: 1;
          }
        `}
      </style>


      {error && (
        <div className="text-red-400 text-sm mt-4">
          {error}
        </div>
      )}
      
      {isUploading && (
        <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 mt-4 mx-auto">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}
    </section>
  );
};

export default UploadDemo;
