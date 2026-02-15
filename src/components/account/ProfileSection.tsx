import React from 'react';
import { Link } from 'react-router-dom';

interface ProfileSectionProps {
  isLightTheme: boolean;
  navigate: (path: string) => void;
}

const ProfileSection: React.FC<ProfileSectionProps> = ({ isLightTheme, navigate }) => {
  return (
    <>
      {/* Заголовочный блок */}
      <div className="text-center mb-4 md:mb-6 px-4">
        <h1
          className="text-2xl md:text-3xl lg:text-4xl font-light mb-2 md:mb-3 tracking-wide"
          style={{ color: 'var(--text-primary)' }}
        >
          Профиль
        </h1>
        <p
          className="text-sm md:text-base lg:text-lg opacity-70 max-w-2xl mx-auto"
          style={{ color: 'var(--text-secondary)' }}
        >
          Управляйте своим профилем и настройками
        </p>
      </div>

      {/* Секция профиля */}
       <div className="bg-transparent border rounded-xl p-4 md:p-6 lg:p-8 mb-6 md:mb-10" style={{ borderColor: 'var(--border-color)' }}>

         {/* Информация о пользователе сверху */}
         <div className="text-center mb-6">
           <div
             className="w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full flex items-center justify-center text-2xl md:text-3xl lg:text-4xl font-semibold mx-auto mb-4 relative"
             style={{
               background: 'var(--text-primary)',
               color: 'var(--bg-primary)',
               boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
             }}
           >
             <span className="material-symbols-outlined text-3xl md:text-4xl lg:text-5xl">account_circle</span>
           </div>
           <h3 className="text-xl md:text-2xl lg:text-3xl font-semibold mb-2 md:mb-3" style={{ color: 'var(--text-primary)' }}>
             Иван Иванов
           </h3>
           <p className="text-base md:text-lg lg:text-xl mb-2" style={{ color: 'var(--text-secondary)' }}>
             ivan.ivanov@example.com
           </p>
           <p className="text-xs md:text-sm lg:text-base opacity-70" style={{ color: 'var(--text-secondary)' }}>
             Зарегистрирован: 15 января 2025
           </p>
         </div>

         {/* Остальная информация */}
         <div className="space-y-4 md:space-y-5">

           {/* Информация о подписке */}
           <div className="border rounded-lg p-4 md:p-5"
             style={{
               background: 'var(--hover-bg)',
               borderColor: '#B58488'
             }}>
             <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-2">
                 <span className="material-symbols-outlined" style={{ color: '#B58488' }}>workspace_premium</span>
                 <h4 className="text-base md:text-lg font-semibold" style={{ color: '#B58488' }}>Премиум подписка</h4>
               </div>
               <div className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ background: '#B58488', color: '#fffff0' }}>
                 Активна
               </div>
             </div>
             <div className="space-y-2">
               <div className="flex justify-between items-center">
                 <span className="text-xs md:text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>Действует до:</span>
                 <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>15 марта 2025</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-xs md:text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>Осталось:</span>
                 <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>47 дней</span>
               </div>
             </div>
             <div className="mt-3 flex justify-end">
               <Link
                 to="/pricing"
                 className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-all duration-300"
                 style={{
                   background: '#B58488',
                   borderColor: '#B58488',
                   color: '#fffff0'
                 }}
               >
                 <span>Посмотреть планы</span>
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                 </svg>
               </Link>
             </div>
           </div>


           {/* Кнопки действий */}
           <div className="flex flex-col sm:flex-row gap-3 justify-center">
             <button
               className="btn"
             >
               Изменить пароль
             </button>
             <button
               onClick={() => {
                 navigate('/');
                 window.scrollTo(0, 0);
               }}
               className="btn-gradient transition-all duration-300"
             >
               Выйти из профиля
             </button>

           </div>
         </div>
       </div>
    </>
  );
};

export default ProfileSection;
