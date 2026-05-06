import React, { useCallback, useMemo, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import htmlDocx from 'html-docx-js/dist/html-docx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { useAuth } from '../../contexts/AuthContext';
import 'katex/dist/katex.min.css';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mdParse = (require('marked') as { parse: (s: string) => string }).parse;

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
type Semester = 'winter' | 'spring';
type SemesterKey = Semester | typeof NO_SEMESTER;

const NOTE_MODES = [
  { id: 'summary', label: 'Краткий конспект', icon: 'edit_note' },
  { id: 'detailed_notes', label: 'Расширенный конспект', icon: 'auto_stories' },
  { id: 'qa', label: 'Q&A', icon: 'help_outline' },
  { id: 'flashcards', label: 'Флешкарточки', icon: 'style' },
  { id: 'mindmap', label: 'Майнд-карта', icon: 'account_tree' },
];

const EXPORT_FORMATS = [
  { id: 'txt', label: 'TXT', icon: 'description', hint: 'Простой текст' },
  { id: 'md', label: 'MD', icon: 'markdown', hint: 'Markdown' },
  { id: 'docx', label: 'DOCX', icon: 'article', hint: 'Документ Word' },
  { id: 'pdf', label: 'PDF', icon: 'picture_as_pdf', hint: 'PDF файл' },
] as const;

type ExportFormatId = (typeof EXPORT_FORMATS)[number]['id'];

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || {};

const NO_COURSE = '__no_course__';
const NO_DISCIPLINE = '__no_discipline__';
const NO_SEMESTER = '__no_semester__';

interface LookupItem { id: string; name: string }
interface DirectionItem extends LookupItem { faculty_id: string }
interface StreamItem { id: string; direction_id: string; name: string; course: number | null }
interface CatalogSemesterItem { stream_id: string; course_text: string; semester_key: string }

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
  is_ai_filtered: boolean;
  filtered_at: string | null;
}

interface LectureNoteInfo { id: string; mode: string; created_at: string }
interface MaterialRequestInfo {
  id: string;
  lecture_id: string;
  mode: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'failed';
  review_comment: string | null;
  generation_error?: string | null;
  created_at: string;
}
interface LectureDetail {
  id: string;
  transcriptions: {
    raw_text: string;
    processed_text: string | null;
    is_ai_filtered?: boolean;
    filtered_at?: string | null;
  }[];
}
interface CatalogSectionProps { isLightTheme: boolean; onOpenInEditor: (text: string, lectureId: string, lectureTitle?: string) => void }

const POLL_BASE_MS = 12000;
const POLL_MAX_MS = 60000;

interface ExplorerPath {
  facultyId?: string;
  directionId?: string;
  streamId?: string;
  courseKey?: string;
  semesterKey?: SemesterKey;
  disciplineKey?: string;
}

interface FolderEntry {
  id: string;
  label: string;
  typeLabel: string;
  nextPath: ExplorerPath;
  icon: 'folder' | 'folder_open';
}

const normalizeCourse = (value: string | null | undefined) => (value || '').trim() || NO_COURSE;
const normalizeDiscipline = (value: string | null | undefined) => (value || '').trim() || NO_DISCIPLINE;

const normalizeSemesterKey = (value: string | null | undefined): SemesterKey => {
  const lower = (value || '').trim().toLowerCase();
  if (lower === 'winter' || lower === 'зимний' || lower === 'зимний семестр') return 'winter';
  if (lower === 'spring' || lower === 'весенний' || lower === 'весенний семестр') return 'spring';
  return NO_SEMESTER;
};

const semesterLabel = (key: SemesterKey) => {
  if (key === 'winter') return 'Зимний семестр';
  if (key === 'spring') return 'Весенний семестр';
  return 'Семестр не указан';
};

const courseLabel = (key: string) => (key === NO_COURSE ? 'Курс не указан' : `Курс ${key}`);
const disciplineLabel = (key: string) => (key === NO_DISCIPLINE ? 'Дисциплина не указана' : key);

