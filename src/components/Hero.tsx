import React, { useEffect } from 'react';
import { motion, Variants, stagger, useAnimate } from 'framer-motion';
import { useFileUpload } from '../hooks/useFileUpload';
import { useNavigate } from 'react-router-dom';

// Простая функция для объединения классов
function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs.filter(Boolean).join(' ');
}

interface WordPullUpProps {
  words: string;
  delayMultiple?: number;
  wrapperFramerProps?: Variants;
  framerProps?: Variants;
  className?: string;
  style?: React.CSSProperties;
}

function WordPullUp({
  words,
  wrapperFramerProps = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  },
  framerProps = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
  },
  className,
  style,
}: WordPullUpProps) {
  return (
    <motion.h1
      variants={wrapperFramerProps}
      initial="hidden"
      animate="show"
      className={cn(
        'font-display text-center font-light leading-tight tracking-tight',
        className,
      )}
      style={style}
    >
      {words.split(' ').map((word, i) => (
        <motion.span
          key={i}
          variants={framerProps}
          className="inline-block pr-2 sm:pr-6"
        >
          {word === '' ? <span>&nbsp;</span> : word}
        </motion.span>
      ))}
    </motion.h1>
  );
}

interface TextGenerateEffectProps {
  words: string;
  className?: string;
  filter?: boolean;
  duration?: number;
  style?: React.CSSProperties;
}

const TextGenerateEffect: React.FC<TextGenerateEffectProps> = ({
  words,
  className,
  filter = true,
  duration = 0.5,
  style,
}) => {
  const [scope, animate] = useAnimate();
  let wordsArray = words.split(' ');

  useEffect(() => {
    if (scope.current) {
      animate(
        'span',
        {
          opacity: 1,
          filter: filter ? 'blur(0px)' : 'none',
        },
        {
          duration: 0.3,
          delay: stagger(0.05),
        }
      );
    }
  }, [scope, animate, filter, duration]);

  const renderWords = () => {
    return (
      <motion.div ref={scope}>
        {wordsArray.map((word, idx) => {
          return (
            <motion.span
              key={word + idx}
              className="opacity-0"
              style={{
                filter: filter ? 'blur(10px)' : 'none',
              }}
            >
              {word}{' '}
            </motion.span>
          );
        })}
      </motion.div>
    );
  };

  return (
    <div className={cn('font-light', className)} style={style}>
      <div className="mt-4">
        <div className="leading-relaxed tracking-wide">
          {renderWords()}
        </div>
      </div>
    </div>
  );
};

const Hero: React.FC = () => {
  const { isUploading, uploadProgress, error, success } = useFileUpload();
  const navigate = useNavigate();

  const handleUploadClick = () => {
    navigate('/account');
    // Прокрутка к началу страницы после навигации
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="max-w-4xl mx-auto text-center">
      <div className="mb-8 sm:mb-15 pt-20 sm:pt-15">
        <WordPullUp
          className="text-3xl sm:text-6xl md:text-7xl lg:text-8xl mb-6 sm:mb-10 opacity-95"
          words="Голос становится текстом"
          style={{ 
            color: 'var(--text-primary)',
            fontFamily: 'Georgia, serif'
          }}
        />
      </div>
      
      <div className="text-sm sm:text-base md:text-lg lg:text-xl text-secondary max-w-3xl mx-auto mb-10 sm:mb-20 opacity-70 pt-2 sm:pt-4">
        <TextGenerateEffect
          words="Превратите любую аудиозапись в структурированный текст за минуты. Лекции, интервью, встречи — всё становится доступным для изучения и анализа."
          className="text-center"
          style={{ color: 'var(--text-secondary)' }}
        />
      </div>
      
      <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
        <motion.button
          onClick={handleUploadClick}
          className={`btn-upload btn-lg ${
            isUploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={isUploading}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.5, 
            delay: 1.2,
            ease: [0.4, 0, 0.2, 1],
            type: 'tween'
          }}
          onAnimationComplete={() => {
            // Сброс willChange после завершения анимации для оптимизации
            const button = document.querySelector('.btn-upload');
            if (button) {
              (button as HTMLElement).style.willChange = 'auto';
            }
          }}
        >
          {isUploading ? `Загрузка... ${uploadProgress}%` : success ? 'Файл загружен!' : 'Загрузить аудио'}
        </motion.button>
        
        {error && (
          <div className="text-red-400 text-sm mt-2">
            {error}
          </div>
        )}
        
        {isUploading && (
          <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 mt-4">
            <div 
              className="h-2 rounded-full transition-all duration-300"
              style={{ background: 'var(--text-primary)', width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Hero;
