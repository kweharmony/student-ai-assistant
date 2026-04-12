import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface ReqItem {
  id: string;
  lecture_id: string;
  lecture_title: string;
  stream_id: string;
  stream_name: string;
  direction_name: string;
  faculty_name: string;
  discipline: string;
  lecturer_name: string | null;
  course_text: string | null;
  study_year_text: string | null;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_comment: string | null;
  requested_by_login: string;
  created_at: string;
}

interface LookupItem { id: string; name: string }

interface CatalogModerationSectionProps {
  isLightTheme: boolean;
}

const CatalogModerationSection: React.FC<CatalogModerationSectionProps> = ({ isLightTheme }) => {
  const { token, user } = useAuth();
  const [requests, setRequests] = useState<ReqItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [reviewText, setReviewText] = useState<Record<string, string>>({});
  const [faculties, setFaculties] = useState<LookupItem[]>([]);
  const [directions, setDirections] = useState<LookupItem[]>([]);
  const [streams, setStreams] = useState<LookupItem[]>([]);
  const [manual, setManual] = useState({
    lecture_id: '',
    stream_id: '',
    discipline: '',
    lecturer_name: '',
    course_text: '',
    study_year_text: '',
  });

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const headingColor = isLightTheme ? '#2a1918' : '#fff7ec';
  const mutedColor = isLightTheme ? '#7a5a5c' : '#c6b7a7';

  const loadRequests = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`${API_BASE}/api/catalog/requests?${params}`, { headers });
    if (res.ok) setRequests(await res.json());
  }, [headers, statusFilter]);

  const loadLookups = useCallback(async () => {
    const [f, d, s] = await Promise.all([
      fetch(`${API_BASE}/api/catalog/faculties`, { headers }),
      fetch(`${API_BASE}/api/catalog/directions`, { headers }),
      fetch(`${API_BASE}/api/catalog/streams`, { headers }),
    ]);
    if (f.ok) setFaculties(await f.json());
    if (d.ok) setDirections(await d.json());
    if (s.ok) setStreams(await s.json());
  }, [headers]);

  useEffect(() => { loadRequests(); }, [loadRequests]);
  useEffect(() => { loadLookups(); }, [loadLookups]);

  const moderate = async (id: string, action: 'approve' | 'reject') => {
    const review_comment = reviewText[id] || '';
    const res = await fetch(`${API_BASE}/api/catalog/requests/${id}/${action}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_comment }),
    });
    if (res.ok) loadRequests();
  };

  const createFaculty = async () => {
    const name = window.prompt('Название факультета');
    if (!name) return;
    const res = await fetch(`${API_BASE}/api/catalog/faculties`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) loadLookups();
  };

  const createDirection = async () => {
    const faculty_id = window.prompt('ID факультета');
    const name = window.prompt('Название направления');
    if (!faculty_id || !name) return;
    const res = await fetch(`${API_BASE}/api/catalog/directions`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ faculty_id, name }),
    });
    if (res.ok) loadLookups();
  };

  const createStream = async () => {
    const direction_id = window.prompt('ID направления');
    const name = window.prompt('Название потока');
    if (!direction_id || !name) return;
    const res = await fetch(`${API_BASE}/api/catalog/streams`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction_id, name }),
    });
    if (res.ok) loadLookups();
  };

  const publishManual = async () => {
    const res = await fetch(`${API_BASE}/api/catalog/publish`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...manual,
        lecturer_name: manual.lecturer_name || null,
        course_text: manual.course_text || null,
        study_year_text: manual.study_year_text || null,
      }),
    });
    if (res.ok) {
      setManual({ lecture_id: '', stream_id: '', discipline: '', lecturer_name: '', course_text: '', study_year_text: '' });
      loadRequests();
    }
  };

  return (
    <div>
      <div className="text-center mb-8 px-4">
        <h1 className="text-3xl lg:text-4xl font-light mb-3 tracking-wide" style={{ color: headingColor }}>
          Модерация базы лекций
        </h1>
        <p className="text-sm opacity-70" style={{ color: mutedColor }}>
          {user?.role === 'admin' ? 'Админ: все потоки' : 'Староста: только ваш поток'}
        </p>
      </div>

      <div className="border rounded-xl p-4 mb-4" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
        <div className="flex flex-wrap gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="pending">На модерации</option>
            <option value="approved">Одобрено</option>
            <option value="rejected">Отклонено</option>
            <option value="">Все</option>
          </select>
          <button onClick={loadRequests} className="px-3 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
            Обновить заявки
          </button>
          {user?.role === 'admin' && (
            <>
              <button onClick={createFaculty} className="px-3 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>+ Факультет</button>
              <button onClick={createDirection} className="px-3 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>+ Направление</button>
              <button onClick={createStream} className="px-3 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>+ Поток</button>
            </>
          )}
        </div>
      </div>

      <div className="border rounded-xl p-4 mb-5" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: headingColor }}>Ручная публикация в базу</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input value={manual.lecture_id} onChange={(e) => setManual(prev => ({ ...prev, lecture_id: e.target.value }))} placeholder="Lecture ID" className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          <select value={manual.stream_id} onChange={(e) => setManual(prev => ({ ...prev, stream_id: e.target.value }))} className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="">Поток</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input value={manual.discipline} onChange={(e) => setManual(prev => ({ ...prev, discipline: e.target.value }))} placeholder="Дисциплина" className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          <input value={manual.lecturer_name} onChange={(e) => setManual(prev => ({ ...prev, lecturer_name: e.target.value }))} placeholder="Лектор" className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          <input value={manual.course_text} onChange={(e) => setManual(prev => ({ ...prev, course_text: e.target.value }))} placeholder="Курс" className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          <input value={manual.study_year_text} onChange={(e) => setManual(prev => ({ ...prev, study_year_text: e.target.value }))} placeholder="Год обучения" className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
        </div>
        <button onClick={publishManual} className="mt-3 px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>
          Опубликовать
        </button>
      </div>

      <div className="space-y-3">
        {requests.map(req => (
          <div key={req.id} className="border rounded-xl p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-sm font-medium" style={{ color: headingColor }}>{req.lecture_title}</h3>
                <p className="text-xs" style={{ color: mutedColor }}>
                  {req.faculty_name} · {req.direction_name} · {req.stream_name} · {req.discipline}
                </p>
                <p className="text-xs" style={{ color: mutedColor }}>
                  Лектор: {req.lecturer_name || '—'} · Курс: {req.course_text || '—'} · Год: {req.study_year_text || '—'}
                </p>
                <p className="text-xs" style={{ color: mutedColor }}>
                  От: {req.requested_by_login} · Статус: {req.status}
                </p>
              </div>
            </div>
            {req.comment && (
              <p className="text-xs mb-2" style={{ color: mutedColor }}>Комментарий: {req.comment}</p>
            )}
            <textarea
              value={reviewText[req.id] ?? ''}
              onChange={(e) => setReviewText(prev => ({ ...prev, [req.id]: e.target.value }))}
              placeholder="Комментарий модератора (для отклонения обязателен)"
              className="w-full px-3 py-2 rounded-lg border text-xs mb-2"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              rows={2}
            />
            <div className="flex gap-2">
              <button onClick={() => moderate(req.id, 'approve')} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: '#22c55e', color: '#fff' }}>
                Одобрить
              </button>
              <button onClick={() => moderate(req.id, 'reject')} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: '#ef4444', color: '#fff' }}>
                Отклонить
              </button>
            </div>
          </div>
        ))}
      </div>

      {user?.role === 'admin' && (
        <div className="mt-5 text-xs" style={{ color: mutedColor }}>
          Справочники: факультетов {faculties.length}, направлений {directions.length}, потоков {streams.length}.
        </div>
      )}
    </div>
  );
};

export default CatalogModerationSection;
