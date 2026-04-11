import React from 'react';
import { useNavigate } from 'react-router-dom';

const UploadDemo: React.FC = () => {
  const navigate = useNavigate();

  const handleBoardsClick = () => {
    navigate('/account');
    // Прокрутка к началу страницы после навигации
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  return (
    <section 
      className="mt-20 sm:mt-30 md:mt-40 max-w-5xl mx-auto py-10 sm:py-14 md:py-18 px-4 sm:px-8 md:px-12 border rounded-2xl relative overflow-hidden"
      style={{ 
        borderColor: 'var(--border-color)',
        background: 'linear-gradient(135deg, var(--hover-bg) 0%, rgba(148, 163, 184, 0.08) 100%)'
      }}
    >
      <div
        className="absolute -top-24 -right-20 w-72 h-72 rounded-full blur-3xl"
        style={{ background: 'rgba(14, 116, 144, 0.12)' }}
      />
      <div
        className="absolute -bottom-28 -left-16 w-72 h-72 rounded-full blur-3xl"
        style={{ background: 'rgba(30, 64, 175, 0.10)' }}
      />

      <div className="relative z-10">
        <div className="mb-4 sm:mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border"
          style={{ borderColor: 'var(--border-color)', background: 'rgba(255,255,255,0.45)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-primary)' }}>draw</span>
          <span className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>Интерактивные доски</span>
        </div>

        <h3
          className="text-2xl sm:text-3xl md:text-4xl font-light leading-tight mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Доски для быстрых схем,
          <br className="hidden sm:block" />
          формул и совместных идей
        </h3>

        <p
          className="text-sm sm:text-base md:text-lg opacity-80 max-w-3xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          Создавайте визуальные конспекты, собирайте mind-map по теме и делитесь полотнами по ссылке.
          Всё хранится в аккаунте и доступно с любого устройства.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-7 sm:mt-8 mb-7 sm:mb-8">
          {[
            { icon: 'route', title: 'Структурируйте мысли', text: 'Блок-схемы, стрелки и связи между идеями.' },
            { icon: 'group', title: 'Работайте вместе', text: 'Публичные ссылки для обсуждения и проверки.' },
            { icon: 'inventory_2', title: 'Храните всё в одном месте', text: 'Полотна сохраняются и сортируются в профиле.' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--border-color)', background: 'rgba(255,255,255,0.55)' }}
            >
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg mb-2" style={{ background: 'rgba(15, 23, 42, 0.08)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-primary)' }}>{item.icon}</span>
              </div>
              <h4 className="text-sm sm:text-base mb-1" style={{ color: 'var(--text-primary)' }}>{item.title}</h4>
              <p className="text-xs sm:text-sm opacity-75" style={{ color: 'var(--text-secondary)' }}>{item.text}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleBoardsClick}
            className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base transition-all duration-200 hover:opacity-85"
            style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
          >
            Открыть доски
          </button>
          <span className="text-xs sm:text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>
            В личном кабинете: вкладка «Доска»
          </span>
        </div>
      </div>
    </section>
  );
};

export default UploadDemo;
