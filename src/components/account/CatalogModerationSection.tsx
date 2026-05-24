import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import 'katex/dist/katex.min.css';
import { safeMdParse } from '../../utils/markdownUtils';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface ReqItem {
  id: string;
  lecture_id: string;
  lecture_title: string;
  stream_id: string;
  direction_id: string;
  faculty_id: string;
  stream_name: string;
  direction_name: string;
  faculty_name: string;
  discipline: string;
  lecturer_name: string | null;
  course_text: string | null;
  semester_text: string | null;
  lecture_number_text: string | null;
  study_year_text: string | null;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_comment: string | null;
  requested_by_login: string;
}

interface MaterialReqItem {
  id: string;
  lecture_id: string;
  lecture_title: string;
  stream_id: string;
  direction_id: string;
  faculty_id: string;
  stream_name: string;
  direction_name: string;
  faculty_name: string;
  mode: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'failed';
  review_comment: string | null;
  generation_error?: string | null;
  is_regeneration?: boolean;
  regeneration_reason?: string | null;
  requested_by_login: string;
  created_at: string;
}

interface LookupItem { id: string; name: string }
interface DirectionItem extends LookupItem { faculty_id: string }
interface StreamItem extends LookupItem { direction_id: string; course: number | null; study_year_start: number | null }
type DeletableNodeType = 'faculty' | 'direction' | 'stream';
type SemesterKey = 'winter' | 'spring';

interface CatalogItem {
  id: string;
  lecture_id: string;
  lecture_title: string;
  discipline: string;
  lecturer_name: string | null;
  course_text: string | null;
  semester_text: string | null;
  lecture_number_text: string | null;
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

interface CatalogEditState {
  lecture_title: string;
  discipline: string;
  lecturer_name: string;
  course_text: string;
  semester_text: string;
  lecture_number_text: string;
  study_year_text: string;
  stream_id: string;
}

interface DeleteDialogState {
  open: boolean;
  nodeType: DeletableNodeType;
  nodeId: string;
  nodeName: string;
  message: string;
  counts: Record<string, number>;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  onConfirm: () => void;
}

interface CourseDeleteDialogState {
  open: boolean;
  streamId: string;
  courseText: string;
  message: string;
  counts: Record<string, number>;
}

interface CatalogNoticeState {
  type: 'error' | 'success';
  message: string;
}

interface CatalogModerationSectionProps {
  isLightTheme: boolean;
}

const statusLabel: Record<string, string> = {
  pending: 'На модерации',
  processing: 'Генерируется',
  approved: 'Готово',
  rejected: 'Отклонено',
  failed: 'Ошибка генерации',
};
const statusColor: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#3b82f6',
  approved: '#22c55e',
  rejected: '#ef4444',
  failed: '#dc2626',
};
const materialModeLabels: Record<string, string> = {
  summary: 'Краткий конспект',
  detailed_notes: 'Расширенный конспект',
  qa: 'Q&A',
  flashcards: 'Флешкарточки',
  mindmap: 'Майнд-карта',
  ai_filter: 'ИИ-фильтрация текста',
};
type NodeType = 'root' | 'faculty' | 'direction' | 'stream' | 'course' | 'semester' | 'discipline' | 'lecture';
const normalizeSemesterForApi = (value: string | null | undefined): 'winter' | 'spring' | null => {
  const lower = (value || '').trim().toLowerCase();
  if (!lower) return null;
  if (lower === 'winter' || lower === 'зимний' || lower === 'зимний семестр') return 'winter';
  if (lower === 'spring' || lower === 'весенний' || lower === 'весенний семестр') return 'spring';
  return null;
};