const sanitizeFilename = (value: string): string => {
  const withoutForbidden = value.replace(/[<>:"/\\|?*]/g, ' ');
  const withoutControl = Array.from(withoutForbidden)
    .map((ch) => (ch.charCodeAt(0) < 32 ? ' ' : ch))
    .join('');
  return withoutControl.replace(/\s+/g, ' ').trim();
};

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildExportFilename = (title?: string): string => {
  const base = sanitizeFilename(title || '');
  if (base) return base;
  return `lecture_${new Date().toISOString().split('T')[0]}`;
};

const hasActiveMaterialRequests = (items: MaterialRequestInfo[]): boolean =>
  items.some((req) => req.status === 'pending' || req.status === 'processing');

const pollDelayWithJitter = (baseMs: number): number => {
  const jitter = Math.floor(Math.random() * 2000);
  return baseMs + jitter;
};

const pathKey = (path: ExplorerPath) => [
  path.facultyId || '',
  path.directionId || '',
  path.streamId || '',
  path.courseKey || '',
  path.semesterKey || '',
  path.disciplineKey || '',
].join('|');

const isSamePath = (a: ExplorerPath, b: ExplorerPath) => pathKey(a) === pathKey(b);

const matchItemToPath = (item: CatalogItem, path: ExplorerPath) => {
  if (path.facultyId && item.faculty_id !== path.facultyId) return false;
  if (path.directionId && item.direction_id !== path.directionId) return false;
  if (path.streamId && item.stream_id !== path.streamId) return false;
  if (path.courseKey && normalizeCourse(item.course_text) !== path.courseKey) return false;
  if (path.semesterKey && normalizeSemesterKey(item.semester_text) !== path.semesterKey) return false;
  if (path.disciplineKey && normalizeDiscipline(item.discipline) !== path.disciplineKey) return false;
  return true;
};

const CatalogSection: React.FC<CatalogSectionProps> = ({ isLightTheme, onOpenInEditor }) => {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const headingColor = isLightTheme ? '#2a1918' : '#fff7ec';
  const mutedColor = isLightTheme ? '#7a5a5c' : '#c6b7a7';
  const cardBg = isLightTheme ? 'rgba(255,255,240,0.95)' : 'rgba(33,24,25,0.95)';
  const cardBorder = `1px solid ${isLightTheme ? 'rgba(68,41,43,0.16)' : 'rgba(255,247,236,0.16)'}`;
  const panelBg = isLightTheme ? 'rgba(255,255,255,0.78)' : 'rgba(24,18,19,0.88)';

  const [faculties, setFaculties] = useState<LookupItem[]>([]);
  const [directions, setDirections] = useState<DirectionItem[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [allItems, setAllItems] = useState<CatalogItem[]>([]);
  const [catalogSemesters, setCatalogSemesters] = useState<CatalogSemesterItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [currentPath, setCurrentPath] = useState<ExplorerPath>({});
  const [backStack, setBackStack] = useState<ExplorerPath[]>([]);
  const [forwardStack, setForwardStack] = useState<ExplorerPath[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [searchInFolder, setSearchInFolder] = useState('');
  const [selectedEntryKey, setSelectedEntryKey] = useState('');

  const [selectedLecture, setSelectedLecture] = useState<CatalogItem | null>(null);
  const [notesByLecture, setNotesByLecture] = useState<Record<string, LectureNoteInfo[]>>({});
  const [materialRequestsByLecture, setMaterialRequestsByLecture] = useState<Record<string, MaterialRequestInfo[]>>({});
  const [lectureTextByLecture, setLectureTextByLecture] = useState<Record<string, string>>({});
  const [notePreviewModal, setNotePreviewModal] = useState<{ lectureId: string; noteId: string; title: string } | null>(null);
  const [noteTextContent, setNoteTextContent] = useState('');
  const [noteActionMenu, setNoteActionMenu] = useState<{ lectureId: string; noteId: string; title: string; content: string; x: number; y: number } | null>(null);
  const [noteExportMenuOpen, setNoteExportMenuOpen] = useState(false);
  const [noteDownloadFormat, setNoteDownloadFormat] = useState<ExportFormatId | null>(null);
  const [noteExportError, setNoteExportError] = useState('');
  const [requestModal, setRequestModal] = useState<{ lecture: CatalogItem; modeId: string; modeLabel: string } | null>(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestModalError, setRequestModalError] = useState('');
  const [showAiFilterHelp, setShowAiFilterHelp] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<ExportFormatId | null>(null);
  const [downloadMenuError, setDownloadMenuError] = useState('');
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const noteActionMenuRef = useRef<HTMLDivElement | null>(null);
  const noteTextContainerRef = useRef<HTMLDivElement | null>(null);

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
      const limit = 300;
      let offset = 0;
      let loaded: CatalogItem[] = [];
      while (true) {
        const res = await fetch(`${API_BASE}/api/catalog/items?limit=${limit}&offset=${offset}`, { headers });
        if (!res.ok) {
          loaded = [];
          break;
        }
        const chunk: CatalogItem[] = await res.json();
        loaded = loaded.concat(chunk);
        if (chunk.length < limit) break;
        offset += limit;
      }
      setAllItems(loaded);
      const semestersRes = await fetch(`${API_BASE}/api/catalog/semesters`, { headers });
      if (semestersRes.ok) {
        setCatalogSemesters(await semestersRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, [headers]);

  React.useEffect(() => { fetchLookups(); fetchCatalog(); }, [fetchLookups, fetchCatalog]);

  React.useEffect(() => {
    const onCatalogRefresh = () => {
      fetchLookups();
      fetchCatalog();
    };
    window.addEventListener('catalog:refresh', onCatalogRefresh);
    return () => window.removeEventListener('catalog:refresh', onCatalogRefresh);
  }, [fetchLookups, fetchCatalog]);

  const directionsByFaculty = useMemo(() => {
    const map: Record<string, DirectionItem[]> = {};
    directions.forEach((d) => {
      if (!map[d.faculty_id]) map[d.faculty_id] = [];
      map[d.faculty_id].push(d);
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
    return map;
  }, [directions]);

  const streamsByDirection = useMemo(() => {
    const map: Record<string, StreamItem[]> = {};
    streams.forEach((s) => {
      if (!map[s.direction_id]) map[s.direction_id] = [];
      map[s.direction_id].push(s);
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
    return map;
  }, [streams]);

  const indexData = useMemo(() => {
    const coursesByStreamSets: Record<string, Set<string>> = {};
    const semestersByStreamCourseSets: Record<string, Set<SemesterKey>> = {};
    const disciplinesBySCSets: Record<string, Set<string>> = {};

    allItems.forEach((item) => {
      const course = normalizeCourse(item.course_text);
      const semester = normalizeSemesterKey(item.semester_text);
      const discipline = normalizeDiscipline(item.discipline);
      const streamId = item.stream_id;

      if (!coursesByStreamSets[streamId]) coursesByStreamSets[streamId] = new Set();
      coursesByStreamSets[streamId].add(course);

      const scKey = `${streamId}|${course}`;
      if (!semestersByStreamCourseSets[scKey]) semestersByStreamCourseSets[scKey] = new Set();
      semestersByStreamCourseSets[scKey].add(semester);

      const scsKey = `${streamId}|${course}|${semester}`;
      if (!disciplinesBySCSets[scsKey]) disciplinesBySCSets[scsKey] = new Set();
      disciplinesBySCSets[scsKey].add(discipline);
    });

    catalogSemesters.forEach((row) => {
      const course = normalizeCourse(row.course_text);
      const semester = normalizeSemesterKey(row.semester_key);
      const streamId = row.stream_id;

      if (!coursesByStreamSets[streamId]) coursesByStreamSets[streamId] = new Set();
      coursesByStreamSets[streamId].add(course);

      const scKey = `${streamId}|${course}`;
      if (!semestersByStreamCourseSets[scKey]) semestersByStreamCourseSets[scKey] = new Set();
      semestersByStreamCourseSets[scKey].add(semester);
    });

    const coursesByStream: Record<string, string[]> = {};
    Object.entries(coursesByStreamSets).forEach(([key, set]) => {
      coursesByStream[key] = Array.from(set).sort((a, b) => courseLabel(a).localeCompare(courseLabel(b), 'ru'));
    });

    const semestersByStreamCourse: Record<string, SemesterKey[]> = {};
    Object.entries(semestersByStreamCourseSets).forEach(([key, set]) => {
      semestersByStreamCourse[key] = Array.from(set).sort((a, b) => semesterLabel(a).localeCompare(semesterLabel(b), 'ru'));
    });

    const disciplinesBySCS: Record<string, string[]> = {};
    Object.entries(disciplinesBySCSets).forEach(([key, set]) => {
      disciplinesBySCS[key] = Array.from(set).sort((a, b) => disciplineLabel(a).localeCompare(disciplineLabel(b), 'ru'));
    });

    return {
      coursesByStream,
      semestersByStreamCourse,
      disciplinesBySCS,
    };
  }, [allItems, catalogSemesters]);

  const navigateTo = useCallback((nextPath: ExplorerPath, pushHistory = true) => {
    if (isSamePath(currentPath, nextPath)) return;
    if (pushHistory) {
      setBackStack((prev) => [...prev, currentPath]);
      setForwardStack([]);
    }
    setCurrentPath(nextPath);
    setSelectedEntryKey('');
    setSelectedLecture(null);
  }, [currentPath]);

  const goBack = useCallback(() => {
    if (backStack.length === 0) return;
    const prevPath = backStack[backStack.length - 1];
    setBackStack((prev) => prev.slice(0, -1));
    setForwardStack((prev) => [currentPath, ...prev]);
    setCurrentPath(prevPath);
    setSelectedLecture(null);
    setSelectedEntryKey('');
  }, [backStack, currentPath]);

  const goForward = useCallback(() => {
    if (forwardStack.length === 0) return;
    const nextPath = forwardStack[0];
    setForwardStack((prev) => prev.slice(1));
    setBackStack((prev) => [...prev, currentPath]);
    setCurrentPath(nextPath);
    setSelectedLecture(null);
    setSelectedEntryKey('');
  }, [forwardStack, currentPath]);

  const goUp = useCallback(() => {
    if (currentPath.disciplineKey) return navigateTo({ ...currentPath, disciplineKey: undefined });
    if (currentPath.semesterKey) return navigateTo({ ...currentPath, semesterKey: undefined });
    if (currentPath.courseKey) return navigateTo({ ...currentPath, courseKey: undefined });
    if (currentPath.streamId) return navigateTo({ ...currentPath, streamId: undefined });
    if (currentPath.directionId) return navigateTo({ ...currentPath, directionId: undefined });
    if (currentPath.facultyId) return navigateTo({ ...currentPath, facultyId: undefined });
  }, [currentPath, navigateTo]);

  React.useEffect(() => {
    const expandUpdates: Record<string, boolean> = {};
    if (currentPath.facultyId) expandUpdates[`faculty:${currentPath.facultyId}`] = true;
    if (currentPath.directionId) expandUpdates[`direction:${currentPath.directionId}`] = true;
    if (currentPath.streamId) expandUpdates[`stream:${currentPath.streamId}`] = true;
    if (currentPath.streamId && currentPath.courseKey) expandUpdates[`course:${currentPath.streamId}|${currentPath.courseKey}`] = true;
    if (currentPath.streamId && currentPath.courseKey && currentPath.semesterKey) {
      expandUpdates[`semester:${currentPath.streamId}|${currentPath.courseKey}|${currentPath.semesterKey}`] = true;
    }
    if (Object.keys(expandUpdates).length > 0) {
      setExpandedNodes((prev) => ({ ...prev, ...expandUpdates }));
    }
  }, [currentPath]);

  const breadcrumbs = useMemo(() => {
    const list: { label: string; path: ExplorerPath }[] = [{ label: 'Каталог', path: {} }];
    if (currentPath.facultyId) {
      const faculty = faculties.find((f) => f.id === currentPath.facultyId);
      list.push({ label: faculty?.name || 'Факультет', path: { facultyId: currentPath.facultyId } });
    }
    if (currentPath.directionId) {
      const direction = directions.find((d) => d.id === currentPath.directionId);
      list.push({ label: direction?.name || 'Направление', path: { facultyId: currentPath.facultyId, directionId: currentPath.directionId } });
    }
    if (currentPath.streamId) {
      const stream = streams.find((s) => s.id === currentPath.streamId);
      list.push({ label: stream?.name || 'Поток', path: { facultyId: currentPath.facultyId, directionId: currentPath.directionId, streamId: currentPath.streamId } });
    }
    if (currentPath.courseKey) {
      list.push({
        label: courseLabel(currentPath.courseKey),
        path: {
          facultyId: currentPath.facultyId,
          directionId: currentPath.directionId,
          streamId: currentPath.streamId,
          courseKey: currentPath.courseKey,
        },
      });
    }
    if (currentPath.semesterKey) {
      list.push({
        label: semesterLabel(currentPath.semesterKey),
        path: {
          facultyId: currentPath.facultyId,
          directionId: currentPath.directionId,
          streamId: currentPath.streamId,
          courseKey: currentPath.courseKey,
          semesterKey: currentPath.semesterKey,
        },
      });
    }
    if (currentPath.disciplineKey) {
      list.push({
        label: disciplineLabel(currentPath.disciplineKey),
        path: {
          facultyId: currentPath.facultyId,
          directionId: currentPath.directionId,
          streamId: currentPath.streamId,
          courseKey: currentPath.courseKey,
          semesterKey: currentPath.semesterKey,
          disciplineKey: currentPath.disciplineKey,
        },
      });
    }
    return list;
  }, [currentPath, faculties, directions, streams]);

  const currentFolder = useMemo(() => {
    const folders: FolderEntry[] = [];
    let lectures: CatalogItem[] = [];

    if (!currentPath.facultyId) {
      faculties
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        .forEach((faculty) => {
          folders.push({
            id: `faculty:${faculty.id}`,
            label: faculty.name,
            typeLabel: 'Факультет',
            icon: 'folder',
            nextPath: { facultyId: faculty.id },
          });
        });
      return { folders, lectures };
    }

    if (!currentPath.directionId) {
      (directionsByFaculty[currentPath.facultyId] || []).forEach((direction) => {
        folders.push({
          id: `direction:${direction.id}`,
          label: direction.name,
          typeLabel: 'Направление',
          icon: 'folder',
          nextPath: { facultyId: currentPath.facultyId, directionId: direction.id },
        });
      });
      return { folders, lectures };
    }

    if (!currentPath.streamId) {
      (streamsByDirection[currentPath.directionId] || []).forEach((stream) => {
        folders.push({
          id: `stream:${stream.id}`,
          label: stream.name,
          typeLabel: 'Поток',
          icon: 'folder',
          nextPath: {
            facultyId: currentPath.facultyId,
            directionId: currentPath.directionId,
            streamId: stream.id,
          },
        });
      });
      return { folders, lectures };
    }

    if (!currentPath.courseKey) {
      const courses = indexData.coursesByStream[currentPath.streamId] || [];
      courses.forEach((course) => {
        folders.push({
          id: `course:${currentPath.streamId}|${course}`,
          label: courseLabel(course),
          typeLabel: 'Курс',
          icon: 'folder',
          nextPath: {
            facultyId: currentPath.facultyId,
            directionId: currentPath.directionId,
            streamId: currentPath.streamId,
            courseKey: course,
          },
        });
      });
      return { folders, lectures };
    }

    if (!currentPath.semesterKey) {
      const key = `${currentPath.streamId}|${currentPath.courseKey}`;
      const semesters = indexData.semestersByStreamCourse[key] || [];
      semesters.forEach((semester) => {
        folders.push({
          id: `semester:${currentPath.streamId}|${currentPath.courseKey}|${semester}`,
          label: semesterLabel(semester),
          typeLabel: 'Семестр',
          icon: 'folder',
          nextPath: {
            facultyId: currentPath.facultyId,
            directionId: currentPath.directionId,
            streamId: currentPath.streamId,
            courseKey: currentPath.courseKey,
            semesterKey: semester,
          },
        });
      });
      return { folders, lectures };
    }

    if (!currentPath.disciplineKey) {
      const key = `${currentPath.streamId}|${currentPath.courseKey}|${currentPath.semesterKey}`;
      const disciplines = indexData.disciplinesBySCS[key] || [];
      disciplines.forEach((discipline) => {
        folders.push({
          id: `discipline:${currentPath.streamId}|${currentPath.courseKey}|${currentPath.semesterKey}|${discipline}`,
          label: disciplineLabel(discipline),
          typeLabel: 'Дисциплина',
          icon: 'folder',
          nextPath: {
            facultyId: currentPath.facultyId,
            directionId: currentPath.directionId,
            streamId: currentPath.streamId,
            courseKey: currentPath.courseKey,
            semesterKey: currentPath.semesterKey,
            disciplineKey: discipline,
          },
        });
      });
      return { folders, lectures };
    }

    lectures = allItems
      .filter((item) => matchItemToPath(item, currentPath))
      .sort((a, b) => a.lecture_title.localeCompare(b.lecture_title, 'ru'));

    return { folders, lectures };
  }, [allItems, currentPath, directionsByFaculty, faculties, indexData, streamsByDirection]);

  const visibleFolders = useMemo(() => {
    const query = searchInFolder.trim().toLowerCase();
    if (!query) return currentFolder.folders;
    return currentFolder.folders.filter((folder) => folder.label.toLowerCase().includes(query));
  }, [currentFolder.folders, searchInFolder]);

  const visibleLectures = useMemo(() => {
    const query = searchInFolder.trim().toLowerCase();
    if (!query) return currentFolder.lectures;
    return currentFolder.lectures.filter((item) =>
      item.lecture_title.toLowerCase().includes(query) ||
      (item.lecturer_name || '').toLowerCase().includes(query) ||
      item.discipline.toLowerCase().includes(query)
    );
  }, [currentFolder.lectures, searchInFolder]);

  const openLectureDetails = async (item: CatalogItem) => {
    setSelectedLecture(item);
    setSelectedEntryKey(`lecture:${item.lecture_id}`);

    const nRes = await fetch(`${API_BASE}/api/lectures/${item.lecture_id}/notes`, { headers });
    if (nRes.ok) {
      const notes = await nRes.json();
      setNotesByLecture((prev) => ({ ...prev, [item.lecture_id]: notes }));
    }

    if (!lectureTextByLecture[item.lecture_id]) {
      const lRes = await fetch(`${API_BASE}/api/lectures/${item.lecture_id}`, { headers });
      if (lRes.ok) {
        const detail: LectureDetail = await lRes.json();
        const latest = detail.transcriptions?.[0];
        const text = latest?.processed_text || latest?.raw_text || '';
        setLectureTextByLecture((prev) => ({ ...prev, [item.lecture_id]: text }));
      }
    }
    const reqRes = await fetch(`${API_BASE}/api/catalog/material-requests/lecture?lecture_id=${item.lecture_id}`, { headers });
    if (reqRes.ok) {
      const reqs = await reqRes.json();
      setMaterialRequestsByLecture((prev) => ({ ...prev, [item.lecture_id]: reqs }));
    }
  };

  const ensureLectureTextLoaded = useCallback(async (lectureId: string): Promise<string> => {
    const cached = lectureTextByLecture[lectureId];
    if (typeof cached === 'string') return cached;

    const lRes = await fetch(`${API_BASE}/api/lectures/${lectureId}`, { headers });
    if (!lRes.ok) {
      throw new Error('Не удалось загрузить текст лекции');
    }

    const detail: LectureDetail = await lRes.json();
    const latest = detail.transcriptions?.[0];
    const text = latest?.processed_text || latest?.raw_text || '';
    setLectureTextByLecture((prev) => ({ ...prev, [lectureId]: text }));
    return text;
  }, [headers, lectureTextByLecture]);

  const exportLectureText = async (text: string, lectureTitle: string, format: ExportFormatId): Promise<void> => {
    const baseName = buildExportFilename(lectureTitle);

    if (format === 'txt') {
      saveAs(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${baseName}.txt`);
      return;
    }

    if (format === 'md') {
      saveAs(new Blob([text], { type: 'text/markdown;charset=utf-8' }), `${baseName}.md`);
      return;
    }

    if (format === 'docx') {
      const htmlBody = text
        .split(/\n\s*\n/g)
        .map((chunk) => `<p>${escapeHtml(chunk).replace(/\n/g, '<br/>')}</p>`)
        .join('');
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(lectureTitle || 'Lecture')}</title>
</head>
<body>
  ${htmlBody || '<p></p>'}
</body>
</html>`;
      const docxBlob = htmlDocx.asBlob(html);
      saveAs(docxBlob, `${baseName}.docx`);
      return;
    }

    const lines = text.split(/\r?\n/);
    const content = lines.map((line) => ({
      text: line || ' ',
      margin: [0, 0, 0, 4],
    }));
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 50, 40, 50],
      content,
      defaultStyle: {
        font: 'Roboto',
        fontSize: 12,
        lineHeight: 1.45,
      },
      fonts: {
        Roboto: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Regular.ttf',
          italics: 'Roboto-Regular.ttf',
          bolditalics: 'Roboto-Regular.ttf',
        },
      },
    };
    (pdfMake as any).createPdf(docDefinition).download(`${baseName}.pdf`);
  };

  const handleOpenCleanTextInEditor = async (lecture: CatalogItem) => {
    try {
      const text = await ensureLectureTextLoaded(lecture.lecture_id);
      onOpenInEditor(text, lecture.lecture_id, lecture.lecture_title);
    } catch {
      onOpenInEditor('', lecture.lecture_id, lecture.lecture_title);
    }
  };

  const handleDownloadLecture = async (format: ExportFormatId) => {
    if (!selectedLecture) return;
    setDownloadMenuError('');
    setDownloadingFormat(format);
    try {
      const text = await ensureLectureTextLoaded(selectedLecture.lecture_id);
      if (!text.trim()) {
        setDownloadMenuError('Текст лекции пустой. Скачивание недоступно.');
        return;
      }
      await exportLectureText(text, selectedLecture.lecture_title, format);
      setDownloadMenuOpen(false);
    } catch {
      setDownloadMenuError('Не удалось подготовить файл для скачивания.');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const refreshLectureRuntimeData = useCallback(async (lectureId: string): Promise<{ hasActive: boolean }> => {
    const [nRes, reqRes, lRes] = await Promise.all([
      fetch(`${API_BASE}/api/lectures/${lectureId}/notes`, { headers }),
      fetch(`${API_BASE}/api/catalog/material-requests/lecture?lecture_id=${lectureId}`, { headers }),
      fetch(`${API_BASE}/api/lectures/${lectureId}`, { headers }),
    ]);

    if (!nRes.ok || !reqRes.ok || !lRes.ok) {
      throw new Error('Не удалось обновить статус генерации');
    }

    const [notes, reqs, detail] = await Promise.all([nRes.json(), reqRes.json(), lRes.json() as Promise<LectureDetail>]);
    const latest = detail.transcriptions?.[0];
    setNotesByLecture((prev) => ({ ...prev, [lectureId]: notes }));
    setMaterialRequestsByLecture((prev) => ({ ...prev, [lectureId]: reqs }));
    setSelectedLecture((prev) => prev && prev.lecture_id === lectureId ? { ...prev, is_ai_filtered: Boolean(latest?.is_ai_filtered), filtered_at: latest?.filtered_at || null } : prev);

    return { hasActive: hasActiveMaterialRequests(reqs) };
  }, [headers]);

  const parseApiErrorMessage = (payload: any) => {
    if (typeof payload?.detail === 'string') return payload.detail;
    if (typeof payload?.detail?.message === 'string') return payload.detail.message;
    if (typeof payload?.message === 'string') return payload.message;
    return 'Не удалось выполнить действие';
  };

  const openMaterialRequestModal = (lecture: CatalogItem, modeId: string, modeLabel: string) => {
    setRequestModalError('');
    setRequestModal({ lecture, modeId, modeLabel });
  };

  const submitMaterialRequest = async () => {
    if (!requestModal) return;
    setRequestSubmitting(true);
    setRequestModalError('');
    try {
      const res = await fetch(`${API_BASE}/api/catalog/material-requests`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecture_id: requestModal.lecture.lecture_id,
          stream_id: requestModal.lecture.stream_id,
          mode: requestModal.modeId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setRequestModalError(parseApiErrorMessage(err));
        return;
      }

      const reqRes = await fetch(`${API_BASE}/api/catalog/material-requests/lecture?lecture_id=${requestModal.lecture.lecture_id}`, { headers });
      if (reqRes.ok) {
        const reqs = await reqRes.json();
        setMaterialRequestsByLecture((prev) => ({ ...prev, [requestModal.lecture.lecture_id]: reqs }));
      }
      setRequestModal(null);
      window.dispatchEvent(new Event('catalog:refresh'));
    } finally {
      setRequestSubmitting(false);
    }
  };

  const openNoteActionMenu = async (lectureId: string, noteId: string, title: string, anchorEl: HTMLElement) => {
    const res = await fetch(`${API_BASE}/api/lectures/${lectureId}/notes/${noteId}`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    const rect = anchorEl.getBoundingClientRect();
    const popupWidth = 280;
    const popupHeight = 230;
    const x = Math.max(12, Math.min(rect.left, window.innerWidth - popupWidth - 12));
    const fitsBelow = rect.bottom + popupHeight + 12 <= window.innerHeight;
    const fitsAbove = rect.top - popupHeight - 12 >= 12;
    const y = fitsBelow ? rect.bottom + 10 : fitsAbove ? rect.top - popupHeight - 10 : Math.max(12, window.innerHeight - popupHeight - 12);
    setNoteTextContent(data.content || '');
    setNoteExportError('');
    setNoteExportMenuOpen(false);
    setNoteActionMenu({ lectureId, noteId, title, content: data.content || '', x, y });
  };

  const toggleTreeNode = (nodeKey: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  };

  const treeRow = (params: {
    nodeKey: string;
    level: number;
    label: string;
    icon?: 'folder' | 'folder_open';
    isSelected: boolean;
    hasChildren: boolean;
    expanded: boolean;
    onSelect: () => void;
    onToggle: () => void;
  }) => (
    <div className="flex items-center gap-1 rounded-md" style={{ paddingLeft: `${params.level * 14}px` }}>
      {params.hasChildren ? (
        <button
          onClick={params.onToggle}
          className="w-5 h-5 flex items-center justify-center rounded text-xs"
          style={{ color: mutedColor }}
          aria-label="toggle"
        >
          {params.expanded ? '▾' : '▸'}
        </button>
      ) : (
        <span className="w-5 h-5" />
      )}
      <button
        key={params.nodeKey}
        onClick={params.onSelect}
        className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-md text-left"
        style={{
          background: params.isSelected ? 'rgba(31,111,235,0.2)' : 'transparent',
          color: params.isSelected ? (isLightTheme ? '#0f3a72' : '#b8d8ff') : 'var(--text-primary)',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          {params.icon || (params.hasChildren ? 'folder' : 'description')}
        </span>
        <span className="truncate text-sm">{params.label}</span>
      </button>
    </div>
  );

  const selectedLectureModeState = useMemo(() => {
    if (!selectedLecture) return null;
    const lectureId = selectedLecture.lecture_id;
    const noteMap = new Map<string, LectureNoteInfo>();
    (notesByLecture[lectureId] || []).forEach((note) => {
      noteMap.set(note.mode, note);
    });

    const requestMap = new Map<string, MaterialRequestInfo>();
    (materialRequestsByLecture[lectureId] || []).forEach((req) => {
      if (!requestMap.has(req.mode)) {
        requestMap.set(req.mode, req);
      }
    });

    return { noteMap, requestMap };
  }, [selectedLecture, notesByLecture, materialRequestsByLecture]);

  React.useEffect(() => {
    if (!downloadMenuOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(target)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [downloadMenuOpen]);

  React.useEffect(() => {
    setDownloadMenuOpen(false);
    setDownloadMenuError('');
  }, [selectedLecture?.lecture_id]);

  React.useEffect(() => {
    if (!notePreviewModal || !noteTextContainerRef.current) return;
    import('katex/contrib/auto-render').then(({ default: renderMathInElement }) => {
      if (!noteTextContainerRef.current) return;
      renderMathInElement(noteTextContainerRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    });
  }, [notePreviewModal, noteTextContent]);

  React.useEffect(() => {
    if (!noteActionMenu || !noteActionMenuRef.current) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (noteActionMenuRef.current && !noteActionMenuRef.current.contains(target)) {
        setNoteActionMenu(null);
        setNoteExportMenuOpen(false);
        setNoteExportError('');
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [noteActionMenu]);

  React.useEffect(() => {
    if (!noteActionMenu) {
      setNoteExportMenuOpen(false);
      setNoteExportError('');
    }
  }, [noteActionMenu]);

  React.useEffect(() => {
    const lectureId = selectedLecture?.lecture_id;
    if (!lectureId) return;

    const lectureReqs = materialRequestsByLecture[lectureId] || [];
    if (!hasActiveMaterialRequests(lectureReqs)) return;

    let timeoutId: number | null = null;
    let cancelled = false;
    let errorStreak = 0;

    const schedule = (delayMs: number) => {
      if (cancelled) return;
      timeoutId = window.setTimeout(tick, delayMs);
    };

    const tick = async () => {
      if (cancelled) return;

      if (document.hidden) {
        schedule(pollDelayWithJitter(POLL_BASE_MS));
        return;
      }

      try {
        const result = await refreshLectureRuntimeData(lectureId);
        errorStreak = 0;
        if (cancelled || !result.hasActive) return;
        schedule(pollDelayWithJitter(POLL_BASE_MS));
      } catch {
        errorStreak += 1;
        const backoffBase = Math.min(POLL_MAX_MS, POLL_BASE_MS * (2 ** Math.min(errorStreak, 3)));
        schedule(pollDelayWithJitter(backoffBase));
      }
    };

    schedule(pollDelayWithJitter(POLL_BASE_MS));

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [selectedLecture?.lecture_id, materialRequestsByLecture, refreshLectureRuntimeData]);

  return (
    <div>
      <div className="text-center mb-6 px-4">
        <h1 className="text-3xl lg:text-4xl font-light mb-3 tracking-wide" style={{ color: headingColor }}>База лекций</h1>
        <p className="text-sm opacity-80" style={{ color: mutedColor }}>
          Режим проводника: дерево каталога слева, содержимое папки справа.
        </p>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: cardBorder, background: panelBg }}>
        <div
          className="flex flex-wrap items-center gap-2 p-3 border-b"
          style={{ borderColor: 'var(--border-color)', background: isLightTheme ? 'rgba(68,41,43,0.04)' : 'rgba(255,247,236,0.04)' }}
        >
          <button
            onClick={goBack}
            disabled={backStack.length === 0}
            className="px-2.5 py-1.5 rounded-md border text-xs disabled:opacity-45"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            Назад
          </button>
          <button
            onClick={goForward}
            disabled={forwardStack.length === 0}
            className="px-2.5 py-1.5 rounded-md border text-xs disabled:opacity-45"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            Вперёд
          </button>
          <button
            onClick={goUp}
            disabled={pathKey(currentPath) === pathKey({})}
            className="px-2.5 py-1.5 rounded-md border text-xs disabled:opacity-45"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            Вверх
          </button>

          <div
            className="flex-1 min-w-[260px] px-3 py-1.5 rounded-md border flex items-center gap-1 overflow-x-auto"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}
          >
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={`${idx}-${crumb.label}`}>
                {idx > 0 && <span style={{ color: mutedColor }}>/</span>}
                <button
                  onClick={() => navigateTo(crumb.path)}
                  className="text-xs whitespace-nowrap hover:underline"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          <input
            value={searchInFolder}
            onChange={(e) => setSearchInFolder(e.target.value)}
            placeholder="Поиск в текущей папке"
            className="px-3 py-1.5 rounded-md border text-sm min-w-[200px]"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[320px,1fr] min-h-[520px]">
          <aside className="border-r p-3 max-h-[74vh] overflow-y-auto" style={{ borderColor: 'var(--border-color)' }}>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: mutedColor }}>Дерево каталога</p>

            {treeRow({
              nodeKey: 'root',
              level: 0,
              label: 'Каталог',
              icon: 'folder_open',
              isSelected: isSamePath(currentPath, {}),
              hasChildren: true,
              expanded: true,
              onSelect: () => navigateTo({}),
              onToggle: () => undefined,
            })}

            <div className="mt-1 space-y-0.5">
              {faculties
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
                .map((faculty) => {
                  const facultyKey = `faculty:${faculty.id}`;
                  const facultyExpanded = expandedNodes[facultyKey] ?? false;
                  const facultySelected = isSamePath(currentPath, { facultyId: faculty.id });
                  const directionList = directionsByFaculty[faculty.id] || [];

                  return (
                    <div key={faculty.id}>
                      {treeRow({
                        nodeKey: facultyKey,
                        level: 1,
                        label: faculty.name,
                        icon: 'folder',
                        isSelected: facultySelected,
                        hasChildren: directionList.length > 0,
                        expanded: facultyExpanded,
                        onSelect: () => navigateTo({ facultyId: faculty.id }),
                        onToggle: () => toggleTreeNode(facultyKey),
                      })}

                      {facultyExpanded && directionList.map((direction) => {
                        const directionKey = `direction:${direction.id}`;
                        const directionExpanded = expandedNodes[directionKey] ?? false;
                        const directionSelected = isSamePath(currentPath, { facultyId: faculty.id, directionId: direction.id });
                        const streamList = streamsByDirection[direction.id] || [];

                        return (
                          <div key={direction.id}>
                            {treeRow({
                              nodeKey: directionKey,
                              level: 2,
                              label: direction.name,
                              icon: 'folder',
                              isSelected: directionSelected,
                              hasChildren: streamList.length > 0,
                              expanded: directionExpanded,
                              onSelect: () => navigateTo({ facultyId: faculty.id, directionId: direction.id }),
                              onToggle: () => toggleTreeNode(directionKey),
                            })}

                            {directionExpanded && streamList.map((stream) => {
                              const streamKey = `stream:${stream.id}`;
                              const streamExpanded = expandedNodes[streamKey] ?? false;
                              const streamSelected = isSamePath(currentPath, {
                                facultyId: faculty.id,
                                directionId: direction.id,
                                streamId: stream.id,
                              });
                              const courses = indexData.coursesByStream[stream.id] || [];

                              return (
                                <div key={stream.id}>
                                  {treeRow({
                                    nodeKey: streamKey,
                                    level: 3,
                                    label: stream.name,
                                    icon: 'folder',
                                    isSelected: streamSelected,
                                    hasChildren: courses.length > 0,
                                    expanded: streamExpanded,
                                    onSelect: () => navigateTo({ facultyId: faculty.id, directionId: direction.id, streamId: stream.id }),
                                    onToggle: () => toggleTreeNode(streamKey),
                                  })}

                                  {streamExpanded && courses.map((course) => {
                                    const courseKey = `course:${stream.id}|${course}`;
                                    const courseExpanded = expandedNodes[courseKey] ?? false;
                                    const courseSelected = isSamePath(currentPath, {
                                      facultyId: faculty.id,
                                      directionId: direction.id,
                                      streamId: stream.id,
                                      courseKey: course,
                                    });
                                    const semesterKey = `${stream.id}|${course}`;
                                    const semesters = indexData.semestersByStreamCourse[semesterKey] || [];

                                    return (
                                      <div key={courseKey}>
                                        {treeRow({
                                          nodeKey: courseKey,
                                          level: 4,
                                          label: courseLabel(course),
                                          icon: 'folder',
                                          isSelected: courseSelected,
                                          hasChildren: semesters.length > 0,
                                          expanded: courseExpanded,
                                          onSelect: () => navigateTo({
                                            facultyId: faculty.id,
                                            directionId: direction.id,
                                            streamId: stream.id,
                                            courseKey: course,
                                          }),
                                          onToggle: () => toggleTreeNode(courseKey),
                                        })}

                                        {courseExpanded && semesters.map((semester) => {
                                          const semNodeKey = `semester:${stream.id}|${course}|${semester}`;
                                          const semExpanded = expandedNodes[semNodeKey] ?? false;
                                          const semSelected = isSamePath(currentPath, {
                                            facultyId: faculty.id,
                                            directionId: direction.id,
                                            streamId: stream.id,
                                            courseKey: course,
                                            semesterKey: semester,
                                          });
                                          const scsKey = `${stream.id}|${course}|${semester}`;
                                          const disciplines = indexData.disciplinesBySCS[scsKey] || [];

                                          return (
                                            <div key={semNodeKey}>
                                              {treeRow({
                                                nodeKey: semNodeKey,
                                                level: 5,
                                                label: semesterLabel(semester),
                                                icon: 'folder',
                                                isSelected: semSelected,
                                                hasChildren: disciplines.length > 0,
                                                expanded: semExpanded,
                                                onSelect: () => navigateTo({
                                                  facultyId: faculty.id,
                                                  directionId: direction.id,
                                                  streamId: stream.id,
                                                  courseKey: course,
                                                  semesterKey: semester,
                                                }),
                                                onToggle: () => toggleTreeNode(semNodeKey),
                                              })}

                                              {semExpanded && disciplines.map((discipline) => {
                                                const disciplineNodeKey = `discipline:${stream.id}|${course}|${semester}|${discipline}`;
                                                const disciplineSelected = isSamePath(currentPath, {
                                                  facultyId: faculty.id,
                                                  directionId: direction.id,
                                                  streamId: stream.id,
                                                  courseKey: course,
                                                  semesterKey: semester,
                                                  disciplineKey: discipline,
                                                });
                                                return (
                                                  <div key={disciplineNodeKey}>
                                                    {treeRow({
                                                      nodeKey: disciplineNodeKey,
                                                      level: 6,
                                                      label: disciplineLabel(discipline),
                                                      icon: 'folder',
                                                      isSelected: disciplineSelected,
                                                      hasChildren: false,
                                                      expanded: false,
                                                      onSelect: () => navigateTo({
                                                        facultyId: faculty.id,
                                                        directionId: direction.id,
                                                        streamId: stream.id,
                                                        courseKey: course,
                                                        semesterKey: semester,
                                                        disciplineKey: discipline,
                                                      }),
                                                      onToggle: () => undefined,
                                                    })}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          </aside>

          <section className="p-3">
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: mutedColor }}>Содержимое папки</p>

            <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
              <div
                className="grid grid-cols-[minmax(220px,1fr)_120px_200px_120px] gap-2 px-3 py-2 border-b text-xs font-medium"
                style={{ borderColor: 'var(--border-color)', color: mutedColor }}
              >
                <span>Имя</span>
                <span>Тип</span>
                <span>Детали</span>
                <span>Действие</span>
              </div>

              <div className="max-h-[58vh] overflow-y-auto">
                {loading ? (
                  <p className="text-sm px-4 py-6" style={{ color: mutedColor }}>Загрузка каталога...</p>
                ) : (
                  <>
                    {visibleFolders.map((folder) => (
                      <div
                        key={folder.id}
                        onClick={() => setSelectedEntryKey(folder.id)}
                        onDoubleClick={() => navigateTo(folder.nextPath)}
                        className="grid grid-cols-[minmax(220px,1fr)_120px_200px_120px] gap-2 px-3 py-2 border-b text-sm cursor-default"
                        style={{
                          borderColor: 'var(--border-color)',
                          background: selectedEntryKey === folder.id ? 'rgba(31,111,235,0.15)' : 'transparent',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{folder.icon}</span>
                          <span className="truncate">{folder.label}</span>
                        </span>
                        <span style={{ color: mutedColor }}>{folder.typeLabel}</span>
                        <span style={{ color: mutedColor }}>—</span>
                        <span>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigateTo(folder.nextPath); }}
                            className="px-2 py-1 rounded border text-xs"
                            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                          >
                            Открыть
                          </button>
                        </span>
                      </div>
                    ))}

                    {visibleLectures.map((item) => {
                      const rowKey = `lecture:${item.lecture_id}`;
                      const detail = item.lecturer_name || item.discipline;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedEntryKey(rowKey);
                            setSelectedLecture(item);
                          }}
                          onDoubleClick={() => openLectureDetails(item)}
                          className="grid grid-cols-[minmax(220px,1fr)_120px_200px_120px] gap-2 px-3 py-2 border-b text-sm cursor-default"
                          style={{
                            borderColor: 'var(--border-color)',
                            background: selectedEntryKey === rowKey ? 'rgba(31,111,235,0.15)' : 'transparent',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>description</span>
                            <span className="truncate">{item.lecture_title}</span>
                          </span>
                          <span style={{ color: mutedColor }}>Лекция</span>
                          <span className="truncate" style={{ color: mutedColor }}>{detail || '—'}</span>
                          <span>
                            <button
                              onClick={(e) => { e.stopPropagation(); openLectureDetails(item); }}
                              className="px-2 py-1 rounded border text-xs"
                              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                            >
                              Просмотр
                            </button>
                          </span>
                        </div>
                      );
                    })}

                    {visibleFolders.length === 0 && visibleLectures.length === 0 && (
                      <p className="text-sm px-4 py-6" style={{ color: mutedColor }}>
                        В этой папке пусто.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {selectedLecture && (
        <div className="border rounded-xl p-4 mt-5" style={{ borderColor: 'var(--border-color)', background: cardBg }}>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="text-lg font-medium" style={{ color: headingColor }}>{selectedLecture.lecture_title}</h3>
            {selectedLecture.is_ai_filtered ? (
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(34,197,94,.14)', color: '#22c55e' }}>
                Текст прошел фильтрацию
              </span>
            ) : (
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,.12)', color: '#d97706' }}>
                Текст не фильтрован
              </span>
            )}
          </div>
          <p className="text-xs mb-3" style={{ color: mutedColor }}>
            {selectedLecture.faculty_name} / {selectedLecture.direction_name} / {selectedLecture.stream_name} / {courseLabel(normalizeCourse(selectedLecture.course_text))} / {semesterLabel(normalizeSemesterKey(selectedLecture.semester_text))} / {disciplineLabel(normalizeDiscipline(selectedLecture.discipline))}
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => handleOpenCleanTextInEditor(selectedLecture)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
            >
              Открыть чистый текст в редакторе
            </button>

            <div className="relative" ref={downloadMenuRef}>
              <button
                onClick={() => {
                  setDownloadMenuOpen((prev) => !prev);
                  setDownloadMenuError('');
                }}
                className="px-3 py-2 rounded-lg text-sm border flex items-center gap-1.5"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                Загрузить текст лекции
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {downloadMenuOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              <div
                className={`absolute left-0 top-full mt-2 w-[300px] rounded-xl border shadow-xl overflow-hidden transition-all duration-300 origin-top ${downloadMenuOpen ? 'max-h-[420px] opacity-100 scale-100' : 'max-h-0 opacity-0 scale-95 pointer-events-none'}`}
                style={{
                  borderColor: 'var(--border-color)',
                  background: isLightTheme ? 'rgba(255,255,247,0.98)' : 'rgba(28,21,22,0.98)',
                }}
              >
                <div className="p-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <p className="text-sm font-medium" style={{ color: headingColor }}>Формат загрузки</p>
                  <p className="text-xs mt-1" style={{ color: mutedColor }}>
                    Выберите формат: TXT, MD, DOCX или PDF.
                  </p>
                </div>

                <div className="p-2 space-y-1">
                  {EXPORT_FORMATS.map((format) => (
                    <button
                      key={format.id}
                      onClick={() => handleDownloadLecture(format.id)}
                      className="w-full text-left px-3 py-2 rounded-lg border transition-all flex items-center justify-between gap-2 disabled:opacity-60"
                      style={{
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-primary)',
                        background: 'var(--bg-primary)',
                      }}
                      disabled={Boolean(downloadingFormat)}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{format.icon}</span>
                        <span className="truncate text-sm">{format.label} - {format.hint}</span>
                      </span>
                      {downloadingFormat === format.id && (
                        <span className="text-xs" style={{ color: mutedColor }}>Подготовка...</span>
                      )}
                    </button>
                  ))}
                </div>

                {downloadMenuError && (
                  <p className="px-3 pb-3 text-xs" style={{ color: '#ef4444' }}>
                    {downloadMenuError}
                  </p>
                )}
              </div>
            </div>

            <div className="relative inline-flex items-center gap-2">
              <button
                onClick={() => {
                  if (selectedLecture.is_ai_filtered) return;
                  openMaterialRequestModal(selectedLecture, 'ai_filter', 'ИИ-фильтрация текста');
                }}
                disabled={selectedLecture.is_ai_filtered}
                className="px-3 py-2 rounded-lg text-sm border flex items-center gap-1.5 disabled:opacity-60"
                style={{
                  borderColor: 'var(--border-color)',
                  color: selectedLecture.is_ai_filtered ? '#22c55e' : 'var(--text-primary)',
                  background: selectedLecture.is_ai_filtered ? 'rgba(34,197,94,.10)' : 'var(--bg-primary)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {selectedLecture.is_ai_filtered ? 'check_circle' : 'auto_fix_high'}
                </span>
                {selectedLecture.is_ai_filtered ? 'Текст прошел фильтрацию' : 'ИИ-фильтрация текста'}
              </button>

              <button
                type="button"
                onMouseEnter={() => setShowAiFilterHelp(true)}
                onMouseLeave={() => setShowAiFilterHelp(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center border"
                style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
                aria-label="Что такое ИИ-фильтрация"
              >
                <span className="material-symbols-outlined text-base">help</span>
              </button>

              {showAiFilterHelp && (
                <div
                  className="absolute left-0 top-full mt-2 z-50 w-72 rounded-xl border p-3 text-xs shadow-2xl"
                  style={{ background: isLightTheme ? 'rgba(255,255,247,0.98)' : 'rgba(28,21,22,0.98)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  ИИ-фильтрация очищает текст лекции от ошибок распознавания, лишних слов и артефактов. После фильтрации в базе открывается уже чистая версия текста.
                </div>
              )}
            </div>
          </div>

          <div className="mb-3">
            <p className="text-xs mb-2" style={{ color: mutedColor }}>Готовые режимы</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {NOTE_MODES.map((mode) => {
                const note = selectedLectureModeState?.noteMap.get(mode.id);
                const latestReq = selectedLectureModeState?.requestMap.get(mode.id);
                const isGenerated = Boolean(note);
                const isPending = !isGenerated && latestReq?.status === 'pending';
                const isProcessing = !isGenerated && latestReq?.status === 'processing';
                const isRejected = !isGenerated && latestReq?.status === 'rejected';
                const isFailed = !isGenerated && latestReq?.status === 'failed';

                const bg = isGenerated
                  ? (isLightTheme ? 'rgba(34,197,94,.10)' : 'rgba(34,197,94,.12)')
                  : isProcessing
                    ? (isLightTheme ? 'rgba(59,130,246,.12)' : 'rgba(59,130,246,.18)')
                    : isPending
                    ? (isLightTheme ? 'rgba(245,158,11,.12)' : 'rgba(245,158,11,.16)')
                    : (isRejected || isFailed)
                      ? (isLightTheme ? 'rgba(239,68,68,.10)' : 'rgba(239,68,68,.14)')
                      : 'var(--bg-primary)';
                const borderColor = isGenerated
                  ? 'rgba(34,197,94,.35)'
                  : isProcessing
                    ? 'rgba(59,130,246,.45)'
                    : isPending
                    ? 'rgba(245,158,11,.4)'
                    : (isRejected || isFailed)
                      ? 'rgba(239,68,68,.35)'
                      : 'var(--border-color)';
                const titleColor = isGenerated
                  ? '#22c55e'
                  : isProcessing
                    ? '#3b82f6'
                    : isPending
                    ? '#f59e0b'
                    : (isRejected || isFailed)
                      ? '#ef4444'
                      : 'var(--text-primary)';

                return (
                  <button
                    key={mode.id}
                    onClick={(e) => {
                      if (isGenerated && note) {
                        openNoteActionMenu(selectedLecture.lecture_id, note.id, mode.label, e.currentTarget as HTMLElement);
                        return;
                      }
                      if (isPending || isProcessing || isFailed) return;
                      openMaterialRequestModal(selectedLecture, mode.id, mode.label);
                    }}
                    className="text-left p-3 rounded-lg border transition-all"
                    style={{ background: bg, borderColor, color: 'var(--text-primary)' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: titleColor }}>{mode.icon}</span>
                      <span className="text-sm font-medium" style={{ color: titleColor }}>{mode.label}</span>
                    </div>
                    <p className="text-xs" style={{ color: mutedColor }}>
                      {isGenerated
                        ? 'Материал готов. Нажмите, чтобы открыть.'
                        : isProcessing
                          ? 'Генерация запущена и выполняется в фоне.'
                        : isPending
                          ? 'Заявка уже отправлена и ожидает модерации.'
                          : isRejected
                            ? `Отклонено${latestReq?.review_comment ? `: ${latestReq.review_comment}` : ''}`
                          : isFailed
                            ? `Ошибка генерации${latestReq?.generation_error ? `: ${latestReq.generation_error}` : ''}. Модератор повторно обработает эту же заявку.`
                            : 'Материала пока нет. Нажмите, чтобы отправить заявку.'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {requestModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setRequestModal(null)}
        >
          <div
            className="rounded-2xl p-5 w-full max-w-lg"
            style={{ background: isLightTheme ? 'rgba(255,255,240,.98)' : 'rgba(33,24,25,.97)', border: cardBorder }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-medium mb-2" style={{ color: headingColor }}>
              {requestModal.modeId === 'ai_filter' ? 'Заявка на ИИ-фильтрацию' : 'Заявка на генерацию материала'}
            </h4>
            <p className="text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
              {requestModal.modeId === 'ai_filter'
                ? 'Отправить модератору заявку на фильтрацию текста лекции:'
                : 'Отправить модератору заявку на создание материала:'}
            </p>
            <p className="text-sm mb-4" style={{ color: mutedColor }}>
              «{requestModal.modeLabel}» для лекции «{requestModal.lecture.lecture_title}»
            </p>
            {requestModalError && (
              <p className="text-sm mb-3" style={{ color: '#ef4444' }}>{requestModalError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRequestModal(null)}
                className="px-3 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                disabled={requestSubmitting}
              >
                Отмена
              </button>
              <button
                onClick={submitMaterialRequest}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
                disabled={requestSubmitting}
              >
                {requestSubmitting ? 'Отправка...' : 'Отправить заявку'}
              </button>
            </div>
          </div>
        </div>
      )}

      {noteActionMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => {
            setNoteActionMenu(null);
            setNoteExportMenuOpen(false);
            setNoteExportError('');
          }}
        >
          <div
            ref={noteActionMenuRef}
            className="fixed w-[280px] rounded-2xl p-3 border shadow-2xl transition-all duration-200 overflow-y-auto"
            style={{
              left: `${noteActionMenu.x}px`,
              top: `${noteActionMenu.y}px`,
              maxHeight: 'calc(100vh - 24px)',
              background: isLightTheme ? 'rgba(255,255,247,0.98)' : 'rgba(28,21,22,0.98)',
              borderColor: 'var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-medium mb-1 truncate" style={{ color: headingColor }}>{noteActionMenu.title}</h4>
            <p className="text-[11px] mb-3" style={{ color: mutedColor }}>Выберите действие.</p>

            {!noteExportMenuOpen ? (
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    setNotePreviewModal({ lectureId: noteActionMenu.lectureId, noteId: noteActionMenu.noteId, title: noteActionMenu.title });
                    setNoteActionMenu(null);
                  }}
                  className="w-full px-3 py-2 rounded-lg border text-left flex items-center gap-2 text-sm"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>visibility</span>
                  Предпросмотр
                </button>
                <button
                  onClick={() => {
                    onOpenInEditor(noteActionMenu.content, noteActionMenu.lectureId, selectedLecture?.lecture_title);
                    setNoteActionMenu(null);
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
                  {EXPORT_FORMATS.map((format) => (
                    <button
                      key={format.id}
                      onClick={async () => {
                        setNoteDownloadFormat(format.id);
                        setNoteExportError('');
                        try {
                          await exportLectureText(noteActionMenu.content || noteTextContent, noteActionMenu.title, format.id);
                          setNoteActionMenu(null);
                          setNoteExportMenuOpen(false);
                        } catch {
                          setNoteExportError('Не удалось скачать файл.');
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
                {noteExportError && <p className="mt-3 text-xs" style={{ color: '#ef4444' }}>{noteExportError}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {notePreviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setNotePreviewModal(null)}
        >
          <div
            className="rounded-2xl p-5 w-full max-w-4xl"
            style={{ background: isLightTheme ? 'rgba(255,255,240,.98)' : 'rgba(33,24,25,.97)', border: cardBorder }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-medium mb-2" style={{ color: headingColor }}>{notePreviewModal.title}</h4>
            <div
              ref={noteTextContainerRef}
              className="max-h-[60vh] overflow-y-auto prose-modal text-sm leading-relaxed p-3 rounded-lg border"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              dangerouslySetInnerHTML={{ __html: mdParse(noteTextContent || '') }}
            >
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onOpenInEditor(noteTextContent, notePreviewModal.lectureId, selectedLecture?.lecture_title)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
              >
                Открыть в редакторе
              </button>
              <button
                onClick={() => setNotePreviewModal(null)}
                className="px-3 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              >
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
