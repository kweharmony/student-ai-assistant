import React from 'react';

interface HeaderProps {
  onToggleTheme: () => void;
  isLightTheme: boolean;
  onNavigateToAuth?: () => void;
  isAuthPage?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onToggleTheme, isLightTheme, onNavigateToAuth, isAuthPage = false }) => {
  return (
    <header 
      className="bg-transparent px-15 sticky top-0 z-50 border-b"
      style={{ 
        borderColor: 'var(--border-color)',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between h-25 relative z-10">
        <button 
          onClick={() => window.location.href = '/'}
          className="text-3xl font-normal text-primary no-underline tracking-wider transition-opacity duration-500 hover:opacity-60 bg-transparent border-none cursor-pointer"
          style={{ 
            color: 'var(--text-primary)',
            fontFamily: 'Georgia, serif'
          }}
          aria-label="На главную"
        >
          MindeSync
        </button>
        
        <div className="flex items-center gap-5 md:gap-15">
          <a 
            href="#how-it-works" 
            className="hidden md:block text-secondary no-underline font-normal text-base transition-all duration-500 opacity-60 tracking-wide hover:opacity-100"
            style={{ color: 'var(--text-secondary)' }}
          >
            Как работает
          </a>
          <a 
            href="#" 
            className="hidden md:block text-secondary no-underline font-normal text-base transition-all duration-500 opacity-60 tracking-wide hover:opacity-100"
            style={{ color: 'var(--text-secondary)' }}
          >
            Аккаунт
          </a>
          {!isAuthPage && (
            <button 
              onClick={onNavigateToAuth}
              className="px-5 py-3 md:px-7 bg-transparent border text-secondary cursor-pointer text-sm md:text-base transition-all duration-500 opacity-60 hover:opacity-100 hover:bg-hover rounded-lg"
              style={{ 
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-color)',
                background: 'var(--hover-bg)'
              }}
            >
              Войти
            </button>
          )}
          <button 
            onClick={onToggleTheme}
            className="bg-transparent border text-secondary px-3 py-3 md:px-5 cursor-pointer text-base transition-all duration-500 opacity-60 hover:opacity-100 hover:bg-hover rounded-lg"
            style={{ 
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-color)',
              background: 'var(--hover-bg)'
            }}
          >
            {isLightTheme ? '☾' : '☀︎'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
