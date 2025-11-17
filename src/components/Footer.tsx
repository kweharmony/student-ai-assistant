import React from 'react';

const Footer: React.FC = () => {
  const footerSections = [
    {
      title: 'Продукт',
      links: ['Как работает', 'Цены', 'API', 'Документация', 'Интеграции']
    },
    {
      title: 'Компания',
      links: ['О нас', 'Блог', 'Карьера', 'Контакты', 'Пресса']
    },
    {
      title: 'Поддержка',
      links: ['Справка', 'Статус', 'Безопасность', 'Конфиденциальность', 'Сообщество']
    }
  ];

  return (
    <footer 
      className="bg-transparent text-secondary py-10 px-15 mt-auto relative z-10 border-t"
      style={{ 
        color: 'var(--text-secondary)',
        borderColor: 'var(--border-color)'
      }}
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-30 mb-20">
        <div className="md:col-span-2">
          <h3 
            className="text-sm mb-8 text-primary font-normal tracking-widest uppercase opacity-50"
            style={{ color: 'var(--text-primary)' }}
          >
            MindeSync
          </h3>
          <p 
            className="text-secondary mb-10 leading-8 opacity-50 text-lg max-w-lg font-light"
            style={{ color: 'var(--text-secondary)' }}
          >
            Мы создаём инструменты для преобразования звука в текст. Делаем информацию доступной, понятной и удобной для работы.
          </p>
          <div className="flex gap-4 mt-10">
            {['flight', 'bolt', 'diamond'].map((icon, index) => (
              <a 
                key={index}
                href="#" 
                className="w-11 h-11 bg-transparent flex items-center justify-center text-secondary no-underline transition-all duration-500 border text-lg opacity-80 hover:opacity-100 hover:border-secondary hover:-translate-y-0.5 rounded-lg"
                style={{ 
                  color: 'var(--text-secondary)',
                  borderColor: 'var(--border-color)'
                }}
                aria-label={`Social link ${index + 1}`}
              >
                <span className="material-symbols-outlined">{icon}</span>
              </a>
            ))}
          </div>
        </div>
        
        {footerSections.map((section, index) => (
          <div key={index}>
            <h3 
              className="text-sm mb-8 text-primary font-normal tracking-widest uppercase opacity-50"
              style={{ color: 'var(--text-primary)' }}
            >
              {section.title}
            </h3>
            <div className="flex flex-col gap-4">
              {section.links.map((link, linkIndex) => (
                <a 
                  key={linkIndex}
                  href="#" 
                  className="text-secondary no-underline transition-all duration-300 text-base opacity-50 font-light tracking-wide hover:opacity-80 relative group inline-block w-fit"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="relative z-10">{link}</span>
                  <div 
                    className="absolute -bottom-1 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full"
                    style={{ background: 'var(--text-secondary)' }}
                  />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div 
        className="max-w-7xl mx-auto pt-15 border-t flex flex-col md:flex-row justify-between items-center text-secondary text-sm opacity-40 tracking-wide gap-6"
        style={{ 
          color: 'var(--text-secondary)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div>© 2025 MindeSync.</div>
        <div className="flex flex-col md:flex-row gap-4 md:gap-10 text-center md:text-left">
          {['Условия использования', 'Конфиденциальность', 'Cookies'].map((link, index) => (
            <a 
              key={index}
              href="#" 
              className="text-secondary no-underline transition-all duration-300 opacity-50 hover:opacity-80 relative group inline-block"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span className="relative z-10">{link}</span>
              <div 
                className="absolute -bottom-1 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full"
                style={{ background: 'var(--text-secondary)' }}
              />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
