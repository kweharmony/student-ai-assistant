import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface LookupItem {
  id: string;
  name: string;
}

interface StreamItem {
  id: string;
  direction_id: string;
  name: string;
  course: number | null;
  study_year_start: number | null;
}

interface CatalogItem {
  id: string;
  lecture_id: string;
  lecture_title: string;
  lecture_subject: string | null;
  discipline: string;
  lecturer_name: string | null;
  course_text: string | null;
  study_year_text: string | null;
  stream_id: string;
  stream_name: string;
  direction_id: string;
  direction_name: string;
  faculty_id: string;
  faculty_name: string;
  published_by_login: string;
  created_at: string;
}

interface CatalogSectionProps {
  isLightTheme: boolean;
}

const CatalogSection: React.FC<CatalogSectionProps> = ({ isLightTheme }) => {
  const { token } = useAuth();
  const [faculties, setFaculties] = useState<LookupItem[]>([]);
  const [directions, setDirections] = useState<LookupItem[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [facultyId, setFacultyId] = useState('');
  const [directionId, setDirectionId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [lecturerName, setLecturerName] = useState('');
  const [courseText, setCourseText] = useState('');
  const [studyYearText, setStudyYearText] = useState('');
  const [search, setSearch] = useState('');

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchFaculties = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/catalog/faculties`, { headers });
    if (res.ok) setFaculties(await res.json());
  }, [headers]);

  const fetchDirections = useCallback(async (selectedFacultyId?: string) => {
    const params = new URLSearchParams();
    if (selectedFacultyId) params.set('faculty_id', selectedFacultyId);
    const res = await fetch(`${API_BASE}/api/catalog/directions?${params}`, { headers });
    if (res.ok) setDirections(await res.json());
  }, [headers]);

  const fetchStreams = useCallback(async (selectedDirectionId?: string) => {
    const params = new URLSearchParams();
    if (selectedDirectionId) params.set('direction_id', selectedDirectionId);
    const res = await fetch(`${API_BASE}/api/catalog/streams?${params}`, { headers });
    if (res.ok) setStreams(await res.json());
  }, [headers]);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (facultyId) params.set('faculty_id', facultyId);
    if (directionId) params.set('direction_id', directionId);
    if (streamId) params.set('stream_id', streamId);
    if (discipline.trim()) params.set('discipline', discipline.trim());
    if (lecturerName.trim()) params.set('lecturer_name', lecturerName.trim());
    if (courseText.trim()) params.set('course_text', courseText.trim());
    if (studyYearText.trim()) params.set('study_year_text', studyYearText.trim());
    if (search.trim()) params.set('search', search.trim());
    params.set('limit', '200');

    try {
      const res = await fetch(`${API_BASE}/api/catalog/items?${params}`, { headers });
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, [headers, facultyId, directionId, streamId, discipline, lecturerName, courseText, studyYearText, search]);

  useEffect(() => { fetchFaculties(); }, [fetchFaculties]);
  useEffect(() => { fetchDirections(facultyId || undefined); }, [fetchDirections, facultyId]);
  useEffect(() => { fetchStreams(directionId || undefined); }, [fetchStreams, directionId]);
  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  const headingColor = isLightTheme ? '#2a1918' : '#fff7ec';
  const mutedColor = isLightTheme ? '#7a5a5c' : '#c6b7a7';

  const openLecture = async (lectureId: string) => {
    const res = await fetch(`${API_BASE}/api/lectures/${lectureId}`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    const tr = data.transcriptions?.[0];
    const text = tr?.processed_text || tr?.raw_text || 'Текст отсутствует';
    alert(text.slice(0, 5000));
  };

  return (
    <div>
      <div className="text-center mb-8 px-4">
        <h1 className="text-3xl lg:text-4xl font-light mb-3 tracking-wide" style={{ color: headingColor }}>
          База лекций
        </h1>
        <p className="text-sm opacity-70" style={{ color: mutedColor }}>
          Просмотр лекций всех потоков. Добавление и обработка материалов — только админ/староста.
        </p>
      </div>

      <div className="border rounded-xl p-4 mb-5" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={facultyId} onChange={(e) => { setFacultyId(e.target.value); setDirectionId(''); setStreamId(''); }} className="px-3 py-2 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="">Факультет</option>
            {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select value={directionId} onChange={(e) => { setDirectionId(e.target.value); setStreamId(''); }} className="px-3 py-2 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="">Направление</option>
            {directions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={streamId} onChange={(e) => setStreamId(e.target.value)} className="px-3 py-2 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="">Поток</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input value={discipline} onChange={(e) => setDiscipline(e.target.value)} placeholder="Дисциплина" className="px-3 py-2 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          <input value={lecturerName} onChange={(e) => setLecturerName(e.target.value)} placeholder="Лектор" className="px-3 py-2 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          <input value={courseText} onChange={(e) => setCourseText(e.target.value)} placeholder="Курс" className="px-3 py-2 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          <input value={studyYearText} onChange={(e) => setStudyYearText(e.target.value)} placeholder="Год обучения" className="px-3 py-2 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию/дисциплине/лектору" className="px-3 py-2 rounded-lg border md:col-span-2" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={fetchCatalog} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>
            Применить
          </button>
          <button onClick={() => { setFacultyId(''); setDirectionId(''); setStreamId(''); setDiscipline(''); setLecturerName(''); setCourseText(''); setStudyYearText(''); setSearch(''); }} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
            Сбросить
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-center py-8" style={{ color: mutedColor }}>Загрузка...</p>
      ) : items.length === 0 ? (
        <p className="text-center py-8" style={{ color: mutedColor }}>Лекции не найдены</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="border rounded-xl p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-medium" style={{ color: headingColor }}>{item.lecture_title}</h3>
                  <p className="text-xs mt-1" style={{ color: mutedColor }}>
                    {item.faculty_name} · {item.direction_name} · {item.stream_name}
                  </p>
                  <p className="text-xs mt-1" style={{ color: mutedColor }}>
                    Дисциплина: {item.discipline}{item.lecturer_name ? ` · Лектор: ${item.lecturer_name}` : ''}
                  </p>
                  <p className="text-xs mt-1" style={{ color: mutedColor }}>
                    Курс: {item.course_text || '—'} · Год: {item.study_year_text || '—'} · Добавил: {item.published_by_login}
                  </p>
                </div>
                <button onClick={() => openLecture(item.lecture_id)} className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>
                  Просмотр
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CatalogSection;
