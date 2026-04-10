import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const EMOJI_LIST = [
  '😀','😎','🤓','🧑‍💻','👨‍🎓','👩‍🎓','🧑‍🏫','👨‍🔬','👩‍🔬','🧙','🦊','🐼','🐨','🦁','🐯',
  '🦋','🐉','🦄','🌟','⚡','🔥','💎','🎯','🚀','🎮','🎸','🎨','📚','🔬','🏆',
  '💡','🌈','🍀','🌺','🌙','☀️','🍕','🎃','👾','🤖','👑','🎭','🏄','🧩','🎲',
  '🌍','🏔️','🎋','🍁','🌊','🦅','🐬','🦋','🌸','🍄','🎵','🎺','🎻','🎷','🥁',
];

interface ProfileSectionProps {
  isLightTheme: boolean;
  navigate: (path: string) => void;
}

const roleLabels: Record<string, string> = {
  student: 'Студент',
  teacher: 'Преподаватель',
  admin: 'Администратор',
};

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const ProfileSection: React.FC<ProfileSectionProps> = ({ isLightTheme, navigate }) => {
  const { user, token, logout, updateUser } = useAuth();

  // Emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiLoading, setEmojiLoading] = useState(false);

  const handleSelectEmoji = async (emoji: string) => {
    setEmojiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/me/avatar-emoji`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      updateUser(updated);
      setShowEmojiPicker(false);
    } finally {
      setEmojiLoading(false);
    }
  };

  const handleRemoveEmoji = async () => {
    setEmojiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/me/avatar-emoji`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const updated = await res.json();
      updateUser(updated);
    } finally {
      setEmojiLoading(false);
    }
  };

  // Edit profile modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    group_name: '',
    course: '',
    faculty: '',
    department: '',
    position: '',
    academic_degree: '',
  });

  const openEditModal = () => {
    if (!user) return;
    setEditForm({
      full_name: user.full_name ?? '',
      email: user.email ?? '',
      group_name: user.student_profile?.group_name ?? '',
      course: user.student_profile?.course?.toString() ?? '',
      faculty: user.student_profile?.faculty ?? '',
      department: user.teacher_profile?.department ?? '',
      position: user.teacher_profile?.position ?? '',
      academic_degree: user.teacher_profile?.academic_degree ?? '',
    });
    setEditError('');
    setEditSuccess(false);
    setShowEditModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    setEditLoading(true);
    try {
      const body: Record<string, any> = {
        full_name: editForm.full_name || null,
        email: editForm.email || null,
      };
      if (user?.student_profile) {
        body.group_name = editForm.group_name || null;
        body.course = editForm.course ? parseInt(editForm.course) : null;
        body.faculty = editForm.faculty || null;
      }
      if (user?.teacher_profile) {
        body.department = editForm.department || null;
        body.position = editForm.position || null;
        body.academic_degree = editForm.academic_degree || null;
      }
      const res = await fetch(`${API_BASE}/api/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
        setEditError(err.detail || 'Ошибка сохранения');
        return;
      }
      const updated = await res.json();
      updateUser(updated);
      setEditSuccess(true);
      setTimeout(() => setShowEditModal(false), 1200);
    } catch {
      setEditError('Не удалось подключиться к серверу');
    } finally {
      setEditLoading(false);
    }
  };

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess(false);
    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Новые пароли не совпадают');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Новый пароль должен быть не короче 6 символов');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/me/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
        setPasswordError(err.detail || 'Ошибка сервера');
        return;
      }

      setPasswordSuccess(true);
      setTimeout(() => setShowPasswordModal(false), 1500);
    } catch {
      setPasswordError('Не удалось подключиться к серверу');
    } finally {
      setPasswordLoading(false);
    }
  };

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
          <div className="relative inline-block mb-4">
            <div
              className="w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full flex items-center justify-center mx-auto"
              style={{
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                fontSize: user.avatar_emoji ? '2.5rem' : undefined,
              }}
            >
              {user.avatar_emoji
                ? <span>{user.avatar_emoji}</span>
                : <span className="material-symbols-outlined text-3xl md:text-4xl lg:text-5xl">account_circle</span>
              }
            </div>
            {/* Кнопка выбора эмодзи */}
            <button
              onClick={() => setShowEmojiPicker(true)}
              title="Выбрать эмодзи"
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ background: 'var(--bg-primary)', border: '2px solid var(--border-color)', fontSize: '0.9rem' }}
            >
              ✏️
            </button>
          </div>
          {user.avatar_emoji && (
            <button
              onClick={handleRemoveEmoji}
              disabled={emojiLoading}
              className="text-xs opacity-50 hover:opacity-80 transition-opacity mb-2 block mx-auto"
              style={{ color: 'var(--text-secondary)' }}
            >
              Убрать эмодзи
            </button>
          )}
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
            <button className="btn" onClick={openEditModal}>
              Редактировать профиль
            </button>
            <button className="btn" onClick={openPasswordModal}>
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

      {/* Emoji picker modal */}
      {showEmojiPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEmojiPicker(false); }}
        >
          <div
            className="w-full max-w-sm rounded-xl p-5 shadow-xl"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Выберите эмодзи</h3>
              <button onClick={() => setShowEmojiPicker(false)} style={{ color: 'var(--text-secondary)' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSelectEmoji(emoji)}
                  disabled={emojiLoading}
                  className="w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all hover:scale-125"
                  style={{
                    background: user.avatar_emoji === emoji ? 'var(--hover-bg)' : 'transparent',
                    border: user.avatar_emoji === emoji ? '2px solid var(--text-primary)' : '2px solid transparent',
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit profile modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}
        >
          <div
            className="w-full max-w-md rounded-xl p-6 shadow-xl overflow-y-auto"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', maxHeight: '90vh' }}
          >
            <h3 className="text-xl font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
              Редактировать профиль
            </h3>

            {editSuccess ? (
              <div className="text-center py-4" style={{ color: '#4caf50' }}>
                <span className="material-symbols-outlined text-4xl block mb-2">check_circle</span>
                Профиль обновлён
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Общие поля */}
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Полное имя</label>
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                {/* Поля студента */}
                {user?.student_profile !== null && user?.role === 'student' && (
                  <>
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Группа</label>
                      <input
                        type="text"
                        value={editForm.group_name}
                        onChange={e => setEditForm(f => ({ ...f, group_name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Курс (1–6)</label>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={editForm.course}
                        onChange={e => setEditForm(f => ({ ...f, course: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Факультет</label>
                      <input
                        type="text"
                        value={editForm.faculty}
                        onChange={e => setEditForm(f => ({ ...f, faculty: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </>
                )}

                {/* Поля преподавателя */}
                {user?.role === 'teacher' && (
                  <>
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Кафедра</label>
                      <input
                        type="text"
                        value={editForm.department}
                        onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Должность</label>
                      <input
                        type="text"
                        value={editForm.position}
                        onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Учёная степень</label>
                      <input
                        type="text"
                        value={editForm.academic_degree}
                        onChange={e => setEditForm(f => ({ ...f, academic_degree: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </>
                )}

                {editError && <p className="text-sm" style={{ color: '#e57373' }}>{editError}</p>}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 btn" disabled={editLoading}>
                    Отмена
                  </button>
                  <button type="submit" className="flex-1 btn-gradient transition-all duration-300" disabled={editLoading}>
                    {editLoading ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Change password modal */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closePasswordModal(); }}
        >
          <div
            className="w-full max-w-md rounded-xl p-6 shadow-xl"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}
          >
            <h3 className="text-xl font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
              Изменить пароль
            </h3>

            {passwordSuccess ? (
              <div className="text-center py-4" style={{ color: '#4caf50' }}>
                <span className="material-symbols-outlined text-4xl block mb-2">check_circle</span>
                Пароль успешно изменён
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Текущий пароль
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: 'var(--hover-bg)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Новый пароль
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: 'var(--hover-bg)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Повторите новый пароль
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: 'var(--hover-bg)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                {passwordError && (
                  <p className="text-sm" style={{ color: '#e57373' }}>{passwordError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closePasswordModal}
                    className="flex-1 btn"
                    disabled={passwordLoading}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="flex-1 btn-gradient transition-all duration-300"
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileSection;
