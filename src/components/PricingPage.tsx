import React from 'react';
import Header from './Header';
import Footer from './Footer';
// @ts-ignore
import { Link } from 'react-router-dom';

interface PricingPageProps {
  onToggleTheme: () => void;
  isLightTheme: boolean;
}

const PricingPage: React.FC<PricingPageProps> = ({ onToggleTheme, isLightTheme }) => {
  return (
    <div className={`min-h-screen flex flex-col overflow-x-hidden relative transition-all duration-500 ${
      isLightTheme ? 'light-theme' : ''
    }`} style={{
      fontFamily: 'Georgia, Times New Roman, serif',
      lineHeight: '1.8',
      color: 'var(--text-primary)',
      background: 'var(--bg-primary)'
    }}>
      
      <Header onToggleTheme={onToggleTheme} isLightTheme={isLightTheme} />
      
      <main className="flex-1 px-8 md:px-15 py-16 md:py-25 max-w-7xl mx-auto w-full relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-wide text-center mt-4 sm:text-5xl" style={{ color: 'var(--text-primary)' }}>
            Тарифные планы
          </h2>
          <p className="max-w-3xl mx-auto mt-4 text-xl text-center opacity-70" style={{ color: 'var(--text-secondary)' }}>
            Начните с бесплатного плана и обновитесь, когда будете готовы.
          </p>
        </div>

        <div className="mt-12 container space-y-12 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-x-8">
          {/* Бесплатный план */}
          <div className="relative p-8 border rounded-2xl shadow-sm flex flex-col" style={{ 
            borderColor: 'var(--border-color)',
            backgroundColor: 'var(--bg-secondary)'
          }}>
            <div className="flex-1">
              <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Бесплатный</h3>
              <p className="mt-4 flex items-baseline">
                <span className="text-5xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>₽0</span>
                <span className="ml-1 text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>/месяц</span>
              </p>
              <p className="mt-6" style={{ color: 'var(--text-secondary)' }}>Для знакомства с платформой</p>
              <ul role="list" className="mt-6 space-y-6">
                <li className="flex">
                  <span className="material-symbols-outlined flex-shrink-0 w-6 h-6" style={{ color: 'var(--text-primary)' }}>check</span>
                  <span className="ml-3" style={{ color: 'var(--text-primary)' }}>5 транскрибаций лекций в месяц</span>
                </li>
                <li className="flex">
                  <span className="material-symbols-outlined flex-shrink-0 w-6 h-6" style={{ color: 'var(--text-primary)' }}>check</span>
                  <span className="ml-3" style={{ color: 'var(--text-primary)' }}>10 обработок текста с помощью ИИ в месяц</span>
                </li>
                <li className="flex">
                  <span className="material-symbols-outlined flex-shrink-0 w-6 h-6" style={{ color: 'var(--text-primary)' }}>check</span>
                  <span className="ml-3" style={{ color: 'var(--text-primary)' }}>Базовые функции</span>
                </li>
              </ul>
            </div>
            <Link
              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 mt-8 block w-full py-3 px-6 border border-transparent rounded-md text-center font-medium transition-all duration-300"
              to="/account"
              style={{
                backgroundColor: 'var(--hover-bg)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)'
              }}
            >
              Начать бесплатно
            </Link>
          </div>

          {/* Платный план */}
          <div className="relative p-8 border rounded-2xl shadow-sm flex flex-col" style={{ 
            borderColor: 'var(--border-color)',
            backgroundColor: 'var(--bg-secondary)'
          }}>
            <div className="flex-1">
              <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Премиум</h3>
              <p className="absolute top-0 py-1.5 px-4 text-white rounded-full text-xs font-semibold uppercase tracking-wide transform -translate-y-1/2" style={{ background: '#B58488' }}>
                Популярный
              </p>
              <p className="mt-4 flex items-baseline">
                <span className="text-5xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>₽300</span>
                <span className="ml-1 text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>/месяц</span>
              </p>
              <p className="mt-6" style={{ color: 'var(--text-secondary)' }}>Для активного обучения и работы</p>
              <ul role="list" className="mt-6 space-y-6">
                <li className="flex">
                  <span className="material-symbols-outlined flex-shrink-0 w-6 h-6" style={{ color: 'var(--text-primary)' }}>check</span>
                  <span className="ml-3" style={{ color: 'var(--text-primary)' }}>15 транскрибаций лекций в месяц</span>
                </li>
                <li className="flex">
                  <span className="material-symbols-outlined flex-shrink-0 w-6 h-6" style={{ color: 'var(--text-primary)' }}>check</span>
                  <span className="ml-3" style={{ color: 'var(--text-primary)' }}>30 обработок текста с помощью ИИ в месяц</span>
                </li>
                <li className="flex">
                  <span className="material-symbols-outlined flex-shrink-0 w-6 h-6" style={{ color: 'var(--text-primary)' }}>check</span>
                  <span className="ml-3" style={{ color: 'var(--text-primary)' }}>Экспорт в различных форматах</span>
                </li>
              </ul>
            </div>
            <Link
              className="mt-8 block w-full py-3 px-6 border border-transparent rounded-md text-center font-medium transition-all duration-300"
              style={{ background: '#B58488', color: '#fffff0' }}
              to="/auth"
            >
              Выбрать Премиум
            </Link>
          </div>
        </div>

        {/* Отступ перед footer */}
        <div className="h-20"></div>
      </main>
      
      <Footer />
    </div>
  );
};

export default PricingPage;
