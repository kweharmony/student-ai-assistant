import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// ==================== Types ====================

interface Stats {
  users: { total: number; active: number; blocked: number; students: number; teachers: number; admins: number };
  lectures: { total: number };
  boards: { total: number };
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
  lecture_count: number;
  student_profile: { group_name: string | null; course: number | null; faculty: string | null } | null;
  teacher_profile: { department: string | null; position: string | null; academic_degree: string | null } | null;
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
  description: string | null;
  subject: string | null;
  status: string | null;
  is_public: boolean;
  is_deleted: boolean;
  created_at: string | null;
  uploader: { id: string; login: string; role: string } | null;
  audio_count: number;
  transcription_count: number;
}

interface AdminBoardItem {
  id: string;
  title: string;
  is_public: boolean;
  share_token: string | null;
  created_at: string | null;
  updated_at: string | null;
  owner: { id: string; login: string; email: string; full_name: string | null; role: string } | null;
}

interface AudioFileWithExpiry {
  id: string;
  file_name: string;
  file_size: number | null;
  duration_seconds: number | null;
  created_at: string | null;
  audio_expires_at: string | null;
  days_left: number;
  expired: boolean;
}

interface LectureWithAudio {
  id: string;
  title: string;
  subject: string | null;
  created_at: string | null;
  uploader: { id: string; login: string; full_name: string | null } | null;
  audio_files: AudioFileWithExpiry[];
  audio_count: number;
}

type AdminTab = 'overview' | 'users' | 'queue' | 'workers' | 'lectures' | 'boards';

// ==================== Component ====================

