import React from 'react';
import { useFileUpload } from '../hooks/useFileUpload';

const UploadDemo: React.FC = () => {
  const { isUploading, uploadProgress, error, success, uploadFile } = useFileUpload();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  return (
    <section 
      className="mt-40 max-w-4xl mx-auto py-20 px-15 border text-center rounded-xl"
      style={{ 
        borderColor: 'var(--border-color)',
        background: 'var(--hover-bg)'
      }}
    >
      <div className="mb-8">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 48 48"
          strokeWidth="2"
          stroke="currentColor"
          className="w-20 h-20 mx-auto"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 33v4.5A4.5 4.5 0 0 0 10.5 42h27A4.5 4.5 0 0 0 42 37.5V33M33 24l-9 9m0 0-9-9m9 9V6"
          />
        </svg>
      </div>

      <h3 
        className="text-3xl font-normal text-primary mb-5"
        style={{ color: 'var(--text-primary)' }}
      >
        Попробуйте прямо сейчас
      </h3>
      
      <p 
        className="text-lg text-secondary opacity-60 mb-10"
        style={{ color: 'var(--text-secondary)' }}
      >
        Загрузите аудиофайл и получите транскрипцию бесплатно
      </p>
      
      <label 
        className={`inline-block px-12 py-5 text-lg font-normal bg-transparent text-primary border-2 no-underline transition-all duration-500 tracking-wider cursor-pointer hover:border-primary hover:bg-hover rounded-lg ${
          isUploading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        style={{ 
          color: 'var(--text-primary)',
          borderColor: 'var(--border-color)',
          background: 'var(--hover-bg)'
        }}
      >
        {isUploading ? `Загрузка... ${uploadProgress}%` : success ? 'Файл загружен!' : 'Выбрать файл'}
        <input 
          type="file" 
          accept="audio/*" 
          className="hidden"
          onChange={handleFileUpload}
          disabled={isUploading}
        />
      </label>
      
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
