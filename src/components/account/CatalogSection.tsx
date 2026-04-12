import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
type Semester = 'winter' | 'spring';

interface LookupItem { id: string; name: string }
interface DirectionItem extends LookupItem { faculty_id: string }
interface StreamItem { id: string; direction_id: string; name: string; course: number | null }
interface CatalogItem {
  id: string;
  lecture_id: string;
  lecture_title: string;
  discipline: string;
  lecturer_name: string | null;
  course_text: string | null;
  semester_text: string | null;
  study_year_text: string | null;
  stream_id: string;
  stream_name: string;
  direction_id: string;
  direction_name: string;
  faculty_id: string;
  faculty_name: string;
  published_by_login: string;
}

interface CatalogSectionProps { isLightTheme: boolean }

const semesterLabel = (s: Semester) => (s === 'winter' ? 'Зимний семестр' : 'Весенний семестр');

const CatalogSection: React.FC<CatalogSectionProps> = ({ isLightTheme }) => {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const headingColor = isLightTheme ? '#2a1918' : '#fff7ec';
  const mutedColor = isLightTheme ? '#7a5a5c' : '#c6b7a7';

  const [faculties, setFaculties] = useState<LookupItem[]>([]);
  const [directions, setDirections] = useState<DirectionItem[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [facultyId, setFacultyId] = useState('');
  const [directionId, setDirectionId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [courseText, setCourseText] = useState('');
  const [semesterText, setSemesterText] = useState<Semester | ''>('');
  const [yearText, setYearText] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [lecturerName, setLecturerName] = useState('');

  const [expandedFaculties, setExpandedFaculties] = useState<Record<string, boolean>>({});
  const [expandedDirections, setExpandedDirections] = useState<Record<string, boolean>>({});
  const [expandedStreams, setExpandedStreams] = useState<Record<string, boolean>>({});
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({});

  const fetchFaculties = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/catalog/faculties`, { headers });
    if (res.ok) setFaculties(await res.json());
  }, [headers]);

  const fetchDirections = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/catalog/directions`, { headers });
    if (res.ok) setDirections(await res.json());
  }, [headers]);

  const fetchStreams = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/catalog/streams`, { headers });
    if (res.ok) setStreams(await res.json());
  }, [headers]);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (facultyId) params.set('faculty_id', facultyId);
      if (directionId) params.set('direction_id', directionId);
      if (streamId) params.set('stream_id', streamId);
      if (courseText.trim()) params.set('course_text', courseText.trim());
      if (semesterText) params.set('semester_text', semesterText);
      if (yearText.trim()) params.set('study_year_text', yearText.trim());
      if (discipline.trim()) params.set('discipline', discipline.trim());
      if (lecturerName.trim()) params.set('lecturer_name', lecturerName.trim());
      params.set('limit', '300');
      const res = await fetch(`${API_BASE}/api/catalog/items?${params}`, { headers });
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, [headers, facultyId, directionId, streamId, courseText, semesterText, yearText, discipline, lecturerName]);

  useEffect(() => { fetchFaculties(); fetchDirections(); fetchStreams(); }, [fetchFaculties, fetchDirections, fetchStreams]);
  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  const directionsByFaculty = useMemo(() => {
    const map: Record<string, DirectionItem[]> = {};
    directions.forEach(d => { if (!map[d.faculty_id]) map[d.faculty_id] = []; map[d.faculty_id].push(d); });
    return map;
  }, [directions]);

  const streamsByDirection = useMemo(() => {
    const map: Record<string, StreamItem[]> = {};
    streams.forEach(s => { if (!map[s.direction_id]) map[s.direction_id] = []; map[s.direction_id].push(s); });
    return map;
  }, [streams]);

  const setPath = (fId?: string, dId?: string, sId?: string, cText?: string, sem?: Semester | '', yText?: string, disc?: string, lect?: string) => {
    setFacultyId(fId || '');
    setDirectionId(dId || '');
    setStreamId(sId || '');
    setCourseText(cText || '');
    setSemesterText(sem || '');
    setYearText(yText || '');
    setDiscipline(disc || '');
    setLecturerName(lect || '');
  };

  const yearsForNode = useMemo(() => {
    const pool = items.filter(i =>
      (!streamId || i.stream_id === streamId) &&
      (!courseText || (i.course_text || '') === courseText) &&
      (!semesterText || (i.semester_text || '').toLowerCase() === semesterText)
    );
    const setYears = new Set(pool.map(i => i.study_year_text || '').filter(Boolean));
    return Array.from(setYears).sort((a, b) => Number(b) - Number(a));
  }, [items, streamId, courseText, semesterText]);

  const disciplinesForNode = useMemo(() => {
    const pool = items.filter(i =>
      (!streamId || i.stream_id === streamId) &&
      (!courseText || (i.course_text || '') === courseText) &&
      (!semesterText || (i.semester_text || '').toLowerCase() === semesterText) &&
      (!yearText || (i.study_year_text || '') === yearText)
    );
    return Array.from(new Set(pool.map(i => i.discipline).filter(Boolean))).sort();
  }, [items, streamId, courseText, semesterText, yearText]);

  const lecturersForNode = useMemo(() => {
    const pool = items.filter(i =>
      (!streamId || i.stream_id === streamId) &&
      (!courseText || (i.course_text || '') === courseText) &&
      (!semesterText || (i.semester_text || '').toLowerCase() === semesterText) &&
      (!yearText || (i.study_year_text || '') === yearText) &&
      (!discipline || i.discipline === discipline)
    );
    return Array.from(new Set(pool.map(i => i.lecturer_name || '').filter(Boolean))).sort();
  }, [items, streamId, courseText, semesterText, yearText, discipline]);

  const filteredLectures = useMemo(() => items.filter(i =>
    (!facultyId || i.faculty_id === facultyId) &&
    (!directionId || i.direction_id === directionId) &&
    (!streamId || i.stream_id === streamId) &&
    (!courseText || (i.course_text || '') === courseText) &&
    (!semesterText || (i.semester_text || '').toLowerCase() === semesterText) &&
    (!yearText || (i.study_year_text || '') === yearText) &&
    (!discipline || i.discipline === discipline) &&
    (!lecturerName || (i.lecturer_name || '') === lecturerName)
  ), [items, facultyId, directionId, streamId, courseText, semesterText, yearText, discipline, lecturerName]);

  const openLecture = async (lectureId: string) => {
    const res = await fetch(`${API_BASE}/api/lectures/${lectureId}`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    const tr = data.transcriptions?.[0];
    alert((tr?.processed_text || tr?.raw_text || 'Текст отсутствует').slice(0, 5000));
  };

  return (
    <div>
      <div className="text-center mb-8 px-4">
        <h1 className="text-3xl lg:text-4xl font-light mb-3 tracking-wide" style={{ color: headingColor }}>База лекций</h1>
        <p className="text-sm opacity-70" style={{ color: mutedColor }}>
          Иерархия: факультет / направление / поток / курс / семестр / год записи / дисциплина / лектор.
        </p>
      </div>

      <div className="border rounded-xl p-4 mb-5" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
        <div className="border rounded-lg p-3 max-h-80 overflow-y-auto mb-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
          {faculties.map(f => (
            <div key={f.id} className="mb-1">
              <div className="flex items-center gap-1">
                <button onClick={() => setExpandedFaculties(prev => ({ ...prev, [f.id]: !prev[f.id] }))} className="text-xs w-5">{expandedFaculties[f.id] ? '▾' : '▸'}</button>
                <button onClick={() => setPath(f.id)} className="text-left px-2 py-1 rounded text-sm" style={{ background: facultyId === f.id ? 'var(--text-primary)' : 'transparent', color: facultyId === f.id ? 'var(--bg-primary)' : 'var(--text-primary)' }}>{f.name}</button>
              </div>
              {expandedFaculties[f.id] && (
                <div className="ml-6 mt-1">
                  {(directionsByFaculty[f.id] || []).map(d => (
                    <div key={d.id} className="mb-1">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setExpandedDirections(prev => ({ ...prev, [d.id]: !prev[d.id] }))} className="text-xs w-5">{expandedDirections[d.id] ? '▾' : '▸'}</button>
                        <button onClick={() => setPath(f.id, d.id)} className="text-left px-2 py-1 rounded text-sm" style={{ background: directionId === d.id ? 'var(--text-primary)' : 'transparent', color: directionId === d.id ? 'var(--bg-primary)' : 'var(--text-primary)' }}>{d.name}</button>
                      </div>
                      {expandedDirections[d.id] && (
                        <div className="ml-6 mt-1">
                          {(streamsByDirection[d.id] || []).map(s => {
                            const courseNodeKey = `${s.id}:${s.course ?? ''}`;
                            return (
                              <div key={s.id} className="mb-1">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setExpandedStreams(prev => ({ ...prev, [s.id]: !prev[s.id] }))} className="text-xs w-5">{expandedStreams[s.id] ? '▾' : '▸'}</button>
                                  <button onClick={() => setPath(f.id, d.id, s.id)} className="text-left px-2 py-1 rounded text-sm" style={{ background: streamId === s.id ? 'var(--text-primary)' : 'transparent', color: streamId === s.id ? 'var(--bg-primary)' : 'var(--text-primary)' }}>{s.name}</button>
                                </div>
                                {expandedStreams[s.id] && (
                                  <div className="ml-6 mt-1">
                                    <div>
                                      <button onClick={() => { setExpandedCourses(prev => ({ ...prev, [courseNodeKey]: !prev[courseNodeKey] })); setPath(f.id, d.id, s.id, s.course ? String(s.course) : ''); }} className="text-left px-2 py-1 rounded text-sm w-full" style={{ background: courseText === (s.course ? String(s.course) : '') ? 'var(--text-primary)' : 'transparent', color: courseText === (s.course ? String(s.course) : '') ? 'var(--bg-primary)' : 'var(--text-primary)' }}>
                                        Курс {s.course ?? '—'}
                                      </button>
                                      {expandedCourses[courseNodeKey] && (
                                        <div className="ml-6 mt-1 space-y-1">
                                          {(['winter', 'spring'] as Semester[]).map(sem => (
                                            <button key={sem} onClick={() => setPath(f.id, d.id, s.id, s.course ? String(s.course) : '', sem)} className="text-left px-2 py-1 rounded text-sm block w-full" style={{ background: semesterText === sem ? 'var(--text-primary)' : 'transparent', color: semesterText === sem ? 'var(--bg-primary)' : 'var(--text-primary)' }}>
                                              {semesterLabel(sem)}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {(streamId && semesterText) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <select value={yearText} onChange={(e) => setYearText(e.target.value)} className="px-3 py-2 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              <option value="">Год записи</option>
              {yearsForNode.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="px-3 py-2 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              <option value="">Дисциплина</option>
              {disciplinesForNode.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={lecturerName} onChange={(e) => setLecturerName(e.target.value)} className="px-3 py-2 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              <option value="">Лектор</option>
              {lecturersForNode.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading ? <p className="text-center py-8" style={{ color: mutedColor }}>Загрузка...</p> : filteredLectures.length === 0 ? (
        <p className="text-center py-8" style={{ color: mutedColor }}>Лекции не найдены</p>
      ) : (
        <div className="space-y-3">
          {filteredLectures.map(item => (
            <div key={item.id} className="border rounded-xl p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-medium" style={{ color: headingColor }}>{item.lecture_title}</h3>
                  <p className="text-xs mt-1" style={{ color: mutedColor }}>
                    {item.faculty_name} · {item.direction_name} · {item.stream_name} · Курс: {item.course_text || '—'} · Семестр: {item.semester_text || '—'} · Год: {item.study_year_text || '—'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: mutedColor }}>
                    {item.discipline} {item.lecturer_name ? `· ${item.lecturer_name}` : ''} · Добавил: {item.published_by_login}
                  </p>
                </div>
                <button onClick={() => openLecture(item.lecture_id)} className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>Просмотр</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CatalogSection;
