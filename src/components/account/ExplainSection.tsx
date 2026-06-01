import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { safeMdParse } from '../../utils/markdownUtils';
import { notifyQuotaChanged, quotaMessageFromResponse } from '../../utils/quota';
import QuotaBadge from './QuotaBadge';
import 'katex/dist/katex.min.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

type SourceType = 'my' | 'catalog';

interface MyLectureItem {
  id: string;
  title: string;
  subject: string | null;
  created_at: string;
  has_text: boolean;
  is_ai_filtered: boolean;
}

interface CatalogItem {
  id: string;
  lecture_id: string;
  lecture_title: string;
  lecture_subject: string | null;
  discipline: string;
  lecturer_name: string | null;
  stream_name: string;
  direction_name: string;
  faculty_name: string;
  created_at: string;
  is_ai_filtered: boolean;
}

interface NormalizedLectureItem {
  id: string;
  title: string;
  subject: string | null;
  createdAt: string;
  hasText: boolean;
  lecturer: string | null;
  stream: string | null;
  direction: string | null;
  faculty: string | null;
  source: SourceType;
}

interface ExplainSectionProps {
  isLightTheme: boolean;
}

const ExplainSection: React.FC<ExplainSectionProps> = ({ isLightTheme }) => {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [source, setSource] = useState<SourceType>('my');
  const [myLectures, setMyLectures] = useState<MyLectureItem[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'recent' | 'title' | 'relevance'>('recent');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterLecturer, setFilterLecturer] = useState('');
  const [filterStream, setFilterStream] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('');
  const [selectedLectureId, setSelectedLectureId] = useState<string | null>(null);
  const [selectedLectureTitle, setSelectedLectureTitle] = useState('');
  const [lectureText, setLectureText] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [question, setQuestion] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingText, setLoadingText] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState('');

  const textRef = useRef<HTMLDivElement | null>(null);
  const explanationRef = useRef<HTMLDivElement | null>(null);

  const headingColor = isLightTheme ? '#2a1918' : '#fff7ec';
  const mutedColor = isLightTheme ? '#7a5a5c' : '#c6b7a7';
  const panelBg = isLightTheme ? 'rgba(255,255,255,0.75)' : 'rgba(24,18,19,0.85)';
  const panelBorder = `1px solid ${isLightTheme ? 'rgba(68,41,43,0.16)' : 'rgba(255,247,236,0.12)'}`;

  const fetchMyLectures = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${API_BASE}/api/lectures/my`, { headers });
      if (!res.ok) throw new Error('Не удалось загрузить список лекций');
      const data = await res.json();
      setMyLectures(data || []);
    } catch (err: any) {
      setError(err?.message || 'Ошибка загрузки списка');
    } finally {
      setLoadingList(false);
    }
  }, [headers]);

  const fetchCatalogItems = useCallback(async () => {
    setLoadingList(true);
    try {
      const limit = 200;
      let offset = 0;
      let loaded: CatalogItem[] = [];
      while (true) {
        const res = await fetch(`${API_BASE}/api/catalog/items?limit=${limit}&offset=${offset}`, { headers });
        if (!res.ok) break;
        const chunk = await res.json();
        loaded = loaded.concat(chunk || []);
        if (!chunk || chunk.length < limit) break;
        offset += limit;
      }
      setCatalogItems(loaded);
    } catch (err: any) {
      setError(err?.message || 'Ошибка загрузки базы');
    } finally {
      setLoadingList(false);
    }
  }, [headers]);

  useEffect(() => {
    setError('');
    if (source === 'my') {
      fetchMyLectures();
    } else {
      fetchCatalogItems();
    }
  }, [source, fetchMyLectures, fetchCatalogItems]);

  useEffect(() => {
    if (source === 'my') {
      setFilterLecturer('');
      setFilterStream('');
      setFilterFaculty('');
    }
  }, [source]);

  useEffect(() => {
    if (!explanationRef.current || !explanation) return;
    import('katex/contrib/auto-render').then(({ default: renderMathInElement }) => {
      if (!explanationRef.current) return;
      renderMathInElement(explanationRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    });
  }, [explanation]);

  const handleSelectLecture = async (lectureId: string, title: string) => {
    setSelectedLectureId(lectureId);
    setSelectedLectureTitle(title);
    setLectureText('');
    setSelectedText('');
    setExplanation('');
    setError('');

    setLoadingText(true);
    try {
      const res = await fetch(`${API_BASE}/api/lectures/${lectureId}`, { headers });
      if (!res.ok) throw new Error('Не удалось загрузить текст лекции');
      const data = await res.json();
      const transcriptions = data?.transcriptions || [];
      if (!transcriptions.length) {
        setLectureText('Текст лекции не найден.');
        return;
      }
      const sorted = [...transcriptions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latest = sorted[0];
      const text = latest.processed_text || latest.raw_text || '';
      setLectureText(text || 'Текст лекции пуст.');
    } catch (err: any) {
      setError(err?.message || 'Ошибка загрузки текста');
    } finally {
      setLoadingText(false);
    }
  };

  const handleSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !textRef.current) return;

    const anchor = selection.anchorNode;
    const focus = selection.focusNode;
    if (anchor && !textRef.current.contains(anchor)) return;
    if (focus && !textRef.current.contains(focus)) return;

    const selected = selection.toString().trim();
    if (selected.length < 5) return;
    setSelectedText(selected);
  };

  const handleExplain = async () => {
    if (!selectedText.trim()) return;
    setExplaining(true);
    setExplanation('');
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/ml/explain`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: selectedText,
          lecture_title: selectedLectureTitle,
          question: question.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const quotaMsg = await quotaMessageFromResponse(res.clone());
        if (quotaMsg) throw new Error(quotaMsg);
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.detail || 'Не удалось получить объяснение');
      }
      notifyQuotaChanged();
      const data = await res.json();
      setExplanation(data?.explanation || '');
    } catch (err: any) {
      setError(err?.message || 'Ошибка запроса к ИИ');
    } finally {
      setExplaining(false);
    }
  };

  const normalizedItems = useMemo<NormalizedLectureItem[]>(() => {
    if (source === 'my') {
      return myLectures.map((item) => ({
        id: item.id,
        title: item.title,
        subject: item.subject,
        createdAt: item.created_at,
        hasText: item.has_text,
        lecturer: null,
        stream: null,
        direction: null,
        faculty: null,
        source: 'my',
      }));
    }
    return catalogItems.map((item) => ({
      id: item.lecture_id || item.id,
      title: item.lecture_title,
      subject: item.discipline || item.lecture_subject,
      createdAt: item.created_at,
      hasText: true,
      lecturer: item.lecturer_name,
      stream: item.stream_name,
      direction: item.direction_name,
      faculty: item.faculty_name,
      source: 'catalog',
    }));
  }, [source, myLectures, catalogItems]);

  const subjectOptions = useMemo(() => {
    const values = normalizedItems
      .map((item) => item.subject)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [normalizedItems]);

  const lecturerOptions = useMemo(() => {
    const values = normalizedItems
      .map((item) => item.lecturer)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [normalizedItems]);

  const streamOptions = useMemo(() => {
    const values = normalizedItems
      .map((item) => item.stream)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [normalizedItems]);

  const facultyOptions = useMemo(() => {
    const values = normalizedItems
      .map((item) => item.faculty)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [normalizedItems]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const tokens = query.split(/\s+/).filter(Boolean);
    const scoreFor = (text: string) => tokens.reduce((acc, token) => acc + (text.includes(token) ? 1 : 0), 0);

    const items = normalizedItems
      .filter((item) => (filterSubject ? item.subject === filterSubject : true))
      .filter((item) => (filterLecturer ? item.lecturer === filterLecturer : true))
      .filter((item) => (filterStream ? item.stream === filterStream : true))
      .filter((item) => (filterFaculty ? item.faculty === filterFaculty : true))
      .map((item) => {
        if (!query) return { ...item, score: 0 };
        const haystack = [
          item.title,
          item.subject || '',
          item.lecturer || '',
          item.stream || '',
          item.direction || '',
          item.faculty || '',
        ].join(' ').toLowerCase();
        if (!haystack.includes(query) && !tokens.every((token) => haystack.includes(token))) {
          return null;
        }
        const score =
          scoreFor(item.title.toLowerCase()) * 3 +
          scoreFor((item.subject || '').toLowerCase()) * 2 +
          scoreFor((item.lecturer || '').toLowerCase()) +
          scoreFor((item.stream || '').toLowerCase()) +
          scoreFor((item.faculty || '').toLowerCase());
        return { ...item, score };
      })
      .filter((item): item is NormalizedLectureItem & { score: number } => Boolean(item));

    const sorted = [...items].sort((a, b) => {
      if (sortMode === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortMode === 'relevance' && search.trim()) {
        if (b.score !== a.score) return b.score - a.score;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sorted;
  }, [normalizedItems, search, sortMode, filterSubject, filterLecturer, filterStream, filterFaculty]);

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold" style={{ color: headingColor }}>
            Разбор лекций
          </h2>
          <p className="mt-2 text-sm md:text-base" style={{ color: mutedColor }}>
            Выберите лекцию, выделите фрагмент и получите понятное объяснение от ИИ.
          </p>
        </div>
        <QuotaBadge kind="explain" />
      </div>

      <div className="rounded-2xl p-4 md:p-5 space-y-4" style={{ background: panelBg, border: panelBorder }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] rounded-xl px-3 py-2" style={{ background: 'var(--bg-secondary)' }}>
            <span className="material-symbols-outlined" style={{ color: mutedColor }}>search</span>
            <input
              className="w-full bg-transparent border-none outline-none text-sm"
              style={{ color: headingColor }}
              placeholder="Поиск: название, предмет, преподаватель, поток"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: source === 'my' ? 'var(--text-primary)' : 'var(--hover-bg)',
                color: source === 'my' ? 'var(--bg-primary)' : 'var(--text-secondary)',
              }}
              onClick={() => setSource('my')}
            >
              Мои лекции
            </button>
            <button
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: source === 'catalog' ? 'var(--text-primary)' : 'var(--hover-bg)',
                color: source === 'catalog' ? 'var(--bg-primary)' : 'var(--text-secondary)',
              }}
              onClick={() => setSource('catalog')}
            >
              База лекций
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
          <select
            className="rounded-xl px-3 py-2"
            style={{ background: 'var(--bg-secondary)', color: headingColor, border: '1px solid var(--border-color)' }}
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
          >
            <option value="">Все предметы</option>
            {subjectOptions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select
            className="rounded-xl px-3 py-2"
            style={{ background: 'var(--bg-secondary)', color: headingColor, border: '1px solid var(--border-color)' }}
            value={filterLecturer}
            onChange={(e) => setFilterLecturer(e.target.value)}
            disabled={source !== 'catalog'}
          >
            <option value="">Преподаватель</option>
            {lecturerOptions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select
            className="rounded-xl px-3 py-2"
            style={{ background: 'var(--bg-secondary)', color: headingColor, border: '1px solid var(--border-color)' }}
            value={filterStream}
            onChange={(e) => setFilterStream(e.target.value)}
            disabled={source !== 'catalog'}
          >
            <option value="">Поток</option>
            {streamOptions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select
            className="rounded-xl px-3 py-2"
            style={{ background: 'var(--bg-secondary)', color: headingColor, border: '1px solid var(--border-color)' }}
            value={filterFaculty}
            onChange={(e) => setFilterFaculty(e.target.value)}
            disabled={source !== 'catalog'}
          >
            <option value="">Факультет</option>
            {facultyOptions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select
            className="rounded-xl px-3 py-2"
            style={{ background: 'var(--bg-secondary)', color: headingColor, border: '1px solid var(--border-color)' }}
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as 'recent' | 'title' | 'relevance')}
          >
            <option value="recent">Сначала новые</option>
            <option value="title">По названию</option>
            <option value="relevance">По релевантности</option>
          </select>
        </div>

        <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
          {loadingList && (
            <div className="text-sm" style={{ color: mutedColor }}>Загрузка списка...</div>
          )}
          {!loadingList && filteredItems.length === 0 && (
            <div className="text-sm" style={{ color: mutedColor }}>Ничего не найдено.</div>
          )}
          {filteredItems.slice(0, 30).map((item) => {
            const meta = source === 'my'
              ? (item.hasText ? 'Есть текст' : 'Без текста')
              : [item.lecturer, item.stream, item.faculty].filter(Boolean).join(' • ');
            const isActive = selectedLectureId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectLecture(item.id, item.title)}
                className="w-full text-left p-3 rounded-xl transition-all"
                style={{
                  background: isActive ? 'var(--text-primary)' : 'var(--hover-bg)',
                  color: isActive ? 'var(--bg-primary)' : 'var(--text-primary)',
                }}
              >
                <div className="text-sm font-medium truncate">{item.title}</div>
                <div className="text-xs opacity-70 truncate">{item.subject || 'Без предмета'}</div>
                {meta && <div className="text-[11px] opacity-70 mt-1 truncate">{meta}</div>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl p-4 md:p-6" style={{ background: panelBg, border: panelBorder }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-wide" style={{ color: mutedColor }}>
                Текст лекции
              </div>
              <div className="text-sm font-medium" style={{ color: headingColor }}>
                {selectedLectureTitle || 'Сначала выберите лекцию'}
              </div>
            </div>
            {loadingText && (
              <div className="text-xs" style={{ color: mutedColor }}>Загрузка...</div>
            )}
          </div>

          <div
            ref={textRef}
            onMouseUp={handleSelection}
            className="rounded-xl p-4 text-sm leading-relaxed max-h-[460px] overflow-y-auto"
            style={{
              background: 'var(--bg-secondary)',
              color: isLightTheme ? '#3b2a2b' : '#f3e7d8',
              whiteSpace: 'pre-wrap',
            }}
          >
            {lectureText || 'Текст появится здесь после выбора лекции.'}
          </div>
        </div>

        <div className="rounded-2xl p-4 md:p-6" style={{ background: panelBg, border: panelBorder }}>
          <div className="text-xs uppercase tracking-wide mb-3" style={{ color: mutedColor }}>
            Чат с ИИ
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wide mb-2" style={{ color: mutedColor }}>
                Выбранный фрагмент
              </div>
              <textarea
                className="w-full rounded-xl p-3 text-sm outline-none"
                style={{
                  background: 'var(--bg-secondary)',
                  color: isLightTheme ? '#3b2a2b' : '#f3e7d8',
                  border: '1px solid var(--border-color)',
                  minHeight: '120px',
                }}
                placeholder="Выделите фрагмент в тексте слева или вставьте сюда вручную."
                value={selectedText}
                onChange={(e) => setSelectedText(e.target.value)}
              />
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide mb-2" style={{ color: mutedColor }}>
                Что именно объяснить?
              </div>
              <input
                className="w-full rounded-xl p-3 text-sm outline-none"
                style={{
                  background: 'var(--bg-secondary)',
                  color: isLightTheme ? '#3b2a2b' : '#f3e7d8',
                  border: '1px solid var(--border-color)',
                }}
                placeholder="Например: объясни смысл формулы или приведи простой пример"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExplain}
                disabled={explaining || !selectedText.trim()}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                style={{
                  background: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                }}
              >
                {explaining ? 'Объясняю...' : 'Объяснить фрагмент'}
              </button>
              <button
                onClick={() => setSelectedText('')}
                className="px-4 py-2 rounded-lg text-sm transition-all"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}
              >
                Очистить фрагмент
              </button>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: mutedColor }}>
                Ответ
              </div>
              {error && (
                <div className="text-sm mb-3" style={{ color: '#ef4444' }}>{error}</div>
              )}
              {!explanation && !error && (
                <div className="text-sm" style={{ color: mutedColor }}>
                  Здесь появится ответ ИИ после запроса.
                </div>
              )}
              {explanation && (
                <div
                  ref={explanationRef}
                  className="prose text-sm leading-relaxed"
                  style={{ color: isLightTheme ? '#4b2d2f' : '#f3e7d8', fontFamily: 'Georgia, serif' }}
                  dangerouslySetInnerHTML={{ __html: safeMdParse(explanation) }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExplainSection;
