import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { useAuth, RegisterData } from '../contexts/AuthContext';

interface AuthPageProps {
  onToggleTheme: () => void;
  isLightTheme: boolean;
}

type Role = 'student' | 'teacher';

const AuthPage: React.FC<AuthPageProps> = ({ onToggleTheme, isLightTheme }) => {
  const navigate = useNavigate();
  const { login, register, isAuthenticated } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Modal for showing generated login after registration
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [generatedLogin, setGeneratedLogin] = useState('');
  const [copied, setCopied] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    username: '',     // only used for login form
    email: '',
    password: '',
    full_name: '',
    role: 'student' as Role,
    // Student
    group_name: '',
    course: '',
    faculty: '',
    // Teacher
    department: '',
    position: '',
    academic_degree: '',
  });

  // Redirect if already logged in (but not if showing modal)
  React.useEffect(() => {
    if (isAuthenticated && !showLoginModal) navigate('/account');
  }, [isAuthenticated, showLoginModal, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await login({ login: formData.username, password: formData.password });
        navigate('/account');
      } else {
        const payload: RegisterData = {
          email: formData.email,
          password: formData.password,
          role: formData.role,
          full_name: formData.full_name || undefined,
        };

        if (formData.role === 'student') {
          if (formData.group_name) payload.group_name = formData.group_name;
          if (formData.course) payload.course = Number(formData.course);
          if (formData.faculty) payload.faculty = formData.faculty;
        } else {
          if (formData.department) payload.department = formData.department;
          if (formData.position) payload.position = formData.position;
          if (formData.academic_degree) payload.academic_degree = formData.academic_degree;
        }

        const loginName = await register(payload);
        setGeneratedLogin(loginName);
        setShowLoginModal(true);
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLogin = () => {
    navigator.clipboard.writeText(generatedLogin).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCloseModal = () => {
    setShowLoginModal(false);
    navigate('/account');
  };

  const handleModeToggle = () => {
    setIsLogin(!isLogin);
    setError(null);
    setFormData({
      username: '', email: '', password: '', full_name: '',
      role: 'student', group_name: '', course: '', faculty: '',
      department: '', position: '', academic_degree: '',
    });
  };

  // ---- Input helper ----
  const inputStyle = (field: string) => ({
    color: 'var(--text-primary)',
    borderColor: focusedField === field ? 'var(--text-secondary)' : 'var(--border-color)',
    background: 'var(--hover-bg)',
    fontFamily: 'Georgia, serif',
  });

  const inputClass = "w-full px-5 py-4 bg-transparent border text-primary text-base transition-all duration-300 rounded-lg focus:outline-none hover:border-opacity-60 focus:border-opacity-80";
  const labelClass = "flex items-center gap-2 text-sm font-normal mb-2 tracking-wide opacity-80 transition-all duration-300";

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
          {/* Title */}
          <div className="text-center mb-8">
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-light mb-4 leading-tight tracking-tight opacity-95"
              style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}
            >
              {isLogin ? 'Добро пожаловать' : 'Создать аккаунт'}
            </h1>
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

          {/* Error message */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{
              background: 'rgba(181, 132, 136, 0.15)',
              color: '#B58488',
              border: '1px solid rgba(181, 132, 136, 0.3)',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Login field — only for login mode */}
            {isLogin && (
              <div className="group">
                <label htmlFor="username" className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-outlined">person</span>
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
                  className={inputClass}
                  style={inputStyle('username')}
                  placeholder="Введите логин"
                />
              </div>
            )}

            {/* Email — only for register mode */}
            {!isLogin && (
              <div className="group">
                <label htmlFor="email" className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-outlined">email</span>
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
                  required
                  className={inputClass}
                  style={inputStyle('email')}
                  placeholder="Введите email"
                />
              </div>
            )}

            {/* Password */}
            <div className="group">
              <label htmlFor="password" className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                <span className="material-symbols-outlined">lock</span>
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
                minLength={isLogin ? undefined : 6}
                className={inputClass}
                style={inputStyle('password')}
                placeholder={isLogin ? 'Введите пароль' : 'Минимум 6 символов'}
              />
            </div>

            {/* ---- Register-only fields ---- */}
            {!isLogin && (
              <>
                {/* Full name */}
                <div className="group">
                  <label htmlFor="full_name" className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                    <span className="material-symbols-outlined">badge</span>
                    <span>ФИО</span>
                  </label>
                  <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    onFocus={() => setFocusedField('full_name')}
                    onBlur={() => setFocusedField(null)}
                    className={inputClass}
                    style={inputStyle('full_name')}
                    placeholder="Иванов Иван Иванович"
                  />
                </div>

                {/* Role selector */}
                <div className="group">
                  <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                    <span className="material-symbols-outlined">school</span>
                    <span>Роль</span>
                  </label>
                  <div className="flex gap-3">
                    {(['student', 'teacher'] as Role[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, role: r }))}
                        className="flex-1 px-4 py-3 rounded-lg border text-base transition-all duration-300"
                        style={{
                          borderColor: formData.role === r ? 'var(--text-primary)' : 'var(--border-color)',
                          background: formData.role === r ? 'var(--text-primary)' : 'var(--hover-bg)',
                          color: formData.role === r ? 'var(--bg-primary)' : 'var(--text-secondary)',
                          fontFamily: 'Georgia, serif',
                        }}
                      >
                        {r === 'student' ? 'Студент' : 'Преподаватель'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Student fields */}
                {formData.role === 'student' && (
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="group_name" className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>groups</span>
                          <span>Группа</span>
                        </label>
                        <input
                          type="text"
                          id="group_name"
                          name="group_name"
                          value={formData.group_name}
                          onChange={handleInputChange}
                          onFocus={() => setFocusedField('group_name')}
                          onBlur={() => setFocusedField(null)}
                          className={inputClass}
                          style={inputStyle('group_name')}
                          placeholder="ИСП-221"
                        />
                      </div>
                      <div>
                        <label htmlFor="course" className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>timeline</span>
                          <span>Курс</span>
                        </label>
                        <input
                          type="number"
                          id="course"
                          name="course"
                          min="1"
                          max="6"
                          value={formData.course}
                          onChange={handleInputChange}
                          onFocus={() => setFocusedField('course')}
                          onBlur={() => setFocusedField(null)}
                          className={inputClass}
                          style={inputStyle('course')}
                          placeholder="2"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="faculty" className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>apartment</span>
                        <span>Факультет</span>
                      </label>
                      <input
                        type="text"
                        id="faculty"
                        name="faculty"
                        value={formData.faculty}
                        onChange={handleInputChange}
                        onFocus={() => setFocusedField('faculty')}
                        onBlur={() => setFocusedField(null)}
                        className={inputClass}
                        style={inputStyle('faculty')}
                        placeholder="Факультет информатики"
                      />
                    </div>
                  </div>
                )}

                {/* Teacher fields */}
                {formData.role === 'teacher' && (
                  <div className="space-y-4 pt-1">
                    <div>
                      <label htmlFor="department" className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>domain</span>
                        <span>Кафедра</span>
                      </label>
                      <input
                        type="text"
                        id="department"
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        onFocus={() => setFocusedField('department')}
                        onBlur={() => setFocusedField(null)}
                        className={inputClass}
                        style={inputStyle('department')}
                        placeholder="Кафедра информатики"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="position" className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>work</span>
                          <span>Должность</span>
                        </label>
                        <input
                          type="text"
                          id="position"
                          name="position"
                          value={formData.position}
                          onChange={handleInputChange}
                          onFocus={() => setFocusedField('position')}
                          onBlur={() => setFocusedField(null)}
                          className={inputClass}
                          style={inputStyle('position')}
                          placeholder="Доцент"
                        />
                      </div>
                      <div>
                        <label htmlFor="academic_degree" className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>military_tech</span>
                          <span>Степень</span>
                        </label>
                        <input
                          type="text"
                          id="academic_degree"
                          name="academic_degree"
                          value={formData.academic_degree}
                          onChange={handleInputChange}
                          onFocus={() => setFocusedField('academic_degree')}
                          onBlur={() => setFocusedField(null)}
                          className={inputClass}
                          style={inputStyle('academic_degree')}
                          placeholder="к.т.н."
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Submit */}
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

            {/* Toggle mode */}
            <div className="text-center pt-4">
              <button
                type="button"
                onClick={handleModeToggle}
                className="text-secondary text-base font-normal transition-all duration-300 opacity-60 hover:opacity-100 tracking-wide relative group flex items-center justify-center gap-2 mx-auto bg-transparent border-none cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span className="text-sm">
                  {isLogin
                    ? <span className="material-symbols-outlined">refresh</span>
                    : <span className="material-symbols-outlined">arrow_back</span>
                  }
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

      {/* ====== Modal: Generated Login ====== */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-md mx-4 p-8 rounded-2xl shadow-2xl"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              fontFamily: 'Georgia, serif',
            }}
          >
            {/* Success icon */}
            <div className="text-center mb-6">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                style={{ background: 'rgba(130, 170, 130, 0.15)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#82AA82' }}>
                  check_circle
                </span>
              </div>
              <h2
                className="text-2xl font-light mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                Регистрация успешна!
              </h2>
              <p
                className="text-sm opacity-70"
                style={{ color: 'var(--text-secondary)' }}
              >
                Запомните или скопируйте ваш логин для входа
              </p>
            </div>

            {/* Generated login display */}
            <div
              className="flex items-center gap-3 p-4 rounded-xl mb-6"
              style={{
                background: 'var(--hover-bg)',
                border: '1px solid var(--border-color)',
              }}
            >
              <span className="material-symbols-outlined opacity-50" style={{ color: 'var(--text-secondary)' }}>
                person
              </span>
              <div className="flex-1">
                <div className="text-xs opacity-50 mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Ваш логин
                </div>
                <div
                  className="text-lg font-medium tracking-wide"
                  style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}
                >
                  {generatedLogin}
                </div>
              </div>
              <button
                onClick={handleCopyLogin}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-all duration-300"
                style={{
                  background: copied ? 'rgba(130, 170, 130, 0.15)' : 'transparent',
                  color: copied ? '#82AA82' : 'var(--text-secondary)',
                  border: `1px solid ${copied ? 'rgba(130, 170, 130, 0.3)' : 'var(--border-color)'}`,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {copied ? 'done' : 'content_copy'}
                </span>
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>

            {/* Info */}
            <div
              className="text-xs p-3 rounded-lg mb-6 opacity-70"
              style={{
                background: 'rgba(180, 170, 130, 0.1)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(180, 170, 130, 0.2)',
              }}
            >
              Используйте этот логин и ваш пароль для входа в систему.
            </div>

            {/* Continue button */}
            <button
              onClick={handleCloseModal}
              className="btn btn-lg w-full"
            >
              Продолжить
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthPage;