const AdminDashboard: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [queue, setQueue] = useState<QueueFile[]>([]);
  const [workerStats, setWorkerStats] = useState<WorkerStats | null>(null);
  const [lectures, setLectures] = useState<LectureItem[]>([]);
  const [boards, setBoards] = useState<AdminBoardItem[]>([]);
  const [lecturesWithAudio, setLecturesWithAudio] = useState<LectureWithAudio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Lecture filters
  const [lectureSearch, setLectureSearch] = useState('');
  const [lectureStatus, setLectureStatus] = useState('');
  const [lectureDateFrom, setLectureDateFrom] = useState('');
  const [lectureDateTo, setLectureDateTo] = useState('');
  const [lectureUploader, setLectureUploader] = useState('');

  // Board filters
  const [boardSearch, setBoardSearch] = useState('');
  const [boardOwnerSearch, setBoardOwnerSearch] = useState('');

  // Audio filters
  const [audioSearch, setAudioSearch] = useState('');
  const [audioSubject, setAudioSubject] = useState('');
  const [audioDateFrom, setAudioDateFrom] = useState('');
  const [audioDateTo, setAudioDateTo] = useState('');
  const [audioUploader, setAudioUploader] = useState('');

  // Block modal
  const [blockModal, setBlockModal] = useState<{ userId: string; login: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  // null = бессрочно, число = минуты
  const [blockDuration, setBlockDuration] = useState<number | null>(null);
  const [blockCustomDays, setBlockCustomDays] = useState('');

  // Hard delete modal
  const [hardDeleteModal, setHardDeleteModal] = useState<{ userId: string; login: string } | null>(null);

  // Edit lecture modal
  const [editLectureModal, setEditLectureModal] = useState<LectureItem | null>(null);
  const [editLectureLoading, setEditLectureLoading] = useState(false);

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

  const fetchLectures = useCallback(async (filters?: {
    search?: string; status?: string;
    dateFrom?: string; dateTo?: string; uploader?: string;
  }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (filters?.search) params.set('search', filters.search);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.dateFrom) params.set('date_from', filters.dateFrom);
      if (filters?.dateTo) params.set('date_to', filters.dateTo);
      if (filters?.uploader) params.set('uploader_search', filters.uploader);
      const res = await fetch(`${API_BASE}/api/admin/lectures?${params}`, { headers });
      if (!res.ok) throw new Error('Ошибка загрузки лекций');
      setLectures(await res.json());
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [token]);

  const fetchBoards = useCallback(async (filters?: { search?: string; owner?: string }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '300' });
      if (filters?.search) params.set('search', filters.search);
      if (filters?.owner) params.set('owner_search', filters.owner);
      const res = await fetch(`${API_BASE}/api/admin/boards?${params}`, { headers });
      if (!res.ok) throw new Error('Ошибка загрузки досок');
      setBoards(await res.json());
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [token]);

  const fetchLecturesWithAudio = useCallback(async (filters?: {
    search?: string; subject?: string;
    dateFrom?: string; dateTo?: string; uploader?: string;
  }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (filters?.search) params.set('search', filters.search);
      if (filters?.subject) params.set('subject', filters.subject);
      if (filters?.dateFrom) params.set('date_from', filters.dateFrom);
      if (filters?.dateTo) params.set('date_to', filters.dateTo);
      if (filters?.uploader) params.set('uploader_search', filters.uploader);
      const res = await fetch(`${API_BASE}/api/admin/lectures/audio/with-expiry?${params}`, { headers });
      if (!res.ok) throw new Error('Ошибка загрузки аудио лекций');
      setLecturesWithAudio(await res.json());
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'queue') fetchLecturesWithAudio({});
    if (activeTab === 'workers') fetchWorkers();
    if (activeTab === 'lectures') fetchLectures({});
    if (activeTab === 'boards') fetchBoards({});
  }, [activeTab, fetchUsers, fetchQueue, fetchWorkers, fetchLectures, fetchBoards, fetchLecturesWithAudio]);

  // Actions
  const handleBlock = async () => {
    if (!blockModal || !blockReason.trim()) return;
    // Вычисляем duration_minutes
    let durationMinutes: number | null = blockDuration;
    if (blockDuration === -1) {
      const days = parseInt(blockCustomDays);
      if (!days || days <= 0) { setError('Укажите корректное количество дней'); return; }
      durationMinutes = days * 24 * 60;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${blockModal.userId}/block`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: blockReason, duration_minutes: durationMinutes }),
      });
      if (!res.ok) throw new Error('Ошибка блокировки');
      setBlockModal(null);
      setBlockReason('');
      setBlockDuration(null);
      setBlockCustomDays('');
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

  const handleHardDelete = async () => {
    if (!hardDeleteModal) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${hardDeleteModal.userId}`, {
        method: 'DELETE', headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Ошибка удаления');
      setHardDeleteModal(null);
      fetchUsers();
      fetchStats();
    } catch (e: any) { setError(e.message); }
  };

  const handleSaveLecture = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editLectureModal) return;
    const form = e.currentTarget;
    const data = {
      title: (form.elements.namedItem('title') as HTMLInputElement).value.trim() || undefined,
      subject: (form.elements.namedItem('subject') as HTMLInputElement).value.trim() || null,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value.trim() || null,
      is_public: (form.elements.namedItem('is_public') as HTMLInputElement).checked,
    };
    setEditLectureLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/lectures/${editLectureModal.id}`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Ошибка сохранения');
      setEditLectureModal(null);
      fetchLectures({ search: lectureSearch, status: lectureStatus, dateFrom: lectureDateFrom, dateTo: lectureDateTo, uploader: lectureUploader });
    } catch (e: any) { setError(e.message); }
    setEditLectureLoading(false);
  };

  const filteredUsers = users.filter(u => {
    if (filterRole && u.role !== filterRole) return false;
    if (filterGroup) {
      const g = u.student_profile?.group_name?.toLowerCase() || '';
      if (!g.includes(filterGroup.toLowerCase())) return false;
    }
    if (filterSearch) {
      const s = filterSearch.toLowerCase();
      const match =
        u.login.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        (u.full_name?.toLowerCase().includes(s) ?? false);
      if (!match) return false;
    }
    return true;
  });

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
    { id: 'queue', label: 'Аудио' },
    { id: 'workers', label: 'Воркеры' },
    { id: 'lectures', label: 'Лекции' },
    { id: 'boards', label: 'Доски' },
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
            { label: 'Полотен', value: stats.boards.total },
            { label: 'Аудиофайлов', value: stats.audio.total },
            { label: 'Транскрипций', value: stats.transcriptions.total },
            { label: 'В очереди', value: stats.queue.files, sub: 'ожидают + обрабатываются' },
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
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              <option value="">Все роли</option>
              <option value="student">Студенты</option>
              <option value="teacher">Преподаватели</option>
              <option value="admin">Администраторы</option>
            </select>
            <input
              type="text"
              value={filterGroup}
              onChange={e => setFilterGroup(e.target.value)}
              placeholder="Группа (напр. ИС-21)"
              className="text-xs px-3 py-2 rounded-lg border"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', width: 160 }}
            />
            <input
              type="text"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Поиск по логину, email, имени..."
              className="text-xs px-3 py-2 rounded-lg border flex-1 min-w-40"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            {(filterRole || filterGroup || filterSearch) && (
              <button
                onClick={() => { setFilterRole(''); setFilterGroup(''); setFilterSearch(''); }}
                className="text-xs px-3 py-2 rounded-lg border"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              >
                Сбросить
              </button>
            )}
          </div>

          <p className="text-xs opacity-40 mb-3" style={{ color: 'var(--text-secondary)' }}>
            Показано: {filteredUsers.length} из {users.length}
          </p>

          <div className="space-y-3">
            {loading ? (
              <p className="text-center opacity-60 py-8" style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-center opacity-60 py-8" style={{ color: 'var(--text-secondary)' }}>Нет пользователей</p>
            ) : (
              filteredUsers.map(user => (
                <div
                  key={user.id}
                  className="border rounded-xl p-4 flex flex-col md:flex-row md:items-start gap-3"
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
                      <span className="text-xs opacity-50 ml-auto" style={{ color: 'var(--text-secondary)' }}>
                        {user.lecture_count} лекц.
                      </span>
                    </div>
                    <div className="text-xs opacity-60 mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {user.email}{user.full_name ? ` \u00b7 ${user.full_name}` : ''}
                    </div>
                    {user.role === 'student' && user.student_profile && (
                      <div className="text-xs opacity-50 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {[user.student_profile.group_name, user.student_profile.course ? `${user.student_profile.course} курс` : null, user.student_profile.faculty].filter(Boolean).join(' \u00b7 ')}
                      </div>
                    )}
                    {user.role === 'teacher' && user.teacher_profile && (
                      <div className="text-xs opacity-50 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {[user.teacher_profile.department, user.teacher_profile.position, user.teacher_profile.academic_degree].filter(Boolean).join(' \u00b7 ')}
                      </div>
                    )}
                    <div className="text-xs opacity-40 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      Регистрация: {formatDate(user.created_at)}
                      {user.last_login_at && ` \u00b7 Вход: ${formatDate(user.last_login_at)}`}
                    </div>
                    {user.blocked_reason && (
                      <div className="text-xs mt-1" style={{ color: '#ef4444' }}>
                        Причина блок.: {user.blocked_reason}
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
                      <button
                        onClick={() => setHardDeleteModal({ userId: user.id, login: user.login })}
                        className="px-3 py-1.5 text-xs rounded-lg border transition-all hover:opacity-80"
                        style={{ borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444' }}
                        title="Удалить из БД безвозвратно"
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================== Queue ==================== */}
      {activeTab === 'queue' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm opacity-60" style={{ color: 'var(--text-secondary)' }}>
              Аудио лекции и сроки их хранения (7 дней)
            </p>
            <button onClick={() => fetchLecturesWithAudio({ search: audioSearch, subject: audioSubject, dateFrom: audioDateFrom, dateTo: audioDateTo, uploader: audioUploader })} className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:opacity-80" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
              Обновить
            </button>
          </div>

          {/* Filters */}
          <div className="border rounded-xl p-4 mb-4 space-y-3" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={audioSearch}
                onChange={e => setAudioSearch(e.target.value)}
                placeholder="Поиск по названию лекции..."
                className="text-xs px-3 py-2 rounded-lg border flex-1 min-w-48"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              <input
                type="text"
                value={audioSubject}
                onChange={e => setAudioSubject(e.target.value)}
                placeholder="Предмет"
                className="text-xs px-3 py-2 rounded-lg border"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', width: 120 }}
              />
              <input
                type="text"
                value={audioUploader}
                onChange={e => setAudioUploader(e.target.value)}
                placeholder="Автор (логин)"
                className="text-xs px-3 py-2 rounded-lg border"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', width: 140 }}
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>Дата создания:</span>
              <input
                type="date"
                value={audioDateFrom}
                onChange={e => setAudioDateFrom(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              <span className="text-xs opacity-40" style={{ color: 'var(--text-secondary)' }}>—</span>
              <input
                type="date"
                value={audioDateTo}
                onChange={e => setAudioDateTo(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={() => fetchLecturesWithAudio({ search: audioSearch, subject: audioSubject, dateFrom: audioDateFrom, dateTo: audioDateTo, uploader: audioUploader })}
                className="text-xs px-4 py-2 rounded-lg transition-all"
                style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
              >
                Найти
              </button>
              {(audioSearch || audioSubject || audioDateFrom || audioDateTo || audioUploader) && (
                <button
                  onClick={() => {
                    setAudioSearch(''); setAudioSubject('');
                    setAudioDateFrom(''); setAudioDateTo(''); setAudioUploader('');
                    fetchLecturesWithAudio();
                  }}
                  className="text-xs px-3 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>

          <p className="text-xs opacity-40 mb-3" style={{ color: 'var(--text-secondary)' }}>
            Найдено: {lecturesWithAudio.length} лекций с аудио
          </p>

          {loading ? (
            <p className="text-center opacity-60 py-8" style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
          ) : lecturesWithAudio.length === 0 ? (
            <div className="text-center py-12 border rounded-xl" style={{ borderColor: 'var(--border-color)' }}>
              <p className="text-lg opacity-40 mb-2" style={{ color: 'var(--text-secondary)' }}>Лекций с аудио нет</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lecturesWithAudio.map(lecture => (
                <div key={lecture.id} className="border rounded-xl p-4" style={{ borderColor: 'var(--border-color)' }}>
                  {/* Lecture header */}
                  <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3 pb-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{lecture.title}</h4>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        {lecture.subject && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
                            {lecture.subject}
                          </span>
                        )}
                        {lecture.uploader && (
                          <span className="text-xs opacity-60" style={{ color: 'var(--text-secondary)' }}>
                            {lecture.uploader.login}
                          </span>
                        )}
                        <span className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                          {formatDate(lecture.created_at)}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full opacity-70" style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                      {lecture.audio_count} файл{lecture.audio_count === 1 ? '' : 'ов'}
                    </span>
                  </div>

                  {/* Audio files list */}
                  <div className="space-y-2">
                    {lecture.audio_files.map(audio => {
                      const expiryColor = audio.expired ? '#ef4444' : (audio.days_left <= 2 ? '#f59e0b' : '#22c55e');
                      const expiryBg = audio.expired ? 'rgba(239,68,68,0.1)' : (audio.days_left <= 2 ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)');
                      
                      return (
                        <div key={audio.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                              {audio.file_name}
                            </div>
                            <div className="text-xs opacity-50 mt-0.5 flex flex-wrap gap-2" style={{ color: 'var(--text-secondary)' }}>
                              {audio.file_size && (
                                <span>{(audio.file_size / (1024 * 1024)).toFixed(1)} МБ</span>
                              )}
                              {audio.duration_seconds && (
                                <span>{Math.round(audio.duration_seconds / 60)} мин</span>
                              )}
                              {audio.created_at && (
                                <span>Загружено: {formatDate(audio.created_at)}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ background: expiryBg, color: expiryColor }}>
                              <span className="material-symbols-outlined text-base">schedule</span>
                              {audio.expired ? 'Истекло' : `${audio.days_left} дн.`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
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
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm opacity-60" style={{ color: 'var(--text-secondary)' }}>
              Все лекции на платформе
            </p>
            <button
              onClick={() => fetchLectures({ search: lectureSearch, status: lectureStatus, dateFrom: lectureDateFrom, dateTo: lectureDateTo, uploader: lectureUploader })}
              className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              Обновить
            </button>
          </div>

          {/* Filters */}
          <div className="border rounded-xl p-4 mb-4 space-y-3" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={lectureSearch}
                onChange={e => setLectureSearch(e.target.value)}
                placeholder="Поиск по названию или предмету..."
                className="text-xs px-3 py-2 rounded-lg border flex-1 min-w-48"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              <input
                type="text"
                value={lectureUploader}
                onChange={e => setLectureUploader(e.target.value)}
                placeholder="Логин / имя автора"
                className="text-xs px-3 py-2 rounded-lg border"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', width: 160 }}
              />
              <select
                value={lectureStatus}
                onChange={e => setLectureStatus(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
                <option value="">Все статусы</option>
                <option value="processing">Обрабатывается</option>
                <option value="ready">Готова</option>
                <option value="error">Ошибка</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>Дата создания:</span>
              <input
                type="date"
                value={lectureDateFrom}
                onChange={e => setLectureDateFrom(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              <span className="text-xs opacity-40" style={{ color: 'var(--text-secondary)' }}>—</span>
              <input
                type="date"
                value={lectureDateTo}
                onChange={e => setLectureDateTo(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={() => fetchLectures({ search: lectureSearch, status: lectureStatus, dateFrom: lectureDateFrom, dateTo: lectureDateTo, uploader: lectureUploader })}
                className="text-xs px-4 py-2 rounded-lg transition-all"
                style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
              >
                Найти
              </button>
              {(lectureSearch || lectureStatus || lectureDateFrom || lectureDateTo || lectureUploader) && (
                <button
                  onClick={() => {
                    setLectureSearch(''); setLectureStatus('');
                    setLectureDateFrom(''); setLectureDateTo(''); setLectureUploader('');
                    fetchLectures();
                  }}
                  className="text-xs px-3 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>

          <p className="text-xs opacity-40 mb-3" style={{ color: 'var(--text-secondary)' }}>
            Найдено: {lectures.length}
          </p>

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
                        {lecture.status && (
                          <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{
                            background: lecture.status === 'ready' ? 'rgba(34,197,94,0.15)' : 
                                       lecture.status === 'processing' ? 'rgba(59,130,246,0.15)' :
                                       'rgba(239,68,68,0.15)',
                            color: lecture.status === 'ready' ? '#22c55e' : 
                                   lecture.status === 'processing' ? '#3b82f6' :
                                   '#ef4444'
                          }}>
                            {lecture.status === 'processing' && <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                            {lecture.status === 'ready' ? 'Готова' : lecture.status === 'processing' ? 'Обрабатывается' : 'Ошибка'}
                          </span>
                        )}
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
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs opacity-60" style={{ color: 'var(--text-secondary)' }}>{lecture.audio_count} аудио</span>
                      <span className="text-xs opacity-60" style={{ color: 'var(--text-secondary)' }}>{lecture.transcription_count} транскр.</span>
                      <button
                        onClick={() => setEditLectureModal(lecture)}
                        className="px-2 py-1 text-xs rounded-lg border transition-all hover:opacity-80"
                        style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                      >
                        Изменить
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== Boards ==================== */}
      {activeTab === 'boards' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm opacity-60" style={{ color: 'var(--text-secondary)' }}>
              Все доски на платформе
            </p>
            <button
              onClick={() => fetchBoards({ search: boardSearch, owner: boardOwnerSearch })}
              className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              Обновить
            </button>
          </div>

          <div className="border rounded-xl p-4 mb-4" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={boardSearch}
                onChange={e => setBoardSearch(e.target.value)}
                placeholder="Поиск по названию доски..."
                className="text-xs px-3 py-2 rounded-lg border flex-1 min-w-48"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              <input
                type="text"
                value={boardOwnerSearch}
                onChange={e => setBoardOwnerSearch(e.target.value)}
                placeholder="Логин / email / имя владельца"
                className="text-xs px-3 py-2 rounded-lg border"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', width: 240 }}
              />
              <button
                onClick={() => fetchBoards({ search: boardSearch, owner: boardOwnerSearch })}
                className="text-xs px-4 py-2 rounded-lg transition-all"
                style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
              >
                Найти
              </button>
              {(boardSearch || boardOwnerSearch) && (
                <button
                  onClick={() => {
                    setBoardSearch('');
                    setBoardOwnerSearch('');
                    fetchBoards({});
                  }}
                  className="text-xs px-3 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>

          <p className="text-xs opacity-40 mb-3" style={{ color: 'var(--text-secondary)' }}>
            Найдено: {boards.length}
          </p>

          {loading ? (
            <p className="text-center opacity-60 py-8" style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
          ) : boards.length === 0 ? (
            <div className="text-center py-12 border rounded-xl" style={{ borderColor: 'var(--border-color)' }}>
              <p className="text-lg opacity-40 mb-2" style={{ color: 'var(--text-secondary)' }}>Досок нет</p>
            </div>
          ) : (
            <div className="space-y-2">
              {boards.map(board => (
                <div key={board.id} className="border rounded-xl p-4" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{board.title}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: board.is_public ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', color: board.is_public ? '#22c55e' : '#6b7280' }}>
                          {board.is_public ? 'Публичная' : 'Приватная'}
                        </span>
                      </div>
                      <div className="text-xs opacity-50 mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Владелец: {board.owner ? `${board.owner.login}${board.owner.full_name ? ` (${board.owner.full_name})` : ''}` : 'Неизвестен'}
                        {board.owner?.email ? ` · ${board.owner.email}` : ''}
                      </div>
                      <div className="text-xs opacity-40 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Создано: {formatDate(board.created_at)} · Обновлено: {formatDate(board.updated_at)}
                      </div>
                    </div>
                    <div className="text-xs opacity-50 shrink-0" style={{ color: 'var(--text-secondary)' }}>
                      ID: {board.id.slice(0, 8)}...
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== Edit Lecture Modal ==================== */}
      {editLectureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setEditLectureModal(null)}>
          <div className="max-w-lg w-full rounded-2xl p-6 border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>Редактировать лекцию</h3>
            <form onSubmit={handleSaveLecture} className="space-y-4">
              <div>
                <label className="block text-xs mb-1 opacity-60" style={{ color: 'var(--text-secondary)' }}>Название *</label>
                <input
                  name="title"
                  defaultValue={editLectureModal.title}
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                  style={{ background: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1 opacity-60" style={{ color: 'var(--text-secondary)' }}>Предмет</label>
                <input
                  name="subject"
                  defaultValue={editLectureModal.subject ?? ''}
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                  style={{ background: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1 opacity-60" style={{ color: 'var(--text-secondary)' }}>Описание</label>
                <textarea
                  name="description"
                  defaultValue={editLectureModal.description ?? ''}
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-none"
                  style={{ background: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_public" id="lec_is_public" defaultChecked={editLectureModal.is_public} className="w-4 h-4" />
                <label htmlFor="lec_is_public" className="text-sm" style={{ color: 'var(--text-primary)' }}>Публичная лекция</label>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setEditLectureModal(null)} className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                  Отмена
                </button>
                <button type="submit" disabled={editLectureLoading} className="px-4 py-2 text-sm rounded-lg transition-opacity" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)', opacity: editLectureLoading ? 0.5 : 1 }}>
                  {editLectureLoading ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== Hard Delete Modal ==================== */}
      {hardDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={() => setHardDeleteModal(null)}>
          <div className="max-w-md w-full rounded-2xl p-6 border" style={{ background: 'var(--bg-primary)', borderColor: 'rgba(239,68,68,0.4)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined" style={{ color: '#ef4444' }}>warning</span>
              <h3 className="text-lg font-semibold" style={{ color: '#ef4444' }}>
                Удалить {hardDeleteModal.login} из БД?
              </h3>
            </div>
            <div className="text-sm mb-5 space-y-2" style={{ color: 'var(--text-secondary)' }}>
              <p>Это <strong>безвозвратное</strong> действие. Пользователь будет полностью удалён из базы данных.</p>
              <p>Его лекции, аудио и транскрипции <strong>не удаляются</strong> — они будут переназначены на администратора с логином <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--hover-bg)' }}>admin</code>.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setHardDeleteModal(null)} className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                Отмена
              </button>
              <button onClick={handleHardDelete} className="px-4 py-2 text-sm rounded-lg font-medium" style={{ background: '#ef4444', color: '#fff' }}>
                Удалить безвозвратно
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Block Modal ==================== */}
      {blockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => { setBlockModal(null); setBlockReason(''); setBlockDuration(null); setBlockCustomDays(''); }}>
          <div className="max-w-md w-full rounded-2xl p-6 border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-light mb-4" style={{ color: 'var(--text-primary)' }}>
              Заблокировать {blockModal.login}
            </h3>

            {/* Причина */}
            <textarea
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              placeholder="Причина блокировки..."
              rows={2}
              className="w-full p-3 rounded-lg border text-sm resize-none mb-4"
              style={{ background: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />

            {/* Срок блокировки */}
            <p className="text-xs mb-2 opacity-60" style={{ color: 'var(--text-secondary)' }}>Срок блокировки:</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: '5 минут', value: 5 },
                { label: '1 час', value: 60 },
                { label: '1 день', value: 1440 },
                { label: '3 дня', value: 4320 },
                { label: '1 неделя', value: 10080 },
                { label: '1 месяц', value: 43200 },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setBlockDuration(opt.value); setBlockCustomDays(''); }}
                  className="px-2 py-1.5 text-xs rounded-lg border transition-all"
                  style={{
                    borderColor: blockDuration === opt.value ? '#ef4444' : 'var(--border-color)',
                    background: blockDuration === opt.value ? 'rgba(239,68,68,0.1)' : 'transparent',
                    color: blockDuration === opt.value ? '#ef4444' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { setBlockDuration(-1); }}
                className="px-3 py-1.5 text-xs rounded-lg border flex-1 transition-all"
                style={{
                  borderColor: blockDuration === -1 ? '#ef4444' : 'var(--border-color)',
                  background: blockDuration === -1 ? 'rgba(239,68,68,0.1)' : 'transparent',
                  color: blockDuration === -1 ? '#ef4444' : 'var(--text-secondary)',
                }}
              >
                Указать дни
              </button>
              <button
                onClick={() => { setBlockDuration(null); setBlockCustomDays(''); }}
                className="px-3 py-1.5 text-xs rounded-lg border flex-1 transition-all"
                style={{
                  borderColor: blockDuration === null ? '#ef4444' : 'var(--border-color)',
                  background: blockDuration === null ? 'rgba(239,68,68,0.1)' : 'transparent',
                  color: blockDuration === null ? '#ef4444' : 'var(--text-secondary)',
                }}
              >
                Бессрочно
              </button>
            </div>

            {blockDuration === -1 && (
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number"
                  min={1}
                  value={blockCustomDays}
                  onChange={e => setBlockCustomDays(e.target.value)}
                  placeholder="Кол-во дней"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border"
                  style={{ background: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
                <span className="text-sm opacity-60" style={{ color: 'var(--text-secondary)' }}>дн.</span>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setBlockModal(null); setBlockReason(''); setBlockDuration(null); setBlockCustomDays(''); }}
                className="px-4 py-2 text-sm rounded-lg border"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              >
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