const CatalogModerationSection: React.FC<CatalogModerationSectionProps> = ({ isLightTheme }) => {
  const { token, user } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [requests, setRequests] = useState<ReqItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewText, setReviewText] = useState<Record<string, string>>({});
  const [lectureTitleText, setLectureTitleText] = useState<Record<string, string>>({});
  const [disciplineText, setDisciplineText] = useState<Record<string, string>>({});
  const [lecturerText, setLecturerText] = useState<Record<string, string>>({});
  const [courseText, setCourseText] = useState<Record<string, string>>({});
  const [semesterText, setSemesterText] = useState<Record<string, string>>({});
  const [lectureNumberText, setLectureNumberText] = useState<Record<string, string>>({});
  const [studyYearText, setStudyYearText] = useState<Record<string, string>>({});
  const [facultyIdText, setFacultyIdText] = useState<Record<string, string>>({});
  const [directionIdText, setDirectionIdText] = useState<Record<string, string>>({});
  const [streamIdText, setStreamIdText] = useState<Record<string, string>>({});
  const [disciplineOptions, setDisciplineOptions] = useState<string[]>([]);
  const [requestLecturerOptions, setRequestLecturerOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [moderationNotice, setModerationNotice] = useState<CatalogNoticeState | null>(null);
  const [materialRequests, setMaterialRequests] = useState<MaterialReqItem[]>([]);
  const [materialSelectedId, setMaterialSelectedId] = useState<string | null>(null);
  const [materialStatusFilter, setMaterialStatusFilter] = useState<string>('pending');
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  const [materialReviewText, setMaterialReviewText] = useState<Record<string, string>>({});
  const [materialLoading, setMaterialLoading] = useState(false);
  const [materialProcessingById, setMaterialProcessingById] = useState<Record<string, boolean>>({});
  const [materialNotice, setMaterialNotice] = useState<CatalogNoticeState | null>(null);

  const [faculties, setFaculties] = useState<LookupItem[]>([]);
  const [directions, setDirections] = useState<DirectionItem[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [expandedFaculties, setExpandedFaculties] = useState<Record<string, boolean>>({});
  const [expandedDirections, setExpandedDirections] = useState<Record<string, boolean>>({});
  const [expandedStreams, setExpandedStreams] = useState<Record<string, boolean>>({});
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({});
  const [expandedSemesters, setExpandedSemesters] = useState<Record<string, boolean>>({});
  const [activeNodeType, setActiveNodeType] = useState<NodeType>('root');
  const [activeFacultyId, setActiveFacultyId] = useState('');
  const [activeDirectionId, setActiveDirectionId] = useState('');
  const [activeStreamId, setActiveStreamId] = useState('');
  const [activeCourseKey, setActiveCourseKey] = useState('');
  const [activeSemesterKey, setActiveSemesterKey] = useState('');
  const [activeDisciplineName, setActiveDisciplineName] = useState('');

  const [newFacultyName, setNewFacultyName] = useState('');
  const [newDirectionName, setNewDirectionName] = useState('');
  const [newStreamName, setNewStreamName] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [deleteProcessing, setDeleteProcessing] = useState(false);
  const [courseDeleteDialog, setCourseDeleteDialog] = useState<CourseDeleteDialogState | null>(null);
  const [courseDeleteProcessing, setCourseDeleteProcessing] = useState(false);

  const [renameFacultyName, setRenameFacultyName] = useState('');
  const [renameDirectionName, setRenameDirectionName] = useState('');
  const [renameStreamName, setRenameStreamName] = useState('');
  const [renameProcessing, setRenameProcessing] = useState(false);

  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogSemesters, setCatalogSemesters] = useState<CatalogSemesterItem[]>([]);
  const [catalogDisciplineNodes, setCatalogDisciplineNodes] = useState<CatalogDisciplineNodeItem[]>([]);
  const [catalogSelectedId, setCatalogSelectedId] = useState<string | null>(null);
  const [catalogEdit, setCatalogEdit] = useState<Record<string, CatalogEditState>>({});
  const [catalogProcessing, setCatalogProcessing] = useState(false);
  const [catalogNotice, setCatalogNotice] = useState<CatalogNoticeState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const [bulkCourseName, setBulkCourseName] = useState('');
  const [bulkSemesterKey, setBulkSemesterKey] = useState('winter');
  const [bulkDisciplineName, setBulkDisciplineName] = useState('');
  const [newDisciplineName, setNewDisciplineName] = useState('');

  const headingColor = isLightTheme ? '#2a1918' : '#fff7ec';
  const mutedColor = isLightTheme ? '#7a5a5c' : '#c6b7a7';
  const surface = { borderColor: 'var(--border-color)', background: 'var(--hover-bg)' };
  const isAdmin = user?.role === 'admin';

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`${API_BASE}/api/catalog/requests?${params}`, { headers });
      if (!res.ok) return;
      const data: ReqItem[] = await res.json();
      setRequests(data);
      setSelectedId(prev => (prev && data.some(d => d.id === prev) ? prev : (data[0]?.id ?? null)));
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

  const loadMaterialRequests = useCallback(async () => {
    setMaterialLoading(true);
    try {
      const params = new URLSearchParams();
      if (materialStatusFilter) params.set('status', materialStatusFilter);
      const res = await fetch(`${API_BASE}/api/catalog/material-requests?${params}`, { headers });
      if (!res.ok) return;
      const data: MaterialReqItem[] = await res.json();
      setMaterialRequests(data);
      setMaterialSelectedId(prev => (prev && data.some(d => d.id === prev) ? prev : (data[0]?.id ?? null)));
    } finally {
      setMaterialLoading(false);
    }
  }, [headers, materialStatusFilter]);

  const loadCatalogItems = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/catalog/items?limit=300`, { headers });
      if (!res.ok) return;
      const data: CatalogItem[] = await res.json();
      setCatalogItems(data);
      setCatalogSelectedId(prev => (prev && data.some(d => d.id === prev) ? prev : (data[0]?.id ?? null)));

      const [semRes, discRes] = await Promise.all([
        fetch(`${API_BASE}/api/catalog/semesters`, { headers }),
        fetch(`${API_BASE}/api/catalog/discipline-nodes`, { headers }),
      ]);
      if (semRes.ok) setCatalogSemesters(await semRes.json());
      if (discRes.ok) setCatalogDisciplineNodes(await discRes.json());
    } finally {
      // no-op
    }
  }, [headers]);

  const renameFaculty = async () => {
    if (!activeFaculty || !renameFacultyName.trim()) return;
    setRenameProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/catalog/faculties/${activeFaculty.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameFacultyName.trim() }),
      });
      if (!res.ok) throw new Error('Не удалось переименовать факультет');
      await Promise.all([loadLookups(), loadCatalogItems()]);
      window.dispatchEvent(new Event('catalog:refresh'));
    } finally {
      setRenameProcessing(false);
    }
  };

  const renameDirection = async () => {
    if (!activeDirection || !renameDirectionName.trim()) return;
    setRenameProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/catalog/directions/${activeDirection.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameDirectionName.trim() }),
      });
      if (!res.ok) throw new Error('Не удалось переименовать направление');
      await Promise.all([loadLookups(), loadCatalogItems()]);
      window.dispatchEvent(new Event('catalog:refresh'));
    } finally {
      setRenameProcessing(false);
    }
  };

  const renameStream = async () => {
    if (!activeStream || !renameStreamName.trim()) return;
    setRenameProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/catalog/streams/${activeStream.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameStreamName.trim() }),
      });
      if (!res.ok) throw new Error('Не удалось переименовать поток');
      await Promise.all([loadLookups(), loadCatalogItems()]);
      window.dispatchEvent(new Event('catalog:refresh'));
    } finally {
      setRenameProcessing(false);
    }
  };

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
    const map: Record<string, SemesterKey[]> = {};
    catalogSemesters.forEach((row) => {
      const course = (row.course_text || '').trim();
      const semester = (row.semester_key || '').trim() as SemesterKey;
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

  const selected = useMemo(() => filtered.find(r => r.id === selectedId) ?? filtered[0] ?? null, [filtered, selectedId]);
  const selectedFacultyId = selected ? (facultyIdText[selected.id] ?? selected.faculty_id ?? '') : '';
  const selectedDirectionId = selected ? (directionIdText[selected.id] ?? selected.direction_id ?? '') : '';
  const selectedStreamId = selected ? (streamIdText[selected.id] ?? selected.stream_id ?? '') : '';
  const selectedDirectionOptions = directions.filter(d => !selectedFacultyId || d.faculty_id === selectedFacultyId);
  const selectedStreamOptions = streams.filter(s => !selectedDirectionId || s.direction_id === selectedDirectionId);
  const materialFiltered = useMemo(() => {
    const q = materialSearchQuery.trim().toLowerCase();
    if (!q) return materialRequests;
    return materialRequests.filter(r =>
      r.lecture_title.toLowerCase().includes(q) ||
      r.requested_by_login.toLowerCase().includes(q) ||
      (materialModeLabels[r.mode] || r.mode).toLowerCase().includes(q) ||
      r.stream_name.toLowerCase().includes(q)
    );
  }, [materialRequests, materialSearchQuery]);
  const materialSelected = useMemo(
    () => materialFiltered.find(r => r.id === materialSelectedId) ?? materialFiltered[0] ?? null,
    [materialFiltered, materialSelectedId]
  );
  const catalogSelected = useMemo(
    () => catalogItems.find(item => item.id === catalogSelectedId) ?? catalogItems[0] ?? null,
    [catalogItems, catalogSelectedId]
  );
  const activeDisciplineLectures = useMemo(() => {
    if (!activeStreamId || !activeCourseKey || !activeSemesterKey || !activeDisciplineName) return [];
    return catalogItems.filter(item => item.stream_id === activeStreamId && item.course_text === activeCourseKey && item.semester_text === activeSemesterKey && item.discipline === activeDisciplineName);
  }, [catalogItems, activeStreamId, activeCourseKey, activeSemesterKey, activeDisciplineName]);

  useEffect(() => { loadRequests(); }, [loadRequests]);
  useEffect(() => { loadLookups(); }, [loadLookups]);
  useEffect(() => { loadMaterialRequests(); }, [loadMaterialRequests]);
  useEffect(() => { loadCatalogItems(); }, [loadCatalogItems]);
  useEffect(() => { setPreviewText(''); }, [selectedId]);
  useEffect(() => {
    if (previewLoading || !previewText || !previewRef.current) return;
    import('katex/contrib/auto-render').then(({ default: renderMathInElement }) => {
      if (!previewRef.current) return;
      renderMathInElement(previewRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    });
  }, [previewLoading, previewText]);
  useEffect(() => {
    setRenameFacultyName(activeFaculty?.name || '');
  }, [activeFaculty?.id]);
  useEffect(() => {
    setRenameDirectionName(activeDirection?.name || '');
  }, [activeDirection?.id]);
  useEffect(() => {
    setRenameStreamName(activeStream?.name || '');
  }, [activeStream?.id]);
  useEffect(() => {
    if (!selected) return;
    setLectureTitleText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.lecture_title ?? '' }));
    setDisciplineText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.discipline ?? '' }));
    setLecturerText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.lecturer_name ?? '' }));
    setCourseText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.course_text ?? '' }));
    setSemesterText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.semester_text ?? 'winter' }));
    setLectureNumberText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.lecture_number_text ?? '' }));
    setStudyYearText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.study_year_text ?? '' }));
    setFacultyIdText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.faculty_id ?? '' }));
    setDirectionIdText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.direction_id ?? '' }));
    setStreamIdText(prev => ({ ...prev, [selected.id]: prev[selected.id] ?? selected.stream_id ?? '' }));
  }, [selected]);
  useEffect(() => {
    if (!catalogSelected) return;
    setCatalogEdit(prev => ({
      ...prev,
      [catalogSelected.id]: prev[catalogSelected.id] ?? {
        lecture_title: catalogSelected.lecture_title || '',
        discipline: catalogSelected.discipline || '',
        lecturer_name: catalogSelected.lecturer_name || '',
        course_text: catalogSelected.course_text || '',
        semester_text: catalogSelected.semester_text || '',
        lecture_number_text: catalogSelected.lecture_number_text || '',
        study_year_text: catalogSelected.study_year_text || '',
        stream_id: catalogSelected.stream_id || '',
      },
    }));
  }, [catalogSelected]);
  useEffect(() => {
    if (activeCourseKey) setBulkCourseName(activeCourseKey);
  }, [activeCourseKey]);
  useEffect(() => {
    if (activeSemesterKey) setBulkSemesterKey(activeSemesterKey);
  }, [activeSemesterKey]);
  useEffect(() => {
    if (activeDisciplineName) setBulkDisciplineName(activeDisciplineName);
  }, [activeDisciplineName]);

  useEffect(() => {
    if (!selected) return;
    const selectedStreamId = (streamIdText[selected.id] || selected.stream_id || '').trim();
    if (!selectedStreamId) return;
    (async () => {
      const [dRes, lRes] = await Promise.all([
        fetch(`${API_BASE}/api/catalog/disciplines?stream_id=${selectedStreamId}`, { headers }),
        fetch(`${API_BASE}/api/catalog/lecturers?stream_id=${selectedStreamId}`, { headers }),
      ]);
      setDisciplineOptions(dRes.ok ? await dRes.json() : []);
      setRequestLecturerOptions(lRes.ok ? await lRes.json() : []);
    })();
  }, [selected?.id, selected?.stream_id, streamIdText, headers]);

  const selectFacultyNode = (facultyId: string) => {
    setActiveNodeType('faculty');
    setActiveFacultyId(facultyId);
    setActiveDirectionId('');
    setActiveStreamId('');
    setActiveCourseKey('');
    setActiveSemesterKey('');
    setActiveDisciplineName('');
    setCatalogSelectedId(null);
    setExpandedFaculties(prev => ({ ...prev, [facultyId]: true }));
  };

  const selectDirectionNode = (facultyId: string, directionId: string) => {
    setActiveNodeType('direction');
    setActiveFacultyId(facultyId);
    setActiveDirectionId(directionId);
    setActiveStreamId('');
    setActiveCourseKey('');
    setActiveSemesterKey('');
    setActiveDisciplineName('');
    setCatalogSelectedId(null);
    setExpandedFaculties(prev => ({ ...prev, [facultyId]: true }));
    setExpandedDirections(prev => ({ ...prev, [directionId]: true }));
  };

  const selectStreamNode = (facultyId: string, directionId: string, streamId: string) => {
    setActiveNodeType('stream');
    setActiveFacultyId(facultyId);
    setActiveDirectionId(directionId);
    setActiveStreamId(streamId);
    setActiveCourseKey('');
    setActiveSemesterKey('');
    setActiveDisciplineName('');
    setCatalogSelectedId(null);
    setExpandedFaculties(prev => ({ ...prev, [facultyId]: true }));
    setExpandedDirections(prev => ({ ...prev, [directionId]: true }));
    setExpandedStreams(prev => ({ ...prev, [streamId]: true }));
  };

  const selectCourseNode = (facultyId: string, directionId: string, streamId: string, courseKey: string) => {
    setActiveNodeType('course');
    setActiveFacultyId(facultyId);
    setActiveDirectionId(directionId);
    setActiveStreamId(streamId);
    setActiveCourseKey(courseKey);
    setActiveSemesterKey('');
    setActiveDisciplineName('');
    setCatalogSelectedId(null);
    setExpandedFaculties(prev => ({ ...prev, [facultyId]: true }));
    setExpandedDirections(prev => ({ ...prev, [directionId]: true }));
    setExpandedStreams(prev => ({ ...prev, [streamId]: true }));
    setExpandedCourses(prev => ({ ...prev, [`${streamId}|${courseKey}`]: true }));
  };

  const selectSemesterNode = (facultyId: string, directionId: string, streamId: string, courseKey: string, semesterKey: string) => {
    setActiveNodeType('semester');
    setActiveFacultyId(facultyId);
    setActiveDirectionId(directionId);
    setActiveStreamId(streamId);
    setActiveCourseKey(courseKey);
    setActiveSemesterKey(semesterKey);
    setActiveDisciplineName('');
    setCatalogSelectedId(null);
    setExpandedFaculties(prev => ({ ...prev, [facultyId]: true }));
    setExpandedDirections(prev => ({ ...prev, [directionId]: true }));
    setExpandedStreams(prev => ({ ...prev, [streamId]: true }));
    setExpandedCourses(prev => ({ ...prev, [`${streamId}|${courseKey}`]: true }));
    setExpandedSemesters(prev => ({ ...prev, [`${streamId}|${courseKey}|${semesterKey}`]: true }));
  };

  const selectDisciplineNode = (facultyId: string, directionId: string, streamId: string, courseKey: string, semesterKey: string, disciplineName: string) => {
    setActiveNodeType('discipline');
    setActiveFacultyId(facultyId);
    setActiveDirectionId(directionId);
    setActiveStreamId(streamId);
    setActiveCourseKey(courseKey);
    setActiveSemesterKey(semesterKey);
    setActiveDisciplineName(disciplineName);
    const firstLecture = catalogItems.find(item => item.stream_id === streamId && item.course_text === courseKey && item.semester_text === semesterKey && item.discipline === disciplineName);
    setCatalogSelectedId(firstLecture?.id ?? null);
    setExpandedFaculties(prev => ({ ...prev, [facultyId]: true }));
    setExpandedDirections(prev => ({ ...prev, [directionId]: true }));
    setExpandedStreams(prev => ({ ...prev, [streamId]: true }));
    setExpandedCourses(prev => ({ ...prev, [`${streamId}|${courseKey}`]: true }));
    setExpandedSemesters(prev => ({ ...prev, [`${streamId}|${courseKey}|${semesterKey}`]: true }));
  };

  const moderate = async (id: string, action: 'approve' | 'reject') => {
    const review_comment = (reviewText[id] || '').trim();
    const lecture_title = (lectureTitleText[id] || '').trim();
    const discipline = (disciplineText[id] || '').trim();
    const lecturer_name = (lecturerText[id] || '').trim();
    const course_text = (courseText[id] || '').trim();
    const semester_text = normalizeSemesterForApi(semesterText[id]);
    const lecture_number_text = (lectureNumberText[id] || '').trim();
    const study_year_text = (studyYearText[id] || '').trim();
    const stream_id = (streamIdText[id] || '').trim();
    if (action === 'approve' && !discipline) {
      setModerationNotice({ type: 'error', message: 'Для одобрения укажите дисциплину.' });
      return;
    }
    if (action === 'approve' && !stream_id) {
      setModerationNotice({ type: 'error', message: 'Для одобрения нужно выбрать поток.' });
      return;
    }
    if (action === 'reject' && !review_comment) {
      setModerationNotice({ type: 'error', message: 'Для отклонения нужно указать причину.' });
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/catalog/requests/${id}/${action}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecture_title: lecture_title || null,
          stream_id: stream_id || null,
          review_comment: review_comment || null,
          discipline: discipline || null,
          lecturer_name: lecturer_name || null,
          course_text: course_text || null,
          semester_text,
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
      setModerationNotice({ type: 'error', message: e.message || 'Ошибка модерации' });
    } finally {
      setProcessing(false);
    }
  };

  const moderateMaterialRequest = async (id: string, action: 'approve' | 'reject') => {
    const review_comment = (materialReviewText[id] || '').trim();
    if (action === 'reject' && !review_comment) {
      setMaterialNotice({ type: 'error', message: 'Для отклонения нужно указать причину.' });
      return;
    }
    setMaterialProcessingById(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/catalog/material-requests/${id}/${action}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_comment: review_comment || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Ошибка обработки заявки на материал');
      }
      await loadMaterialRequests();
      window.dispatchEvent(new Event('catalog:refresh'));
    } catch (e: any) {
      setMaterialNotice({ type: 'error', message: e.message || 'Ошибка обработки заявки на материал' });
    } finally {
      setMaterialProcessingById(prev => ({ ...prev, [id]: false }));
    }
  };

  const openPreview = async (lectureId: string) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/lectures/${lectureId}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const tr = data.transcriptions?.[0];
      setPreviewText((tr?.processed_text || tr?.raw_text || 'Текст отсутствует').slice(0, 2500));
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
    const res = await fetch(`${API_BASE}/api/catalog/streams`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction_id: activeDirectionId, name }),
    });
    if (!res.ok) return;
    const created: StreamItem = await res.json();
    setNewStreamName('');
    await loadLookups();
    selectStreamNode(activeFacultyId, activeDirectionId, created.id);
  };

  const createCourse = async () => {
    const name = newCourseName.trim();
    if (!activeStreamId || !name) return;
    const res = await fetch(`${API_BASE}/api/catalog/semesters`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stream_id: activeStreamId, course_text: name }),
    });
    if (res.ok) {
      setNewCourseName('');
      await loadLookups();
      setExpandedStreams(prev => ({ ...prev, [activeStreamId]: true }));
    } else {
      const err = await res.json().catch(() => ({}));
      setCatalogNotice({ type: 'error', message: err?.detail || 'Не удалось создать курс.' });
    }
  };

  const deleteCourse = async (streamId: string, courseText: string, force = false) => {
    if (!streamId || !courseText) return;
    const params = new URLSearchParams({ stream_id: streamId, course_text: courseText, force: String(force) });
    const res = await fetch(`${API_BASE}/api/catalog/semesters/by-course?${params}`, {
      method: 'DELETE',
      headers,
    });

    if (res.ok || res.status === 204) {
      setActiveCourseKey('');
      setActiveSemesterKey('');
      setActiveDisciplineName('');
      setActiveNodeType('stream');
      setCourseDeleteDialog(null);
      await loadLookups();
      window.dispatchEvent(new Event('catalog:refresh'));
      return;
    }

    const payload = await res.json().catch(() => ({}));
    const detail = parseDeleteError(payload);
    if (res.status === 409 && detail?.code === 'catalog_node_not_empty') {
      setCourseDeleteDialog({
        open: true,
        streamId,
        courseText,
        message: detail.message || `В курсе «${courseText}» есть лекции. Удалить вместе со всем содержимым?`,
        counts: detail.counts || {},
      });
      return;
    }
    setCatalogNotice({ type: 'error', message: detail?.message || 'Не удалось удалить курс.' });
  };

  const confirmDeleteCourse = async () => {
    if (!courseDeleteDialog) return;
    setCourseDeleteProcessing(true);
    try {
      await deleteCourse(courseDeleteDialog.streamId, courseDeleteDialog.courseText, true);
    } finally {
      setCourseDeleteProcessing(false);
    }
  };

  const courseDeleteCountEntries = useMemo(() => {
    if (!courseDeleteDialog?.counts) return [];
    const labels: Record<string, string> = {
      catalog_items: 'Лекций в каталоге',
      discipline_nodes: 'Дисциплин',
    };
    return Object.entries(courseDeleteDialog.counts)
      .filter(([, value]) => Number(value) > 0)
      .map(([key, value]) => ({ label: labels[key] || key, value: Number(value) }));
  }, [courseDeleteDialog]);

  const pluralByNodeType: Record<DeletableNodeType, string> = {
    faculty: 'faculties',
    direction: 'directions',
    stream: 'streams',
  };

  const parseDeleteError = (payload: any) => {
    if (!payload) return null;
    if (payload.detail && typeof payload.detail === 'object') return payload.detail;
    if (typeof payload.detail === 'string') return { message: payload.detail };
    if (typeof payload === 'object') return payload;
    return null;
  };

  const deleteNode = async (nodeType: DeletableNodeType, nodeId: string, nodeName: string, force = false) => {
    if (!nodeId) return;
    const params = force ? '?force=true' : '';
    const res = await fetch(`${API_BASE}/api/catalog/${pluralByNodeType[nodeType]}/${nodeId}${params}`, {
      method: 'DELETE',
      headers,
    });

    if (res.ok) {
      if (nodeType === 'faculty') {
        setActiveNodeType('root');
        setActiveFacultyId('');
        setActiveDirectionId('');
        setActiveStreamId('');
        setActiveCourseKey('');
        setActiveSemesterKey('');
        setActiveDisciplineName('');
        setCatalogSelectedId(null);
      } else if (nodeType === 'direction') {
        setActiveNodeType('faculty');
        setActiveDirectionId('');
        setActiveStreamId('');
        setActiveCourseKey('');
        setActiveSemesterKey('');
        setActiveDisciplineName('');
        setCatalogSelectedId(null);
      } else {
        setActiveNodeType('direction');
        setActiveStreamId('');
        setActiveCourseKey('');
        setActiveSemesterKey('');
        setActiveDisciplineName('');
        setCatalogSelectedId(null);
      }
      setDeleteDialog(null);
      await Promise.all([loadLookups(), loadRequests()]);
      window.dispatchEvent(new Event('catalog:refresh'));
      return;
    }

    const payload = await res.json().catch(() => ({}));
    const detail = parseDeleteError(payload);
    if (res.status === 409 && detail?.code === 'catalog_node_not_empty') {
      setDeleteDialog({
        open: true,
        nodeType,
        nodeId,
        nodeName,
        message: detail.message || `В разделе ${nodeName} есть вложенные элементы. Удалить всё?`,
        counts: detail.counts || {},
      });
      return;
    }
    setCatalogNotice({ type: 'error', message: detail?.message || 'Не удалось удалить раздел каталога.' });
  };

  const confirmDeleteFromDialog = async () => {
    if (!deleteDialog) return;
    setDeleteProcessing(true);
    try {
      await deleteNode(deleteDialog.nodeType, deleteDialog.nodeId, deleteDialog.nodeName, true);
    } finally {
      setDeleteProcessing(false);
    }
  };

  const deleteCountEntries = useMemo(() => {
    if (!deleteDialog?.counts) return [];
    const labels: Record<string, string> = {
      directions: 'Направлений',
      streams: 'Потоков',
      catalog_items: 'Файлов (лекций)',
      publication_requests: 'Заявок',
      material_generation_requests: 'Заявок на материалы',
      users: 'Пользователей',
    };
    return Object.entries(deleteDialog.counts)
      .filter(([, value]) => Number(value) > 0)
      .map(([key, value]) => ({ label: labels[key] || key, value: Number(value) }));
  }, [deleteDialog]);

  const saveCatalogItem = async () => {
    if (!catalogSelected) return;
    const edit = catalogEdit[catalogSelected.id];
    if (!edit) return;
    const canEditTitle = isAdmin || (user?.is_group_head && catalogSelected.stream_id === user?.stream_id);
    const payload: Record<string, string | null> = {
      discipline: edit.discipline.trim() || null,
      lecturer_name: edit.lecturer_name.trim() || null,
      course_text: edit.course_text.trim() || null,
      semester_text: edit.semester_text.trim() || null,
      lecture_number_text: edit.lecture_number_text.trim() || null,
      study_year_text: edit.study_year_text.trim() || null,
      stream_id: edit.stream_id || null,
    };
    if (canEditTitle) payload.lecture_title = edit.lecture_title.trim() || null;

    if (!payload.discipline) {
      setCatalogNotice({ type: 'error', message: 'Нужно указать дисциплину.' });
      return;
    }
    if (!payload.stream_id) {
      setCatalogNotice({ type: 'error', message: 'Нужно выбрать поток.' });
      return;
    }
    if (canEditTitle && !payload.lecture_title) {
      setCatalogNotice({ type: 'error', message: 'Нужно указать название лекции.' });
      return;
    }

    setCatalogProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/catalog/items/${catalogSelected.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Не удалось сохранить запись');
      }
      await loadCatalogItems();
      window.dispatchEvent(new Event('catalog:refresh'));
    } catch (e: any) {
      setCatalogNotice({ type: 'error', message: e.message || 'Не удалось сохранить запись' });
    } finally {
      setCatalogProcessing(false);
    }
  };

  const performDeleteCatalogItem = async () => {
    if (!catalogSelected) return;
    setCatalogProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/catalog/items/${catalogSelected.id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Не удалось удалить запись');
      }
      await loadCatalogItems();
      window.dispatchEvent(new Event('catalog:refresh'));
    } catch (e: any) {
      setCatalogNotice({ type: 'error', message: e.message || 'Не удалось удалить запись' });
    } finally {
      setCatalogProcessing(false);
    }
  };

  const requestDeleteCatalogItem = () => {
    if (!catalogSelected) return;
    setConfirmDialog({
      title: 'Подтвердите удаление',
      message: 'Удалить лекцию из базы? Лекция останется у владельца.',
      onConfirm: () => {
        setConfirmDialog(null);
        void performDeleteCatalogItem();
      },
    });
  };

  const applyBulkUpdate = async (payload: Record<string, string | null>) => {
    setCatalogProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/catalog/bulk-update`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Не удалось применить изменения');
      }
      await loadCatalogItems();
      window.dispatchEvent(new Event('catalog:refresh'));
    } catch (e: any) {
      setCatalogNotice({ type: 'error', message: e.message || 'Не удалось применить изменения' });
    } finally {
      setCatalogProcessing(false);
    }
  };

  const updateCourseNode = async () => {
    if (!activeStreamId || !activeCourseKey) return;
    const next = bulkCourseName.trim();
    if (!next) {
      setCatalogNotice({ type: 'error', message: 'Укажите новое название курса.' });
      return;
    }
    await applyBulkUpdate({
      stream_id: activeStreamId,
      course_text: activeCourseKey,
      new_course_text: next,
    });
  };

  const updateSemesterNode = async () => {
    if (!activeStreamId || !activeCourseKey || !activeSemesterKey) return;
    const next = bulkSemesterKey.trim();
    if (!next) {
      setCatalogNotice({ type: 'error', message: 'Укажите новый семестр.' });
      return;
    }
    await applyBulkUpdate({
      stream_id: activeStreamId,
      course_text: activeCourseKey,
      semester_text: activeSemesterKey,
      new_semester_text: next,
    });
  };

  const updateDisciplineNode = async () => {
    if (!activeStreamId || !activeCourseKey || !activeSemesterKey || !activeDisciplineName) return;
    const next = bulkDisciplineName.trim();
    if (!next) {
      setCatalogNotice({ type: 'error', message: 'Укажите новое название дисциплины.' });
      return;
    }
    await applyBulkUpdate({
      stream_id: activeStreamId,
      course_text: activeCourseKey,
      semester_text: activeSemesterKey,
      discipline: activeDisciplineName,
      new_discipline: next,
    });
  };

  const createDisciplineNode = async () => {
    if (!activeStreamId || !activeCourseKey || !activeSemesterKey) return;
    const name = newDisciplineName.trim();
    if (!name) {
      setCatalogNotice({ type: 'error', message: 'Укажите название дисциплины.' });
      return;
    }
    setCatalogProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/catalog/discipline-nodes`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream_id: activeStreamId,
          course_text: activeCourseKey,
          semester_key: activeSemesterKey,
          name,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Не удалось добавить дисциплину');
      }
      setNewDisciplineName('');
      await loadCatalogItems();
      window.dispatchEvent(new Event('catalog:refresh'));
    } catch (e: any) {
      setCatalogNotice({ type: 'error', message: e.message || 'Не удалось добавить дисциплину' });
    } finally {
      setCatalogProcessing(false);
    }
  };

  const performDeleteDisciplineNode = async (nodeId: string) => {
    if (!activeStreamId || !activeCourseKey || !activeSemesterKey || !activeDisciplineName) return;
    setCatalogProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/catalog/discipline-nodes/${nodeId}?force=true`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Не удалось удалить дисциплину');
      }
      setActiveDisciplineName('');
      setActiveNodeType('semester');
      setCatalogSelectedId(null);
      await loadCatalogItems();
      window.dispatchEvent(new Event('catalog:refresh'));
    } catch (e: any) {
      setCatalogNotice({ type: 'error', message: e.message || 'Не удалось удалить дисциплину' });
    } finally {
      setCatalogProcessing(false);
    }
  };

  const requestDeleteDisciplineNode = () => {
    if (!activeStreamId || !activeCourseKey || !activeSemesterKey || !activeDisciplineName) return;
    const node = catalogDisciplineNodes.find(n => n.stream_id === activeStreamId && n.course_text === activeCourseKey && n.semester_key === activeSemesterKey && n.name === activeDisciplineName);
    if (!node) {
      setCatalogNotice({ type: 'error', message: 'Дисциплина не найдена.' });
      return;
    }
    setConfirmDialog({
      title: 'Подтвердите удаление',
      message: 'Удалить дисциплину и все лекции внутри?',
      onConfirm: () => {
        setConfirmDialog(null);
        void performDeleteDisciplineNode(node.id);
      },
    });
  };

  return (
    <div>
      <div className="text-center mb-6 px-4">
        <h1 className="text-3xl lg:text-4xl font-light mb-3 tracking-wide" style={{ color: headingColor }}>Модерация базы лекций</h1>
        <p className="text-sm opacity-70" style={{ color: mutedColor }}>
          {user?.role === 'admin' ? 'Inbox всех заявок + управление структурой каталога' : 'Inbox заявок потока + просмотр структуры каталога'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px,1fr] gap-4">
        <section className="border rounded-xl p-3" style={surface}>
          <div className="flex items-center gap-2 mb-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              <option value="pending">На модерации</option>
              <option value="approved">Одобрено</option>
              <option value="rejected">Отклонено</option>
              <option value="">Все</option>
            </select>
            <button onClick={loadRequests} className="px-3 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Обновить</button>
          </div>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Поиск по заявкам..." className="w-full px-3 py-2 rounded-lg border text-sm mb-3" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          <div className="max-h-[65vh] overflow-y-auto space-y-2 pr-1">
            {loading ? <p className="text-sm px-2 py-3" style={{ color: mutedColor }}>Загрузка...</p> : filtered.length === 0 ? <p className="text-sm px-2 py-3" style={{ color: mutedColor }}>Заявок нет</p> : filtered.map((req) => (
              <button key={req.id} onClick={() => setSelectedId(req.id)} className="w-full text-left border rounded-lg p-3 transition-all" style={{ borderColor: selected?.id === req.id ? 'var(--text-primary)' : 'var(--border-color)', background: selected?.id === req.id ? 'rgba(68,41,43,0.08)' : 'var(--bg-primary)' }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate" style={{ color: headingColor }}>{req.lecture_title}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${statusColor[req.status]}22`, color: statusColor[req.status] }}>{statusLabel[req.status]}</span>
                </div>
                <p className="text-xs mt-1 truncate" style={{ color: mutedColor }}>{req.stream_name} · {req.discipline || 'Без дисциплины'}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: mutedColor }}>От: {req.requested_by_login}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="border rounded-xl p-4" style={surface}>
          {!selected ? <p className="text-sm" style={{ color: mutedColor }}>Выберите заявку слева.</p> : (
            <>
              {moderationNotice && (
                <div className="mb-3 rounded-lg border px-3 py-2 text-sm flex items-center justify-between gap-2" style={{ borderColor: moderationNotice.type === 'error' ? 'rgba(239,68,68,.5)' : 'rgba(34,197,94,.5)', background: 'var(--hover-bg)', color: headingColor }}>
                  <span>{moderationNotice.message}</span>
                  <button onClick={() => setModerationNotice(null)} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Закрыть</button>
                </div>
              )}
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-xs mb-1" style={{ color: mutedColor }}>Название лекции</p>
                  <input
                    value={lectureTitleText[selected.id] ?? selected.lecture_title}
                    onChange={(e) => setLectureTitleText(prev => ({ ...prev, [selected.id]: e.target.value }))}
                    className="w-full md:w-[420px] px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    placeholder="Название лекции"
                  />
                  <p className="text-xs mt-2" style={{ color: mutedColor }}>
                    {faculties.find(f => f.id === selectedFacultyId)?.name || 'Факультет'} · {directions.find(d => d.id === selectedDirectionId)?.name || 'Направление'} · {streams.find(s => s.id === selectedStreamId)?.name || 'Поток'}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full h-fit" style={{ background: `${statusColor[selected.status]}22`, color: statusColor[selected.status] }}>{statusLabel[selected.status]}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                <div className="text-xs p-2 rounded-lg" style={{ background: 'var(--bg-primary)', color: mutedColor }}>Дисциплина: <span style={{ color: headingColor }}>{selected.discipline || '—'}</span></div>
                <div className="text-xs p-2 rounded-lg" style={{ background: 'var(--bg-primary)', color: mutedColor }}>Лектор: <span style={{ color: headingColor }}>{selected.lecturer_name || '—'}</span></div>
                <div className="text-xs p-2 rounded-lg" style={{ background: 'var(--bg-primary)', color: mutedColor }}>Курс: <span style={{ color: headingColor }}>{selected.course_text || '—'}</span></div>
                <div className="text-xs p-2 rounded-lg" style={{ background: 'var(--bg-primary)', color: mutedColor }}>Семестр: <span style={{ color: headingColor }}>{selected.semester_text || '—'}</span></div>
                <div className="text-xs p-2 rounded-lg" style={{ background: 'var(--bg-primary)', color: mutedColor }}>Номер лекции: <span style={{ color: headingColor }}>{selected.lecture_number_text || '—'}</span></div>
                <div className="text-xs p-2 rounded-lg" style={{ background: 'var(--bg-primary)', color: mutedColor }}>Год записи: <span style={{ color: headingColor }}>{selected.study_year_text || '—'}</span></div>
              </div>

              <div className="mb-3">
                <p className="text-xs mb-1" style={{ color: mutedColor }}>Комментарий автора заявки</p>
                <div className="text-sm p-3 rounded-lg border min-h-[56px]" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>{selected.comment || '—'}</div>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs" style={{ color: mutedColor }}>Предпросмотр текста лекции</p>
                  <button onClick={() => openPreview(selected.lecture_id)} className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Показать</button>
                </div>
                <div className="text-sm p-3 rounded-lg border min-h-[86px] max-h-[220px] overflow-y-auto" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                  {previewLoading ? 'Загрузка...' : previewText ? (
                    <div
                      ref={previewRef}
                      className="prose-modal text-sm leading-relaxed"
                      style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}
                      dangerouslySetInnerHTML={{ __html: safeMdParse(previewText) }}
                    />
                  ) : (
                    'Нажмите "Показать" для просмотра фрагмента.'
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                <select
                  value={selectedFacultyId}
                  onChange={(e) => {
                    const nextFaculty = e.target.value;
                    setFacultyIdText(prev => ({ ...prev, [selected.id]: nextFaculty }));
                    setDirectionIdText(prev => ({ ...prev, [selected.id]: '' }));
                    setStreamIdText(prev => ({ ...prev, [selected.id]: '' }));
                  }}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">Факультет</option>
                  {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>

                <select
                  value={selectedDirectionId}
                  onChange={(e) => {
                    const nextDirection = e.target.value;
                    setDirectionIdText(prev => ({ ...prev, [selected.id]: nextDirection }));
                    setStreamIdText(prev => ({ ...prev, [selected.id]: '' }));
                  }}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">Направление</option>
                  {selectedDirectionOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>

                <select
                  value={selectedStreamId}
                  onChange={(e) => setStreamIdText(prev => ({ ...prev, [selected.id]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">Поток</option>
                  {selectedStreamOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                <input list={`discipline-options-${selected.id}`} value={disciplineText[selected.id] ?? ''} onChange={(e) => setDisciplineText(prev => ({ ...prev, [selected.id]: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="Дисциплина" />
                <input list={`lecturer-options-${selected.id}`} value={lecturerText[selected.id] ?? ''} onChange={(e) => setLecturerText(prev => ({ ...prev, [selected.id]: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="Лектор" />
                <input value={courseText[selected.id] ?? ''} onChange={(e) => setCourseText(prev => ({ ...prev, [selected.id]: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="Курс" />
                <select value={semesterText[selected.id] ?? 'winter'} onChange={(e) => setSemesterText(prev => ({ ...prev, [selected.id]: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                  <option value="winter">Зимний</option>
                  <option value="spring">Весенний</option>
                </select>
                <input value={lectureNumberText[selected.id] ?? ''} onChange={(e) => setLectureNumberText(prev => ({ ...prev, [selected.id]: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="Номер лекции" />
                <input value={studyYearText[selected.id] ?? ''} onChange={(e) => setStudyYearText(prev => ({ ...prev, [selected.id]: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="Год записи (напр. 2025)" />
              </div>
              <datalist id={`discipline-options-${selected.id}`}>{disciplineOptions.map((opt) => <option key={opt} value={opt} />)}</datalist>
              <datalist id={`lecturer-options-${selected.id}`}>{requestLecturerOptions.map((opt) => <option key={opt} value={opt} />)}</datalist>

              <textarea value={reviewText[selected.id] ?? ''} onChange={(e) => setReviewText(prev => ({ ...prev, [selected.id]: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm mb-3" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} rows={3} placeholder="Комментарий модератора (обязателен при отклонении)" />
              <div className="flex flex-wrap gap-2">
                <button disabled={processing} onClick={() => moderate(selected.id, 'approve')} className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: '#22c55e', color: '#fff' }}>Одобрить</button>
                <button disabled={processing} onClick={() => moderate(selected.id, 'reject')} className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: '#ef4444', color: '#fff' }}>Отклонить</button>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="mt-5 border rounded-xl p-4" style={surface}>
        <h3 className="text-base font-medium mb-3" style={{ color: headingColor }}>Заявки на генерацию материалов</h3>
        <div className="grid grid-cols-1 lg:grid-cols-[360px,1fr] gap-4">
          <section className="border rounded-xl p-3" style={{ ...surface, background: 'var(--bg-primary)' }}>
            <div className="flex items-center gap-2 mb-2">
              <select value={materialStatusFilter} onChange={(e) => setMaterialStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                <option value="pending">На модерации</option>
                <option value="processing">Генерируются</option>
                <option value="approved">Одобрено</option>
                <option value="rejected">Отклонено</option>
                <option value="failed">Ошибка генерации</option>
                <option value="">Все</option>
              </select>
              <button onClick={loadMaterialRequests} className="px-3 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Обновить</button>
            </div>
            <input value={materialSearchQuery} onChange={(e) => setMaterialSearchQuery(e.target.value)} placeholder="Поиск по заявкам..." className="w-full px-3 py-2 rounded-lg border text-sm mb-3" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
            <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
              {materialLoading ? <p className="text-sm px-2 py-3" style={{ color: mutedColor }}>Загрузка...</p> : materialFiltered.length === 0 ? <p className="text-sm px-2 py-3" style={{ color: mutedColor }}>Заявок нет</p> : materialFiltered.map((req) => (
                <button key={req.id} onClick={() => setMaterialSelectedId(req.id)} className="w-full text-left border rounded-lg p-3 transition-all" style={{ borderColor: materialSelected?.id === req.id ? 'var(--text-primary)' : 'var(--border-color)', background: materialSelected?.id === req.id ? 'rgba(68,41,43,0.08)' : 'var(--bg-primary)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: headingColor }}>{req.lecture_title}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${statusColor[req.status]}22`, color: statusColor[req.status] }}>{statusLabel[req.status]}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-xs truncate" style={{ color: mutedColor }}>{materialModeLabels[req.mode] || req.mode}</p>
                    {req.mode === 'ai_filter' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.14)', color: '#3b82f6' }}>
                        AI
                      </span>
                    )}
                    {req.is_regeneration && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.16)', color: '#d97706' }}>
                        Перегенерация
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: mutedColor }}>От: {req.requested_by_login} · {req.stream_name}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="border rounded-xl p-4" style={{ ...surface, background: 'var(--bg-primary)' }}>
            {!materialSelected ? <p className="text-sm" style={{ color: mutedColor }}>Выберите заявку слева.</p> : (
              <>
                {materialNotice && (
                  <div className="mb-3 rounded-lg border px-3 py-2 text-sm flex items-center justify-between gap-2" style={{ borderColor: materialNotice.type === 'error' ? 'rgba(239,68,68,.5)' : 'rgba(34,197,94,.5)', background: 'var(--hover-bg)', color: headingColor }}>
                    <span>{materialNotice.message}</span>
                    <button onClick={() => setMaterialNotice(null)} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Закрыть</button>
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-medium" style={{ color: headingColor }}>{materialSelected.lecture_title}</p>
                    <p className="text-xs mt-1" style={{ color: mutedColor }}>
                      {materialSelected.faculty_name} · {materialSelected.direction_name} · {materialSelected.stream_name}
                    </p>
                    <p className="text-xs mt-1" style={{ color: mutedColor }}>
                      Режим: <span style={{ color: headingColor }}>{materialModeLabels[materialSelected.mode] || materialSelected.mode}</span>
                    </p>
                    {materialSelected.mode === 'ai_filter' && (
                      <p className="text-xs mt-1" style={{ color: '#3b82f6' }}>
                        Это заявка на ИИ-фильтрацию текста лекции.
                      </p>
                    )}
                    {materialSelected.is_regeneration && (
                      <div className="mt-2 rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.07)' }}>
                        <p className="text-xs font-medium mb-0.5" style={{ color: '#d97706' }}>Заявка на перегенерацию</p>
                        {materialSelected.regeneration_reason ? (
                          <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
                            Причина: {materialSelected.regeneration_reason}
                          </p>
                        ) : (
                          <p className="text-xs" style={{ color: mutedColor }}>Причина не указана.</p>
                        )}
                      </div>
                    )}
                    <p className="text-xs mt-1" style={{ color: mutedColor }}>
                      Автор заявки: {materialSelected.requested_by_login}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${statusColor[materialSelected.status]}22`, color: statusColor[materialSelected.status] }}>{statusLabel[materialSelected.status]}</span>
                </div>

                <textarea
                  value={materialReviewText[materialSelected.id] ?? ''}
                  onChange={(e) => setMaterialReviewText(prev => ({ ...prev, [materialSelected.id]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm mb-3"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  rows={3}
                  placeholder="Комментарий модератора (обязателен при отклонении)"
                />

                {materialSelected.review_comment && (
                  <p className="text-xs mb-3" style={{ color: mutedColor }}>
                    Последний комментарий: {materialSelected.review_comment}
                  </p>
                )}

                {materialSelected.generation_error && (
                  <p className="text-xs mb-3" style={{ color: '#ef4444' }}>
                    Ошибка генерации: {materialSelected.generation_error}
                  </p>
                )}

                {materialSelected.status === 'failed' && (
                  <p className="text-xs mb-3" style={{ color: '#ef4444' }}>
                    Ранее генерация завершилась ошибкой. Эту же заявку можно повторно принять или отклонить.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={Boolean(materialProcessingById[materialSelected.id]) || !['pending', 'failed'].includes(materialSelected.status)}
                    onClick={() => moderateMaterialRequest(materialSelected.id, 'approve')}
                    className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                    style={{ background: '#22c55e', color: '#fff' }}
                  >
                    {materialProcessingById[materialSelected.id]
                      ? 'Отправка...'
                      : materialSelected.status === 'failed'
                        ? 'Повторно принять и сгенерировать'
                        : 'Одобрить и сгенерировать'}
                  </button>
                  <button
                    disabled={Boolean(materialProcessingById[materialSelected.id]) || !['pending', 'failed'].includes(materialSelected.status)}
                    onClick={() => moderateMaterialRequest(materialSelected.id, 'reject')}
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
      </section>

      <section className="mt-5 border rounded-xl p-4" style={surface}>
        <h3 className="text-base font-medium mb-2" style={{ color: headingColor }}>Структура каталога</h3>
        <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4">
          <div className="border rounded-lg p-3 max-h-[560px] overflow-y-auto" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
            <button onClick={() => { setActiveNodeType('root'); setActiveFacultyId(''); setActiveDirectionId(''); setActiveStreamId(''); setActiveCourseKey(''); setActiveSemesterKey(''); setActiveDisciplineName(''); }} className="text-left px-2 py-1 rounded text-sm w-full mb-1" style={{ background: activeNodeType === 'root' ? 'var(--text-primary)' : 'transparent', color: activeNodeType === 'root' ? 'var(--bg-primary)' : 'var(--text-primary)' }}>Каталог</button>
            {faculties.map(f => (
              <div key={f.id} className="mb-1">
                <div className="flex items-center gap-1">
                  <button onClick={() => setExpandedFaculties(prev => ({ ...prev, [f.id]: !prev[f.id] }))} className="text-xs w-5">{expandedFaculties[f.id] ? '▾' : '▸'}</button>
                  <button onClick={() => selectFacultyNode(f.id)} className="text-left px-2 py-1 rounded text-sm flex-1" style={{ background: activeNodeType === 'faculty' && activeFacultyId === f.id ? 'var(--text-primary)' : 'transparent', color: activeNodeType === 'faculty' && activeFacultyId === f.id ? 'var(--bg-primary)' : 'var(--text-primary)' }}>{f.name}</button>
                </div>
                {expandedFaculties[f.id] && (
                  <div className="ml-6 mt-1">
                    {(directionsByFaculty[f.id] || []).map(d => (
                      <div key={d.id} className="mb-1">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setExpandedDirections(prev => ({ ...prev, [d.id]: !prev[d.id] }))} className="text-xs w-5">{expandedDirections[d.id] ? '▾' : '▸'}</button>
                          <button onClick={() => selectDirectionNode(f.id, d.id)} className="text-left px-2 py-1 rounded text-sm flex-1" style={{ background: activeNodeType === 'direction' && activeDirectionId === d.id ? 'var(--text-primary)' : 'transparent', color: activeNodeType === 'direction' && activeDirectionId === d.id ? 'var(--bg-primary)' : 'var(--text-primary)' }}>{d.name}</button>
                        </div>
                        {expandedDirections[d.id] && (
                          <div className="ml-6 mt-1">
                            {(streamsByDirection[d.id] || []).map(s => {
                              const streamExpanded = expandedStreams[s.id] ?? false;
                              return (
                                <div key={s.id} className="mb-1">
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => setExpandedStreams(prev => ({ ...prev, [s.id]: !prev[s.id] }))} className="text-xs w-5">{streamExpanded ? '▾' : '▸'}</button>
                                    <button onClick={() => selectStreamNode(f.id, d.id, s.id)} className="text-left px-2 py-1 rounded text-sm flex-1" style={{ background: activeNodeType === 'stream' && activeStreamId === s.id ? 'var(--text-primary)' : 'transparent', color: activeNodeType === 'stream' && activeStreamId === s.id ? 'var(--bg-primary)' : 'var(--text-primary)' }}>{s.name}</button>
                                  </div>
                                  {streamExpanded && (
                                    <div className="ml-6 mt-1">
                                      {(coursesByStream[s.id] || []).map(course => {
                                        const courseKey = `${s.id}|${course}`;
                                        const courseExpanded = expandedCourses[courseKey] ?? false;
                                        return (
                                          <div key={courseKey} className="mb-1">
                                            <div className="flex items-center gap-1">
                                              <button onClick={() => setExpandedCourses(prev => ({ ...prev, [courseKey]: !prev[courseKey] }))} className="text-xs w-5">{courseExpanded ? '▾' : '▸'}</button>
                                              <button onClick={() => selectCourseNode(f.id, d.id, s.id, course)} className="text-left px-2 py-1 rounded text-sm flex-1" style={{ background: activeNodeType === 'course' && activeStreamId === s.id && activeCourseKey === course ? 'var(--text-primary)' : 'transparent', color: activeNodeType === 'course' && activeStreamId === s.id && activeCourseKey === course ? 'var(--bg-primary)' : 'var(--text-primary)' }}>{course}</button>
                                            </div>
                                            {courseExpanded && (
                                              <div className="ml-6 mt-1">
                                                {(semestersByStreamCourse[courseKey] || []).map(semester => {
                                                  const semKey = `${courseKey}|${semester}`;
                                                  const semExpanded = expandedSemesters[semKey] ?? false;
                                                  return (
                                                    <div key={semKey} className="mb-1">
                                                      <div className="flex items-center gap-1">
                                                        <button onClick={() => setExpandedSemesters(prev => ({ ...prev, [semKey]: !prev[semKey] }))} className="text-xs w-5">{semExpanded ? '▾' : '▸'}</button>
                                                        <button onClick={() => selectSemesterNode(f.id, d.id, s.id, course, semester)} className="text-left px-2 py-1 rounded text-sm flex-1" style={{ background: activeNodeType === 'semester' && activeStreamId === s.id && activeCourseKey === course && activeSemesterKey === semester ? 'var(--text-primary)' : 'transparent', color: activeNodeType === 'semester' && activeStreamId === s.id && activeCourseKey === course && activeSemesterKey === semester ? 'var(--bg-primary)' : 'var(--text-primary)' }}>{semester === 'winter' ? 'Зимний семестр' : 'Весенний семестр'}</button>
                                                      </div>
                                                      {semExpanded && (
                                                        <div className="ml-6 mt-1">
                                                          {(disciplinesByStreamCourseSemester[`${s.id}|${course}|${semester}`] || []).map(discipline => (
                                                            <button key={`${semKey}|${discipline}`} onClick={() => selectDisciplineNode(f.id, d.id, s.id, course, semester, discipline)} className="text-left px-2 py-1 rounded text-sm block w-full mb-1" style={{ background: activeNodeType === 'discipline' && activeStreamId === s.id && activeCourseKey === course && activeSemesterKey === semester && activeDisciplineName === discipline ? 'var(--text-primary)' : 'transparent', color: activeNodeType === 'discipline' && activeStreamId === s.id && activeCourseKey === course && activeSemesterKey === semester && activeDisciplineName === discipline ? 'var(--bg-primary)' : 'var(--text-primary)' }}>{discipline}</button>
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

          <div className="border rounded-lg p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
            <div className="flex flex-wrap items-center gap-2 text-xs mb-3" style={{ color: mutedColor }}>
              <span>Путь:</span><span>Каталог</span>
              {activeFaculty && <><span>/</span><span>{activeFaculty.name}</span></>}
              {activeDirection && <><span>/</span><span>{activeDirection.name}</span></>}
              {activeStream && <><span>/</span><span>{activeStream.name}</span></>}
              {activeCourseKey && <><span>/</span><span>{activeCourseKey}</span></>}
              {activeSemesterKey && <><span>/</span><span>{activeSemesterKey === 'winter' ? 'Зимний семестр' : 'Весенний семестр'}</span></>}
              {activeDisciplineName && <><span>/</span><span>{activeDisciplineName}</span></>}
            </div>

            {catalogNotice && (
              <div className="mb-3 rounded-lg border px-3 py-2 text-sm flex items-center justify-between gap-2" style={{ borderColor: catalogNotice.type === 'error' ? 'rgba(239,68,68,.5)' : 'rgba(34,197,94,.5)', background: 'var(--hover-bg)', color: headingColor }}>
                <span>{catalogNotice.message}</span>
                <button onClick={() => setCatalogNotice(null)} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Закрыть</button>
              </div>
            )}

            {activeNodeType === 'root' && user?.role === 'admin' && (
              <div className="flex gap-2">
                <input value={newFacultyName} onChange={(e) => setNewFacultyName(e.target.value)} placeholder="Название факультета" className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                <button onClick={createFaculty} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>Добавить</button>
              </div>
            )}

            {activeNodeType === 'faculty' && activeFaculty && user?.role === 'admin' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input value={renameFacultyName} onChange={(e) => setRenameFacultyName(e.target.value)} placeholder="Новое название факультета" className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                  <button onClick={renameFaculty} disabled={renameProcessing} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)' }}>Сохранить</button>
                </div>
                <div className="flex gap-2">
                  <input value={newDirectionName} onChange={(e) => setNewDirectionName(e.target.value)} placeholder={`Новое направление для ${activeFaculty.name}`} className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                  <button onClick={createDirection} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>Добавить</button>
                </div>
                <button
                  onClick={() => deleteNode('faculty', activeFaculty.id, activeFaculty.name)}
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'rgba(239,68,68,.14)', color: '#ef4444' }}
                >
                  Удалить факультет
                </button>
              </div>
            )}

            {activeNodeType === 'direction' && activeDirection && user?.role === 'admin' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input value={renameDirectionName} onChange={(e) => setRenameDirectionName(e.target.value)} placeholder="Новое название направления" className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                  <button onClick={renameDirection} disabled={renameProcessing} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)' }}>Сохранить</button>
                </div>
                <input value={newStreamName} onChange={(e) => setNewStreamName(e.target.value)} placeholder={`Новый поток для ${activeDirection.name}`} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                <div className="flex flex-wrap gap-2">
                  <button onClick={createStream} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>Добавить поток</button>
                  <button
                    onClick={() => deleteNode('direction', activeDirection.id, activeDirection.name)}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'rgba(239,68,68,.14)', color: '#ef4444' }}
                  >
                    Удалить направление
                  </button>
                </div>
              </div>
            )}

            {activeNodeType === 'stream' && activeStream && (
              <div className="space-y-3">
                {user?.role === 'admin' && (
                  <div className="flex gap-2">
                    <input value={renameStreamName} onChange={(e) => setRenameStreamName(e.target.value)} placeholder="Новое название потока" className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    <button onClick={renameStream} disabled={renameProcessing} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)' }}>Сохранить</button>
                  </div>
                )}
                {user?.role === 'admin' && (
                  <div className="flex gap-2">
                    <input value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} placeholder={`Новый курс для ${activeStream.name} (напр. 1 курс)`} className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    <button onClick={createCourse} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>Добавить курс</button>
                  </div>
                )}
                <div className="p-3 rounded-lg border text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                  Публикация лекций в базу выполняется в разделе «Лекции» через кнопки «Предложить в базу» и «Добавить в базу».
                </div>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => deleteNode('stream', activeStream.id, activeStream.name)}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'rgba(239,68,68,.14)', color: '#ef4444' }}
                  >
                    Удалить поток
                  </button>
                )}
              </div>
            )}

            {activeNodeType === 'course' && activeStream && (
              <div className="space-y-3">
                <div className="text-xs" style={{ color: mutedColor }}>Массовая правка курса для всех лекций потока.</div>
                <div className="flex gap-2">
                  <input value={bulkCourseName} onChange={(e) => setBulkCourseName(e.target.value)} placeholder="Новое название курса" className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                  <button onClick={updateCourseNode} disabled={catalogProcessing} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>Применить</button>
                </div>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => deleteCourse(activeStreamId, activeCourseKey)}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'rgba(239,68,68,.14)', color: '#ef4444' }}
                  >
                    Удалить курс
                  </button>
                )}
              </div>
            )}

            {activeNodeType === 'semester' && activeStream && (
              <div className="space-y-3">
                <div className="text-xs" style={{ color: mutedColor }}>Массовая правка семестра для всех лекций выбранного курса.</div>
                <div className="flex gap-2">
                  <select value={bulkSemesterKey} onChange={(e) => setBulkSemesterKey(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                    <option value="winter">Зимний семестр</option>
                    <option value="spring">Весенний семестр</option>
                  </select>
                  <button onClick={updateSemesterNode} disabled={catalogProcessing} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>Применить</button>
                </div>
                <div className="flex gap-2">
                  <input value={newDisciplineName} onChange={(e) => setNewDisciplineName(e.target.value)} placeholder="Новая дисциплина" className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                  <button onClick={createDisciplineNode} disabled={catalogProcessing} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)' }}>Добавить</button>
                </div>
              </div>
            )}

            {activeNodeType === 'discipline' && activeStream && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs" style={{ color: mutedColor }}>Массовая правка дисциплины для всех лекций в узле.</div>
                  <div className="flex gap-2">
                    <input value={bulkDisciplineName} onChange={(e) => setBulkDisciplineName(e.target.value)} placeholder="Новое название дисциплины" className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    <button onClick={updateDisciplineNode} disabled={catalogProcessing} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>Применить</button>
                  </div>
                  <button onClick={requestDeleteDisciplineNode} disabled={catalogProcessing} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,.14)', color: '#ef4444' }}>Удалить дисциплину</button>
                </div>

                <div>
                  <p className="text-xs mb-2" style={{ color: mutedColor }}>Лекции в дисциплине</p>
                  <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                    {activeDisciplineLectures.length === 0 ? (
                      <p className="text-sm" style={{ color: mutedColor }}>Лекций нет</p>
                    ) : activeDisciplineLectures.map(item => (
                      <button key={item.id} onClick={() => setCatalogSelectedId(item.id)} className="w-full text-left border rounded-lg p-2 transition-all" style={{ borderColor: catalogSelected?.id === item.id ? 'var(--text-primary)' : 'var(--border-color)', background: catalogSelected?.id === item.id ? 'rgba(68,41,43,0.08)' : 'var(--bg-primary)' }}>
                        <p className="text-sm font-medium truncate" style={{ color: headingColor }}>{item.lecture_title}</p>
                        <p className="text-xs mt-1 truncate" style={{ color: mutedColor }}>{item.lecturer_name || 'Без лектора'}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {catalogSelected ? (() => {
                  const edit = catalogEdit[catalogSelected.id];
                  if (!edit) return <p className="text-sm" style={{ color: mutedColor }}>Загрузка данных...</p>;
                  const canEditTitle = isAdmin || (user?.is_group_head && catalogSelected.stream_id === user?.stream_id);
                  return (
                    <div className="border rounded-lg p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
                      <p className="text-xs mb-2" style={{ color: mutedColor }}>Редактирование лекции</p>
                      <div className="space-y-2">
                        {canEditTitle ? (
                          <input value={edit.lecture_title} onChange={(e) => setCatalogEdit(prev => ({ ...prev, [catalogSelected.id]: { ...edit, lecture_title: e.target.value } }))} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="Название лекции" />
                        ) : (
                          <p className="text-sm" style={{ color: headingColor }}>{catalogSelected.lecture_title}</p>
                        )}
                        <input value={edit.lecturer_name} onChange={(e) => setCatalogEdit(prev => ({ ...prev, [catalogSelected.id]: { ...edit, lecturer_name: e.target.value } }))} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="Лектор" />
                        <input value={edit.lecture_number_text} onChange={(e) => setCatalogEdit(prev => ({ ...prev, [catalogSelected.id]: { ...edit, lecture_number_text: e.target.value } }))} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="Номер лекции" />
                        <input value={edit.study_year_text} onChange={(e) => setCatalogEdit(prev => ({ ...prev, [catalogSelected.id]: { ...edit, study_year_text: e.target.value } }))} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} placeholder="Год записи" />
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button disabled={catalogProcessing} onClick={saveCatalogItem} className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: '#22c55e', color: '#fff' }}>Сохранить</button>
                        <button disabled={catalogProcessing} onClick={requestDeleteCatalogItem} className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: '#ef4444', color: '#fff' }}>Удалить из базы</button>
                      </div>
                    </div>
                  );
                })() : (
                  <p className="text-sm" style={{ color: mutedColor }}>Выберите лекцию в списке.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {deleteDialog?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.45)' }}>
          <div className="w-full max-w-xl rounded-2xl border p-5" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
            <h3 className="text-lg font-medium mb-2" style={{ color: headingColor }}>Подтвердите удаление</h3>
            <p className="text-sm mb-3" style={{ color: mutedColor }}>{deleteDialog.message}</p>

            {deleteCountEntries.length > 0 && (
              <div className="rounded-lg border p-3 mb-4" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
                <p className="text-xs mb-2" style={{ color: mutedColor }}>Будут удалены:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {deleteCountEntries.map((entry) => (
                    <div key={entry.label} className="text-sm" style={{ color: headingColor }}>
                      {entry.label}: {entry.value}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => setDeleteDialog(null)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)' }}
                disabled={deleteProcessing}
              >
                Отмена
              </button>
              <button
                onClick={confirmDeleteFromDialog}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: '#ef4444', color: '#fff' }}
                disabled={deleteProcessing}
              >
                {deleteProcessing ? 'Удаление...' : 'Удалить всё'}
              </button>
            </div>
          </div>
        </div>
      )}

      {courseDeleteDialog?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.45)' }}>
          <div className="w-full max-w-xl rounded-2xl border p-5" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
            <h3 className="text-lg font-medium mb-2" style={{ color: headingColor }}>Подтвердите удаление курса</h3>
            <p className="text-sm mb-3" style={{ color: mutedColor }}>{courseDeleteDialog.message}</p>

            {courseDeleteCountEntries.length > 0 && (
              <div className="rounded-lg border p-3 mb-4" style={{ borderColor: 'var(--border-color)', background: 'var(--hover-bg)' }}>
                <p className="text-xs mb-2" style={{ color: mutedColor }}>Будут удалены:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {courseDeleteCountEntries.map((entry) => (
                    <div key={entry.label} className="text-sm" style={{ color: headingColor }}>
                      {entry.label}: {entry.value}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => setCourseDeleteDialog(null)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)' }}
                disabled={courseDeleteProcessing}
              >
                Отмена
              </button>
              <button
                onClick={confirmDeleteCourse}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: '#ef4444', color: '#fff' }}
                disabled={courseDeleteProcessing}
              >
                {courseDeleteProcessing ? 'Удаление...' : 'Удалить всё'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.45)' }}>
          <div className="w-full max-w-md rounded-2xl border p-5" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
            <h3 className="text-lg font-medium mb-2" style={{ color: headingColor }}>{confirmDialog.title}</h3>
            <p className="text-sm mb-4" style={{ color: mutedColor }}>{confirmDialog.message}</p>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)' }}
              >
                Отмена
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: '#ef4444', color: '#fff' }}
              >
                Да
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogModerationSection;
