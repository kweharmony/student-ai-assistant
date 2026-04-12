import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
type Semester = 'winter' | 'spring';
const NOTE_MODES = [
  { id: 'summary', label: 'Краткий конспект' },
  { id: 'detailed_notes', label: 'Расширенный конспект' },
  { id: 'qa', label: 'Q&A' },
  { id: 'flashcards', label: 'Флешкарточки' },
  { id: 'mindmap', label: 'Майнд-карта' },
];

const NO_COURSE = '__no_course__';
const NO_DISCIPLINE = '__no_discipline__';

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
  lecture_number_text: string | null;
  stream_id: string;
  stream_name: string;
  direction_id: string;
  direction_name: string;
  faculty_id: string;
  faculty_name: string;
  published_by_login: string;
}
interface LectureNoteInfo { id: string; mode: string; created_at: string }
interface LectureDetail { id: string; transcriptions: { raw_text: string; processed_text: string | null }[] }
interface CatalogSectionProps { isLightTheme: boolean; onOpenInEditor: (text: string, lectureId: string) => void }

const semesterLabel = (s: Semester) => (s === 'winter' ? 'Зимний семестр' : 'Весенний семестр');
const normalizeSemester = (value: string | null | undefined): Semester | '' => {
  const lower = (value || '').trim().toLowerCase();
  if (lower === 'winter') return 'winter';
  if (lower === 'spring') return 'spring';
  return '';
};
const normalizeCourse = (value: string | null | undefined) => (value || '').trim() || NO_COURSE;
const normalizeDiscipline = (value: string | null | undefined) => (value || '').trim() || NO_DISCIPLINE;

