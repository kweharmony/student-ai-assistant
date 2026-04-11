import React from 'react';

const Features: React.FC = () => {
  const features = [
    {
      icon: 'mic',
      title: 'Транскрибация лекций',
      description: 'Загружайте аудио и получайте текст с отслеживанием статуса обработки через очередь воркеров.'
    },
    {
      icon: 'auto_fix_high',
      title: 'AI-очистка текста',
      description: 'Автоматически улучшайте расшифровку: исправление структуры, пунктуации и читабельности.'
    },
    {
      icon: 'library_books',
      title: 'База лекций',
      description: 'Храните все материалы в одном месте, быстро находите нужные записи и открывайте их в редакторе.'
    },
    {
      icon: 'dashboard',
      title: 'Интерактивные доски',
      description: 'Создавайте полотна для схем и конспектов, делитесь публичной ссылкой и возвращайтесь к ним позже.'
    },
    {
      icon: 'admin_panel_settings',
      title: 'Админ-панель',
      description: 'Контролируйте пользователей, воркеров, лекции и доски через единый обзор и управленческие вкладки.'
    },
    {
      icon: 'devices',
      title: 'Работа с любого устройства',
      description: 'Продолжайте работу после перезагрузки: активные разделы сохраняются, а интерфейс адаптирован под экран.'
    }
  ];

  return (
    <section
      id="features"
      className="mt-20 sm:mt-40 md:mt-60 max-w-6xl mx-auto px-2 sm:px-0 relative"
    >
      <div className="mb-10 sm:mb-20 md:mb-25 flex flex-col items-center">
        <h2
          className="text-center text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light mb-5 sm:mb-7 leading-tight tracking-tight opacity-95"
          style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}
        >
          Возможности платформы
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 md:gap-12 mb-15 sm:mb-25 md:mb-30 max-w-5xl mx-auto">
        {features.map((feature, index) => (
          <div
            key={index}
            className="group feature-card relative py-8 sm:py-10 md:py-12 px-4 sm:px-6 md:px-8 flex flex-col items-center bg-white bg-opacity-95 rounded-2xl border border-solid transition-all duration-500 hover:shadow-2xl hover:border-secondary hover:bg-hover hover:-translate-y-1.5 overflow-hidden"
            style={{
              borderColor: 'var(--border-color)',
              background: 'var(--bg-primary)'
            }}
          >
            <span
              className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 text-4xl sm:text-5xl rounded-full bg-gradient-to-tr from-primary/10 to-secondary/10 mb-5 sm:mb-7 shadow transition-all duration-400 group-hover:scale-110"
              style={{
                boxShadow: '0 3px 12px rgba(50,30,46,0.07)'
              }}
            >
              <span className="material-symbols-outlined text-4xl sm:text-5xl">{feature.icon}</span>
            </span>
            <h3
              className="text-lg sm:text-xl md:text-2xl font-normal text-primary mb-2 sm:mb-3 tracking-wide text-center"
              style={{ color: 'var(--text-primary)' }}
            >
              {feature.title}
            </h3>
            <p
              className="text-sm sm:text-base md:text-lg text-secondary opacity-70 leading-relaxed font-light text-center"
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
