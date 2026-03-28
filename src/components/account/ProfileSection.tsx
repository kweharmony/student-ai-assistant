import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProfileSectionProps {
  isLightTheme: boolean;
  navigate: (path: string) => void;
}

const roleLabels: Record<string, string> = {
  student: 'Студент',
  teacher: 'Преподаватель',
  admin: 'Администратор',
};

const ProfileSection: React.FC<ProfileSectionProps> = ({ isLightTheme, navigate }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const createdDate = new Date(user.created_at).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const handleLogout = () => {
    logout();
    navigate('/');
    window.scrollTo(0, 0);
  };

  return (
    <>
      {/* Header */}
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

      {/* Profile card */}
      <div className="bg-transparent border rounded-xl p-4 md:p-6 lg:p-8 mb-6 md:mb-10" style={{ borderColor: 'var(--border-color)' }}>

        {/* Avatar + name */}
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
            {user.full_name || user.login}
          </h3>
          <p className="text-base md:text-lg lg:text-xl mb-1" style={{ color: 'var(--text-secondary)' }}>
            {user.email}
          </p>
          <p className="text-sm md:text-base mb-1" style={{ color: 'var(--text-secondary)', opacity: 0.8 }}>
            {roleLabels[user.role] || user.role}
          </p>
          <p className="text-xs md:text-sm lg:text-base opacity-70" style={{ color: 'var(--text-secondary)' }}>
            Зарегистрирован: {createdDate}
          </p>
        </div>

        <div className="space-y-4 md:space-y-5">

          {/* Student profile info */}
          {user.student_profile && (
            <div className="border rounded-lg p-4 md:p-5" style={{
              background: 'var(--hover-bg)',
              borderColor: 'var(--border-color)',
            }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined" style={{ color: '#B58488' }}>school</span>
                <h4 className="text-base md:text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Данные студента</h4>
              </div>
              <div className="space-y-2">
                {user.student_profile.group_name && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>Группа:</span>
                    <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.student_profile.group_name}</span>
                  </div>
                )}
                {user.student_profile.course && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>Курс:</span>
                    <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.student_profile.course}</span>
                  </div>
                )}
                {user.student_profile.faculty && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>Факультет:</span>
                    <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.student_profile.faculty}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Teacher profile info */}
          {user.teacher_profile && (
            <div className="border rounded-lg p-4 md:p-5" style={{
              background: 'var(--hover-bg)',
              borderColor: 'var(--border-color)',
            }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined" style={{ color: '#B58488' }}>work</span>
                <h4 className="text-base md:text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Данные преподавателя</h4>
              </div>
              <div className="space-y-2">
                {user.teacher_profile.department && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>Кафедра:</span>
                    <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.teacher_profile.department}</span>
                  </div>
                )}
                {user.teacher_profile.position && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>Должность:</span>
                    <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.teacher_profile.position}</span>
                  </div>
                )}
                {user.teacher_profile.academic_degree && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>Учёная степень:</span>
                    <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.teacher_profile.academic_degree}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Subscription block */}
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

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="btn">
              Изменить пароль
            </button>
            <button
              onClick={handleLogout}
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
