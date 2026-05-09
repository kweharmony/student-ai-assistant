import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { safeMdParse } from '../../utils/markdownUtils';
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
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.detail || 'Не удалось получить объяснение');
      }
      const data = await res.json();
      setExplanation(data?.explanation || '');
    } catch (err: any) {
      setError(err?.message || 'Ошибка запроса к ИИ');
    } finally {
      setExplaining(false);
    }
  };

  const query = search.trim().toLowerCase();
  const filteredMyLectures = myLectures.filter((item) => {
    if (!query) return true;
    const title = item.title;
    const subject = item.subject;
    return `${title} ${subject || ''}`.toLowerCase().includes(query);
  });
  const filteredCatalogItems = catalogItems.filter((item) => {
    if (!query) return true;
    const title = item.lecture_title;
    const subject = item.discipline;
    return `${title} ${subject || ''}`.toLowerCase().includes(query);
  });
  const filtered = source === 'my' ? filteredMyLectures : filteredCatalogItems;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-semibold" style={{ color: headingColor }}>
          Разбор лекций
        </h2>
        <p className="mt-2 text-sm md:text-base" style={{ color: mutedColor }}>
          Выберите лекцию, выделите фрагмент и получите понятное объяснение от ИИ.
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
        <div className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined" style={{ color: mutedColor }}>search</span>
            <input
              className="w-full bg-transparent border-none outline-none text-sm"
              style={{ color: headingColor }}
              placeholder="Поиск по названию или предмету"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {loadingList && (
              <div className="text-sm" style={{ color: mutedColor }}>Загрузка списка...</div>
            )}
            {!loadingList && filtered.length === 0 && (
              <div className="text-sm" style={{ color: mutedColor }}>Ничего не найдено.</div>
            )}
            {filtered.map((item: any) => {
              const id = source === 'my' ? item.id : item.lecture_id;
              const title = source === 'my' ? item.title : item.lecture_title;
              const subject = source === 'my' ? item.subject : item.discipline;
              const meta = source === 'my'
                ? (item.has_text ? 'Есть текст' : 'Без текста')
                : `${item.stream_name}`;
              const isActive = selectedLectureId === id;
              return (
                <button
                  key={id}
                  onClick={() => handleSelectLecture(id, title)}
                  className="w-full text-left p-3 rounded-xl transition-all"
                  style={{
                    background: isActive ? 'var(--text-primary)' : 'var(--hover-bg)',
                    color: isActive ? 'var(--bg-primary)' : 'var(--text-primary)',
                  }}
                >
                  <div className="text-sm font-medium truncate">{title}</div>
                  <div className="text-xs opacity-70 truncate">{subject || 'Без предмета'}</div>
                  <div className="text-[11px] opacity-70 mt-1">{meta}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
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
              className="rounded-xl p-4 text-sm leading-relaxed max-h-[360px] overflow-y-auto"
              style={{
                background: 'var(--bg-secondary)',
                color: isLightTheme ? '#3b2a2b' : '#f3e7d8',
                whiteSpace: 'pre-wrap',
              }}
            >
              {lectureText || 'Текст появится здесь после выбора лекции.'}
            </div>

            <div className="mt-4">
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
                placeholder="Выделите фрагмент текста сверху или вставьте сюда вручную."
                value={selectedText}
                onChange={(e) => setSelectedText(e.target.value)}
              />
            </div>

            <div className="mt-4">
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

            <div className="mt-4 flex items-center gap-3">
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
          </div>

          <div className="rounded-2xl p-4 md:p-6" style={{ background: panelBg, border: panelBorder }}>
            <div className="text-xs uppercase tracking-wide mb-3" style={{ color: mutedColor }}>
              Объяснение
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
    </section>
  );
};

export default ExplainSection;
