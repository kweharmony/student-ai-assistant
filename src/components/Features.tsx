import React from 'react';

const Features: React.FC = () => {
  const features = [
    {
      icon: '🎯',
      title: 'Высокая точность',
      description: 'Современные алгоритмы AI обеспечивают точность распознавания речи в сложных условиях.'
    },
    {
      icon: '⚡',
      title: 'Быстрая обработка',
      description: 'Часовая запись обрабатывается за несколько минут. Никаких длительных ожиданий.'
    },
    {
      icon: '🔒',
      title: 'Защита данных',
      description: 'Ваши файлы защищены шифрованием. Безопасность превыше всего.'
    }
  ];

  return (
    <section
      id="features"
      className="mt-60 max-w-6xl mx-auto px-2 sm:px-0 relative"
    >
      <div className="mb-25 flex flex-col items-center">
        <h2
          className="text-center text-3xl sm:text-4xl md:text-5xl font-light mb-7 leading-tight tracking-tight opacity-95"
          style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}
        >
          Особенности платформы
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-12 mb-30 max-w-5xl mx-auto">
        {features.map((feature, index) => (
          <div
            key={index}
            className="group feature-card relative py-12 px-8 flex flex-col items-center bg-white bg-opacity-95 rounded-2xl border border-solid transition-all duration-500 hover:shadow-2xl hover:border-secondary hover:bg-hover hover:-translate-y-1.5 overflow-hidden"
            style={{
              borderColor: 'var(--border-color)',
              background: 'var(--bg-primary)'
            }}
          >
            <span
              className="flex items-center justify-center w-20 h-20 text-5xl rounded-full bg-gradient-to-tr from-primary/10 to-secondary/10 mb-7 shadow transition-all duration-400 group-hover:scale-110"
              style={{
                boxShadow: '0 3px 12px rgba(50,30,46,0.07)'
              }}
            >
              {feature.icon}
            </span>
            <h3
              className="text-xl sm:text-2xl font-normal text-primary mb-3 tracking-wide text-center"
              style={{ color: 'var(--text-primary)' }}
            >
              {feature.title}
            </h3>
            <p
              className="text-base sm:text-lg text-secondary opacity-70 leading-relaxed font-light text-center"
              style={{ color: 'var(--text-secondary)' }}
            >
              {feature.description}
            </p>
            <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-r from-primary/0 via-primary/15 to-secondary/0 opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        ))}
      </div>
    </section>
  );
};

export default Features;
