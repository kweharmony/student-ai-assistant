import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// ==================== Types ====================

interface Stats {
  users: { total: number; active: number; blocked: number; students: number; teachers: number; admins: number };
  lectures: { total: number };
  audio: { total: number };
  transcriptions: { total: number };
  queue: { files: number; size_mb: number };
}

interface AdminUser {
  id: string;
  login: string;
  email: string;
  role: string;
  full_name: string | null;
  is_active: boolean;
  is_deleted: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  created_at: string;
  last_login_at: string | null;
}

interface QueueFile {
  filename: string;
  path: string;
  size_mb: number;
  uploaded_at: string;
}

interface WorkerStats {
  pending: number;
  processing: number;
  completed: number;
  error: number;
  failed: number;
  active_workers: string[];
}

interface LectureItem {
  id: string;
  title: string;
  subject: string | null;
  status: string | null;
  is_public: boolean;
  is_deleted: boolean;
  created_at: string | null;
  uploader: { id: string; login: string; role: string } | null;
  audio_count: number;
  transcription_count: number;
}

type AdminTab = 'overview' | 'users' | 'queue' | 'workers' | 'lectures';

// ==================== Component ====================

const AdminDashboard: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [queue, setQueue] = useState<QueueFile[]>([]);
  const [workerStats, setWorkerStats] = useState<WorkerStats | null>(null);
  const [lectures, setLectures] = useState<LectureItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Block modal
  const [blockModal, setBlockModal] = useState<{ userId: string; login: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, { headers });
      if (!res.ok) throw new Error('Ошибка загрузки статистики');
      setStats(await res.json());
    } catch (e: any) { setError(e.message); }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users?limit=200`, { headers });
      if (!res.ok) throw new Error('Ошибка загрузки пользователей');
      setUsers(await res.json());
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [token]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/worker-stats`, { headers });
      if (!res.ok) throw new Error('Ошибка загрузки статистики воркеров');
      const data: WorkerStats = await res.json();
      setWorkerStats(data);
      // Для обратной совместимости: показываем pending задачи как "файлы в очереди"
      setQueue([]);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [token]);

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/worker-stats`, { headers });
      if (!res.ok) throw new Error('Ошибка загрузки воркеров');
      setWorkerStats(await res.json());
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [token]);

  const fetchLectures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/lectures?limit=200`, { headers });
      if (!res.ok) throw new Error('Ошибка загрузки лекций');
      setLectures(await res.json());
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'queue') fetchQueue();
    if (activeTab === 'workers') fetchWorkers();
    if (activeTab === 'lectures') fetchLectures();
  }, [activeTab, fetchUsers, fetchQueue, fetchWorkers, fetchLectures]);

  // Actions
  const handleBlock = async () => {
    if (!blockModal || !blockReason.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${blockModal.userId}/block`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: blockReason }),
      });
      if (!res.ok) throw new Error('Ошибка блокировки');
      setBlockModal(null);
      setBlockReason('');
      fetchUsers();
      fetchStats();
    } catch (e: any) { setError(e.message); }
  };

  const handleUnblock = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/unblock`, {
        method: 'POST', headers,
      });
      if (!res.ok) throw new Error('Ошибка разблокировки');
      fetchUsers();
      fetchStats();
    } catch (e: any) { setError(e.message); }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = { student: 'Студент', teacher: 'Преподаватель', admin: 'Админ' };
    return map[role] || role;
  };

  const roleBadgeColor = (role: string) => {
    const map: Record<string, string> = {
      admin: 'rgba(239, 68, 68, 0.2)',
      teacher: 'rgba(59, 130, 246, 0.2)',
      student: 'rgba(34, 197, 94, 0.2)',
    };
    return map[role] || 'rgba(156, 163, 175, 0.2)';
  };

  // ==================== Tabs ====================

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'overview', label: 'Обзор' },
    { id: 'users', label: 'Пользователи' },
    { id: 'queue', label: 'Очередь аудио' },
    { id: 'workers', label: 'Воркеры' },
    { id: 'lectures', label: 'Лекции' },
  ];

  return (
    <>
      {/* Header */}
      <div className="text-center mb-6 md:mb-10 px-4">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-light mb-2 tracking-wide" style={{ color: 'var(--text-primary)' }}>
          Панель администратора
        </h1>
        <p className="text-sm md:text-base opacity-70" style={{ color: 'var(--text-secondary)' }}>
          Управление платформой MindeSync
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg border text-sm" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--text-primary)' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-3 opacity-60 hover:opacity-100">&times;</button>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all duration-200"
            style={{
              background: activeTab === tab.id ? 'var(--text-primary)' : 'transparent',
              color: activeTab === tab.id ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: `1px solid ${activeTab === tab.id ? 'var(--text-primary)' : 'var(--border-color)'}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== Overview ==================== */}
      {activeTab === 'overview' && stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {[
            { label: 'Пользователей', value: stats.users.total, sub: `${stats.users.active} активных` },
            { label: 'Студентов', value: stats.users.students },
            { label: 'Преподавателей', value: stats.users.teachers },
            { label: 'Заблокировано', value: stats.users.blocked, warn: stats.users.blocked > 0 },
            { label: 'Лекций', value: stats.lectures.total },
            { label: 'Аудиофайлов', value: stats.audio.total },
            { label: 'Транскрипций', value: stats.transcriptions.total },
            { label: 'В очереди', value: stats.queue.files, sub: `${stats.queue.size_mb} МБ` },
          ].map((card, i) => (
            <div key={i} className="border rounded-xl p-4 md:p-5" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
              <div className="text-2xl md:text-3xl font-light mb-1" style={{ color: card.warn ? '#ef4444' : 'var(--text-primary)' }}>
                {card.value}
              </div>
              <div className="text-xs md:text-sm opacity-60" style={{ color: 'var(--text-secondary)' }}>{card.label}</div>
              {card.sub && <div className="text-xs opacity-40 mt-1" style={{ color: 'var(--text-secondary)' }}>{card.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ==================== Users ==================== */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          {loading ? (
            <p className="text-center opacity-60 py-8" style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
          ) : users.length === 0 ? (
            <p className="text-center opacity-60 py-8" style={{ color: 'var(--text-secondary)' }}>Нет пользователей</p>
          ) : (
            users.map(user => (
              <div
                key={user.id}
                className="border rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3"
                style={{
                  borderColor: !user.is_active ? 'rgba(239,68,68,0.3)' : 'var(--border-color)',
                  background: !user.is_active ? 'rgba(239,68,68,0.05)' : 'transparent',
                }}
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{user.login}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: roleBadgeColor(user.role), color: 'var(--text-primary)' }}>
                      {roleLabel(user.role)}
                    </span>
                    {!user.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                        Заблокирован
                      </span>
                    )}
                  </div>
                  <div className="text-xs opacity-60 mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {user.email} {user.full_name ? `\u00b7 ${user.full_name}` : ''}
                  </div>
                  <div className="text-xs opacity-40 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Регистрация: {formatDate(user.created_at)}
                    {user.last_login_at && ` \u00b7 Последний вход: ${formatDate(user.last_login_at)}`}
                  </div>
                  {user.blocked_reason && (
                    <div className="text-xs mt-1" style={{ color: '#ef4444' }}>
                      Причина: {user.blocked_reason}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {user.role !== 'admin' && (
                  <div className="flex gap-2 shrink-0">
                    {user.is_active ? (
                      <button
                        onClick={() => setBlockModal({ userId: user.id, login: user.login })}
                        className="px-3 py-1.5 text-xs rounded-lg border transition-all hover:opacity-80"
                        style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}
                      >
                        Заблокировать
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnblock(user.id)}
                        className="px-3 py-1.5 text-xs rounded-lg border transition-all hover:opacity-80"
                        style={{ borderColor: 'rgba(34,197,94,0.3)', color: '#22c55e' }}
                      >
                        Разблокировать
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ==================== Queue ==================== */}
      {activeTab === 'queue' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm opacity-60" style={{ color: 'var(--text-secondary)' }}>
              Статус задач транскрибации
            </p>
            <button onClick={fetchQueue} className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:opacity-80" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
              Обновить
            </button>
          </div>

          {loading ? (
            <p className="text-center opacity-60 py-8" style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
          ) : workerStats ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {[
                { label: 'В очереди', value: workerStats.pending, color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
                { label: 'Обрабатывается', value: workerStats.processing, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                { label: 'Завершено', value: workerStats.completed, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
                { label: 'Ошибки', value: workerStats.error, color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
                { label: 'Провалено', value: workerStats.failed, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                { label: 'Активных воркеров', value: workerStats.active_workers.length, color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
              ].map((card, i) => (
                <div key={i} className="border rounded-xl p-4" style={{ borderColor: 'var(--border-color)', background: card.bg }}>
                  <div className="text-2xl font-light mb-1" style={{ color: card.color }}>{card.value}</div>
                  <div className="text-xs opacity-70" style={{ color: 'var(--text-secondary)' }}>{card.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border rounded-xl" style={{ borderColor: 'var(--border-color)' }}>
              <p className="text-lg opacity-40 mb-2" style={{ color: 'var(--text-secondary)' }}>Нет данных</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== Workers ==================== */}
      {activeTab === 'workers' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm opacity-60" style={{ color: 'var(--text-secondary)' }}>
              Подключённые воркеры транскрибации
            </p>
            <button onClick={fetchWorkers} className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:opacity-80" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
              Обновить
            </button>
          </div>

          {loading ? (
            <p className="text-center opacity-60 py-8" style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
          ) : workerStats ? (
            <div>
              {workerStats.active_workers.length === 0 ? (
                <div className="text-center py-12 border rounded-xl mb-4" style={{ borderColor: 'var(--border-color)' }}>
                  <p className="text-lg opacity-40 mb-2" style={{ color: 'var(--text-secondary)' }}>Нет активных воркеров</p>
                  <p className="text-sm opacity-30" style={{ color: 'var(--text-secondary)' }}>
                    Запустите worker/tray_app.py на компьютере разработчика
                  </p>
                </div>
              ) : (
                <div className="space-y-2 mb-6">
                  {workerStats.active_workers.map((name, i) => (
                    <div key={i} className="border rounded-xl p-4 flex items-center gap-3" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: '#22c55e' }} />
                      <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                        Активен
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Задач в очереди', value: workerStats.pending },
                  { label: 'Выполняется сейчас', value: workerStats.processing },
                  { label: 'Завершено всего', value: workerStats.completed },
                ].map((card, i) => (
                  <div key={i} className="border rounded-xl p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
                    <div className="text-xl font-light mb-1" style={{ color: 'var(--text-primary)' }}>{card.value}</div>
                    <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>{card.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 border rounded-xl" style={{ borderColor: 'var(--border-color)' }}>
              <p className="text-lg opacity-40 mb-2" style={{ color: 'var(--text-secondary)' }}>Нет данных</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== Lectures ==================== */}
      {activeTab === 'lectures' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm opacity-60" style={{ color: 'var(--text-secondary)' }}>
              Все лекции на платформе
            </p>
            <button onClick={fetchLectures} className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:opacity-80" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
              Обновить
            </button>
          </div>

          {loading ? (
            <p className="text-center opacity-60 py-8" style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
          ) : lectures.length === 0 ? (
            <div className="text-center py-12 border rounded-xl" style={{ borderColor: 'var(--border-color)' }}>
              <p className="text-lg opacity-40 mb-2" style={{ color: 'var(--text-secondary)' }}>Лекций нет</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lectures.map(lecture => (
                <div key={lecture.id} className="border rounded-xl p-4" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{lecture.title}</span>
                        {lecture.subject && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
                            {lecture.subject}
                          </span>
                        )}
                        {lecture.is_public && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                            Публичная
                          </span>
                        )}
                      </div>
                      <div className="text-xs opacity-50 mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {lecture.uploader ? `${lecture.uploader.login} (${roleLabel(lecture.uploader.role)})` : 'Неизвестен'}
                        {' \u00b7 '}{formatDate(lecture.created_at)}
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>
                      <span className="opacity-60">{lecture.audio_count} аудио</span>
                      <span className="opacity-60">{lecture.transcription_count} транскр.</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== Block Modal ==================== */}
      {blockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setBlockModal(null)}>
          <div className="max-w-md w-full rounded-2xl p-6 border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-light mb-4" style={{ color: 'var(--text-primary)' }}>
              Заблокировать {blockModal.login}?
            </h3>
            <textarea
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              placeholder="Причина блокировки..."
              rows={3}
              className="w-full p-3 rounded-lg border text-sm resize-none mb-4"
              style={{ background: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setBlockModal(null)} className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                Отмена
              </button>
              <button
                onClick={handleBlock}
                disabled={!blockReason.trim()}
                className="px-4 py-2 text-sm rounded-lg transition-opacity"
                style={{ background: '#ef4444', color: '#fff', opacity: blockReason.trim() ? 1 : 0.4 }}
              >
                Заблокировать
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminDashboard;
