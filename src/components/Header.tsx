import React from 'react';
// @ts-ignore
import { Link, useLocation } from 'react-router-dom';

interface HeaderProps {
  onToggleTheme: () => void;
  isLightTheme: boolean;
}

const Header: React.FC<HeaderProps> = ({ onToggleTheme, isLightTheme }) => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth';
  return (
    <header 
      className="bg-transparent px-4 sm:px-8 md:px-15 sticky top-0 z-50 border-b"
      style={{ 
        borderColor: 'var(--border-color)',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between h-25 relative z-10">
        <Link 
          to="/"
          className="text-3xl font-normal text-primary no-underline tracking-wider transition-opacity duration-500 hover:opacity-60 bg-transparent border-none cursor-pointer"
          style={{ 
            color: 'var(--text-primary)',
            fontFamily: 'Georgia, serif'
          }}
          aria-label="На главную"
        >
          MindeSync
        </Link>
        
        <div className="flex items-center gap-5 md:gap-15">
          <a 
            href="#how-it-works" 
            className="hidden md:block text-secondary no-underline font-normal text-base transition-all duration-300 opacity-60 tracking-wide hover:opacity-100 relative group"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="relative z-10">Как работает</span>
            <div 
              className="absolute -bottom-1 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full"
              style={{ background: 'var(--text-secondary)' }}
            />
          </a>
          <Link 
            to="/account"
            className="hidden md:block text-secondary no-underline font-normal text-base transition-all duration-300 opacity-60 tracking-wide hover:opacity-100 bg-transparent border-none cursor-pointer relative group"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="relative z-10">Аккаунт</span>
            <div 
              className="absolute -bottom-1 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full"
              style={{ background: 'var(--text-secondary)' }}
            />
          </Link>
          <Link 
            to="/pricing"
            className="hidden md:block text-secondary no-underline font-normal text-base transition-all duration-300 opacity-60 tracking-wide hover:opacity-100 bg-transparent border-none cursor-pointer relative group"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="relative z-10">Подписки</span>
            <div 
              className="absolute -bottom-1 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full"
              style={{ background: 'var(--text-secondary)' }}
            />
          </Link>
          {!isAuthPage && (
            <Link
              to="/auth"
              className="hidden md:block text-secondary no-underline font-normal text-base transition-all duration-300 opacity-60 tracking-wide hover:opacity-100 bg-transparent border-none cursor-pointer relative group"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span className="relative z-10">Войти</span>
              <div 
                className="absolute -bottom-1 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full"
                style={{ background: 'var(--text-secondary)' }}
              />
            </Link>
          )}
          <button 
            onClick={onToggleTheme}
            className="btn-theme"
          >
            {isLightTheme ? '☾' : '☀︎'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
