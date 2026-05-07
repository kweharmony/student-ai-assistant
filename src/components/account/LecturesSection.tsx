import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { saveAs } from 'file-saver';
import htmlDocx from 'html-docx-js/dist/html-docx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { useAuth } from '../../contexts/AuthContext';
import 'katex/dist/katex.min.css';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mdParse = (require('marked') as { parse: (s: string) => string }).parse;
import { safeMdParse } from '../../utils/markdownUtils';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || {};

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NoteInfo {
  id: string;
  mode: string;
  created_at: string;
}

interface LectureItem {
  id: string;
  title: string;
  subject: string | null;
  status: string;
  created_at: string;
  task_status: string | null;
  catalog_stream_id?: string | null;
  has_text: boolean;
  is_ai_filtered: boolean;
  filtered_at?: string | null;
  audio_expires_at: string | null;
  notes: NoteInfo[];
}

interface MyLecturePublicationStatus {
  lecture_id: string;
  latest_request_status: 'pending' | 'approved' | 'rejected' | null;
  latest_request_review_comment: string | null;
}

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
}

interface CatalogSemesterItem {
  stream_id: string;
  course_text: string;
  semester_key: string;
}

interface CatalogDisciplineNodeItem {
  id: string;
  stream_id: string;
  course_text: string;
  semester_key: string;
  name: string;
}

type CatalogPublishMode = 'request' | 'direct';
type NoteExportFormat = 'txt' | 'md' | 'docx' | 'pdf';

const NOTE_EXPORT_FORMATS: { id: NoteExportFormat; label: string; icon: string }[] = [
  { id: 'txt', label: 'TXT', icon: 'description' },
  { id: 'md', label: 'MD', icon: 'markdown' },
  { id: 'docx', label: 'DOCX', icon: 'article' },
  { id: 'pdf', label: 'PDF', icon: 'picture_as_pdf' },
];

function audioExpiryInfo(expires_at: string | null): { daysLeft: number; expired: boolean } {
  if (!expires_at) return { daysLeft: 0, expired: true };
  const ms = new Date(expires_at).getTime() - Date.now();
  if (ms <= 0) return { daysLeft: 0, expired: true };
  return { daysLeft: Math.ceil(ms / (1000 * 60 * 60 * 24)), expired: false };
}

interface LecturesSectionProps {
  isLightTheme: boolean;
  onOpenInEditor: (text: string, lectureId: string, lectureTitle?: string) => void;
  onReTranscribe: (lectureId: string) => void;
}

// ─── ML mode metadata ────────────────────────────────────────────────────────

const ML_MODES: { id: string; label: string; icon: string; requiresTopic?: boolean }[] = [
  { id: 'summarize',         label: 'Краткий конспект',       icon: 'edit_note' },
  { id: 'detailed_notes',    label: 'Расширенный конспект',   icon: 'auto_stories' },
  { id: 'extract_terms',     label: 'Ключевые термины',       icon: 'menu_book' },
  { id: 'generate_questions',label: 'Вопросы для самопроверки', icon: 'help_outline' },
  { id: 'cheat_sheet',       label: 'Шпаргалка',              icon: 'description' },
  { id: 'expand_topic',      label: 'Расширение темы',        icon: 'search', requiresTopic: true },
];

