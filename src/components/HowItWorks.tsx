import React from 'react';

const HowItWorks: React.FC = () => {
  const steps = [
    {
      number: '1',
      icon: 'folder',
      title: 'Загрузите файл',
      description: 'Перетащите аудиофайл или выберите его из системы. Поддерживаем все популярные форматы.'
    },
    {
      number: '2',
      icon: 'settings',
      title: 'Обработка',
      description: 'Наш AI анализирует аудио, распознаёт речь и структурирует информацию.'
    },
    {
      number: '3',
      icon: 'edit_note',
      title: 'Редактируйте текст',
      description: 'Используйте встроенный редактор для форматирования, добавления заголовков, выделения важных моментов и структурирования контента.'
    },
    {
      number: '4',
      icon: 'psychology',
      title: 'Обработка с ИИ',
      description: 'Используйте возможности искусственного интеллекта для создания конспектов, извлечения терминов и генерации вопросов.'
    },
    {
      number: '5',
      icon: 'download',
      title: 'Экспорт и сохранение',
      description: 'Сохраните результат в нужном формате: DOCX, PDF, TXT или Markdown. Все ваши транскрипции доступны в личном кабинете.'
    }
  ];

  return (
    <section id="how-it-works" className="mt-32 sm:mt-40 md:mt-60 mb-20 sm:mb-40 md:mb-60 max-w-4xl mx-auto px-4">
      <h2 
        className="text-center text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light mb-10 sm:mb-20 md:mb-25 tracking-tight opacity-90"
        style={{ color: 'var(--text-primary)' }}
      >
        Как это работает
      </h2>
      
      <div className="relative">
        {/* Вертикальная линия */}
        <div 
          className="absolute left-1/2 transform -translate-x-1/2 w-0.5 h-full hidden sm:block"
          style={{ 
            background: 'linear-gradient(to bottom, var(--border-color), var(--text-secondary), var(--border-color))',
            top: '40px',
            bottom: '40px'
          }}
        />
        
        <div className="flex flex-col gap-8 sm:gap-12 md:gap-16 relative">
          {steps.map((step, index) => {
            const isLeft = index % 2 === 0;
            
            return (
              <div 
                key={index} 
                className="relative flex items-center justify-center sm:justify-start"
                style={{
                  paddingLeft: '0',
                  paddingRight: '0'
                }}
              >
                {/* Точка на линии */}
                <div 
                  className="absolute left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full z-10 transition-all duration-300 group-hover:scale-125 hidden sm:block"
                  style={{ 
                    background: 'var(--text-primary)',
                    border: '2px solid var(--bg-primary)',
                    boxShadow: '0 0 0 4px var(--hover-bg)'
                  }}
                />
                
                {/* Карточка шага */}
                <div 
                  className={`relative w-full max-w-sm rounded-3xl p-4 sm:p-5 transition-all duration-300 hover:scale-105 group cursor-pointer mx-auto sm:mx-0 ${isLeft ? 'sm:mr-auto' : 'sm:ml-auto'}`}
                  style={{
                    background: 'var(--hover-bg)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div className="flex items-start gap-4">
                    {/* Иконка */}
                    <div 
                      className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                      style={{
                        background: 'var(--text-primary)',
                        color: 'var(--bg-primary)'
                      }}
                    >
                      <span className="material-symbols-outlined text-2xl">{step.icon}</span>
                    </div>
                    
                    {/* Контент */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span 
                          className="text-xl font-normal"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {step.number}
                        </span>
                        <h3 
                          className="text-xl font-normal tracking-wide"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {step.title}
                        </h3>
                      </div>
                      
                      <p 
                        className="text-sm leading-relaxed opacity-70"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
