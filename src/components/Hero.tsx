import React from 'react';
import { useFileUpload } from '../hooks/useFileUpload';
// @ts-ignore
import { useNavigate } from 'react-router-dom';

const Hero: React.FC = () => {
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
    <div className="max-w-4xl mx-auto text-center">
      <span 
        className="inline-block px-5 py-3 border text-secondary text-sm font-normal mb-15 tracking-wider opacity-70 rounded-lg"
        style={{ 
          borderColor: 'var(--border-color)',
          color: 'var(--text-secondary)'
        }}
      >
        Транскрибация аудио в текст
      </span>
      
      <h1 
        className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-light mb-10 leading-tight tracking-tight opacity-95"
        style={{ 
          color: 'var(--text-primary)',
          fontFamily: 'Georgia, serif'
        }}
      >
        Голос становится текстом
      </h1>
      
      <p 
        className="text-lg sm:text-xl md:text-2xl text-secondary max-w-3xl mx-auto mb-20 leading-relaxed opacity-70 font-light tracking-wide"
        style={{ color: 'var(--text-secondary)' }}
      >
        Превратите любую аудиозапись в структурированный текст за минуты. Лекции, интервью, встречи — всё становится доступным для изучения и анализа.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
        <button
          onClick={handleUploadClick}
          className={`btn-upload btn-lg ${
            isUploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={isUploading}
        >
          {isUploading ? `Загрузка... ${uploadProgress}%` : success ? 'Файл загружен!' : 'Загрузить аудио'}
        </button>
        
        {error && (
          <div className="text-red-400 text-sm mt-2">
            {error}
          </div>
        )}
        
        {isUploading && (
          <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 mt-4">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Hero;
