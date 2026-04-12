import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface LookupItem {
  id: string;
  name: string;
}

interface DirectionItem extends LookupItem {
  faculty_id: string;
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
  const [directions, setDirections] = useState<DirectionItem[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [facultyId, setFacultyId] = useState('');
  const [directionId, setDirectionId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [lecturerName, setLecturerName] = useState('');
  const [search, setSearch] = useState('');

  const [expandedFaculties, setExpandedFaculties] = useState<Record<string, boolean>>({});
  const [expandedDirections, setExpandedDirections] = useState<Record<string, boolean>>({});

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const headingColor = isLightTheme ? '#2a1918' : '#fff7ec';
  const mutedColor = isLightTheme ? '#7a5a5c' : '#c6b7a7';

  const selectedFaculty = faculties.find(f => f.id === facultyId);
  const selectedDirection = directions.find(d => d.id === directionId);
  const selectedStream = streams.find(s => s.id === streamId);

  const fetchFaculties = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/catalog/faculties`, { headers });
    if (res.ok) {
      const data: LookupItem[] = await res.json();
      setFaculties(data);
      setExpandedFaculties(prev => {
        const next = { ...prev };
        data.forEach(f => { if (!(f.id in next)) next[f.id] = false; });
        return next;
      });
    }
  }, [headers]);

  const fetchDirections = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/catalog/directions`, { headers });
    if (res.ok) {
      const data: DirectionItem[] = await res.json();
      setDirections(data);
      setExpandedDirections(prev => {
        const next = { ...prev };
        data.forEach(d => { if (!(d.id in next)) next[d.id] = false; });
        return next;
      });
    }
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
      if (discipline.trim()) params.set('discipline', discipline.trim());
      if (lecturerName.trim()) params.set('lecturer_name', lecturerName.trim());
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '200');
      const res = await fetch(`${API_BASE}/api/catalog/items?${params}`, { headers });
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, [headers, facultyId, directionId, streamId, discipline, lecturerName, search]);

  useEffect(() => { fetchFaculties(); }, [fetchFaculties]);
  useEffect(() => { fetchDirections(); }, [fetchDirections]);
  useEffect(() => { fetchStreams(); }, [fetchStreams]);
  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

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

  const setPath = (fId?: string, dId?: string, sId?: string) => {
    setFacultyId(fId || '');
    setDirectionId(dId || '');
    setStreamId(sId || '');
  };

  const toggleFaculty = (id: string) => {
    setExpandedFaculties(prev => ({ ...prev, [id]: !prev[id] }));
  };
  const toggleDirection = (id: string) => {
    setExpandedDirections(prev => ({ ...prev, [id]: !prev[id] }));
  };

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
          Проводник с деревом и хлебными крошками.
        </p>
      </div>

      <div className="border rounded-xl p-4 mb-5" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
        <div className="flex flex-wrap items-center gap-2 text-xs mb-3" style={{ color: mutedColor }}>
          <span>Путь:</span>
          <button onClick={() => setPath()} className="underline underline-offset-2">Каталог</button>
          {selectedFaculty && (
            <>
              <span>/</span>
              <button onClick={() => setPath(selectedFaculty.id)} className="underline underline-offset-2">{selectedFaculty.name}</button>
            </>
          )}
          {selectedDirection && (
            <>
              <span>/</span>
              <button onClick={() => setPath(selectedFaculty?.id, selectedDirection.id)} className="underline underline-offset-2">{selectedDirection.name}</button>
            </>
          )}
          {selectedStream && (
            <>
              <span>/</span>
              <button onClick={() => setPath(selectedFaculty?.id, selectedDirection?.id, selectedStream.id)} className="underline underline-offset-2">{selectedStream.name}</button>
            </>
          )}
          {(facultyId || directionId || streamId) && (
            <button onClick={() => setPath()} className="ml-2 px-2 py-1 rounded border" style={{ borderColor: 'var(--border-color)' }}>
              Сбросить путь
            </button>
          )}
        </div>

        <div className="border rounded-lg p-3 max-h-72 overflow-y-auto mb-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
          {faculties.map(f => {
            const isFacultySelected = facultyId === f.id;
            const isFacultyOpen = expandedFaculties[f.id];
            const dirList = directionsByFaculty[f.id] || [];
            return (
              <div key={f.id} className="mb-1">
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleFaculty(f.id)} className="text-xs w-5">{isFacultyOpen ? '▾' : '▸'}</button>
                  <button
                    onClick={() => setPath(f.id)}
                    className="text-left px-2 py-1 rounded text-sm"
                    style={{ background: isFacultySelected ? 'var(--text-primary)' : 'transparent', color: isFacultySelected ? 'var(--bg-primary)' : 'var(--text-primary)' }}
                  >
                    {f.name}
                  </button>
                </div>
                {isFacultyOpen && (
                  <div className="ml-6 mt-1">
                    {dirList.map(d => {
                      const isDirectionOpen = expandedDirections[d.id];
                      const isDirectionSelected = directionId === d.id;
                      const streamList = streamsByDirection[d.id] || [];
                      return (
                        <div key={d.id} className="mb-1">
                          <div className="flex items-center gap-1">
                            <button onClick={() => toggleDirection(d.id)} className="text-xs w-5">{isDirectionOpen ? '▾' : '▸'}</button>
                            <button
                              onClick={() => setPath(f.id, d.id)}
                              className="text-left px-2 py-1 rounded text-sm"
                              style={{ background: isDirectionSelected ? 'var(--text-primary)' : 'transparent', color: isDirectionSelected ? 'var(--bg-primary)' : 'var(--text-primary)' }}
                            >
                              {d.name}
                            </button>
                          </div>
                          {isDirectionOpen && (
                            <div className="ml-6 mt-1">
                              {streamList.map(s => {
                                const isStreamSelected = streamId === s.id;
                                return (
                                  <button
                                    key={s.id}
                                    onClick={() => setPath(f.id, d.id, s.id)}
                                    className="block text-left px-2 py-1 rounded text-sm mb-1 w-full"
                                    style={{ background: isStreamSelected ? 'var(--text-primary)' : 'transparent', color: isStreamSelected ? 'var(--bg-primary)' : 'var(--text-primary)' }}
                                  >
                                    {s.name}
                                  </button>
                                );
                              })}
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={discipline} onChange={(e) => setDiscipline(e.target.value)} placeholder="Дисциплина (опц.)" className="px-3 py-2 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          <input value={lecturerName} onChange={(e) => setLecturerName(e.target.value)} placeholder="Лектор (опц.)" className="px-3 py-2 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию" className="px-3 py-2 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
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
