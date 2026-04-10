import React from 'react';
import { ActiveSection } from './types';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarItem {
  id: ActiveSection | 'exit';
  label: string;
  icon: string;
}

interface SidebarProps {
  activeSection: ActiveSection;
  setActiveSection: (section: ActiveSection) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  showSidebarText: boolean;
  isLightTheme: boolean;
  onThemeToggle: () => void;
  navigate: (path: string) => void;
}

const sidebarItems: SidebarItem[] = [
  { id: 'profile', label: 'Профиль', icon: 'account_circle' },
  { id: 'calendar', label: 'Календарь', icon: 'calendar_today' },
  { id: 'transcriber', label: 'Транскрибатор', icon: 'mic' },
  { id: 'lectures', label: 'Мои лекции', icon: 'library_books' },
  { id: 'text-processing', label: 'Обработка текста', icon: 'edit_note' },
  { id: 'board', label: 'Полотно', icon: 'dashboard' },
  { id: 'exit', label: 'Выход', icon: 'close' },
];

const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  setActiveSection,
  sidebarCollapsed,
  setSidebarCollapsed,
  mobileMenuOpen,
  setMobileMenuOpen,
  showSidebarText,
  isLightTheme,
  onThemeToggle,
  navigate,
}) => {
  const { logout, user } = useAuth();

  // Динамически формируем пункты меню — "Админ-панель" видна только админам
  const items: SidebarItem[] = [
    ...sidebarItems,
  ];
  if (user?.role === 'admin') {
    // Вставляем перед "Выход"
    const exitIndex = items.findIndex(i => i.id === 'exit');
    items.splice(exitIndex, 0, { id: 'admin', label: 'Админ-панель', icon: 'admin_panel_settings' });
  }

  const handleExit = () => {
    logout();
    navigate('/');
    window.scrollTo(0, 0);
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar panel */}
       <div
         className={`fixed left-0 top-0 h-full border-r transition-all duration-700 ease-in-out z-50 ${
           sidebarCollapsed ? 'w-24' : 'w-70'
         } ${
           mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
         }`}
        style={{
          borderColor: 'var(--border-color)',
          background: 'var(--bg-primary)',
          backdropFilter: 'blur(10px)'
        }}
        onMouseEnter={() => !mobileMenuOpen && setSidebarCollapsed(false)}
        onMouseLeave={() => !mobileMenuOpen && setSidebarCollapsed(true)}
      >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <div
            className="text-3xl font-normal text-primary no-underline tracking-wider transition-all duration-700 ease-in-out hover:opacity-60 bg-transparent border-none cursor-pointer relative block pb-10"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'Georgia, serif'
            }}
            onClick={(e) => {
              if (window.innerWidth < 1024 && mobileMenuOpen) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              navigate('/');
              window.scrollTo(0, 0);
            }}
          >
            <span className={`absolute transition-opacity duration-0 delay-0 ${!showSidebarText ? 'opacity-0' : 'opacity-100'}`}>
              MindeSync
            </span>
            <span className={`absolute transition-opacity duration-200 delay-0 ${!showSidebarText ? 'opacity-100' : 'opacity-0'}`}>
              MS
            </span>
          </div>
        </div>

        {/* Nav items */}
        <div className="flex-1 p-4 space-y-3">
          {items.map((item) => {
            if (item.id === 'exit') {
              return (
                <button
                  key={item.id}
                  onClick={handleExit}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg transition-all duration-700 ease-in-out h-16`}
                  style={{
                    color: 'var(--text-secondary)',
                    background: 'var(--hover-bg)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--hover-bg)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--hover-bg)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                  title={sidebarCollapsed ? item.label : ''}
                >
                  <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                  <span className={`text-lg font-medium transition-all duration-300 delay-100 ${
                    !showSidebarText ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            }

            const section = item.id as ActiveSection;
            const isActive = activeSection === section;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(section);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-lg transition-all duration-700 ease-in-out h-16 ${
                  isActive ? '' : 'hover:bg-hover'
                }`}
                style={{
                  background: isActive ? 'var(--text-primary)' : 'var(--hover-bg)',
                  color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)'
                }}
                title={sidebarCollapsed ? item.label : ''}
              >
                <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                <span className={`text-lg font-medium transition-all duration-300 delay-100 ${
                  !showSidebarText ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Theme toggle */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <button
            onClick={onThemeToggle}
            className={`w-full flex items-center p-4 hover:bg-hover rounded-lg transition-all duration-300 h-16 ${
              sidebarCollapsed ? 'justify-center' : 'gap-4'
            }`}
            style={{
              color: 'var(--text-secondary)',
              background: 'var(--hover-bg)'
            }}
            title={sidebarCollapsed ? 'Тема' : ''}
          >
            <span className="text-2xl">{isLightTheme ? '☾' : '☀︎'}</span>
            <span className={`text-lg font-medium transition-all duration-300 delay-100 ${
              !showSidebarText ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
            }`}>
              Тема
            </span>
          </button>
        </div>
      </div>
      </div>
    </>
  );
};

export default Sidebar;
