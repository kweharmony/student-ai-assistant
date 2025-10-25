import React, { useState } from 'react';
// @ts-ignore
import { Link } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

interface AuthPageProps {
  onToggleTheme: () => void;
  isLightTheme: boolean;
}

const AuthPage: React.FC<AuthPageProps> = ({ onToggleTheme, isLightTheme }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Имитация загрузки
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (isLogin) {
      console.log('Вход:', formData);
    } else {
      console.log('Регистрация:', formData);
    }
    
    setIsLoading(false);
  };

  const handleModeToggle = () => {
    setIsLogin(!isLogin);
    setFormData({ username: '', email: '', password: '' });
  };

  return (
    <div className={`min-h-screen flex flex-col overflow-x-hidden relative transition-all duration-500 ${
      isLightTheme ? 'light-theme' : ''
    }`} style={{
      fontFamily: 'Georgia, Times New Roman, serif',
      lineHeight: '1.8',
      color: 'var(--text-primary)',
      background: 'var(--bg-primary)',
      minHeight: '120vh'
    }}>
      
      <Header onToggleTheme={onToggleTheme} isLightTheme={isLightTheme} />
      
      <main className="flex-1 flex items-center justify-center px-8 md:px-15 py-12 md:py-16 max-w-7xl mx-auto w-full relative z-10 min-h-screen">
        <div className="w-full max-w-md mb-32">
          <div className="text-center mb-8">
            <div className="text-center">
              <h1 
                className="text-3xl sm:text-4xl md:text-5xl font-light mb-4 leading-tight tracking-tight opacity-95"
                style={{ 
                  color: 'var(--text-primary)',
                  fontFamily: 'Georgia, serif'
                }}
              >
                {isLogin ? 'Добро пожаловать' : 'Создать аккаунт'}
              </h1>
            </div>
            
            <p 
              className="text-base sm:text-lg text-secondary max-w-2xl mx-auto leading-relaxed opacity-70 font-light tracking-wide"
              style={{ color: 'var(--text-secondary)' }}
            >
              {isLogin 
                ? 'Войдите в свой аккаунт для доступа к функциям транскрибации'
                : 'Зарегистрируйтесь для начала работы с MindeSync'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="group">
              <label 
                htmlFor="username" 
                className="flex items-center gap-2 text-sm font-normal mb-2 tracking-wide opacity-80 transition-all duration-300"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span>👤</span>
                <span>Логин</span>
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                required
                className="w-full px-5 py-4 bg-transparent border text-primary text-base transition-all duration-300 rounded-lg focus:outline-none hover:border-opacity-60 focus:border-opacity-80"
                style={{ 
                  color: 'var(--text-primary)',
                  borderColor: focusedField === 'username' ? 'var(--text-secondary)' : 'var(--border-color)',
                  background: 'var(--hover-bg)',
                  fontFamily: 'Georgia, serif'
                }}
                placeholder="Введите логин"
              />
            </div>

            {!isLogin && (
              <div className="group">
                <label 
                  htmlFor="email" 
                  className="flex items-center gap-2 text-sm font-normal mb-2 tracking-wide opacity-80 transition-all duration-300"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span>📧</span>
                  <span>Email</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  required={!isLogin}
                  className="w-full px-5 py-4 bg-transparent border text-primary text-base transition-all duration-300 rounded-lg focus:outline-none hover:border-opacity-60 focus:border-opacity-80"
                  style={{ 
                    color: 'var(--text-primary)',
                    borderColor: focusedField === 'email' ? 'var(--text-secondary)' : 'var(--border-color)',
                    background: 'var(--hover-bg)',
                    fontFamily: 'Georgia, serif'
                  }}
                  placeholder="Введите email"
                />
              </div>
            )}

            <div className="group">
              <label 
                htmlFor="password" 
                className="flex items-center gap-2 text-sm font-normal mb-2 tracking-wide opacity-80 transition-all duration-300"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span>🔒</span>
                <span>Пароль</span>
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                required
                className="w-full px-5 py-4 bg-transparent border text-primary text-base transition-all duration-300 rounded-lg focus:outline-none hover:border-opacity-60 focus:border-opacity-80"
                style={{ 
                  color: 'var(--text-primary)',
                  borderColor: focusedField === 'password' ? 'var(--text-secondary)' : 'var(--border-color)',
                  background: 'var(--hover-bg)',
                  fontFamily: 'Georgia, serif'
                }}
                placeholder="Введите пароль"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-lg flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  {isLoading && (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  )}
                  {isLoading 
                    ? (isLogin ? 'Входим...' : 'Создаем аккаунт...') 
                    : (isLogin ? 'Войти' : 'Создать аккаунт')
                  }
                </span>
              </button>
            </div>

            <div className="text-center pt-4">
              <button
                type="button"
                onClick={handleModeToggle}
                className="text-secondary text-base font-normal transition-all duration-300 opacity-60 hover:opacity-100 tracking-wide relative group flex items-center justify-center gap-2 mx-auto bg-transparent border-none cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span className="text-sm">
                  {isLogin ? '🔄' : '↩️'}
                </span>
                <span className="relative z-10">
                  {isLogin 
                    ? 'Нет аккаунта? Зарегистрироваться' 
                    : 'Уже есть аккаунт? Войти'
                  }
                </span>
                <div 
                  className="absolute -bottom-1 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full"
                  style={{ background: 'var(--text-secondary)' }}
                />
              </button>
            </div>
          </form>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default AuthPage;