const CatalogSection: React.FC<CatalogSectionProps> = ({ isLightTheme, onOpenInEditor }) => {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const headingColor = isLightTheme ? '#2a1918' : '#fff7ec';
  const mutedColor = isLightTheme ? '#7a5a5c' : '#c6b7a7';
  const cardBg = isLightTheme ? 'rgba(255,255,240,0.95)' : 'rgba(33,24,25,0.95)';
  const cardBorder = `1px solid ${isLightTheme ? 'rgba(68,41,43,0.16)' : 'rgba(255,247,236,0.16)'}`;

  const [faculties, setFaculties] = useState<LookupItem[]>([]);
  const [directions, setDirections] = useState<DirectionItem[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [allItems, setAllItems] = useState<CatalogItem[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [facultyId, setFacultyId] = useState('');
  const [directionId, setDirectionId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [courseText, setCourseText] = useState('');
  const [semesterText, setSemesterText] = useState<Semester | ''>('');
  const [discipline, setDiscipline] = useState('');

  const [selectedLecture, setSelectedLecture] = useState<CatalogItem | null>(null);
  const [notesByLecture, setNotesByLecture] = useState<Record<string, LectureNoteInfo[]>>({});
  const [lectureTextByLecture, setLectureTextByLecture] = useState<Record<string, string>>({});
  const [noteTextModal, setNoteTextModal] = useState<{ lectureId: string; noteId: string; title: string } | null>(null);
  const [noteTextContent, setNoteTextContent] = useState('');
  const [addNoteModeByLecture, setAddNoteModeByLecture] = useState<Record<string, string>>({});
  const [addNoteContentByLecture, setAddNoteContentByLecture] = useState<Record<string, string>>({});

  const fetchLookups = useCallback(async () => {
    const [f, d, s] = await Promise.all([
      fetch(`${API_BASE}/api/catalog/faculties`, { headers }),
      fetch(`${API_BASE}/api/catalog/directions`, { headers }),
      fetch(`${API_BASE}/api/catalog/streams`, { headers }),
    ]);
    if (f.ok) setFaculties(await f.json());
    if (d.ok) setDirections(await d.json());
    if (s.ok) setStreams(await s.json());
  }, [headers]);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/catalog/items?limit=500`, { headers });
      if (res.ok) {
        const data: CatalogItem[] = await res.json();
        setAllItems(data);
      }
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchLookups(); fetchCatalog(); }, [fetchLookups, fetchCatalog]);

  useEffect(() => {
    const filtered = allItems.filter(i =>
      (!facultyId || i.faculty_id === facultyId) &&
      (!directionId || i.direction_id === directionId) &&
      (!streamId || i.stream_id === streamId) &&
      (!courseText || normalizeCourse(i.course_text) === courseText) &&
      (!semesterText || normalizeSemester(i.semester_text) === semesterText) &&
      (!discipline || normalizeDiscipline(i.discipline) === discipline)
    );
    setItems(filtered);
  }, [allItems, facultyId, directionId, streamId, courseText, semesterText, discipline]);

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

  const folderEntries = useMemo(() => {
    if (!facultyId) return faculties.map(f => ({ type: 'faculty' as const, key: f.id, label: f.name, meta: f }));
    if (!directionId) return (directionsByFaculty[facultyId] || []).map(d => ({ type: 'direction' as const, key: d.id, label: d.name, meta: d }));
    if (!streamId) return (streamsByDirection[directionId] || []).map(s => ({ type: 'stream' as const, key: s.id, label: s.name, meta: s }));
    if (!courseText) {
      const set = new Set(allItems.filter(i => i.stream_id === streamId).map(i => normalizeCourse(i.course_text)));
      return Array.from(set).sort().map(c => ({ type: 'course' as const, key: c, label: c === NO_COURSE ? 'Курс не указан' : `Курс ${c}`, meta: c }));
    }
    if (!semesterText) return (['winter', 'spring'] as Semester[]).map(s => ({ type: 'semester' as const, key: s, label: semesterLabel(s), meta: s }));
    if (!discipline) {
      const set = new Set(
        allItems
          .filter(i =>
            i.stream_id === streamId &&
            normalizeCourse(i.course_text) === courseText &&
            normalizeSemester(i.semester_text) === semesterText
          )
          .map(i => normalizeDiscipline(i.discipline))
      );
      return Array.from(set).sort().map(d => ({ type: 'discipline' as const, key: d, label: d === NO_DISCIPLINE ? 'Дисциплина не указана' : d, meta: d }));
    }
    return [];
  }, [facultyId, directionId, streamId, courseText, semesterText, discipline, faculties, directionsByFaculty, streamsByDirection, allItems]);

  const setPath = (fId = '', dId = '', sId = '', cText = '', sem: Semester | '' = '', disc = '') => {
    setFacultyId(fId);
    setDirectionId(dId);
    setStreamId(sId);
    setCourseText(cText);
    setSemesterText(sem);
    setDiscipline(disc);
    setSelectedLecture(null);
  };

  const openLectureDetails = async (item: CatalogItem) => {
    setSelectedLecture(item);
    if (!notesByLecture[item.lecture_id]) {
      const nRes = await fetch(`${API_BASE}/api/lectures/${item.lecture_id}/notes`, { headers });
      if (nRes.ok) {
        const notes = await nRes.json();
        setNotesByLecture(prev => ({ ...prev, [item.lecture_id]: notes }));
      }
    }
    if (!lectureTextByLecture[item.lecture_id]) {
      const lRes = await fetch(`${API_BASE}/api/lectures/${item.lecture_id}`, { headers });
      if (lRes.ok) {
        const detail: LectureDetail = await lRes.json();
        const text = detail.transcriptions?.[0]?.processed_text || detail.transcriptions?.[0]?.raw_text || '';
        setLectureTextByLecture(prev => ({ ...prev, [item.lecture_id]: text }));
      }
    }
  };

  const saveNote = async (lectureId: string) => {
    const mode = addNoteModeByLecture[lectureId];
    const content = (addNoteContentByLecture[lectureId] || '').trim();
    if (!mode || !content) return;
    const res = await fetch(`${API_BASE}/api/lectures/${lectureId}/notes`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, content }),
    });
    if (!res.ok) return;
    const nRes = await fetch(`${API_BASE}/api/lectures/${lectureId}/notes`, { headers });
    if (nRes.ok) {
      const notes = await nRes.json();
      setNotesByLecture(prev => ({ ...prev, [lectureId]: notes }));
    }
    setAddNoteContentByLecture(prev => ({ ...prev, [lectureId]: '' }));
  };

  const openNoteText = async (lectureId: string, noteId: string, title: string) => {
    const res = await fetch(`${API_BASE}/api/lectures/${lectureId}/notes/${noteId}`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    setNoteTextContent(data.content || '');
    setNoteTextModal({ lectureId, noteId, title });
  };

  return (
    <div>
      <div className="text-center mb-8 px-4">
        <h1 className="text-3xl lg:text-4xl font-light mb-3 tracking-wide" style={{ color: headingColor }}>База лекций</h1>
        <p className="text-sm opacity-70" style={{ color: mutedColor }}>Проводник: факультет / направление / поток / курс / семестр / дисциплина / лекции.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4 mb-5">
        <div className="border rounded-xl p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
          <div className="text-xs mb-2" style={{ color: mutedColor }}>
            Путь: Каталог
            {facultyId ? ` / ${faculties.find(f => f.id === facultyId)?.name || ''}` : ''}
            {directionId ? ` / ${directions.find(d => d.id === directionId)?.name || ''}` : ''}
            {streamId ? ` / ${streams.find(s => s.id === streamId)?.name || ''}` : ''}
            {courseText ? ` / ${courseText === NO_COURSE ? 'Курс не указан' : `Курс ${courseText}`}` : ''}
            {semesterText ? ` / ${semesterLabel(semesterText)}` : ''}
            {discipline ? ` / ${discipline === NO_DISCIPLINE ? 'Дисциплина не указана' : discipline}` : ''}
          </div>
          <button onClick={() => setPath()} className="mb-2 px-2 py-1 rounded border text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>В корень</button>
          <div className="space-y-1 max-h-[64vh] overflow-y-auto">
            {folderEntries.map(entry => (
              <button
                key={entry.key}
                onClick={() => {
                  if (entry.type === 'faculty') setPath(entry.key);
                  if (entry.type === 'direction') setPath(facultyId, entry.key);
                  if (entry.type === 'stream') setPath(facultyId, directionId, entry.key);
                  if (entry.type === 'course') setPath(facultyId, directionId, streamId, entry.meta as string);
                  if (entry.type === 'semester') setPath(facultyId, directionId, streamId, courseText, entry.meta as Semester);
                  if (entry.type === 'discipline') setPath(facultyId, directionId, streamId, courseText, semesterText, entry.meta as string);
                }}
                className="w-full text-left px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                {entry.label}
              </button>
            ))}
            {folderEntries.length === 0 && <p className="text-xs px-2 py-2" style={{ color: mutedColor }}>Папки не найдены</p>}
          </div>
        </div>

        <div>
          {loading ? <p className="text-center py-8" style={{ color: mutedColor }}>Загрузка...</p> : items.length === 0 ? (
            <p className="text-center py-8" style={{ color: mutedColor }}>В этой папке пока пусто</p>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="rounded-xl" style={{ background: cardBg, border: cardBorder }}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-medium" style={{ color: headingColor }}>{item.lecture_title}</h3>
                        <p className="text-xs mt-1" style={{ color: mutedColor }}>
                          {item.faculty_name} · {item.direction_name} · {item.stream_name} · Курс: {item.course_text || '—'} · Семестр: {item.semester_text || '—'} · Год: {item.study_year_text || '—'}
                        </p>
                        <p className="text-xs mt-1" style={{ color: mutedColor }}>{item.discipline}{item.lecturer_name ? ` · ${item.lecturer_name}` : ''}</p>
                      </div>
                      <button onClick={() => openLectureDetails(item)} className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>Открыть</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedLecture && (
        <div className="border rounded-xl p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
          <h3 className="text-lg font-medium mb-2" style={{ color: headingColor }}>{selectedLecture.lecture_title}</h3>
          <p className="text-xs mb-3" style={{ color: mutedColor }}>Материалы лекции</p>

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => onOpenInEditor(lectureTextByLecture[selectedLecture.lecture_id] || '', selectedLecture.lecture_id)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
            >
              Открыть чистый текст в редакторе
            </button>
          </div>

          <div className="mb-3">
            <p className="text-xs mb-2" style={{ color: mutedColor }}>Готовые режимы</p>
            <div className="flex flex-wrap gap-2">
              {(notesByLecture[selectedLecture.lecture_id] || []).map(n => (
                <button key={n.id} onClick={() => openNoteText(selectedLecture.lecture_id, n.id, n.mode)} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                  {NOTE_MODES.find(m => m.id === n.mode)?.label || n.mode}
                </button>
              ))}
              {(notesByLecture[selectedLecture.lecture_id] || []).length === 0 && (
                <span className="text-xs" style={{ color: mutedColor }}>Пока нет добавленных режимов</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[240px,1fr,auto] gap-2">
            <select
              value={addNoteModeByLecture[selectedLecture.lecture_id] || ''}
              onChange={(e) => setAddNoteModeByLecture(prev => ({ ...prev, [selectedLecture.lecture_id]: e.target.value }))}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              <option value="">Выберите режим</option>
              {NOTE_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <input
              value={addNoteContentByLecture[selectedLecture.lecture_id] || ''}
              onChange={(e) => setAddNoteContentByLecture(prev => ({ ...prev, [selectedLecture.lecture_id]: e.target.value }))}
              placeholder="Вставьте готовый текст режима"
              className="px-3 py-2 rounded-lg border text-sm"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <button onClick={() => saveNote(selectedLecture.lecture_id)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>
              Добавить
            </button>
          </div>
        </div>
      )}

      {noteTextModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => setNoteTextModal(null)}>
          <div className="rounded-2xl p-5 w-full max-w-4xl" style={{ background: isLightTheme ? 'rgba(255,255,240,.98)' : 'rgba(33,24,25,.97)', border: cardBorder }} onClick={(e) => e.stopPropagation()}>
            <h4 className="text-base font-medium mb-2" style={{ color: headingColor }}>{noteTextModal.title}</h4>
            <div className="max-h-[60vh] overflow-y-auto text-sm whitespace-pre-wrap p-3 rounded-lg border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              {noteTextContent || 'Пусто'}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => onOpenInEditor(noteTextContent, noteTextModal.lectureId)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>
                Открыть в редакторе
              </button>
              <button onClick={() => setNoteTextModal(null)} className="px-3 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogSection;