function modeLabel(mode: string): string {
  return ML_MODES.find(m => m.id === mode)?.label ?? mode;
}
function modeIcon(mode: string): string {
  return ML_MODES.find(m => m.id === mode)?.icon ?? 'description';
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function getStatusBadge(lec: LectureItem): { label: string; color: string } {
  const ts = lec.task_status;
  if (ts === 'pending')    return { label: 'В очереди',       color: '#f59e0b' };
  if (ts === 'processing') return { label: 'Обрабатывается',  color: '#3b82f6' };
  if (ts === 'failed' || ts === 'error' || lec.status === 'error')
                           return { label: 'Ошибка',          color: '#ef4444' };
  if (lec.has_text)        return { label: lec.is_ai_filtered ? 'Отфильтрована' : 'Транскрибирована', color: '#22c55e' };
  return { label: 'В обработке', color: '#9ca3af' };
}

function isInProgress(lec: LectureItem) {
  return lec.task_status === 'pending' || lec.task_status === 'processing';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Tooltip с иконкой вопроса */
const FilterTooltip: React.FC<{ isLightTheme: boolean }> = ({ isLightTheme }) => {
  const [show, setShow] = useState(false);
  const mutedColor = isLightTheme ? '#7a5a5c' : '#c6b7a7';
  return (
    <span
      className="relative inline-flex items-center cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="material-symbols-outlined text-sm" style={{ color: mutedColor, fontSize: 16 }}>help</span>
      {show && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg px-3 py-2 text-xs z-50 pointer-events-none"
          style={{
            background: isLightTheme ? '#fff9f1' : '#1f1516',
            border: `1px solid ${isLightTheme ? 'rgba(68,41,43,0.15)' : 'rgba(255,255,240,0.12)'}`,
            color: isLightTheme ? '#44292b' : '#f0e6d8',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}
        >
          ИИ-фильтрация исправляет ошибки распознавания речи, удаляет слова-паразиты и форматирует текст.
        </span>
      )}
    </span>
  );
};

/** Модальное окно для просмотра текста лекции */
const TextModal: React.FC<{
  lecture: LectureItem;
  isLightTheme: boolean;
  onClose: () => void;
  onOpenInEditor: (text: string) => void;
  authHeaders: () => Record<string, string>;
}> = ({ lecture, isLightTheme, onClose, onOpenInEditor, authHeaders }) => {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const textContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/lectures/${lecture.id}`, { headers: authHeaders() });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const tr = data.transcriptions?.[0];
        setText(tr?.processed_text || tr?.raw_text || '');
      } catch {
        setText('Не удалось загрузить текст.');
      } finally {
        setLoading(false);
      }
    })();
  }, [lecture.id, authHeaders]);

  useEffect(() => {
    if (loading || !textContainerRef.current) return;
    import('katex/contrib/auto-render').then(({ default: renderMathInElement }) => {
      if (!textContainerRef.current) return;
      renderMathInElement(textContainerRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    });
  }, [loading, text]);

  const headingColor = isLightTheme ? '#2a1918' : '#fff7ec';
  const mutedColor   = isLightTheme ? '#7a5a5c' : '#c6b7a7';
  const surface = isLightTheme
    ? 'linear-gradient(145deg,rgba(255,255,240,.98),rgba(248,235,220,.96))'
    : 'linear-gradient(145deg,rgba(33,24,25,.97),rgba(18,12,14,.92))';
  const border = isLightTheme ? '1px solid rgba(68,41,43,.12)' : '1px solid rgba(255,255,240,.08)';
  const btnBg  = isLightTheme ? 'rgba(68,41,43,.08)' : 'rgba(255,255,240,.06)';
  const btnColor = isLightTheme ? '#44292b' : '#f0e6d8';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div
        className="rounded-2xl flex flex-col w-full max-w-2xl max-h-[85vh]"
        style={{ background: surface, border, boxShadow: '0 40px 140px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b shrink-0" style={{ borderColor: isLightTheme ? 'rgba(68,41,43,.1)' : 'rgba(255,255,240,.08)' }}>
          <div>
            <p className="text-xs mb-0.5" style={{ color: mutedColor }}>Текст лекции</p>
            <h2 className="text-base font-medium" style={{ color: headingColor }}>{lecture.title}</h2>
          </div>
          <button onClick={onClose} className="ml-4 shrink-0" style={{ color: mutedColor }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Open in editor button */}
        <div className="px-5 pt-4 shrink-0">
          <button
            onClick={() => text && onOpenInEditor(text)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{ background: btnBg, color: btnColor }}
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            Открыть в редакторе
          </button>
        </div>

        {/* Text content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" style={{ color: mutedColor }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : (
            <div
              ref={textContainerRef}
              className="prose-modal text-sm leading-relaxed"
              style={{ color: isLightTheme ? '#4b2d2f' : '#f3e7d8', fontFamily: 'Georgia, serif' }}
              dangerouslySetInnerHTML={{ __html: safeMdParse(text ?? '') }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/** Модальное окно для просмотра заметки (конспект, термины и т.д.) */
const NoteModal: React.FC<{
  noteInfo: NoteInfo;
  lecture: LectureItem;
  isLightTheme: boolean;
  onClose: () => void;
  onDeleted: (noteId: string) => void;
  onRegenerate: (mode: string) => void;
  onOpenInEditor: (text: string) => void;
  authHeaders: () => Record<string, string>;
}> = ({ noteInfo, lecture, isLightTheme, onClose, onDeleted, onRegenerate, onOpenInEditor, authHeaders }) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const contentContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/lectures/${lecture.id}/notes/${noteInfo.id}`, { headers: authHeaders() });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setContent(data.content);
      } catch {
        setContent('Не удалось загрузить заметку.');
      } finally {
        setLoading(false);
      }
    })();
  }, [noteInfo.id, lecture.id, authHeaders]);

  useEffect(() => {
    if (loading || !contentContainerRef.current) return;
    import('katex/contrib/auto-render').then(({ default: renderMathInElement }) => {
      if (!contentContainerRef.current) return;
      renderMathInElement(contentContainerRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    });
  }, [loading, content]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`${API_BASE}/api/lectures/${lecture.id}/notes/${noteInfo.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      onDeleted(noteInfo.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const headingColor = isLightTheme ? '#2a1918' : '#fff7ec';
  const mutedColor   = isLightTheme ? '#7a5a5c' : '#c6b7a7';
  const surface = isLightTheme
    ? 'linear-gradient(145deg,rgba(255,255,240,.98),rgba(248,235,220,.96))'
    : 'linear-gradient(145deg,rgba(33,24,25,.97),rgba(18,12,14,.92))';
  const border = isLightTheme ? '1px solid rgba(68,41,43,.12)' : '1px solid rgba(255,255,240,.08)';
  const btnBg  = isLightTheme ? 'rgba(68,41,43,.08)' : 'rgba(255,255,240,.06)';
  const btnColor = isLightTheme ? '#44292b' : '#f0e6d8';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div
        className="rounded-2xl flex flex-col w-full max-w-2xl max-h-[85vh]"
        style={{ background: surface, border, boxShadow: '0 40px 140px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b shrink-0" style={{ borderColor: isLightTheme ? 'rgba(68,41,43,.1)' : 'rgba(255,255,240,.08)' }}>
          <div>
            <p className="text-xs mb-0.5" style={{ color: mutedColor }}>{lecture.title}</p>
            <h2 className="text-base font-medium flex items-center gap-2" style={{ color: headingColor }}>
              <span className="material-symbols-outlined text-base">{modeIcon(noteInfo.mode)}</span>
              {modeLabel(noteInfo.mode)}
            </h2>
          </div>
          <button onClick={onClose} className="ml-4 shrink-0" style={{ color: mutedColor }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 px-5 pt-4 shrink-0">
          <button
            onClick={() => content && onOpenInEditor(content)}
            disabled={!content}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
            style={{ background: btnBg, color: btnColor }}
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            Открыть в редакторе
          </button>
          <button
            onClick={() => { onClose(); onRegenerate(noteInfo.mode); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
            style={{ background: btnBg, color: btnColor }}
          >
            <span className="material-symbols-outlined text-base">replay</span>
            Перегенерировать
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ml-auto"
            style={{ background: 'rgba(239,68,68,.1)', color: '#ef4444' }}
          >
            <span className="material-symbols-outlined text-base">delete</span>
            Удалить
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" style={{ color: mutedColor }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : (
            <div
              ref={contentContainerRef}
              className="prose-modal text-sm leading-relaxed"
              style={{ color: isLightTheme ? '#4b2d2f' : '#f3e7d8', fontFamily: 'Georgia, serif' }}
              dangerouslySetInnerHTML={{ __html: safeMdParse(content ?? '') }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const LecturesSection: React.FC<LecturesSectionProps> = ({ isLightTheme, onOpenInEditor, onReTranscribe }) => {
  const { token, user } = useAuth();
  const [lectures, setLectures] = useState<LectureItem[]>([]);
  const [publicationStatuses, setPublicationStatuses] = useState<Record<string, MyLecturePublicationStatus>>({});
  const [loading, setLoading] = useState(true);

  // Modal state
  const [textModalLecture, setTextModalLecture]     = useState<LectureItem | null>(null);
  const [noteModal, setNoteModal]                   = useState<{ note: NoteInfo; lecture: LectureItem } | null>(null);
  const [noteActionMenu, setNoteActionMenu]         = useState<{ note: NoteInfo; lecture: LectureItem; content: string; x: number; y: number } | null>(null);
  const [noteExportMenuOpen, setNoteExportMenuOpen] = useState(false);
  const [noteDownloadFormat, setNoteDownloadFormat] = useState<NoteExportFormat | null>(null);
  const noteActionMenuRef = useRef<HTMLDivElement>(null);
  const [noteRegenerateWarning, setNoteRegenerateWarning] = useState<{ lecture: LectureItem; note: NoteInfo; anchorEl: HTMLElement } | null>(null);

  // Per-card actions loading state
  const [filteringId,     setFilteringId]           = useState<string | null>(null);
  const [reTranscribingId, setReTranscribingId]     = useState<string | null>(null);
  const [reUploadingId,    setReUploadingId]         = useState<string | null>(null);
  const [reUploadTarget,   setReUploadTarget]        = useState<string | null>(null);
  const reUploadInputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId]       = useState<string | null>(null);

  // Add-note dropdown
  const [addNoteDropdown, setAddNoteDropdown]       = useState<string | null>(null); // lectureId
  const [generatingNote, setGeneratingNote]         = useState<{ lectureId: string; mode: string } | null>(null);
  const [topicInput, setTopicInput]                 = useState('');
  const [pendingTopicMode, setPendingTopicMode]     = useState<{ lectureId: string; mode: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [openCatalogDropdown, setOpenCatalogDropdown] = useState<string | null>(null);
  const [suggestModalLecture, setSuggestModalLecture] = useState<LectureItem | null>(null);
  const [catalogPublishMode, setCatalogPublishMode] = useState<CatalogPublishMode>('request');
  const [faculties, setFaculties] = useState<LookupItem[]>([]);
  const [directions, setDirections] = useState<DirectionItem[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [catalogSemesters, setCatalogSemesters] = useState<CatalogSemesterItem[]>([]);
  const [catalogDisciplineNodes, setCatalogDisciplineNodes] = useState<CatalogDisciplineNodeItem[]>([]);
  const [suggestData, setSuggestData] = useState({
    faculty_id: '',
    direction_id: '',
    stream_id: '',
    discipline: '',
    lecturer_name: '',
    course_text: '',
    semester_text: '',
    lecture_number_text: '',
    study_year_text: '',
    comment: '',
  });

  const canDirectPublish = user?.role === 'admin' || user?.is_group_head;
  const allowedStreams = useMemo(() => {
    if (user?.role === 'admin') return streams;
    if (user?.is_group_head && user?.stream_id) return streams.filter((s) => s.id === user.stream_id);
    return streams;
  }, [streams, user]);

  const resetSuggestData = useCallback(() => {
    setSuggestData({
      faculty_id: '',
      direction_id: '',
      stream_id: '',
      discipline: '',
      lecturer_name: '',
      course_text: '',
      semester_text: '',
      lecture_number_text: '',
      study_year_text: '',
      comment: '',
    });
  }, []);

  const openCatalogModal = useCallback((lecture: LectureItem, mode: CatalogPublishMode) => {
    const defaultDiscipline = (lecture.subject || lecture.title || '').trim();
    let streamId = '';
    let directionId = '';
    let facultyId = '';

    if (user?.is_group_head && user.stream_id) {
      const ownStream = streams.find((s) => s.id === user.stream_id);
      if (ownStream) {
        streamId = ownStream.id;
        directionId = ownStream.direction_id;
        const ownDirection = directions.find((d) => d.id === ownStream.direction_id);
        if (ownDirection) {
          facultyId = ownDirection.faculty_id;
        }
      }
    }

    setCatalogPublishMode(mode);
    setSuggestModalLecture(lecture);
    setSuggestData({
      faculty_id: facultyId,
      direction_id: directionId,
      stream_id: streamId,
      discipline: defaultDiscipline,
      lecturer_name: '',
      course_text: '',
      semester_text: '',
      lecture_number_text: '',
      study_year_text: '',
      comment: '',
    });
  }, [directions, streams, user]);

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }, [token]);

  const exportNoteContent = useCallback(async (content: string, title: string, format: NoteExportFormat) => {
    const safeTitle = title.replace(/[<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim() || 'note';
    const filenameBase = `${safeTitle}`;

    if (format === 'txt') {
      const text = mdParse(content).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      saveAs(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${filenameBase}.txt`);
      return;
    }

    if (format === 'md') {
      saveAs(new Blob([content], { type: 'text/markdown;charset=utf-8' }), `${filenameBase}.md`);
      return;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title></head><body>${mdParse(content)}</body></html>`;

    if (format === 'docx') {
      saveAs(htmlDocx.asBlob(html), `${filenameBase}.docx`);
      return;
    }

    const container = document.createElement('div');
    container.innerHTML = mdParse(content);
    const plainText = (container.textContent || '').replace(/\s+/g, ' ').trim();
    pdfMake.createPdf({
      content: [{ text: plainText || safeTitle, fontSize: 12, lineHeight: 1.5 }],
      defaultStyle: { font: 'Roboto' },
    }).download(`${filenameBase}.pdf`);
  }, []);

  const openNoteActionMenu = useCallback(async (note: NoteInfo, lecture: LectureItem, anchorEl: HTMLElement) => {
    const res = await fetch(`${API_BASE}/api/lectures/${lecture.id}/notes/${note.id}`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const rect = anchorEl.getBoundingClientRect();
    const popupWidth = 280;
    const popupHeight = 232;
    const x = Math.max(12, Math.min(rect.left, window.innerWidth - popupWidth - 12));
    const fitsBelow = rect.bottom + popupHeight + 12 <= window.innerHeight;
    const fitsAbove = rect.top - popupHeight - 12 >= 12;
    const y = fitsBelow ? rect.bottom + 10 : fitsAbove ? rect.top - popupHeight - 10 : Math.max(12, window.innerHeight - popupHeight - 12);
    setNoteExportMenuOpen(false);
    setNoteDownloadFormat(null);
    setNoteActionMenu({ note, lecture, content: data.content || '', x, y });
  }, [authHeaders]);

  const closeNoteActionMenu = useCallback(() => {
    setNoteActionMenu(null);
    setNoteExportMenuOpen(false);
    setNoteDownloadFormat(null);
  }, []);

  const fetchLectures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/lectures/my`, { headers: authHeaders() });
      if (!res.ok) return;
      setLectures(await res.json());
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const fetchPublicationStatuses = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/catalog/my-lecture-statuses`, { headers: authHeaders() });
      if (!res.ok) return;
      const list: MyLecturePublicationStatus[] = await res.json();
      const map: Record<string, MyLecturePublicationStatus> = {};
      list.forEach((row) => { map[row.lecture_id] = row; });
      setPublicationStatuses(map);
    } catch {
      // ignore status fetch errors
    }
  }, [authHeaders]);

  const fetchCatalogLookups = useCallback(async () => {
    try {
      const [fRes, dRes, sRes, semRes, discRes] = await Promise.all([
        fetch(`${API_BASE}/api/catalog/faculties`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/catalog/directions`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/catalog/streams`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/catalog/semesters`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/catalog/discipline-nodes`, { headers: authHeaders() }),
      ]);
      if (fRes.ok) setFaculties(await fRes.json());
      if (dRes.ok) setDirections(await dRes.json());
      if (sRes.ok) setStreams(await sRes.json());
      if (semRes.ok) setCatalogSemesters(await semRes.json());
      if (discRes.ok) setCatalogDisciplineNodes(await discRes.json());
    } catch {
      // ignore lookup load errors
    }
  }, [authHeaders]);

  useEffect(() => { fetchLectures(); }, [fetchLectures]);
  useEffect(() => {
    fetchPublicationStatuses();
    fetchCatalogLookups();
  }, [fetchPublicationStatuses, fetchCatalogLookups]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (addNoteDropdown && dropdownRef.current && !dropdownRef.current.contains(target)) {
        setAddNoteDropdown(null);
      }
      if (openCatalogDropdown && !target.closest('[data-catalog-dropdown]')) {
        setOpenCatalogDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addNoteDropdown, openCatalogDropdown]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleApplyFilter = async (lecture: LectureItem) => {
    setFilteringId(lecture.id);
    try {
      const res = await fetch(`${API_BASE}/api/lectures/${lecture.id}/apply-filter`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Ошибка фильтрации');
      }
      setLectures(prev => prev.map(l =>
        l.id === lecture.id ? { ...l, is_ai_filtered: true } : l
      ));
    } catch (e: any) {
      alert(`Ошибка: ${e.message}`);
    } finally {
      setFilteringId(null);
    }
  };

  const handleReTranscribe = async (lecture: LectureItem) => {
    setReTranscribingId(lecture.id);
    try {
      const res = await fetch(`${API_BASE}/api/lectures/${lecture.id}/re-transcribe`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Ошибка');
      }
      await fetchLectures();
      onReTranscribe(lecture.id);
    } catch (e: any) {
      alert(`Ошибка: ${e.message}`);
    } finally {
      setReTranscribingId(null);
    }
  };

  const handleReUploadClick = (lectureId: string) => {
    setReUploadTarget(lectureId);
    reUploadInputRef.current?.click();
  };

  const handleReUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !reUploadTarget) return;
    const lectureId = reUploadTarget;
    setReUploadTarget(null);
    setReUploadingId(lectureId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/api/lectures/${lectureId}/audio`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Ошибка загрузки файла');
      }
      await fetchLectures();
    } catch (e: any) {
      alert(`Ошибка: ${e.message}`);
    } finally {
      setReUploadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/lectures/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      setLectures(prev => prev.filter(l => l.id !== id));
    } catch (e: any) {
      alert(`Ошибка: ${e.message}`);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleGenerateNote = async (lectureId: string, mode: string, topic?: string) => {
    setAddNoteDropdown(null);
    setPendingTopicMode(null);
    setGeneratingNote({ lectureId, mode });
    try {
      // 1. Fetch lecture text
      const lectureRes = await fetch(`${API_BASE}/api/lectures/${lectureId}`, { headers: authHeaders() });
      if (!lectureRes.ok) throw new Error('Не удалось загрузить текст лекции');
      const lectureData = await lectureRes.json();
      const tr = lectureData.transcriptions?.[0];
      const text = tr?.processed_text || tr?.raw_text || '';
      if (!text) throw new Error('Текст лекции пуст');

      // 2. Call ML API
      const mlHeaders = { ...authHeaders(), 'Content-Type': 'application/json' };
      const mlRes = await fetch(`${API_BASE}/api/ml/process`, {
        method: 'POST',
        headers: mlHeaders,
        body: JSON.stringify({ text, mode, topic }),
      });
      if (!mlRes.ok) {
        const err = await mlRes.json().catch(() => ({}));
        throw new Error(err.detail || 'Ошибка генерации');
      }
      const mlData = await mlRes.json();
      const content: string = mlData.processed_text;

      // 3. Save note
      const saveRes = await fetch(`${API_BASE}/api/lectures/${lectureId}/notes`, {
        method: 'POST',
        headers: mlHeaders,
        body: JSON.stringify({ mode, content }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        throw new Error(
          err.detail ||
          err.message ||
          (saveRes.status ? `Не удалось сохранить заметку (HTTP ${saveRes.status})` : 'Не удалось сохранить заметку')
        );
      }
      const savedNote: NoteInfo = await saveRes.json();

      setLectures(prev => prev.map(l =>
        l.id === lectureId
          ? { ...l, notes: [...l.notes.filter(n => n.mode !== mode), savedNote] }
          : l
      ));
    } catch (e: any) {
      alert(`Ошибка: ${e.message}`);
    } finally {
      setGeneratingNote(null);
      setTopicInput('');
    }
  };

  const handleRequestNoteRegeneration = async (lecture: LectureItem, note: NoteInfo) => {
    if (!lecture.catalog_stream_id) {
      alert('Эта лекция пока не добавлена в базу, поэтому заявку на перегенерацию отправить нельзя.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/catalog/material-requests`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecture_id: lecture.id,
          stream_id: lecture.catalog_stream_id,
          mode: note.mode,
          regenerate: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Не удалось отправить заявку');
      }
      setNoteRegenerateWarning(null);
      alert('Заявка на перегенерацию отправлена модератору.');
    } catch (e: any) {
      alert(e.message || 'Не удалось отправить заявку');
    }
  };

  const handleNoteDeleted = (lectureId: string, noteId: string) => {
    setLectures(prev => prev.map(l =>
      l.id === lectureId ? { ...l, notes: l.notes.filter(n => n.id !== noteId) } : l
    ));
  };

  const allowedDirectionIds = useMemo(() => new Set(allowedStreams.map((s) => s.direction_id)), [allowedStreams]);
  const allowedDirections = useMemo(() => directions.filter((d) => allowedDirectionIds.has(d.id)), [directions, allowedDirectionIds]);
  const allowedFacultyIds = useMemo(() => new Set(allowedDirections.map((d) => d.faculty_id)), [allowedDirections]);
  const allowedFaculties = useMemo(() => faculties.filter((f) => allowedFacultyIds.has(f.id)), [faculties, allowedFacultyIds]);

  const coursesByStream = useMemo(() => {
    const map: Record<string, string[]> = {};
    catalogSemesters.forEach((row) => {
      const course = (row.course_text || '').trim();
      if (!course) return;
      if (!map[row.stream_id]) map[row.stream_id] = [];
      if (!map[row.stream_id].includes(course)) map[row.stream_id].push(course);
    });
    Object.keys(map).forEach((key) => map[key].sort((a, b) => a.localeCompare(b, 'ru')));
    return map;
  }, [catalogSemesters]);

  const semestersByStreamCourse = useMemo(() => {
    const map: Record<string, string[]> = {};
    catalogSemesters.forEach((row) => {
      const course = (row.course_text || '').trim();
      const semester = (row.semester_key || '').trim();
      if (!course || !semester) return;
      const key = `${row.stream_id}|${course}`;
      if (!map[key]) map[key] = [];
      if (!map[key].includes(semester)) map[key].push(semester);
    });
    Object.keys(map).forEach((key) => map[key].sort((a, b) => a.localeCompare(b, 'ru')));
    return map;
  }, [catalogSemesters]);

  const disciplinesByStreamCourseSemester = useMemo(() => {
    const map: Record<string, string[]> = {};
    catalogDisciplineNodes.forEach((row) => {
      const course = (row.course_text || '').trim();
      const semester = (row.semester_key || '').trim();
      const name = (row.name || '').trim();
      if (!course || !semester || !name) return;
      const key = `${row.stream_id}|${course}|${semester}`;
      if (!map[key]) map[key] = [];
      if (!map[key].includes(name)) map[key].push(name);
    });
    Object.keys(map).forEach((key) => map[key].sort((a, b) => a.localeCompare(b, 'ru')));
    return map;
  }, [catalogDisciplineNodes]);

  const modalFacultyOptions = user?.role === 'admin' ? faculties : allowedFaculties;
  const modalDirectionOptions = (user?.role === 'admin' ? directions : allowedDirections)
    .filter((d) => !suggestData.faculty_id || d.faculty_id === suggestData.faculty_id);
  const modalStreamOptions = allowedStreams
    .filter((s) => !suggestData.direction_id || s.direction_id === suggestData.direction_id);
  const modalCourseOptions = coursesByStream[suggestData.stream_id] || [];
  const modalSemesterOptions = semestersByStreamCourse[`${suggestData.stream_id}|${suggestData.course_text}`] || [];
  const modalDisciplineOptions = disciplinesByStreamCourseSemester[`${suggestData.stream_id}|${suggestData.course_text}|${suggestData.semester_text}`] || [];

  useEffect(() => {
    if (suggestData.course_text && !modalCourseOptions.includes(suggestData.course_text)) {
      setSuggestData(prev => ({ ...prev, course_text: '', semester_text: '', discipline: '' }));
      return;
    }
    if (suggestData.semester_text && !modalSemesterOptions.includes(suggestData.semester_text)) {
      setSuggestData(prev => ({ ...prev, semester_text: '', discipline: '' }));
      return;
    }
    if (suggestData.discipline && !modalDisciplineOptions.includes(suggestData.discipline)) {
      setSuggestData(prev => ({ ...prev, discipline: '' }));
    }
  }, [modalCourseOptions, modalSemesterOptions, modalDisciplineOptions, suggestData.course_text, suggestData.semester_text, suggestData.discipline]);

  const submitCatalogAction = useCallback(async () => {
    if (!suggestModalLecture) return;
    if (!suggestData.stream_id) {
      alert('Выберите поток.');
      return;
    }
    if (!suggestData.course_text) {
      alert('Выберите курс.');
      return;
    }
    if (!suggestData.semester_text) {
      alert('Выберите семестр.');
      return;
    }
    if (!suggestData.discipline) {
      alert('Выберите дисциплину.');
      return;
    }

    if (catalogPublishMode === 'request') {
      const res = await fetch(`${API_BASE}/api/catalog/requests`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecture_id: suggestModalLecture.id,
          stream_id: suggestData.stream_id,
          discipline: suggestData.discipline,
          course_text: suggestData.course_text,
          semester_text: suggestData.semester_text,
          lecture_number_text: suggestData.lecture_number_text.trim() || null,
          study_year_text: suggestData.study_year_text.trim() || null,
          comment: suggestData.comment.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Не удалось отправить заявку');
        return;
      }
    } else {
      const res = await fetch(`${API_BASE}/api/catalog/publish`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecture_id: suggestModalLecture.id,
          stream_id: suggestData.stream_id,
          discipline: suggestData.discipline,
          lecturer_name: suggestData.lecturer_name.trim() || null,
          course_text: suggestData.course_text,
          semester_text: suggestData.semester_text,
          lecture_number_text: suggestData.lecture_number_text.trim() || null,
          study_year_text: suggestData.study_year_text.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Не удалось добавить лекцию в базу');
        return;
      }

      window.dispatchEvent(new Event('catalog:refresh'));
    }

    setSuggestModalLecture(null);
    resetSuggestData();
    fetchPublicationStatuses();
  }, [
    authHeaders,
    catalogPublishMode,
    fetchPublicationStatuses,
    resetSuggestData,
    suggestData,
    suggestModalLecture,
  ]);

  // ── Theme helpers ──────────────────────────────────────────────────────────

  const headingColor = isLightTheme ? '#2a1918' : '#fff7ec';
  const mutedColor   = isLightTheme ? '#7a5a5c' : '#c6b7a7';
  const cardBg       = isLightTheme ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.04)';
  const cardBorder   = isLightTheme ? '1px solid rgba(68,41,43,.12)' : '1px solid rgba(255,255,240,.08)';
  const dividerColor = isLightTheme ? 'rgba(68,41,43,.1)' : 'rgba(255,255,240,.07)';
  const btnBg        = isLightTheme ? 'rgba(68,41,43,.08)' : 'rgba(255,255,240,.06)';
  const btnColor     = isLightTheme ? '#44292b' : '#f0e6d8';
  const dropdownBg   = isLightTheme ? '#fff9f1' : '#1f1516';

  const CatalogSelect: React.FC<{
    id: string;
    value: string;
    options: { value: string; label: string }[];
    placeholder: string;
    disabled?: boolean;
    onChange: (value: string) => void;
  }> = ({ id, value, options, placeholder, disabled, onChange }) => {
    const isOpen = openCatalogDropdown === id;
    const selected = options.find(option => option.value === value);
    return (
      <div data-catalog-dropdown className="relative">
        <button
          type="button"
          onClick={() => setOpenCatalogDropdown(prev => (prev === id ? null : id))}
          className="w-full px-3 py-2 rounded-lg border text-sm text-left flex items-center justify-between gap-2"
          style={{ background: btnBg, color: headingColor, border: cardBorder, opacity: disabled ? 0.6 : 1 }}
          disabled={disabled}
        >
          <span className="truncate">{selected?.label || placeholder}</span>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: mutedColor }}>
            {isOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>
        {isOpen && !disabled && (
          <div
            className="absolute z-50 mt-2 w-full rounded-xl border overflow-hidden"
            style={{ background: dropdownBg, border: cardBorder, boxShadow: '0 16px 48px rgba(0,0,0,0.35)' }}
          >
            <div className="max-h-56 overflow-y-auto">
              {options.length === 0 ? (
                <div className="px-3 py-2 text-xs" style={{ color: mutedColor }}>
                  Нет доступных вариантов
                </div>
              ) : options.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpenCatalogDropdown(null);
                  }}
                  className="w-full text-left px-3 py-2 text-sm transition-all"
                  style={{ color: headingColor, background: option.value === value ? btnBg : 'transparent' }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8 px-4">
        <h1 className="text-3xl lg:text-4xl font-light mb-3 tracking-wide" style={{ color: headingColor }}>
          Лекции
        </h1>
      </div>

      <div className="flex justify-end mb-4">
        <button
          onClick={fetchLectures}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all"
          style={{ background: btnBg, color: btnColor }}
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" style={{ color: mutedColor }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      ) : lectures.length === 0 ? (
        <div className="text-center py-16" style={{ color: mutedColor }}>
          <span className="material-symbols-outlined text-5xl mb-4 block">library_books</span>
          <>
            <p>У вас ещё нет загруженных лекций.</p>
            <p className="text-sm mt-1">Перейдите в раздел «Транскрибатор», чтобы загрузить первую.</p>
          </>
        </div>
      ) : (
        <div className="space-y-4">
          {lectures.map(lecture => {
            const { label: statusLabel, color: statusColor } = getStatusBadge(lecture);
            const inProgress      = isInProgress(lecture);
            const isFiltering     = filteringId === lecture.id;
            const isReTranscribing = reTranscribingId === lecture.id;
            const isGenerating    = generatingNote?.lectureId === lecture.id;
            const existingModes   = new Set(lecture.notes.map(n => n.mode));
            const availableModes  = ML_MODES.filter(m => !existingModes.has(m.id));
            const showAddDropdown = addNoteDropdown === lecture.id;
            const pub = publicationStatuses[lecture.id];
            const inCatalog = Boolean(lecture.catalog_stream_id);
            const hasPendingRequest = !inCatalog && pub?.latest_request_status === 'pending';
            const effectiveStatus = inCatalog
              ? 'approved'
              : (pub?.latest_request_status === 'approved' ? null : pub?.latest_request_status ?? null);
            const pubColor =
              effectiveStatus === 'approved' ? '#22c55e'
                : effectiveStatus === 'rejected' ? '#ef4444'
                : effectiveStatus === 'pending' ? '#f59e0b'
                : null;
            const pubLabel =
              effectiveStatus === 'approved' ? 'Одобрено в базе'
                : effectiveStatus === 'rejected' ? 'Отклонено'
                : effectiveStatus === 'pending' ? 'На модерации'
                : null;

            return (
              <div key={lecture.id} className="rounded-xl transition-all duration-200" style={{ background: cardBg, border: cardBorder }}>

                {/* ── Card header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-5">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium truncate" style={{ color: headingColor }}>
                      {lecture.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {lecture.subject && <span className="text-sm" style={{ color: mutedColor }}>{lecture.subject}</span>}
                      <span className="text-xs" style={{ color: mutedColor }}>
                        {new Date(lecture.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {inProgress && (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" style={{ color: statusColor }}>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    )}
                    <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ background: `${statusColor}22`, color: statusColor }}>
                      {statusLabel}
                    </span>
                  </div>
                </div>

                {/* ── Action row ── */}
                <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
                  {/* Open text */}
                  {lecture.has_text && (
                    <button
                      onClick={() => setTextModalLecture(lecture)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
                      style={{ background: btnBg, color: btnColor }}
                    >
                      <span className="material-symbols-outlined text-base">article</span>
                      Открыть текст
                    </button>
                  )}

                  {/* AI filter button (only if has text and not yet filtered) */}
                  {lecture.has_text && !lecture.is_ai_filtered && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleApplyFilter(lecture)}
                        disabled={isFiltering}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
                        style={{ background: btnBg, color: btnColor }}
                      >
                        {isFiltering ? (
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                        ) : (
                          <span className="material-symbols-outlined text-base">auto_fix_high</span>
                        )}
                        {isFiltering ? 'Фильтрация...' : 'Применить AI-фильтр'}
                      </button>
                      <FilterTooltip isLightTheme={isLightTheme} />
                    </div>
                  )}

                  {/* Audio expiry info + re-transcribe / re-upload */}
                  {!inProgress && (() => {
                    const expiry = audioExpiryInfo(lecture.audio_expires_at);
                    const isReUploading = reUploadingId === lecture.id;
                    if (!expiry.expired) {
                      // Audio still available — show countdown + re-transcribe button
                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                            style={{
                              background: expiry.daysLeft <= 2
                                ? 'rgba(239,68,68,.1)' : 'rgba(34,197,94,.08)',
                              color: expiry.daysLeft <= 2 ? '#ef4444' : '#22c55e',
                            }}
                            title={`Аудиофайл будет удалён ${new Date(lecture.audio_expires_at!).toLocaleDateString('ru-RU')}`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                              {expiry.daysLeft <= 2 ? 'warning' : 'schedule'}
                            </span>
                            {expiry.daysLeft === 1 ? 'Аудио удалится завтра' : `Аудио хранится ещё ${expiry.daysLeft} дн.`}
                          </span>
                          <button
                            onClick={() => handleReTranscribe(lecture)}
                            disabled={isReTranscribing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
                            style={{ background: btnBg, color: btnColor }}
                          >
                            {isReTranscribing ? (
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            ) : (
                              <span className="material-symbols-outlined text-base">replay</span>
                            )}
                            Повторная транскрибация
                          </button>
                        </div>
                      );
                    } else {
                      // Audio deleted — show re-upload button
                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                            style={{ background: 'rgba(156,163,175,.1)', color: '#9ca3af' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>audio_file</span>
                            Аудио удалено
                          </span>
                          <button
                            onClick={() => handleReUploadClick(lecture.id)}
                            disabled={isReUploading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
                            style={{ background: btnBg, color: btnColor }}
                          >
                            {isReUploading ? (
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            ) : (
                              <span className="material-symbols-outlined text-base">upload_file</span>
                            )}
                            {isReUploading ? 'Загрузка...' : 'Загрузить аудио снова'}
                          </button>
                        </div>
                      );
                    }
                  })()}

                  {/* Delete */}
                  <button
                    onClick={() => setConfirmDeleteId(lecture.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ml-auto"
                    style={{ background: 'rgba(239,68,68,.1)', color: '#ef4444' }}
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    Удалить
                  </button>
                </div>

                <div className="px-5 pb-4 flex flex-wrap items-center gap-2">
                  {!inCatalog && (
                    <button
                      onClick={() => !hasPendingRequest && openCatalogModal(lecture, 'request')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
                      style={{
                        background: hasPendingRequest ? 'rgba(59,130,246,.18)' : btnBg,
                        color: hasPendingRequest ? '#3b82f6' : btnColor,
                        opacity: hasPendingRequest ? 0.9 : 1,
                        cursor: hasPendingRequest ? 'default' : 'pointer',
                      }}
                    >
                      <span className="material-symbols-outlined text-base">publish</span>
                      {hasPendingRequest ? 'На рассмотрении в базу' : 'Предложить в базу'}
                    </button>
                  )}
                  {canDirectPublish && (
                    <button
                      onClick={() => openCatalogModal(lecture, 'direct')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
                      style={{ background: 'rgba(34,197,94,.14)', color: '#16a34a' }}
                    >
                      <span className="material-symbols-outlined text-base">add_circle</span>
                      Добавить в базу
                    </button>
                  )}
                  {pubLabel && pubColor && !hasPendingRequest && (
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${pubColor}22`, color: pubColor }}>
                      {pubLabel}
                    </span>
                  )}
                  {pub?.latest_request_status === 'rejected' && pub.latest_request_review_comment && (
                    <span className="text-xs" style={{ color: '#ef4444' }}>
                      Причина: {pub.latest_request_review_comment}
                    </span>
                  )}
                </div>

                {/* ── Materials section (only if has text) ── */}
                {lecture.has_text && (
                  <>
                    <div style={{ borderTop: `1px solid ${dividerColor}` }} />
                    <div className="px-5 py-4">
                      <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: mutedColor }}>
                        Обработанные материалы
                      </p>
                      <div className="flex flex-wrap gap-2 items-center">
                        {/* Existing notes */}
                        {lecture.notes.map(note => (
                          <button
                            key={note.id}
                            onClick={(e) => {
                              const filteredAt = lecture.filtered_at ? new Date(lecture.filtered_at).getTime() : null;
                              const noteCreatedAt = new Date(note.created_at).getTime();
                              if (filteredAt && lecture.catalog_stream_id && noteCreatedAt < filteredAt) {
                                setNoteRegenerateWarning({ lecture, note, anchorEl: e.currentTarget as HTMLElement });
                                return;
                              }
                              openNoteActionMenu(note, lecture, e.currentTarget as HTMLElement);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                            style={{
                              background: isLightTheme ? 'rgba(34,197,94,.08)' : 'rgba(34,197,94,.1)',
                              color: '#22c55e',
                              borderColor: 'rgba(34,197,94,.25)',
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{modeIcon(note.mode)}</span>
                            {modeLabel(note.mode)}
                          </button>
                        ))}

                        {/* Generating spinner */}
                        {isGenerating && (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs" style={{ color: mutedColor }}>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            Генерация...
                          </span>
                        )}

                        {/* Add note button */}
                        {availableModes.length > 0 && !isGenerating && (
                          <div className="relative" ref={showAddDropdown ? dropdownRef : undefined}>
                            <button
                              onClick={() => setAddNoteDropdown(showAddDropdown ? null : lecture.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                              style={{ background: btnBg, color: btnColor, borderColor: dividerColor }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                              Добавить
                            </button>

                            {showAddDropdown && (
                              <div
                                className="absolute left-0 top-full mt-1 z-40 rounded-xl py-1 min-w-48"
                                style={{ background: dropdownBg, border: cardBorder, boxShadow: '0 16px 48px rgba(0,0,0,0.35)' }}
                              >
                                {availableModes.map(m => (
                                  <button
                                    key={m.id}
                                    onClick={() => {
                                      if (m.requiresTopic) {
                                        setPendingTopicMode({ lectureId: lecture.id, mode: m.id });
                                        setAddNoteDropdown(null);
                                      } else {
                                        handleGenerateNote(lecture.id, m.id);
                                      }
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-all hover:opacity-70"
                                    style={{ color: btnColor }}
                                  >
                                    <span className="material-symbols-outlined text-base">{m.icon}</span>
                                    {m.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {lecture.notes.length === 0 && !isGenerating && (
                          <span className="text-xs" style={{ color: mutedColor }}>
                            Нажмите «Добавить», чтобы создать материал
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Topic input modal (for expand_topic) ── */}
      {pendingTopicMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div
            className="rounded-2xl p-6 w-full max-w-sm"
            style={{
              background: isLightTheme ? 'rgba(255,255,240,.98)' : 'rgba(33,24,25,.97)',
              border: cardBorder,
              boxShadow: '0 40px 140px rgba(0,0,0,0.5)',
            }}
          >
            <h2 className="text-base font-medium mb-2" style={{ color: headingColor }}>Укажите тему для расширения</h2>
            <p className="text-sm mb-4" style={{ color: mutedColor }}>Введите конкретную тему или вопрос из лекции.</p>
            <input
              autoFocus
              value={topicInput}
              onChange={e => setTopicInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && topicInput.trim()) {
                  handleGenerateNote(pendingTopicMode.lectureId, pendingTopicMode.mode, topicInput.trim());
                }
              }}
              placeholder="Например: градиентный спуск"
              className="w-full px-3 py-2 rounded-lg text-sm mb-4 outline-none"
              style={{ background: btnBg, color: headingColor, border: cardBorder }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { if (topicInput.trim()) handleGenerateNote(pendingTopicMode.lectureId, pendingTopicMode.mode, topicInput.trim()); }}
                disabled={!topicInput.trim()}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: headingColor, color: isLightTheme ? '#fff9f1' : '#0a0a0a' }}
              >
                Создать
              </button>
              <button
                onClick={() => { setPendingTopicMode(null); setTopicInput(''); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: btnBg, color: btnColor }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setConfirmDeleteId(null)}>
          <div
            className="rounded-2xl p-6 max-w-sm w-full"
            style={{
              background: isLightTheme ? 'rgba(255,255,240,.98)' : 'rgba(33,24,25,.97)',
              border: cardBorder,
              boxShadow: '0 40px 140px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-medium mb-2" style={{ color: headingColor }}>Удалить лекцию?</h2>
            <p className="text-sm mb-6" style={{ color: mutedColor }}>
              Это действие необратимо. Лекция, аудиофайл, транскрипция и все материалы будут удалены.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDeleteId)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#ef4444', color: '#fff' }}>
                Удалить
              </button>
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: btnBg, color: btnColor }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Text modal ── */}
      {textModalLecture && (
        <TextModal
          lecture={textModalLecture}
          isLightTheme={isLightTheme}
          onClose={() => setTextModalLecture(null)}
          onOpenInEditor={(text) => {
            setTextModalLecture(null);
            onOpenInEditor(text, textModalLecture.id, textModalLecture.title);
          }}
          authHeaders={authHeaders}
        />
      )}

      {noteActionMenu && (
        <div className="fixed inset-0 z-50" onClick={closeNoteActionMenu}>
          <div
            ref={noteActionMenuRef}
            className="fixed w-[280px] rounded-2xl p-3 border shadow-2xl overflow-y-auto"
            style={{
              left: `${noteActionMenu.x}px`,
              top: `${noteActionMenu.y}px`,
              maxHeight: 'calc(100vh - 24px)',
              background: isLightTheme ? 'rgba(255,255,247,0.98)' : 'rgba(28,21,22,0.98)',
              borderColor: 'var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-medium mb-1 truncate" style={{ color: headingColor }}>{modeLabel(noteActionMenu.note.mode)}</h4>
            <p className="text-[11px] mb-3" style={{ color: mutedColor }}>Выберите действие.</p>

            {!noteExportMenuOpen ? (
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    setNoteModal({ note: noteActionMenu.note, lecture: noteActionMenu.lecture });
                    closeNoteActionMenu();
                  }}
                  className="w-full px-3 py-2 rounded-lg border text-left flex items-center gap-2 text-sm"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>visibility</span>
                  Предпросмотр
                </button>
                <button
                  onClick={() => {
                    onOpenInEditor(noteActionMenu.content, noteActionMenu.lecture.id, noteActionMenu.lecture.title);
                    closeNoteActionMenu();
                  }}
                  className="w-full px-3 py-2 rounded-lg border text-left flex items-center gap-2 text-sm"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
                  Открыть в редакторе
                </button>
                <button
                  onClick={() => setNoteExportMenuOpen(true)}
                  className="w-full px-3 py-2 rounded-lg border text-left flex items-center gap-2 text-sm"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                  Скачать
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setNoteExportMenuOpen(false)}
                    className="px-2 py-1 rounded-lg border text-xs"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                  >
                    Назад
                  </button>
                  <span className="text-xs" style={{ color: mutedColor }}>Выберите формат экспорта.</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {NOTE_EXPORT_FORMATS.map((format) => (
                    <button
                      key={format.id}
                      onClick={async () => {
                        setNoteDownloadFormat(format.id);
                        try {
                          await exportNoteContent(noteActionMenu.content, noteActionMenu.note.mode, format.id);
                          closeNoteActionMenu();
                        } finally {
                          setNoteDownloadFormat(null);
                        }
                      }}
                      className="px-2.5 py-2 rounded-lg border text-left transition-all flex items-center gap-2 disabled:opacity-60 text-sm"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}
                      disabled={Boolean(noteDownloadFormat)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{format.icon}</span>
                      <span className="text-sm">{format.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {noteRegenerateWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setNoteRegenerateWarning(null)}
        >
          <div
            className="rounded-2xl p-5 w-full max-w-md border shadow-2xl"
            style={{
              background: isLightTheme ? 'rgba(255,255,247,0.98)' : 'rgba(28,21,22,0.98)',
              borderColor: 'var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-medium mb-2" style={{ color: headingColor }}>
              Режим был сгенерирован до фильтрации
            </h3>
            <p className="text-sm mb-4" style={{ color: mutedColor }}>
              После фильтрации текста этот материал может устареть. Хотите отправить заявку на его перегенерацию или открыть текущую версию без изменений?
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => handleRequestNoteRegeneration(noteRegenerateWarning.lecture, noteRegenerateWarning.note)}
                className="px-3 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'rgba(31,111,235,0.16)', color: 'var(--text-primary)' }}
              >
                Отправить заявку
              </button>
              <button
                onClick={() => {
                  const { lecture, note, anchorEl } = noteRegenerateWarning;
                  setNoteRegenerateWarning(null);
                  openNoteActionMenu(note, lecture, anchorEl);
                }}
                className="px-3 py-2 rounded-lg text-sm font-medium"
                style={{ background: btnBg, color: btnColor }}
              >
                Открыть режим
              </button>
              <button
                onClick={() => setNoteRegenerateWarning(null)}
                className="px-3 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'rgba(156,163,175,.14)', color: 'var(--text-primary)' }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Note modal ── */}
      {noteModal && (
        <NoteModal
          noteInfo={noteModal.note}
          lecture={noteModal.lecture}
          isLightTheme={isLightTheme}
          onClose={() => setNoteModal(null)}
          onDeleted={(noteId) => handleNoteDeleted(noteModal.lecture.id, noteId)}
          onRegenerate={(mode) => handleGenerateNote(noteModal.lecture.id, mode)}
          onOpenInEditor={(text) => { setNoteModal(null); onOpenInEditor(text, noteModal.lecture.id, noteModal.lecture.title); }}
          authHeaders={authHeaders}
        />
      )}

      {/* Hidden file input for re-upload */}
      <input
        ref={reUploadInputRef}
        type="file"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.flac,.ogg,.opus,.mp4,.mov,.avi,.mkv,.webm"
        style={{ display: 'none' }}
        onChange={handleReUploadFile}
      />

      {suggestModalLecture && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => {
            setSuggestModalLecture(null);
            resetSuggestData();
          }}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-lg"
            style={{ background: isLightTheme ? 'rgba(255,255,240,.98)' : 'rgba(33,24,25,.97)', border: cardBorder }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-medium mb-1" style={{ color: headingColor }}>
              {catalogPublishMode === 'direct' ? 'Добавление лекции в базу' : 'Предложение в базу лекций'}
            </h2>
            <p className="text-xs mb-4" style={{ color: mutedColor }}>{suggestModalLecture.title}</p>
            <p className="text-xs mb-2" style={{ color: mutedColor }}>
              Путь: {faculties.find(f => f.id === suggestData.faculty_id)?.name || 'Факультет'} / {directions.find(d => d.id === suggestData.direction_id)?.name || 'Направление'} / {streams.find(s => s.id === suggestData.stream_id)?.name || 'Поток'} / {suggestData.course_text || 'Курс'} / {(suggestData.semester_text === 'winter' ? 'Зимний семестр' : suggestData.semester_text === 'spring' ? 'Весенний семестр' : 'Семестр')} / {suggestData.discipline || 'Дисциплина'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
              <CatalogSelect
                id="faculty"
                value={suggestData.faculty_id}
                placeholder="Факультет"
                options={modalFacultyOptions.map(f => ({ value: f.id, label: f.name }))}
                onChange={(value) => setSuggestData(prev => {
                  if (!value) {
                    return { ...prev, faculty_id: '', direction_id: '', stream_id: '', course_text: '', semester_text: '', discipline: '' };
                  }
                  const currentDirection = directions.find(d => d.id === prev.direction_id) || null;
                  const currentStream = streams.find(s => s.id === prev.stream_id) || null;
                  const streamDirection = currentStream ? directions.find(d => d.id === currentStream.direction_id) : null;
                  const nextDirectionId = currentDirection && currentDirection.faculty_id === value ? currentDirection.id : '';
                  const nextStreamId = streamDirection && streamDirection.faculty_id === value ? currentStream?.id || '' : '';
                  const keepLower = Boolean(nextStreamId);
                  return {
                    ...prev,
                    faculty_id: value,
                    direction_id: nextDirectionId,
                    stream_id: nextStreamId,
                    course_text: keepLower ? prev.course_text : '',
                    semester_text: keepLower ? prev.semester_text : '',
                    discipline: keepLower ? prev.discipline : '',
                  };
                })}
              />
              <CatalogSelect
                id="direction"
                value={suggestData.direction_id}
                placeholder="Направление"
                options={modalDirectionOptions.map(d => ({ value: d.id, label: d.name }))}
                onChange={(value) => setSuggestData(prev => {
                  if (!value) {
                    return { ...prev, direction_id: '', stream_id: '', course_text: '', semester_text: '', discipline: '' };
                  }
                  const currentStream = streams.find(s => s.id === prev.stream_id) || null;
                  const nextStreamId = currentStream && currentStream.direction_id === value ? currentStream.id : '';
                  const keepLower = Boolean(nextStreamId);
                  return {
                    ...prev,
                    direction_id: value,
                    stream_id: nextStreamId,
                    course_text: keepLower ? prev.course_text : '',
                    semester_text: keepLower ? prev.semester_text : '',
                    discipline: keepLower ? prev.discipline : '',
                  };
                })}
                disabled={!suggestData.faculty_id}
              />
              <CatalogSelect
                id="stream"
                value={suggestData.stream_id}
                placeholder="Поток"
                options={modalStreamOptions.map(s => ({ value: s.id, label: s.name }))}
                onChange={(value) => setSuggestData(prev => ({ ...prev, stream_id: value, course_text: '', semester_text: '', discipline: '' }))}
                disabled={!suggestData.direction_id}
              />

              <CatalogSelect
                id="course"
                value={suggestData.course_text}
                placeholder="Курс"
                options={modalCourseOptions.map(course => ({ value: course, label: course }))}
                onChange={(value) => setSuggestData(prev => ({ ...prev, course_text: value, semester_text: '', discipline: '' }))}
                disabled={!suggestData.stream_id || modalCourseOptions.length === 0}
              />

              <CatalogSelect
                id="semester"
                value={suggestData.semester_text}
                placeholder="Семестр"
                options={modalSemesterOptions.map(semester => ({
                  value: semester,
                  label: semester === 'winter' ? 'Зимний семестр' : semester === 'spring' ? 'Весенний семестр' : semester,
                }))}
                onChange={(value) => setSuggestData(prev => ({ ...prev, semester_text: value, discipline: '' }))}
                disabled={!suggestData.course_text || modalSemesterOptions.length === 0}
              />

              <CatalogSelect
                id="discipline"
                value={suggestData.discipline}
                placeholder="Дисциплина"
                options={modalDisciplineOptions.map(discipline => ({ value: discipline, label: discipline }))}
                onChange={(value) => setSuggestData(prev => ({ ...prev, discipline: value }))}
                disabled={!suggestData.semester_text || modalDisciplineOptions.length === 0}
              />

              {catalogPublishMode === 'direct' && (
                <input value={suggestData.lecturer_name} onChange={(e) => setSuggestData(prev => ({ ...prev, lecturer_name: e.target.value }))} placeholder="Лектор" className="px-3 py-2 rounded-lg border text-sm" style={{ background: btnBg, color: headingColor, border: cardBorder }} />
              )}

              <input value={suggestData.lecture_number_text} onChange={(e) => setSuggestData(prev => ({ ...prev, lecture_number_text: e.target.value }))} placeholder="Номер лекции (напр. 4)" className="px-3 py-2 rounded-lg border text-sm" style={{ background: btnBg, color: headingColor, border: cardBorder }} />
              <input value={suggestData.study_year_text} onChange={(e) => setSuggestData(prev => ({ ...prev, study_year_text: e.target.value }))} placeholder="Год записи (напр. 2025)" className="px-3 py-2 rounded-lg border text-sm" style={{ background: btnBg, color: headingColor, border: cardBorder }} />
            </div>
            {catalogPublishMode === 'request' && (
              <textarea value={suggestData.comment} onChange={(e) => setSuggestData(prev => ({ ...prev, comment: e.target.value }))} placeholder="Комментарий для модератора" className="w-full px-3 py-2 rounded-lg border text-sm mb-3" style={{ background: btnBg, color: headingColor, border: cardBorder }} rows={3} />
            )}
            <div className="flex gap-2">
              <button
                onClick={submitCatalogAction}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: headingColor, color: isLightTheme ? '#fff9f1' : '#0a0a0a' }}
              >
                {catalogPublishMode === 'direct' ? 'Добавить в базу' : 'Отправить заявку'}
              </button>
              <button
                onClick={() => {
                  setSuggestModalLecture(null);
                  resetSuggestData();
                }}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: btnBg, color: btnColor }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturesSection;
