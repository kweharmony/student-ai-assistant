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
  lecture_number_text: string | null;
  study_year_text: string | null;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_comment: string | null;
  requested_by_login: string;
  created_at: string;
}

interface LookupItem { id: string; name: string }
interface DirectionItem extends LookupItem { faculty_id: string }
interface StreamItem extends LookupItem {
  direction_id: string;
  course: number | null;
  study_year_start: number | null;
}

interface CatalogModerationSectionProps {
  isLightTheme: boolean;
}

const statusLabel: Record<string, string> = {
  pending: 'На модерации',
  approved: 'Одобрено',
  rejected: 'Отклонено',
};

const statusColor: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#22c55e',
  rejected: '#ef4444',
};

type NodeType = 'root' | 'faculty' | 'direction' | 'stream';

const CatalogModerationSection: React.FC<CatalogModerationSectionProps> = ({ isLightTheme }) => {
  const { token, user } = useAuth();
  const [requests, setRequests] = useState<ReqItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewText, setReviewText] = useState<Record<string, string>>({});
  const [disciplineText, setDisciplineText] = useState<Record<string, string>>({});
  const [lecturerText, setLecturerText] = useState<Record<string, string>>({});
  const [courseText, setCourseText] = useState<Record<string, string>>({});
  const [lectureNumberText, setLectureNumberText] = useState<Record<string, string>>({});
  const [studyYearText, setStudyYearText] = useState<Record<string, string>>({});
  const [disciplineOptions, setDisciplineOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewText, setPreviewText] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [faculties, setFaculties] = useState<LookupItem[]>([]);
  const [directions, setDirections] = useState<DirectionItem[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [expandedFaculties, setExpandedFaculties] = useState<Record<string, boolean>>({});
  const [expandedDirections, setExpandedDirections] = useState<Record<string, boolean>>({});
  const [activeNodeType, setActiveNodeType] = useState<NodeType>('root');
  const [activeFacultyId, setActiveFacultyId] = useState('');
  const [activeDirectionId, setActiveDirectionId] = useState('');
  const [activeStreamId, setActiveStreamId] = useState('');

  const [newFacultyName, setNewFacultyName] = useState('');
  const [newDirectionName, setNewDirectionName] = useState('');
  const [newStreamName, setNewStreamName] = useState('');
  const [newStreamCourse, setNewStreamCourse] = useState('');
  const [newStreamYear, setNewStreamYear] = useState('');
  const [manual, setManual] = useState({
    lecture_id: '',
    stream_id: '',
    discipline: '',
    lecturer_name: '',
    course_text: '',
    lecture_number_text: '',
    study_year_text: '',
  });

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const headingColor = isLightTheme ? '#2a1918' : '#fff7ec';
  const mutedColor = isLightTheme ? '#7a5a5c' : '#c6b7a7';
  const surface = { borderColor: 'var(--border-color)', background: 'var(--hover-bg)' };

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`${API_BASE}/api/catalog/requests?${params}`, { headers });
      if (!res.ok) return;
      const data: ReqItem[] = await res.json();
      setRequests(data);
      setSelectedId((prev) => (prev && data.some(d => d.id === prev) ? prev : (data[0]?.id ?? null)));
    } finally {
      setLoading(false);
    }
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

  const directionsByFaculty = useMemo(() => {
    const map: Record<string, DirectionItem[]> = {};
    directions.forEach(d => {
      if (!map[d.faculty_id]) map[d.faculty_id] = [];
      map[d.faculty_id].push(d);
    });
    return map;
  }, [directions]);

  const streamsByDirection = useMemo(() => {
    const map: Record<string, StreamItem[]> = {};
    streams.forEach(s => {
      if (!map[s.direction_id]) map[s.direction_id] = [];
      map[s.direction_id].push(s);
    });
    return map;
  }, [streams]);

  const activeFaculty = faculties.find(f => f.id === activeFacultyId) || null;
  const activeDirection = directions.find(d => d.id === activeDirectionId) || null;
  const activeStream = streams.find(s => s.id === activeStreamId) || null;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(r =>
      r.lecture_title.toLowerCase().includes(q) ||
      r.discipline.toLowerCase().includes(q) ||
      (r.lecturer_name || '').toLowerCase().includes(q) ||
      r.requested_by_login.toLowerCase().includes(q) ||
      r.stream_name.toLowerCase().includes(q)
    );
  }, [requests, searchQuery]);

  const selected = useMemo(
    () => filtered.find(r => r.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  useEffect(() => { loadRequests(); }, [loadRequests]);
  useEffect(() => { loadLookups(); }, [loadLookups]);
  useEffect(() => { setPreviewText(''); }, [selectedId]);
  useEffect(() => {
    if (!selected) return;
    setDisciplineText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.discipline ?? '' }));
    setLecturerText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.lecturer_name ?? '' }));
    setCourseText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.course_text ?? '' }));
    setLectureNumberText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.lecture_number_text ?? '' }));
    setStudyYearText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.study_year_text ?? '' }));
  }, [selected]);
  useEffect(() => {
    if (!selected?.stream_id) {
      setDisciplineOptions([]);
      return;
    }
    (async () => {
      const res = await fetch(`${API_BASE}/api/catalog/disciplines?stream_id=${selected.stream_id}`, { headers });
      if (!res.ok) { setDisciplineOptions([]); return; }
      const data: string[] = await res.json();
      setDisciplineOptions(data);
    })();
  }, [selected?.id, selected?.stream_id, headers]);

  const selectFacultyNode = (facultyId: string) => {
    setActiveNodeType('faculty');
    setActiveFacultyId(facultyId);
    setActiveDirectionId('');
    setActiveStreamId('');
    setExpandedFaculties(prev => ({ ...prev, [facultyId]: true }));
  };

  const selectDirectionNode = (facultyId: string, directionId: string) => {
    setActiveNodeType('direction');
    setActiveFacultyId(facultyId);
    setActiveDirectionId(directionId);
    setActiveStreamId('');
    setExpandedFaculties(prev => ({ ...prev, [facultyId]: true }));
    setExpandedDirections(prev => ({ ...prev, [directionId]: true }));
  };

  const selectStreamNode = (facultyId: string, directionId: string, streamId: string) => {
    setActiveNodeType('stream');
    setActiveFacultyId(facultyId);
    setActiveDirectionId(directionId);
    setActiveStreamId(streamId);
    setManual(prev => ({ ...prev, stream_id: streamId }));
    setExpandedFaculties(prev => ({ ...prev, [facultyId]: true }));
    setExpandedDirections(prev => ({ ...prev, [directionId]: true }));
  };

  const moderate = async (id: string, action: 'approve' | 'reject') => {
    const review_comment = (reviewText[id] || '').trim();
    const discipline = (disciplineText[id] || '').trim();
    const lecturer_name = (lecturerText[id] || '').trim();
    const course_text = (courseText[id] || '').trim();
    const lecture_number_text = (lectureNumberText[id] || '').trim();
    const study_year_text = (studyYearText[id] || '').trim();
    if (action === 'approve' && !discipline) {
      alert('Для одобрения укажите дисциплину.');
      return;
    }
    if (action === 'reject' && !review_comment) {
      alert('Для отклонения нужно указать причину.');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/catalog/requests/${id}/${action}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_comment: review_comment || null,
          discipline: discipline || null,
          lecturer_name: lecturer_name || null,
          course_text: course_text || null,
          lecture_number_text: lecture_number_text || null,
          study_year_text: study_year_text || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Ошибка модерации');
      }
      await loadRequests();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const openPreview = async (lectureId: string) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/lectures/${lectureId}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const tr = data.transcriptions?.[0];
      const text = tr?.processed_text || tr?.raw_text || 'Текст отсутствует';
      setPreviewText(text.slice(0, 2500));
    } finally {
      setPreviewLoading(false);
    }
  };

  const createFaculty = async () => {
    const name = newFacultyName.trim();
    if (!name) return;
    const res = await fetch(`${API_BASE}/api/catalog/faculties`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setNewFacultyName('');
      await loadLookups();
    }
  };

  const createDirection = async () => {
    const name = newDirectionName.trim();
    if (!activeFacultyId || !name) return;
    const res = await fetch(`${API_BASE}/api/catalog/directions`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ faculty_id: activeFacultyId, name }),
    });
    if (res.ok) {
      setNewDirectionName('');
      await loadLookups();
      setExpandedFaculties(prev => ({ ...prev, [activeFacultyId]: true }));
    }
  };

  const createStream = async () => {
    const name = newStreamName.trim();
    if (!activeDirectionId || !name) return;
    const course = Number(newStreamCourse);
    const study_year_start = Number(newStreamYear);
    const body: Record<string, unknown> = { direction_id: activeDirectionId, name };
    if (!Number.isNaN(course) && newStreamCourse.trim()) body.course = course;
    if (!Number.isNaN(study_year_start) && newStreamYear.trim()) body.study_year_start = study_year_start;
    const res = await fetch(`${API_BASE}/api/catalog/streams`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setNewStreamName('');
      setNewStreamCourse('');
      setNewStreamYear('');
      await loadLookups();
      setExpandedDirections(prev => ({ ...prev, [activeDirectionId]: true }));
    }
  };

  const publishManual = async () => {
    if (!manual.stream_id) {
      alert('Выберите поток в дереве слева.');
      return;
    }
    const res = await fetch(`${API_BASE}/api/catalog/publish`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...manual,
        lecturer_name: manual.lecturer_name || null,
        course_text: manual.course_text || null,
        lecture_number_text: manual.lecture_number_text || null,
        study_year_text: manual.study_year_text || null,
      }),
    });
    if (res.ok) {
      setManual({
        lecture_id: '',
        stream_id: activeStreamId || '',
        discipline: '',
        lecturer_name: '',
        course_text: '',
        lecture_number_text: '',
        study_year_text: '',
      });
      loadRequests();
    }
  };

  return (
    <div>
      <div className="text-center mb-6 px-4">
        <h1 className="text-3xl lg:text-4xl font-light mb-3 tracking-wide" style={{ color: headingColor }}>
          Модерация базы лекций
        </h1>
        <p className="text-sm opacity-70" style={{ color: mutedColor }}>
          {user?.role === 'admin' ? 'Inbox всех заявок + проводник каталога' : 'Inbox заявок потока + публикация через проводник'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px,1fr] gap-4">
        <section className="border rounded-xl p-3" style={surface}>
          <div className="flex items-center gap-2 mb-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              <option value="pending">На модерации</option>
              <option value="approved">Одобрено</option>
              <option value="rejected">Отклонено</option>
              <option value="">Все</option>
            </select>
            <button onClick={loadRequests} className="px-3 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
              Обновить
            </button>
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по заявкам..."
            className="w-full px-3 py-2 rounded-lg border text-sm mb-3"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />

          <div className="max-h-[65vh] overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <p className="text-sm px-2 py-3" style={{ color: mutedColor }}>Загрузка...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm px-2 py-3" style={{ color: mutedColor }}>Заявок нет</p>
            ) : filtered.map((req) => (
              <button
                key={req.id}
                onClick={() => setSelectedId(req.id)}
                className="w-full text-left border rounded-lg p-3 transition-all"
                style={{
                  borderColor: selected?.id === req.id ? 'var(--text-primary)' : 'var(--border-color)',
                  background: selected?.id === req.id ? 'rgba(68,41,43,0.08)' : 'var(--bg-primary)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate" style={{ color: headingColor }}>{req.lecture_title}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${statusColor[req.status]}22`, color: statusColor[req.status] }}>
                    {statusLabel[req.status]}
                  </span>
                </div>
                <p className="text-xs mt-1 truncate" style={{ color: mutedColor }}>{req.stream_name} · {req.discipline || 'Без дисциплины'}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: mutedColor }}>От: {req.requested_by_login}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="border rounded-xl p-4" style={surface}>
          {!selected ? (
            <p className="text-sm" style={{ color: mutedColor }}>Выберите заявку слева.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-lg font-medium" style={{ color: headingColor }}>{selected.lecture_title}</h2>
                  <p className="text-xs" style={{ color: mutedColor }}>
                    {selected.faculty_name} · {selected.direction_name} · {selected.stream_name}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full h-fit" style={{ background: `${statusColor[selected.status]}22`, color: statusColor[selected.status] }}>
                  {statusLabel[selected.status]}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                <div className="text-xs p-2 rounded-lg" style={{ background: 'var(--bg-primary)', color: mutedColor }}>
                  Дисциплина: <span style={{ color: headingColor }}>{selected.discipline || '—'}</span>
                </div>
                <div className="text-xs p-2 rounded-lg" style={{ background: 'var(--bg-primary)', color: mutedColor }}>
                  Лектор: <span style={{ color: headingColor }}>{selected.lecturer_name || '—'}</span>
                </div>
                <div className="text-xs p-2 rounded-lg" style={{ background: 'var(--bg-primary)', color: mutedColor }}>
                  Курс: <span style={{ color: headingColor }}>{selected.course_text || '—'}</span>
                </div>
                <div className="text-xs p-2 rounded-lg" style={{ background: 'var(--bg-primary)', color: mutedColor }}>
                  Номер лекции: <span style={{ color: headingColor }}>{selected.lecture_number_text || '—'}</span>
                </div>
                <div className="text-xs p-2 rounded-lg" style={{ background: 'var(--bg-primary)', color: mutedColor }}>
                  Год обучения: <span style={{ color: headingColor }}>{selected.study_year_text || '—'}</span>
                </div>
              </div>

              <div className="mb-3">
                <p className="text-xs mb-1" style={{ color: mutedColor }}>Комментарий автора заявки</p>
                <div className="text-sm p-3 rounded-lg border min-h-[56px]" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                  {selected.comment || '—'}
                </div>
              </div>

              {selected.review_comment && (
                <div className="mb-3">
                  <p className="text-xs mb-1" style={{ color: mutedColor }}>Комментарий модератора</p>
                  <div className="text-sm p-3 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                    {selected.review_comment}
                  </div>
                </div>
              )}

              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs" style={{ color: mutedColor }}>Предпросмотр текста лекции</p>
                  <button onClick={() => openPreview(selected.lecture_id)} className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                    Показать
                  </button>
                </div>
                <div className="text-sm p-3 rounded-lg border min-h-[86px] max-h-[220px] overflow-y-auto" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                  {previewLoading ? 'Загрузка...' : (previewText || 'Нажмите "Показать" для просмотра фрагмента.')}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                <div>
                  <p className="text-xs mb-1" style={{ color: mutedColor }}>Дисциплина (задаёт модератор)</p>
                  <input
                    list={`discipline-options-${selected.id}`}
                    value={disciplineText[selected.id] ?? ''}
                    onChange={(e) => setDisciplineText(prev => ({ ...prev, [selected.id]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <datalist id={`discipline-options-${selected.id}`}>
                    {disciplineOptions.map((opt) => <option key={opt} value={opt} />)}
                  </datalist>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: mutedColor }}>Лектор</p>
                  <input
                    value={lecturerText[selected.id] ?? ''}
                    onChange={(e) => setLecturerText(prev => ({ ...prev, [selected.id]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: mutedColor }}>Курс</p>
                  <input
                    value={courseText[selected.id] ?? ''}
                    onChange={(e) => setCourseText(prev => ({ ...prev, [selected.id]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: mutedColor }}>Номер лекции</p>
                  <input
                    value={lectureNumberText[selected.id] ?? ''}
                    onChange={(e) => setLectureNumberText(prev => ({ ...prev, [selected.id]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: mutedColor }}>Год обучения</p>
                  <input
                    value={studyYearText[selected.id] ?? ''}
                    onChange={(e) => setStudyYearText(prev => ({ ...prev, [selected.id]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div className="mb-3">
                <p className="text-xs mb-1" style={{ color: mutedColor }}>Комментарий модератора (обязателен при отклонении)</p>
                <textarea
                  value={reviewText[selected.id] ?? ''}
                  onChange={(e) => setReviewText(prev => ({ ...prev, [selected.id]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  rows={3}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  disabled={processing}
                  onClick={() => moderate(selected.id, 'approve')}
                  className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                  style={{ background: '#22c55e', color: '#fff' }}
                >
                  Одобрить
                </button>
                <button
                  disabled={processing}
                  onClick={() => moderate(selected.id, 'reject')}
                  className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                  style={{ background: '#ef4444', color: '#fff' }}
                >
                  Отклонить
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="mt-5 border rounded-xl p-4" style={surface}>
        <div className="mb-3">
          <h3 className="text-base font-medium" style={{ color: headingColor }}>Проводник каталога</h3>
          <p className="text-xs mt-1" style={{ color: mutedColor }}>
            Выберите узел слева и работайте с ним справа: добавляйте справочники и публикуйте лекции без ручного ввода ID.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4">
          <div className="border rounded-lg p-3 max-h-[560px] overflow-y-auto" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
            <button
              onClick={() => { setActiveNodeType('root'); setActiveFacultyId(''); setActiveDirectionId(''); setActiveStreamId(''); }}
              className="text-left px-2 py-1 rounded text-sm w-full mb-1"
              style={{ background: activeNodeType === 'root' ? 'var(--text-primary)' : 'transparent', color: activeNodeType === 'root' ? 'var(--bg-primary)' : 'var(--text-primary)' }}
            >
              Каталог
            </button>
            {faculties.map(f => {
              const facultyDirections = directionsByFaculty[f.id] || [];
              const facultyOpen = !!expandedFaculties[f.id];
              return (
                <div key={f.id} className="mb-1">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setExpandedFaculties(prev => ({ ...prev, [f.id]: !prev[f.id] }))} className="text-xs w-5">{facultyOpen ? '▾' : '▸'}</button>
                    <button
                      onClick={() => selectFacultyNode(f.id)}
                      className="text-left px-2 py-1 rounded text-sm flex-1"
                      style={{ background: activeNodeType === 'faculty' && activeFacultyId === f.id ? 'var(--text-primary)' : 'transparent', color: activeNodeType === 'faculty' && activeFacultyId === f.id ? 'var(--bg-primary)' : 'var(--text-primary)' }}
                    >
                      {f.name}
                    </button>
                  </div>
                  {facultyOpen && (
                    <div className="ml-6 mt-1">
                      {facultyDirections.map(d => {
                        const directionStreams = streamsByDirection[d.id] || [];
                        const directionOpen = !!expandedDirections[d.id];
                        return (
                          <div key={d.id} className="mb-1">
                            <div className="flex items-center gap-1">
                              <button onClick={() => setExpandedDirections(prev => ({ ...prev, [d.id]: !prev[d.id] }))} className="text-xs w-5">{directionOpen ? '▾' : '▸'}</button>
                              <button
                                onClick={() => selectDirectionNode(f.id, d.id)}
                                className="text-left px-2 py-1 rounded text-sm flex-1"
                                style={{ background: activeNodeType === 'direction' && activeDirectionId === d.id ? 'var(--text-primary)' : 'transparent', color: activeNodeType === 'direction' && activeDirectionId === d.id ? 'var(--bg-primary)' : 'var(--text-primary)' }}
                              >
                                {d.name}
                              </button>
                            </div>
                            {directionOpen && (
                              <div className="ml-6 mt-1">
                                {directionStreams.map(s => (
                                  <button
                                    key={s.id}
                                    onClick={() => selectStreamNode(f.id, d.id, s.id)}
                                    className="text-left px-2 py-1 rounded text-sm block w-full mb-1"
                                    style={{ background: activeNodeType === 'stream' && activeStreamId === s.id ? 'var(--text-primary)' : 'transparent', color: activeNodeType === 'stream' && activeStreamId === s.id ? 'var(--bg-primary)' : 'var(--text-primary)' }}
                                  >
                                    {s.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border rounded-lg p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
            <div className="flex flex-wrap items-center gap-2 text-xs mb-3" style={{ color: mutedColor }}>
              <span>Путь:</span>
              <span>Каталог</span>
              {activeFaculty && <><span>/</span><span>{activeFaculty.name}</span></>}
              {activeDirection && <><span>/</span><span>{activeDirection.name}</span></>}
              {activeStream && <><span>/</span><span>{activeStream.name}</span></>}
            </div>

            {activeNodeType === 'root' && user?.role === 'admin' && (
              <div>
                <p className="text-sm mb-2" style={{ color: headingColor }}>Создать факультет</p>
                <div className="flex gap-2">
                  <input
                    value={newFacultyName}
                    onChange={(e) => setNewFacultyName(e.target.value)}
                    placeholder="Название факультета"
                    className="flex-1 px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <button onClick={createFaculty} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>
                    Добавить
                  </button>
                </div>
              </div>
            )}

            {activeNodeType === 'faculty' && activeFaculty && user?.role === 'admin' && (
              <div>
                <p className="text-sm mb-2" style={{ color: headingColor }}>Добавить направление в «{activeFaculty.name}»</p>
                <div className="flex gap-2">
                  <input
                    value={newDirectionName}
                    onChange={(e) => setNewDirectionName(e.target.value)}
                    placeholder="Название направления"
                    className="flex-1 px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <button onClick={createDirection} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>
                    Добавить
                  </button>
                </div>
              </div>
            )}

            {activeNodeType === 'direction' && activeDirection && user?.role === 'admin' && (
              <div>
                <p className="text-sm mb-2" style={{ color: headingColor }}>Добавить поток в «{activeDirection.name}»</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                  <input
                    value={newStreamName}
                    onChange={(e) => setNewStreamName(e.target.value)}
                    placeholder="Название потока"
                    className="px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <input
                    value={newStreamCourse}
                    onChange={(e) => setNewStreamCourse(e.target.value)}
                    placeholder="Курс (опц.)"
                    className="px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <input
                    value={newStreamYear}
                    onChange={(e) => setNewStreamYear(e.target.value)}
                    placeholder="Год набора (опц.)"
                    className="px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
                <button onClick={createStream} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>
                  Добавить поток
                </button>
              </div>
            )}

            {activeNodeType === 'stream' && activeStream && (
              <div>
                <p className="text-sm mb-2" style={{ color: headingColor }}>Ручная публикация в поток «{activeStream.name}»</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input value={manual.lecture_id} onChange={(e) => setManual(prev => ({ ...prev, lecture_id: e.target.value }))} placeholder="Lecture ID" className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                  <input value={manual.discipline} onChange={(e) => setManual(prev => ({ ...prev, discipline: e.target.value }))} placeholder="Дисциплина" className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                  <input value={manual.lecturer_name} onChange={(e) => setManual(prev => ({ ...prev, lecturer_name: e.target.value }))} placeholder="Лектор" className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                  <input value={manual.course_text} onChange={(e) => setManual(prev => ({ ...prev, course_text: e.target.value }))} placeholder="Курс" className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                  <input value={manual.lecture_number_text} onChange={(e) => setManual(prev => ({ ...prev, lecture_number_text: e.target.value }))} placeholder="Номер лекции" className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                  <input value={manual.study_year_text} onChange={(e) => setManual(prev => ({ ...prev, study_year_text: e.target.value }))} placeholder="Год обучения" className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
                <button onClick={publishManual} className="mt-3 px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>
                  Опубликовать
                </button>
              </div>
            )}

            {activeNodeType !== 'stream' && user?.role !== 'admin' && (
              <p className="text-sm" style={{ color: mutedColor }}>
                Староста может публиковать лекции в своем потоке. Выберите поток в дереве.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default CatalogModerationSection;
