import React from 'react';

const HowItWorks: React.FC = () => {
  const steps = [
    {
      number: '01',
      icon: '📁',
      title: 'Загрузите файл',
      description: 'Перетащите аудиофайл или выберите его из системы. Поддерживаем все популярные форматы.'
    },
    {
      number: '02',
      icon: '⚙️',
      title: 'Обработка',
      description: 'Наш AI анализирует аудио, распознаёт речь и структурирует информацию.'
    },
    {
      number: '03',
      icon: '📄',
      title: 'Получите текст',
      description: 'Скачайте готовую транскрипцию в удобном формате. Редактируйте и сохраняйте.'
    }
  ];

  return (
    <section id="how-it-works" className="mt-60 mb-60 max-w-5xl mx-auto">
      <h2 
        className="text-center text-3xl sm:text-4xl md:text-5xl font-light mb-25 tracking-tight opacity-90"
        style={{ color: 'var(--text-primary)' }}
      >
        Как это работает
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-20 relative">
        
        {steps.map((step, index) => (
          <div 
            key={index} 
            className="text-center relative group cursor-pointer transition-all duration-300 hover:scale-105"
          >
            {/* Номер шага */}
            <div 
              className="text-7xl font-light text-secondary opacity-20 mb-6 rounded-full w-20 h-20 flex items-center justify-center mx-auto transition-all duration-300 group-hover:opacity-30"
              style={{ color: 'var(--text-secondary)' }}
            >
              {step.number}
            </div>
            
            {/* Иконка */}
            <div className="text-6xl mb-8 opacity-90 transition-all duration-300 group-hover:scale-110">
              {step.icon}
            </div>
            
            {/* Заголовок */}
            <h3 
              className="text-2xl font-normal text-primary mb-4 tracking-wide transition-all duration-300 group-hover:scale-105"
              style={{ color: 'var(--text-primary)' }}
            >
              {step.title}
            </h3>
            
            {/* Описание */}
            <p 
              className="text-lg text-secondary opacity-60 leading-relaxed transition-all duration-300 group-hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}
            >
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HowItWorks;
