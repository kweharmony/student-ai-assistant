import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Excalidraw,
  convertToExcalidrawElements,
  exportToBlob,
  exportToSvg,
  serializeAsJSON,
} from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import excalidrawStyles from '../excalidrawStyles';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

type LectureSource = 'my' | 'catalog';

interface LectureMeta {
  id: string;
  title: string;
  subject: string | null;
  has_text?: boolean;
  created_at: string;
  source: LectureSource;
  lectureId?: string;
  discipline?: string | null;
  streamName?: string | null;
}

interface LectureFull {
  id: string;
  title: string;
  transcriptions: { raw_text: string; processed_text: string | null }[];
}

interface BoardMeta {
  id: string;
  title: string;
  is_public: boolean;
  share_token: string | null;
  share_mode: 'view' | 'edit';
  created_at: string;
  updated_at: string;
}

interface BoardDetail extends BoardMeta {
  data: string | null;
  owner: BoardOwner | null;
  can_edit: boolean;
}

interface BoardOwner {
  id: string;
  login: string;
  full_name: string | null;
  role: string;
}

interface RecentBoardItem extends BoardMeta {
  owner: BoardOwner | null;
  last_opened_at: string | null;
  last_access_mode: 'view' | 'edit';
}

interface BoardSectionProps {
  isLightTheme: boolean;
  onCanvasMode?: (active: boolean) => void;
  onToggleTheme?: () => void;
}

type Mode = 'modal' | 'canvas';

const BG_MAIN = [
  { color: '#000000', label: 'Черный'        },
  { color: '#35524a', label: 'Меловая доска' },
  { color: '#ffffff', label: 'Белый'         },
];

const AI_DIAGRAM_TEMPLATES = [
  {
    id: 'process',
    title: 'Процесс',
    text: 'Процесс создания конспекта: запись лекции -> распознавание -> очистка текста -> выделение ключевых идей -> итоговый конспект. Добавь стрелки по порядку.',
  },
  {
    id: 'compare',
    title: 'Сравнение',
    text: 'Сравни два подхода: метод А и метод Б. Для каждого укажи шаги, плюсы и минусы. Свяжи блоки так, чтобы было видно различия.',
  },
  {
    id: 'mindmap',
    title: 'Майндмэп',
    text: 'Центр: "Машинное обучение". Ветки: "Данные", "Модели", "Обучение", "Оценка", "Применение". Для каждой ветки 2-3 подпункта.',
  },
];

const AI_TABLE_TEMPLATES = [
  {
    id: 'terms',
    title: 'Термины',
    text: 'Сделай таблицу: Термин | Определение. Возьми 6-8 ключевых терминов по теме "Алгоритмы".',
  },
  {
    id: 'pros-cons',
    title: 'Плюсы/минусы',
    text: 'Сделай таблицу: Подход | Плюсы | Минусы. Сравни "KNN" и "SVM".',
  },
  {
    id: 'timeline',
    title: 'Шаги',
    text: 'Сделай таблицу: Шаг | Действие | Результат. Описать процесс обучения модели.',
  },
];

const BG_PALETTE = [
  '#ffffff', '#f5f5f0', '#e8e8e8', '#b0b0b0', '#555555',
  '#fff9e6', '#fef3c7', '#fde8c8', '#f5c6a0', '#e8b89a',
  '#e8f5e9', '#c8e6c9', '#a5d6a7', '#35524a', '#1b3a2d',
  '#e3f2fd', '#bbdefb', '#90caf9', '#5c6bc0', '#1a237e',
];

const BoardSection: React.FC<BoardSectionProps> = ({ isLightTheme, onCanvasMode, onToggleTheme }) => {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── modal state ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('modal');
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [recentBoards, setRecentBoards] = useState<RecentBoardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [shareInput, setShareInput] = useState('');
  const [shareError, setShareError] = useState('');
  const [createError, setCreateError] = useState('');

  // ── canvas state ─────────────────────────────────────────────────────────────
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [boardTitle, setBoardTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);
  const [boardCanEdit, setBoardCanEdit] = useState(false);
  const excalidrawAPI = useRef<ExcalidrawImperativeAPI | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastSentData = useRef<string | null>(null);

  // ── save panel ───────────────────────────────────────────────────────────────
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // ── share panel ──────────────────────────────────────────────────────────────
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [activeBoard, setActiveBoard] = useState<BoardDetail | null>(null);
  const [shareModeDraft, setShareModeDraft] = useState<'view' | 'edit'>('view');
  const [boardIsOwner, setBoardIsOwner] = useState(false);

  // ── exit prompt ──────────────────────────────────────────────────────────────
  const [exitPrompt, setExitPrompt] = useState(false);

  // ── canvas background ────────────────────────────────────────────────────────
  const [bgMenuOpen, setBgMenuOpen] = useState(false);
  const [bgPaletteOpen, setBgPaletteOpen] = useState(false);
  const [canvasBg, setCanvasBg] = useState<string>('transparent');

  // ── desktop panel toggle ─────────────────────────────────────────────────────
  const [desktopPanelOpen, setDesktopPanelOpen] = useState(false);

  // ── lecture insert ───────────────────────────────────────────────────────────
  const [lecturePickerOpen, setLecturePickerOpen] = useState(false);
  const [lectures, setLectures] = useState<LectureMeta[]>([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [selectedLecture, setSelectedLecture] = useState<LectureFull | null>(null);
  const [lectureDetailLoading, setLectureDetailLoading] = useState(false);
  const [insertText, setInsertText] = useState('');
  const [lectureSource, setLectureSource] = useState<LectureSource>('my');

  // ── AI diagram ─────────────────────────────────────────────────────────────
  const [aiDiagramOpen, setAiDiagramOpen] = useState(false);
  const [aiDiagramMode, setAiDiagramMode] = useState<'diagram' | 'table'>('diagram');
  const [aiDiagramText, setAiDiagramText] = useState('');
  const [aiDiagramLoading, setAiDiagramLoading] = useState(false);
  const [aiDiagramError, setAiDiagramError] = useState('');

  // ── text block placement ──────────────────────────────────────────────────
  const [textBlockPlacing, setTextBlockPlacing] = useState(false);
  const [textBlockCursor, setTextBlockCursor] = useState<{ x: number; y: number } | null>(null);

  // ── mobile detection ─────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if (!textBlockPlacing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTextBlockPlacing(false);
        setTextBlockCursor(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [textBlockPlacing]);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    [token]
  );

  // ── load board list ──────────────────────────────────────────────────────────
  const fetchBoards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/boards`, { headers: authHeaders() });
      if (res.ok) setBoards(await res.json());
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const fetchRecentBoards = useCallback(async () => {
    setRecentLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/boards/recent`, { headers: authHeaders() });
      if (res.ok) setRecentBoards(await res.json());
    } finally {
      setRecentLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchBoards();
    fetchRecentBoards();
  }, [fetchBoards, fetchRecentBoards]);

  // ── restore canvas from URL query param ─────────────────────────────────────
  useEffect(() => {
    const boardId = searchParams.get('board');
    if (boardId && mode === 'modal' && activeBoardId !== boardId) {
      openBoard(boardId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── open board ───────────────────────────────────────────────────────────────
  const openBoard = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/boards/${id}`, { headers: authHeaders() });
    if (!res.ok) return;
    const detail: BoardDetail = await res.json();
    let parsed: any = { elements: [], appState: {} };
    if (detail.data) {
      try { parsed = JSON.parse(detail.data); } catch {}
    }
    setInitialData(parsed);
    setActiveBoardId(id);
    setBoardTitle(detail.title);
    setActiveBoard(detail);
    setBoardCanEdit(detail.can_edit);
    setBoardIsOwner(!!detail.owner && detail.owner.id === user?.id);
    setShareModeDraft(detail.share_mode);
    setCanvasBg(parsed?.appState?.viewBackgroundColor || 'transparent');
    setMode('canvas');
    onCanvasMode?.(true);
    setSearchParams({ board: id });
  };

  // ── open board by share link ─────────────────────────────────────────────────
  const openByShareLink = async () => {
    setShareError('');
    const match = shareInput.match(/\/board\/([A-Za-z0-9_-]+)/);
    const token_ = match ? match[1] : shareInput.trim();
    if (!token_) { setShareError('Введите ссылку или токен'); return; }
    const res = await fetch(`${API_BASE}/api/boards/public/${token_}`, { headers: authHeaders() });
    if (!res.ok) { setShareError('Полотно не найдено или ссылка недействительна'); return; }
    const detail: BoardDetail = await res.json();
    let parsed: any = { elements: [], appState: {} };
    if (detail.data) {
      try { parsed = JSON.parse(detail.data); } catch {}
    }
    setInitialData(parsed);
    setActiveBoardId(detail.id);
    setBoardTitle(detail.can_edit ? detail.title : `${detail.title} (только просмотр)`);
    setActiveBoard(detail);
    setBoardCanEdit(detail.can_edit);
    setBoardIsOwner(!!detail.owner && detail.owner.id === user?.id);
    setShareModeDraft(detail.share_mode);
    setMode('canvas');
    onCanvasMode?.(true);
    setSearchParams({ board: detail.id });
    fetchRecentBoards();
  };

  // ── create new board ─────────────────────────────────────────────────────────
  const createBoard = async () => {
    setCreateError('');
    const title = newTitle.trim() || 'Новое полотно';
    const res = await fetch(`${API_BASE}/api/boards`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title }),
    });
    if (!res.ok) { setCreateError('Ошибка создания полотна'); return; }
    const board: BoardMeta = await res.json();
    setNewTitle('');
    await openBoard(board.id);
  };

  const WS_BASE = API_BASE.replace(/^http(s?):\/\//, (_, secure) => (secure ? 'wss://' : 'ws://'));

  const SEND_DEBOUNCE_MS = 150;

  const persistBoardData = useCallback(async (data: string) => {
    if (!activeBoardId) return;
    try {
      await fetch(`${API_BASE}/api/boards/${activeBoardId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ data }),
      });
    } catch {
      // ignore
    }
  }, [activeBoardId, authHeaders]);

  // ── auto-save (real-time via WebSocket) ─────────────────────────────────────
  const handleChange = useCallback(() => {
    if (!activeBoardId || !boardCanEdit || !excalidrawAPI.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const api = excalidrawAPI.current;
      if (!api) return;
      const data = serializeAsJSON(
        api.getSceneElements(),
        api.getAppState(),
        api.getFiles(),
        'local',
      );
      if (lastSentData.current === data) return;
      lastSentData.current = data;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'update',
          elements: api.getSceneElements(),
          appState: api.getAppState(),
          data,
        }));
      } else {
        persistBoardData(data);
      }
    }, SEND_DEBOUNCE_MS);
  }, [activeBoardId, boardCanEdit, persistBoardData]);

  const pendingRemoteUpdate = useRef<any | null>(null);

  const isUserInteracting = useCallback(() => {
    const api = excalidrawAPI.current;
    if (!api) return false;
    const state = api.getAppState();
    return Boolean(state.draggingElement || state.editingElement || state.isResizing || state.isRotating);
  }, []);

  const applyRemoteUpdate = useCallback((msg: any) => {
    if (!excalidrawAPI.current) return;
    let nextElements = msg.elements;
    let nextAppState = msg.appState;
    let nextFiles = undefined;
    if (msg.data) {
      try {
        const parsed = JSON.parse(msg.data);
        nextElements = parsed.elements ?? nextElements;
        nextAppState = parsed.appState ?? nextAppState;
        nextFiles = parsed.files;
      } catch {
        // ignore
      }
    }
    excalidrawAPI.current.updateScene({
      elements: nextElements,
      appState: nextAppState,
    });
    if (nextFiles && excalidrawAPI.current.addFiles) {
      excalidrawAPI.current.addFiles(nextFiles);
    }
  }, []);

  // ── save to profile (manual: persists title to DB) ───────────────────────────
  const saveToProfile = async () => {
    if (!activeBoardId || !boardCanEdit || !excalidrawAPI.current) return;
    setSaving(true);
    const api = excalidrawAPI.current;
    const data = serializeAsJSON(
      api.getSceneElements(),
      api.getAppState(),
      api.getFiles(),
      'local',
    );
    // send real-time update immediately
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'update', elements: api.getSceneElements(), appState: api.getAppState(), data }));
    }
    // persist title
    const res = await fetch(`${API_BASE}/api/boards/${activeBoardId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ title: boardTitle, data }),
    });
    setSaving(false);
    if (res.ok) {
      setSaveMsg('Сохранено');
      setTimeout(() => setSaveMsg(''), 2000);
    }
  };

  // ── WebSocket real-time subscription ────────────────────────────────────────
  useEffect(() => {
    if (!activeBoardId || !token) return;
    const ws = new WebSocket(`${WS_BASE}/api/boards/${activeBoardId}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {};
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'update' && excalidrawAPI.current) {
          if (isUserInteracting()) {
            pendingRemoteUpdate.current = msg;
            return;
          }
          applyRemoteUpdate(msg);
        }
      } catch {
        // ignore
      }
    };
    ws.onerror = () => {};
    ws.onclose = () => { wsRef.current = null; };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [activeBoardId, token, applyRemoteUpdate, isUserInteracting]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!pendingRemoteUpdate.current) return;
      if (isUserInteracting()) return;
      const msg = pendingRemoteUpdate.current;
      pendingRemoteUpdate.current = null;
      applyRemoteUpdate(msg);
    }, 150);
    return () => clearInterval(timer);
  }, [applyRemoteUpdate, isUserInteracting]);

  // ── export ───────────────────────────────────────────────────────────────────
  const exportPNG = async () => {
    const api = excalidrawAPI.current;
    if (!api) return;
    const blob = await exportToBlob({
      elements: api.getSceneElements(),
      appState: { ...api.getAppState(), exportBackground: true },
      files: api.getFiles(),
      mimeType: 'image/png',
    });
    downloadBlob(blob, `${boardTitle}.png`);
    setSaveMenuOpen(false);
  };

  const exportSVG = async () => {
    const api = excalidrawAPI.current;
    if (!api) return;
    const svg = await exportToSvg({
      elements: api.getSceneElements(),
      appState: api.getAppState(),
      files: api.getFiles(),
    });
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    downloadBlob(blob, `${boardTitle}.svg`);
    setSaveMenuOpen(false);
  };

  const exportJSON = () => {
    const api = excalidrawAPI.current;
    if (!api) return;
    const data = serializeAsJSON(
      api.getSceneElements(),
      api.getAppState(),
      api.getFiles(),
      'local',
    );
    const blob = new Blob([data], { type: 'application/json' });
    downloadBlob(blob, `${boardTitle}.excalidraw`);
    setSaveMenuOpen(false);
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  // ── share ─────────────────────────────────────────────────────────────────────
  const enableShare = async (mode: 'view' | 'edit') => {
    if (!activeBoardId || !boardCanEdit || !boardIsOwner) return;
    const res = await fetch(`${API_BASE}/api/boards/${activeBoardId}/share`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ mode }),
    });
    if (res.ok) {
      const updated: BoardDetail = await res.json();
      setActiveBoard(updated);
      setShareModeDraft(updated.share_mode);
    }
  };

  const disableShare = async () => {
    if (!activeBoardId || !boardCanEdit || !boardIsOwner) return;
    const res = await fetch(`${API_BASE}/api/boards/${activeBoardId}/share`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) {
      const updated: BoardDetail = await res.json();
      setActiveBoard(updated);
      setShareModeDraft('view');
    }
  };

  const copyShareLink = () => {
    if (!activeBoard?.share_token) return;
    const link = `${window.location.origin}/board/${activeBoard.share_token}`;
    navigator.clipboard.writeText(link);
    setSaveMsg('Ссылка скопирована');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  // ── canvas background ─────────────────────────────────────────────────────────
  const changeBg = (color: string) => {
    setCanvasBg(color);
    excalidrawAPI.current?.updateScene({ appState: { viewBackgroundColor: color } });
    setBgMenuOpen(false);
  };

  // Keep board background independent from UI theme.
  useEffect(() => {
    if (mode !== 'canvas') return;
    if (!canvasBg) return;
    const api = excalidrawAPI.current;
    if (!api) return;
    api.updateScene({ appState: { viewBackgroundColor: canvasBg } });
  }, [isLightTheme, canvasBg, mode]);

  const clearCanvas = () => {
    if (!boardCanEdit) return;
    if (window.confirm('Очистить холст? Все элементы будут удалены.')) {
      excalidrawAPI.current?.resetScene();
    }
  };

  // ── save title ────────────────────────────────────────────────────────────────
  const saveTitle = async () => {
    setEditingTitle(false);
    if (!activeBoardId || !boardCanEdit) return;
    await fetch(`${API_BASE}/api/boards/${activeBoardId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ title: boardTitle }),
    });
  };

  // ── lecture insert ───────────────────────────────────────────────────────────
  const loadLectures = async (source: LectureSource) => {
    setLecturesLoading(true);
    try {
      if (source === 'my') {
        const res = await fetch(`${API_BASE}/api/lectures/my`, { headers: authHeaders() });
        if (res.ok) {
          const data = (await res.json()) as Array<any>;
          setLectures(
            data
              .filter((l) => l.has_text)
              .map((l) => ({
                id: l.id,
                title: l.title,
                subject: l.subject ?? null,
                created_at: l.created_at,
                source: 'my',
              }))
          );
        } else {
          setLectures([]);
        }
      } else {
        const res = await fetch(`${API_BASE}/api/catalog/items?limit=200`, { headers: authHeaders() });
        if (res.ok) {
          const data = (await res.json()) as Array<any>;
          setLectures(
            data.map((item) => ({
              id: item.id,
              lectureId: item.lecture_id,
              title: item.lecture_title,
              subject: item.lecture_subject ?? null,
              discipline: item.discipline ?? null,
              streamName: item.stream_name ?? null,
              created_at: item.created_at,
              source: 'catalog',
            }))
          );
        } else {
          setLectures([]);
        }
      }
    } finally {
      setLecturesLoading(false);
    }
  };

  const openLecturePicker = async () => {
    if (!boardCanEdit) return;
    setLecturePickerOpen(true);
    setSelectedLecture(null);
    setInsertText('');
    setLectureSource('my');
    await loadLectures('my');
  };

  const selectLecture = async (item: LectureMeta) => {
    setLectureDetailLoading(true);
    try {
      const lectureId = item.source === 'catalog' ? item.lectureId : item.id;
      if (!lectureId) return;
      const res = await fetch(`${API_BASE}/api/lectures/${lectureId}`, { headers: authHeaders() });
      if (!res.ok) return;
      const data: LectureFull = await res.json();
      setSelectedLecture(data);
      const best = data.transcriptions[0];
      setInsertText(best ? (best.processed_text || best.raw_text) : '');
    } finally {
      setLectureDetailLoading(false);
    }
  };

  const insertLectureText = () => {
    const api = excalidrawAPI.current;
    if (!api || !boardCanEdit || !insertText.trim()) return;

    const appState = api.getAppState();
    const zoom = appState.zoom.value;
    const x = (-appState.scrollX + window.innerWidth / 2) / zoom - 300;
    const y = (-appState.scrollY + window.innerHeight / 2) / zoom - 100;
    const boxWidth = 560;
    const boxHeight = 260;

    const newElements = convertToExcalidrawElements([
      {
        type: 'rectangle',
        x,
        y,
        width: boxWidth,
        height: boxHeight,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeColor: isLightTheme ? '#44292b' : '#fffff0',
        strokeWidth: 1,
        strokeStyle: 'dashed',
        label: {
          text: insertText,
          textAlign: 'left',
          verticalAlign: 'top',
          fontSize: 16,
          strokeColor: isLightTheme ? '#44292b' : '#fffff0',
        },
      },
    ]);

    api.updateScene({
      elements: [...api.getSceneElements(), ...newElements],
    });
    api.scrollToContent?.(newElements[0], { fitToViewport: true });
    setLecturePickerOpen(false);
    setSelectedLecture(null);
    setInsertText('');
  };

  const createDiagramElements = (diagram: any) => {
    const api = excalidrawAPI.current;
    if (!api) return;

    const nodes: Array<any> = Array.isArray(diagram?.nodes) ? diagram.nodes : [];
    const edges: Array<any> = Array.isArray(diagram?.edges) ? diagram.edges : [];
    if (nodes.length === 0) return;

    const layout = diagram?.layout || {};
    const direction = (layout.direction || 'LR').toUpperCase();
    const spacingX = Number(layout.spacingX) || 240;
    const spacingY = Number(layout.spacingY) || 140;

    const appState = api.getAppState();
    const zoom = appState.zoom.value;
    const viewportWidth = appState.width || window.innerWidth;
    const viewportHeight = appState.height || window.innerHeight;
    const viewportCenterX = (-appState.scrollX + viewportWidth / 2) / zoom;
    const viewportCenterY = (-appState.scrollY + viewportHeight / 2) / zoom;

    const estimateSize = (text: string, isTable: boolean) => {
      const lines = text.split(/\r?\n/);
      const maxLen = Math.max(1, ...lines.map(l => l.length));
      const minWidth = isTable ? 240 : 180;
      const maxWidth = isTable ? 520 : 360;
      const width = Math.min(maxWidth, Math.max(minWidth, maxLen * 7 + 40));
      const height = Math.min(260, Math.max(80, lines.length * 22 + 30));
      return { width, height };
    };

    const nodeMeta = nodes.map((node) => {
      const text = String(node.text || '').trim() || 'Блок';
      const isTable = String(node.type || '').toLowerCase() === 'table' || text.includes(' | ');
      const size = estimateSize(text, isTable);
      return { node, text, width: size.width, height: size.height, isTable };
    });

    const maxWidth = Math.max(...nodeMeta.map((m) => m.width));
    const maxHeight = Math.max(...nodeMeta.map((m) => m.height));
    const baseSpacingX = Math.max(spacingX, maxWidth + 80);
    const baseSpacingY = Math.max(spacingY, maxHeight + 60);

    const positions = new Map<string, { x: number; y: number; w: number; h: number }>();
    const gridCols = direction === 'GRID' ? Math.ceil(Math.sqrt(nodeMeta.length)) : (direction === 'TB' ? 1 : nodeMeta.length);

    nodeMeta.forEach((meta, index) => {
      let col = index;
      let row = 0;
      if (direction === 'TB') {
        col = 0;
        row = index;
      } else if (direction === 'GRID') {
        col = index % gridCols;
        row = Math.floor(index / gridCols);
      }
      const x = col * baseSpacingX;
      const y = row * baseSpacingY;
      positions.set(meta.node.id, { x, y, w: meta.width, h: meta.height });
    });

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    positions.forEach((pos) => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.w);
      maxY = Math.max(maxY, pos.y + pos.h);
    });

    const diagramCenterX = (minX + maxX) / 2;
    const diagramCenterY = (minY + maxY) / 2;
    const offsetX = viewportCenterX - diagramCenterX;
    const offsetY = viewportCenterY - diagramCenterY;
    positions.forEach((pos, key) => {
      positions.set(key, { x: pos.x + offsetX, y: pos.y + offsetY, w: pos.w, h: pos.h });
    });

    const rectSkeletons = nodes.map((node: any) => {
      const pos = positions.get(node.id);
      const text = String(node.text || '').trim() || 'Блок';
      const isTable = String(node.type || '').toLowerCase() === 'table' || text.includes(' | ');
      const size = estimateSize(text, isTable);
      const width = pos ? pos.w : size.width;
      const height = pos ? pos.h : size.height;
      return {
        type: 'rectangle',
        x: pos?.x ?? viewportCenterX,
        y: pos?.y ?? viewportCenterY,
        width,
        height,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeColor: isLightTheme ? '#44292b' : '#fffff0',
        strokeWidth: 1,
        strokeStyle: 'solid',
        label: {
          text,
          textAlign: isTable ? 'left' : 'center',
          verticalAlign: isTable ? 'top' : 'middle',
          fontSize: 16,
          strokeColor: isLightTheme ? '#44292b' : '#fffff0',
        },
      } as any;
    });

    const arrowSkeletons = edges
      .map((edge: any) => {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) return null;
        const startX = from.x + from.w / 2;
        const startY = from.y + from.h / 2;
        const endX = to.x + to.w / 2;
        const endY = to.y + to.h / 2;
        return {
          type: 'arrow',
          x: startX,
          y: startY,
          points: [[0, 0], [endX - startX, endY - startY]],
          strokeColor: isLightTheme ? '#44292b' : '#fffff0',
          strokeWidth: 1,
          roughness: 0,
          opacity: 100,
          endArrowhead: 'arrow',
          startArrowhead: null,
        } as any;
      })
      .filter(Boolean);

    const rects = convertToExcalidrawElements(rectSkeletons as any);
    const arrows = convertToExcalidrawElements(arrowSkeletons as any);
    api.updateScene({ elements: [...api.getSceneElements(), ...rects, ...arrows] });
  };

  const generateDiagram = async () => {
    if (!aiDiagramText.trim()) return;
    setAiDiagramLoading(true);
    setAiDiagramError('');
    try {
      const requestedLayout = aiDiagramMode === 'table' ? 'GRID' : 'auto';
      const promptText = aiDiagramMode === 'table'
        ? `Сделай таблицу по описанию. ${aiDiagramText}`
        : aiDiagramText;
      const res = await fetch(`${API_BASE}/api/ml/diagram`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ text: promptText, layout: requestedLayout, max_nodes: 12 }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || 'Не удалось построить схему');
      }
      createDiagramElements(payload.diagram);
      setAiDiagramOpen(false);
      setAiDiagramText('');
      setAiDiagramMode('diagram');
    } catch (e: any) {
      setAiDiagramError(e?.message || 'Ошибка построения схемы');
    } finally {
      setAiDiagramLoading(false);
    }
  };

  const insertBoundedTextBlock = () => {
    const api = excalidrawAPI.current;
    if (!api || !boardCanEdit) return;
    const appState = api.getAppState();
    const viewportWidth = appState.width || window.innerWidth;
    const viewportHeight = appState.height || window.innerHeight;
    setTextBlockCursor({ x: viewportWidth / 2, y: viewportHeight / 2 });
    setTextBlockPlacing(true);
    setDesktopPanelOpen(false);
  };

  const placeTextBlockAt = (clientX: number, clientY: number) => {
    const api = excalidrawAPI.current;
    if (!api || !boardCanEdit) return;

    const appState = api.getAppState();
    const zoom = appState.zoom.value;
    const viewportWidth = appState.width || window.innerWidth;
    const viewportHeight = appState.height || window.innerHeight;
    const sceneX = (clientX - viewportWidth / 2) / zoom - appState.scrollX;
    const sceneY = (clientY - viewportHeight / 2) / zoom - appState.scrollY;
    const boxWidth = 440;
    const boxHeight = 180;
    const x = sceneX - boxWidth / 2;
    const y = sceneY - boxHeight / 2;

    const newElements = convertToExcalidrawElements([
      {
        type: 'rectangle',
        x,
        y,
        width: boxWidth,
        height: boxHeight,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeColor: isLightTheme ? '#44292b' : '#fffff0',
        strokeWidth: 1,
        strokeStyle: 'dashed',
        label: {
          text: 'Текст',
          textAlign: 'left',
          verticalAlign: 'top',
          fontSize: 16,
          strokeColor: isLightTheme ? '#44292b' : '#fffff0',
        },
      },
    ]);

    api.updateScene({
      elements: [...api.getSceneElements(), ...newElements],
    });
    setTextBlockPlacing(false);
    setTextBlockCursor(null);
  };

  // ── exit ──────────────────────────────────────────────────────────────────────
  const handleExitRequest = () => setExitPrompt(true);

  const confirmExit = async (saveFirst: boolean) => {
    if (saveFirst && boardCanEdit) await saveToProfile();
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setExitPrompt(false);
    setMode('modal');
    setActiveBoardId(null);
    setInitialData(null);
    setActiveBoard(null);
    setBoardCanEdit(false);
    setBoardIsOwner(false);
    onCanvasMode?.(false);
    setSearchParams({});
    fetchBoards();
    fetchRecentBoards();
  };

  // ── styles ─────────────────────────────────────────────────────────────────────
  const surface = isLightTheme
    ? { background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }
    : { background: 'var(--bg-primary)', border: '1px solid var(--border-color)' };

  const btnPrimary: React.CSSProperties = {
    background: 'var(--text-primary)',
    color: 'var(--bg-primary)',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontFamily: 'Georgia, serif',
    fontSize: 14,
    cursor: 'pointer',
    transition: 'opacity .2s',
  };

  const btnSecondary: React.CSSProperties = {
    background: 'var(--hover-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 20px',
    fontFamily: 'Georgia, serif',
    fontSize: 14,
    cursor: 'pointer',
  };


  // ────────────────────────────────────────────────────────────────────────────
  // CANVAS MODE
  // ────────────────────────────────────────────────────────────────────────────
  if (mode === 'canvas') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: isLightTheme ? '#fffff0' : '#1f1516',
        }}
        data-ext-ui-theme={isLightTheme ? 'light' : 'dark'}
      >
        <style>{excalidrawStyles}</style>
        {/* Excalidraw fills entire viewport */}
        {initialData !== null && (
          <Excalidraw
            excalidrawAPI={(api) => { excalidrawAPI.current = api; }}
            initialData={initialData}
            onChange={handleChange}
            viewModeEnabled={!boardCanEdit}
            theme="light"
            langCode="ru-RU"
            renderTopRightUI={() => null}
            UIOptions={{
              canvasActions: {
                saveToActiveFile: false,
                loadScene: false,
                export: false,
                toggleTheme: false,
                clearCanvas: false,
                changeViewBackgroundColor: false,
              },
            }}
          />
        )}

        {textBlockPlacing && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 320,
              cursor: 'crosshair',
              background: 'rgba(0,0,0,0.02)',
            }}
            onPointerMove={(event) => setTextBlockCursor({ x: event.clientX, y: event.clientY })}
            onPointerDown={(event) => placeTextBlockAt(event.clientX, event.clientY)}
          >
            <style>{`
              @keyframes textBlockPulse {
                0% { transform: translate(-50%, -50%) scale(0.7); opacity: 0.55; }
                70% { transform: translate(-50%, -50%) scale(1.05); opacity: 0.2; }
                100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
              }
            `}</style>
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                background: isLightTheme ? 'rgba(255,253,245,0.95)' : 'rgba(24,18,19,0.92)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                padding: '8px 14px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                fontFamily: 'Georgia, serif',
                boxShadow: '0 10px 24px rgba(0,0,0,0.2)',
              }}
            >
              Кликните по холсту, чтобы вставить текстовый блок. Esc — отмена.
            </div>
            {textBlockCursor && (
              <div style={{ position: 'absolute', left: textBlockCursor.x, top: textBlockCursor.y, pointerEvents: 'none' }}>
                <div style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: isLightTheme ? 'rgba(68,41,43,0.5)' : 'rgba(255,255,240,0.6)',
                  border: `1px solid ${isLightTheme ? 'rgba(68,41,43,0.6)' : 'rgba(255,255,240,0.8)'}`,
                  transform: 'translate(-50%, -50%)',
                }} />
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: `2px solid ${isLightTheme ? 'rgba(68,41,43,0.35)' : 'rgba(255,255,240,0.45)'}`,
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  animation: 'textBlockPulse 1.4s ease-out infinite',
                }} />
              </div>
            )}
          </div>
        )}

        {/* ── Mobile panel — bottom center ── */}
        {isMobile && (
          <div style={{
            position: 'fixed',
            bottom: 12,
            left: 6,
            right: 6,
            transform: 'none',
            zIndex: 300,
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: 4,
            background: isLightTheme ? 'rgba(255,253,245,0.97)' : 'rgba(20,15,17,0.97)',
            border: '1px solid var(--border-color)',
            borderRadius: 20,
            padding: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            fontFamily: 'Georgia, serif',
            width: 'auto',
            maxWidth: 'none',
            overflowX: 'auto',
            overflowY: 'visible',
            WebkitOverflowScrolling: 'touch',
            boxSizing: 'border-box',
            WebkitBackdropFilter: 'none',
            backdropFilter: 'none',
          }}>
            {saveMsg && (
              <div style={{
                position: 'fixed',
                left: 12,
                right: 12,
                bottom: 88,
                transform: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 12px', background: 'rgba(130,170,130,0.9)',
                borderRadius: 20, fontSize: 12, color: '#fff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 350,
                pointerEvents: 'none',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                {saveMsg}
              </div>
            )}

            {activeBoardId && boardCanEdit && (
              <div style={{ position: 'relative' }}>
                <MobileIconButton icon="save" label="Сохранить" onClick={() => { setSaveMenuOpen(o => !o); setShareMenuOpen(false); }} />
                {saveMenuOpen && (
                  <div style={{
                    position: 'fixed',
                    left: 12,
                    right: 12,
                    bottom: 88,
                    transform: 'none',
                    background: isLightTheme ? '#fffdf5' : '#140f11',
                    border: '1px solid var(--border-color)',
                    borderRadius: 12, padding: 6, minWidth: 0,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
                    zIndex: 400, whiteSpace: 'normal',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', padding: '4px 10px 6px', letterSpacing: '0.08em', opacity: 0.6 }}>СОХРАНИТЬ КАК</div>
                    <MenuItem label="На профиль" icon="cloud_upload" onClick={async () => { await saveToProfile(); setSaveMenuOpen(false); }} />
                    <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 6px' }} />
                    <MenuItem label="Скачать PNG" icon="image" onClick={exportPNG} />
                    <MenuItem label="Скачать SVG" icon="shape_line" onClick={exportSVG} />
                    <MenuItem label="Скачать JSON" icon="data_object" onClick={exportJSON} />
                    <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 6px' }} />
                    <MenuItem label="Очистить холст" icon="delete_sweep" onClick={() => { setSaveMenuOpen(false); clearCanvas(); }} danger />
                  </div>
                )}
              </div>
            )}

            {activeBoardId && boardCanEdit && boardIsOwner && (
              <div style={{ position: 'relative' }}>
                <MobileIconButton icon={activeBoard?.is_public ? 'link' : 'share'} label="Поделиться" onClick={() => { setShareMenuOpen(o => !o); setSaveMenuOpen(false); }} active={activeBoard?.is_public} />
                    {shareMenuOpen && (
                      <div style={{
                        position: 'fixed',
                        left: 12,
                        right: 12,
                        bottom: 88,
                        transform: 'none',
                        background: isLightTheme ? '#fffdf5' : '#140f11',
                        border: '1px solid var(--border-color)',
                        borderRadius: 12, padding: 12, minWidth: 0,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
                        zIndex: 400, whiteSpace: 'normal',
                      }}>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.08em', opacity: 0.6 }}>РЕЖИМ ДОСТУПА</div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                          <button
                            style={{ ...btnSecondary, flex: 1, padding: '7px 10px', fontSize: 12, borderColor: shareModeDraft === 'view' ? '#82AA82' : 'var(--border-color)', background: shareModeDraft === 'view' ? 'rgba(130,170,130,0.12)' : 'var(--hover-bg)' }}
                            onClick={() => setShareModeDraft('view')}
                          >
                            Только просмотр
                          </button>
                          <button
                            style={{ ...btnSecondary, flex: 1, padding: '7px 10px', fontSize: 12, borderColor: shareModeDraft === 'edit' ? '#82AA82' : 'var(--border-color)', background: shareModeDraft === 'edit' ? 'rgba(130,170,130,0.12)' : 'var(--hover-bg)' }}
                            onClick={() => setShareModeDraft('edit')}
                          >
                            Редактирование
                          </button>
                        </div>

                        {activeBoard?.is_public ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#82AA82' }}>check_circle</span>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                Публичная ссылка активна: {activeBoard.share_mode === 'edit' ? 'редактирование' : 'только просмотр'}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, wordBreak: 'break-all', marginBottom: 10, color: 'var(--text-primary)', opacity: 0.6, background: 'var(--hover-bg)', borderRadius: 8, padding: '6px 10px', fontFamily: 'monospace' }}>
                              {`${window.location.origin}/board/${activeBoard.share_token}`}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button style={{ ...btnPrimary, flex: 1, fontSize: 12, padding: '7px 0' }} onClick={copyShareLink}>Скопировать</button>
                              <button style={{ ...btnSecondary, flex: 1, fontSize: 12, padding: '7px 0' }} onClick={() => enableShare(shareModeDraft)}>Сохранить режим</button>
                              <button style={{ ...btnSecondary, fontSize: 12, padding: '7px 12px' }} onClick={disableShare}>Отключить</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>Создайте публичную ссылку для доступа</div>
                            <button style={{ ...btnPrimary, width: '100%', fontSize: 13, padding: '8px 0' }} onClick={() => enableShare(shareModeDraft)}>
                              Включить ссылку
                            </button>
                          </>
                        )}
                      </div>
                    )}
              </div>
            )}

            {activeBoardId && boardCanEdit && <MobileIconButton icon="article" label="Лекция" onClick={openLecturePicker} />}
            {activeBoardId && boardCanEdit && <MobileIconButton icon="text_fields" label="Текст-блок" onClick={insertBoundedTextBlock} />}
            {activeBoardId && boardCanEdit && <MobileIconButton icon="auto_awesome" label="AI схема" onClick={() => setAiDiagramOpen(true)} />}

            {boardCanEdit && (
            <div style={{ position: 'relative' }}>
              <MobileIconButton icon="format_color_fill" label="Фон" onClick={() => { setBgMenuOpen(o => !o); setSaveMenuOpen(false); setShareMenuOpen(false); }} />
              {bgMenuOpen && (
                <div style={{
                  position: 'fixed',
                  left: 12,
                  right: 12,
                  bottom: 88,
                  transform: 'none',
                  background: isLightTheme ? '#fffdf5' : '#140f11',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12, padding: '10px 10px 8px',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
                  zIndex: 400, minWidth: 0,
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.08em', opacity: 0.6 }}>ФОН ХОЛСТА</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                    {BG_MAIN.map(p => (
                      <button key={p.color} onClick={() => { changeBg(p.color); setBgPaletteOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, background: canvasBg === p.color ? 'rgba(130,170,130,0.1)' : 'none', border: canvasBg === p.color ? '1px solid rgba(130,170,130,0.4)' : '1px solid transparent', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left', width: '100%', transition: 'background .15s' }}
                        onMouseEnter={e => { if (canvasBg !== p.color) e.currentTarget.style.background = 'var(--hover-bg)'; }}
                        onMouseLeave={e => { if (canvasBg !== p.color) e.currentTarget.style.background = 'none'; }}
                      >
                        <span style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, background: p.color, border: '1px solid rgba(0,0,0,0.12)', boxShadow: p.color === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : 'none' }} />
                        {p.label}
                        {canvasBg === p.color && <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#82AA82', marginLeft: 'auto' }}>check</span>}
                      </button>
                    ))}
                  </div>
                  <div style={{ height: 1, background: 'var(--border-color)', margin: '6px 0' }} />
                  <button onClick={() => setBgPaletteOpen(o => !o)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: bgPaletteOpen ? 'rgba(130,170,130,0.1)' : 'none', border: bgPaletteOpen ? '1px solid rgba(130,170,130,0.4)' : '1px solid transparent', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left', width: '100%', transition: 'background .15s' }}
                    onMouseEnter={e => { if (!bgPaletteOpen) e.currentTarget.style.background = 'var(--hover-bg)'; }}
                    onMouseLeave={e => { if (!bgPaletteOpen) e.currentTarget.style.background = 'none'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-secondary)' }}>palette</span>
                    Из палитры
                    <span className="material-symbols-outlined" style={{ fontSize: 14, marginLeft: 'auto', color: 'var(--text-secondary)', transition: 'transform .2s', transform: bgPaletteOpen ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                  </button>
                  {bgPaletteOpen && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, marginBottom: 8 }}>
                        {BG_PALETTE.map(c => (
                          <button key={c} title={c} onClick={() => changeBg(c)}
                            style={{ width: '100%', aspectRatio: '1', borderRadius: 5, cursor: 'pointer', background: c, border: canvasBg === c ? '2px solid #82AA82' : '1px solid rgba(0,0,0,0.12)', transition: 'transform .1s' }}
                            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Точный цвет</span>
                        <input type="color" value={canvasBg.startsWith('#') ? canvasBg : '#ffffff'} onChange={e => changeBg(e.target.value)} style={{ flex: 1, height: 26, borderRadius: 6, border: '1px solid var(--border-color)', cursor: 'pointer', padding: 2 }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            {onToggleTheme && (
              <MobileIconButton icon={isLightTheme ? 'dark_mode' : 'light_mode'} label={isLightTheme ? 'Тёмная' : 'Светлая'} onClick={onToggleTheme} />
            )}
            <div style={{ width: 1, background: 'var(--border-color)', margin: '0 4px', alignSelf: 'stretch' }} />
            <MobileIconButton icon="logout" label="Выйти" onClick={handleExitRequest} danger />
          </div>
        )}

        {/* ── Desktop panel — hamburger style top-left ── */}
        {!isMobile && (
          <div style={{ position: 'fixed', right: 12, top: 12, zIndex: 300 }}>
            <button
              onClick={() => setDesktopPanelOpen(o => !o)}
              title="Меню полотна"
              style={{
                width: 40, height: 40,
                background: isLightTheme ? 'rgba(255,253,245,0.97)' : 'rgba(20,15,17,0.97)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(16px)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                {desktopPanelOpen ? 'close' : 'menu'}
              </span>
            </button>

            {desktopPanelOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                background: isLightTheme ? 'rgba(255,253,245,0.97)' : 'rgba(20,15,17,0.97)',
                border: '1px solid var(--border-color)',
                borderRadius: 16,
                padding: '10px 8px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
                backdropFilter: 'blur(16px)',
                minWidth: 180,
                fontFamily: 'Georgia, serif',
              }}>
                {/* Title block */}
                <div style={{ position: 'relative', padding: '4px 8px 10px', borderBottom: '1px solid var(--border-color)', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.08em', opacity: 0.6 }}>ПОЛОТНО</span>
                    {onToggleTheme && (
                      <button onClick={onToggleTheme} title={isLightTheme ? 'Тёмная тема' : 'Светлая тема'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-secondary)', display: 'flex', borderRadius: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                          {isLightTheme ? 'dark_mode' : 'light_mode'}
                        </span>
                      </button>
                    )}
                  </div>
                  {editingTitle ? (
                    <input
                      autoFocus
                      value={boardTitle}
                      onChange={e => setBoardTitle(e.target.value)}
                      onBlur={saveTitle}
                      onKeyDown={e => e.key === 'Enter' && saveTitle()}
                      style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--text-secondary)', color: 'var(--text-primary)', fontFamily: 'Georgia, serif', fontSize: 14, outline: 'none', padding: '2px 0' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, color: 'var(--text-primary)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {boardTitle}
                      </span>
                      {activeBoardId && boardCanEdit && (
                        <button onClick={() => setEditingTitle(true)} title="Переименовать"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-secondary)', display: 'flex' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                        </button>
                      )}
                    </div>
                  )}
                  {saveMsg && (
                    <div style={{
                      position: 'absolute', right: 'calc(100% + 10px)', top: 8,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', whiteSpace: 'nowrap',
                      background: isLightTheme ? '#fffdf5' : '#140f11',
                      border: '1px solid rgba(130,170,130,0.4)',
                      borderRadius: 20, fontSize: 11, color: '#82AA82',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      pointerEvents: 'none',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>
                      {saveMsg}
                    </div>
                  )}
                </div>

                {/* Save */}
                {activeBoardId && boardCanEdit && (
                  <div style={{ position: 'relative' }}>
                    <PanelButton icon="save" label="Сохранить" onClick={() => { setSaveMenuOpen(o => !o); setShareMenuOpen(false); }} isLightTheme={isLightTheme} />
                    {saveMenuOpen && (
                      <div style={{
                        position: 'absolute', right: 'calc(100% + 8px)', top: 0,
                        background: isLightTheme ? '#fffdf5' : '#140f11',
                        border: '1px solid var(--border-color)',
                        borderRadius: 12, padding: 6, minWidth: 190,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
                        zIndex: 400, whiteSpace: 'nowrap',
                      }}>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', padding: '4px 10px 6px', letterSpacing: '0.08em', opacity: 0.6 }}>СОХРАНИТЬ КАК</div>
                        <MenuItem label="На профиль" icon="cloud_upload" onClick={async () => { await saveToProfile(); setSaveMenuOpen(false); }} />
                        <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 6px' }} />
                        <MenuItem label="Скачать PNG" icon="image" onClick={exportPNG} />
                        <MenuItem label="Скачать SVG" icon="shape_line" onClick={exportSVG} />
                        <MenuItem label="Скачать JSON" icon="data_object" onClick={exportJSON} />
                        <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 6px' }} />
                        <MenuItem label="Очистить холст" icon="delete_sweep" onClick={() => { setSaveMenuOpen(false); clearCanvas(); }} danger />
                      </div>
                    )}
                  </div>
                )}

                {/* Share */}
                {activeBoardId && boardCanEdit && boardIsOwner && (
                  <div style={{ position: 'relative' }}>
                    <PanelButton icon={activeBoard?.is_public ? 'link' : 'share'} label="Поделиться" onClick={() => { setShareMenuOpen(o => !o); setSaveMenuOpen(false); }} isLightTheme={isLightTheme} active={activeBoard?.is_public} />
                    {shareMenuOpen && (
                      <div style={{
                        position: 'absolute', right: 'calc(100% + 8px)', top: 0,
                        background: isLightTheme ? '#fffdf5' : '#140f11',
                        border: '1px solid var(--border-color)',
                        borderRadius: 12, padding: 12, minWidth: 240,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
                        zIndex: 400, whiteSpace: 'nowrap',
                      }}>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.08em', opacity: 0.6 }}>РЕЖИМ ДОСТУПА</div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                          <button
                            style={{ ...btnSecondary, flex: 1, padding: '7px 10px', fontSize: 12, borderColor: shareModeDraft === 'view' ? '#82AA82' : 'var(--border-color)', background: shareModeDraft === 'view' ? 'rgba(130,170,130,0.12)' : 'var(--hover-bg)' }}
                            onClick={() => setShareModeDraft('view')}
                          >
                            Только просмотр
                          </button>
                          <button
                            style={{ ...btnSecondary, flex: 1, padding: '7px 10px', fontSize: 12, borderColor: shareModeDraft === 'edit' ? '#82AA82' : 'var(--border-color)', background: shareModeDraft === 'edit' ? 'rgba(130,170,130,0.12)' : 'var(--hover-bg)' }}
                            onClick={() => setShareModeDraft('edit')}
                          >
                            Редактирование
                          </button>
                        </div>

                        {activeBoard?.is_public ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#82AA82' }}>check_circle</span>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                Публичная ссылка активна: {activeBoard.share_mode === 'edit' ? 'редактирование' : 'только просмотр'}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, wordBreak: 'break-all', marginBottom: 10, color: 'var(--text-primary)', opacity: 0.6, background: 'var(--hover-bg)', borderRadius: 8, padding: '6px 10px', fontFamily: 'monospace' }}>
                              {`${window.location.origin}/board/${activeBoard.share_token}`}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button style={{ ...btnPrimary, flex: 1, fontSize: 12, padding: '7px 0' }} onClick={copyShareLink}>Скопировать</button>
                              <button style={{ ...btnSecondary, flex: 1, fontSize: 12, padding: '7px 0' }} onClick={() => enableShare(shareModeDraft)}>Сохранить режим</button>
                              <button style={{ ...btnSecondary, fontSize: 12, padding: '7px 12px' }} onClick={disableShare}>Отключить</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>Создайте публичную ссылку для доступа</div>
                            <button style={{ ...btnPrimary, width: '100%', fontSize: 13, padding: '8px 0' }} onClick={() => enableShare(shareModeDraft)}>Включить ссылку</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Lecture + text + AI */}
                {activeBoardId && boardCanEdit && <PanelButton icon="article" label="Из лекции" onClick={openLecturePicker} isLightTheme={isLightTheme} />}
                {activeBoardId && boardCanEdit && <PanelButton icon="text_fields" label="Текст-блок" onClick={insertBoundedTextBlock} isLightTheme={isLightTheme} />}
                {activeBoardId && boardCanEdit && (
                  <PanelButton icon="auto_awesome" label="AI схема" onClick={() => setAiDiagramOpen(true)} isLightTheme={isLightTheme} />
                )}

                {/* Background */}
                {boardCanEdit && (
                <div style={{ position: 'relative' }}>
                  <PanelButton icon="format_color_fill" label="Фон холста" onClick={() => { setBgMenuOpen(o => !o); setSaveMenuOpen(false); setShareMenuOpen(false); }} isLightTheme={isLightTheme} />
                  {bgMenuOpen && (
                    <div style={{
                      position: 'absolute', right: 'calc(100% + 8px)', top: 0,
                      background: isLightTheme ? '#fffdf5' : '#140f11',
                      border: '1px solid var(--border-color)',
                      borderRadius: 12, padding: '10px 10px 8px',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
                      zIndex: 400, minWidth: 210,
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.08em', opacity: 0.6 }}>ФОН ХОЛСТА</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                        {BG_MAIN.map(p => (
                          <button key={p.color} onClick={() => { changeBg(p.color); setBgPaletteOpen(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, background: canvasBg === p.color ? 'rgba(130,170,130,0.1)' : 'none', border: canvasBg === p.color ? '1px solid rgba(130,170,130,0.4)' : '1px solid transparent', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left', width: '100%', transition: 'background .15s' }}
                            onMouseEnter={e => { if (canvasBg !== p.color) e.currentTarget.style.background = 'var(--hover-bg)'; }}
                            onMouseLeave={e => { if (canvasBg !== p.color) e.currentTarget.style.background = 'none'; }}
                          >
                            <span style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, background: p.color, border: '1px solid rgba(0,0,0,0.12)', boxShadow: p.color === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : 'none' }} />
                            {p.label}
                            {canvasBg === p.color && <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#82AA82', marginLeft: 'auto' }}>check</span>}
                          </button>
                        ))}
                      </div>
                      <div style={{ height: 1, background: 'var(--border-color)', margin: '6px 0' }} />
                      <button onClick={() => setBgPaletteOpen(o => !o)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, background: bgPaletteOpen ? 'rgba(130,170,130,0.1)' : 'none', border: bgPaletteOpen ? '1px solid rgba(130,170,130,0.4)' : '1px solid transparent', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left', width: '100%', transition: 'background .15s' }}
                        onMouseEnter={e => { if (!bgPaletteOpen) e.currentTarget.style.background = 'var(--hover-bg)'; }}
                        onMouseLeave={e => { if (!bgPaletteOpen) e.currentTarget.style.background = 'none'; }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-secondary)' }}>palette</span>
                        Из палитры
                        <span className="material-symbols-outlined" style={{ fontSize: 14, marginLeft: 'auto', color: 'var(--text-secondary)', transition: 'transform .2s', transform: bgPaletteOpen ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                      </button>
                      {bgPaletteOpen && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, marginBottom: 8 }}>
                            {BG_PALETTE.map(c => (
                              <button key={c} title={c} onClick={() => changeBg(c)}
                                style={{ width: '100%', aspectRatio: '1', borderRadius: 5, cursor: 'pointer', background: c, border: canvasBg === c ? '2px solid #82AA82' : '1px solid rgba(0,0,0,0.12)', transition: 'transform .1s' }}
                                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                              />
                            ))}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Точный цвет</span>
                            <input type="color" value={canvasBg.startsWith('#') ? canvasBg : '#ffffff'} onChange={e => changeBg(e.target.value)} style={{ flex: 1, height: 26, borderRadius: 6, border: '1px solid var(--border-color)', cursor: 'pointer', padding: 2 }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}

                <div style={{ height: 1, background: 'var(--border-color)', margin: '6px 4px' }} />

                <PanelButton icon="logout" label="Выйти" onClick={handleExitRequest} isLightTheme={isLightTheme} danger />
              </div>
            )}
          </div>
        )}

        {/* ── Exit confirmation prompt ── */}
        {exitPrompt && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 16px',
          }}>
            <div style={{
              ...surface,
              borderRadius: 16,
              padding: 28,
              maxWidth: 400,
              width: '100%',
              fontFamily: 'Georgia, serif',
            }}>
              <div style={{ fontSize: 20, fontWeight: 400, marginBottom: 8, color: 'var(--text-primary)' }}>
                Выйти с полотна?
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
                {boardCanEdit
                  ? 'Несохранённые изменения будут потеряны.'
                  : 'Вы просматривали полотно в режиме только для чтения.'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeBoardId && boardCanEdit && (
                  <button style={{ ...btnPrimary, width: '100%', textAlign: 'center' }} onClick={() => confirmExit(true)}>
                    Сохранить и выйти
                  </button>
                )}
                {activeBoardId && boardCanEdit && (
                  <button style={{ ...btnSecondary, width: '100%', textAlign: 'center' }} onClick={() => confirmExit(false)}>
                    Выйти
                  </button>
                )}
                <button style={{ ...btnSecondary, width: '100%', textAlign: 'center', opacity: 0.7 }} onClick={() => setExitPrompt(false)}>
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ── Lecture picker modal ── */}
        {lecturePickerOpen && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 16px',
          }} onClick={e => { if (e.target === e.currentTarget) { setLecturePickerOpen(false); setSelectedLecture(null); } }}>
            <div style={{
              ...surface,
              borderRadius: 16,
              width: '100%',
              maxWidth: selectedLecture ? 640 : 480,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'Georgia, serif',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                {selectedLecture && (
                  <button onClick={() => { setSelectedLecture(null); setInsertText(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4, borderRadius: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
                  </button>
                )}
                <div>
                  <div style={{ fontSize: 18, color: 'var(--text-primary)', fontWeight: 400 }}>
                    {selectedLecture ? selectedLecture.title : 'Вставить из лекции'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {selectedLecture ? 'Отредактируйте текст и нажмите «Вставить»' : 'Выберите лекцию для вставки текста'}
                  </div>
                </div>
                <button onClick={() => { setLecturePickerOpen(false); setSelectedLecture(null); }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4, borderRadius: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                </button>
              </div>

              {!selectedLecture && (
                <div style={{ padding: '0 24px 12px' }}>
                  <div style={{ display: 'inline-flex', borderRadius: 999, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <button
                      onClick={() => { setLectureSource('my'); loadLectures('my'); }}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        border: 'none',
                        cursor: 'pointer',
                        background: lectureSource === 'my' ? 'var(--text-primary)' : 'transparent',
                        color: lectureSource === 'my' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                        fontFamily: 'Georgia, serif',
                      }}
                    >
                      Мои лекции
                    </button>
                    <button
                      onClick={() => { setLectureSource('catalog'); loadLectures('catalog'); }}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        border: 'none',
                        cursor: 'pointer',
                        background: lectureSource === 'catalog' ? 'var(--text-primary)' : 'transparent',
                        color: lectureSource === 'catalog' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                        fontFamily: 'Georgia, serif',
                      }}
                    >
                      База лекций
                    </button>
                  </div>
                </div>
              )}

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
                {!selectedLecture ? (
                  // Lecture list
                  lecturesLoading ? (
                    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                      Загрузка...
                    </div>
                  ) : lectures.length === 0 ? (
                    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                      Нет лекций с текстом
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {lectures.map(l => (
                        <button key={l.id} onClick={() => selectLecture(l)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            background: 'none', border: '1px solid var(--border-color)',
                            borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                            textAlign: 'left', fontFamily: 'Georgia, serif',
                            transition: 'border-color .15s, background .15s',
                            width: '100%',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-secondary)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)'; }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--text-secondary)', flexShrink: 0 }}>description</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {l.title}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                              {l.subject ? `${l.subject} · ` : ''}
                              {l.discipline ? `${l.discipline} · ` : ''}
                              {l.streamName ? `${l.streamName} · ` : ''}
                              {new Date(l.created_at).toLocaleDateString('ru-RU')}
                            </div>
                          </div>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-secondary)', flexShrink: 0 }}>chevron_right</span>
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  // Text editor
                  lectureDetailLoading ? (
                    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                      Загрузка текста...
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Вы можете отредактировать или сократить текст перед вставкой
                      </div>
                      <textarea
                        value={insertText}
                        onChange={e => setInsertText(e.target.value)}
                        rows={14}
                        style={{
                          width: '100%',
                          background: 'var(--hover-bg)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 10,
                          padding: '12px 14px',
                          color: 'var(--text-primary)',
                          fontFamily: 'Georgia, serif',
                          fontSize: 13,
                          lineHeight: 1.7,
                          outline: 'none',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {insertText.length} символов
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Footer */}
              {selectedLecture && !lectureDetailLoading && (
                <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button style={{ ...btnSecondary, fontSize: 13 }} onClick={() => { setLecturePickerOpen(false); setSelectedLecture(null); }}>
                    Отмена
                  </button>
                  <button style={{ ...btnPrimary, fontSize: 13 }} onClick={insertLectureText} disabled={!insertText.trim()}>
                    Вставить
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AI diagram modal ── */}
        {aiDiagramOpen && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 520,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 16px',
          }} onClick={e => { if (e.target === e.currentTarget) setAiDiagramOpen(false); }}>
            <div style={{
              ...surface,
              borderRadius: 16,
              width: '100%',
              maxWidth: 560,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'Georgia, serif',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, color: 'var(--text-primary)', fontWeight: 400 }}>
                    AI схема из текста
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Опишите структуру или таблицу — получите блоки и стрелки
                  </div>
                </div>
                <button onClick={() => setAiDiagramOpen(false)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4, borderRadius: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                <div style={{ display: 'inline-flex', borderRadius: 999, border: '1px solid var(--border-color)', overflow: 'hidden', marginBottom: 10 }}>
                  <button
                    onClick={() => setAiDiagramMode('diagram')}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      border: 'none',
                      cursor: 'pointer',
                      background: aiDiagramMode === 'diagram' ? 'var(--text-primary)' : 'transparent',
                      color: aiDiagramMode === 'diagram' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                      fontFamily: 'Georgia, serif',
                    }}
                  >
                    Схема
                  </button>
                  <button
                    onClick={() => setAiDiagramMode('table')}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      border: 'none',
                      cursor: 'pointer',
                      background: aiDiagramMode === 'table' ? 'var(--text-primary)' : 'transparent',
                      color: aiDiagramMode === 'table' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                      fontFamily: 'Georgia, serif',
                    }}
                  >
                    Таблица
                  </button>
                </div>
                <textarea
                  value={aiDiagramText}
                  onChange={e => setAiDiagramText(e.target.value)}
                  rows={10}
                  placeholder={aiDiagramMode === 'table'
                    ? 'Например: Таблица: Понятие | Определение. 6-8 строк.'
                    : 'Например: Введение → Метод → Результаты → Выводы'
                  }
                  style={{
                    width: '100%',
                    background: 'var(--hover-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    color: 'var(--text-primary)',
                    fontFamily: 'Georgia, serif',
                    fontSize: 13,
                    lineHeight: 1.7,
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.08em', opacity: 0.6 }}>
                    ШАБЛОНЫ
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(aiDiagramMode === 'table' ? AI_TABLE_TEMPLATES : AI_DIAGRAM_TEMPLATES).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setAiDiagramText(item.text)}
                        style={{
                          ...btnSecondary,
                          fontSize: 12,
                          padding: '6px 10px',
                          borderRadius: 999,
                        }}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
                {aiDiagramError && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#b58488' }}>{aiDiagramError}</div>
                )}
              </div>

              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={{ ...btnSecondary, fontSize: 13 }} onClick={() => setAiDiagramOpen(false)}>
                  Отмена
                </button>
                <button style={{ ...btnPrimary, fontSize: 13 }} onClick={generateDiagram} disabled={aiDiagramLoading || !aiDiagramText.trim()}>
                  {aiDiagramLoading ? 'Генерация…' : 'Построить'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MODAL MODE
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Georgia, serif', color: 'var(--text-primary)' }}>
      <h1 style={{ fontSize: 32, fontWeight: 300, marginBottom: 8, textAlign: 'center' }}>Полотно</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15, textAlign: 'center' }}>
        Интерактивная доска для визуализации лекций, рисунков и схем
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, maxWidth: 700 }}>

        {/* ── Create new board ── */}
        <div style={{
          ...surface,
          borderRadius: 16,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, opacity: 0.7 }}>add_circle</span>
            <span style={{ fontSize: 17 }}>Новое полотно</span>
          </div>
          <input
            type="text"
            placeholder="Название (необязательно)"
            value={newTitle}
            onChange={e => { setNewTitle(e.target.value); setCreateError(''); }}
            onKeyDown={e => e.key === 'Enter' && createBoard()}
            style={{
              background: 'var(--hover-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '10px 14px',
              color: 'var(--text-primary)',
              fontFamily: 'Georgia, serif',
              fontSize: 14,
              outline: 'none',
            }}
          />
          {createError && <div style={{ fontSize: 12, color: '#b58488' }}>{createError}</div>}
          <button style={btnPrimary} onClick={createBoard}>Создать</button>
        </div>

        {/* ── Open by link ── */}
        <div style={{
          ...surface,
          borderRadius: 16,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, opacity: 0.7 }}>link</span>
            <span style={{ fontSize: 17 }}>Открыть по ссылке</span>
          </div>
          <input
            type="text"
            placeholder="Вставьте публичную ссылку"
            value={shareInput}
            onChange={e => { setShareInput(e.target.value); setShareError(''); }}
            onKeyDown={e => e.key === 'Enter' && openByShareLink()}
            style={{
              background: 'var(--hover-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '10px 14px',
              color: 'var(--text-primary)',
              fontFamily: 'Georgia, serif',
              fontSize: 14,
              outline: 'none',
            }}
          />
          {shareError && <div style={{ fontSize: 12, color: '#b58488' }}>{shareError}</div>}
          <button style={btnSecondary} onClick={openByShareLink}>Открыть</button>
        </div>
      </div>

      {/* ── Board list ── */}
      <div style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 300, marginBottom: 16 }}>Мои полотна</h2>
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Загрузка...</div>
        ) : boards.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            У вас пока нет полотен. Создайте первое!
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, maxWidth: 860 }}>
            {boards.map(board => (
              <BoardCard
                key={board.id}
                board={board}
                onOpen={() => openBoard(board.id)}
                onDelete={async () => {
                  await fetch(`${API_BASE}/api/boards/${board.id}`, {
                    method: 'DELETE', headers: authHeaders(),
                  });
                  fetchBoards();
                }}
                isLightTheme={isLightTheme}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 300, marginBottom: 16 }}>Недавние доски</h2>
        {recentLoading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Загрузка...</div>
        ) : recentBoards.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Здесь появятся чужие доски, которые вы открывали по ссылке.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, maxWidth: 860 }}>
            {recentBoards.map(board => (
              <BoardCard
                key={board.id}
                board={board}
                onOpen={() => openBoard(board.id)}
                onDelete={async () => {
                  await fetch(`${API_BASE}/api/boards/recent/${board.id}`, {
                    method: 'DELETE', headers: authHeaders(),
                  });
                  fetchRecentBoards();
                }}
                isLightTheme={isLightTheme}
                owner={board.owner}
                lastOpenedAt={board.last_opened_at}
                accessMode={board.last_access_mode}
                isRecent
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface PanelButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  isLightTheme: boolean;
  danger?: boolean;
  active?: boolean;
}

const MobileIconButton: React.FC<{ icon: string; label: string; onClick: () => void; danger?: boolean; active?: boolean }> = ({ icon, label, onClick, danger, active }) => (
  <button
    onClick={onClick}
    title={label}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      background: active ? 'rgba(130,170,130,0.12)' : 'none',
      border: 'none', cursor: 'pointer',
      padding: '6px 6px', borderRadius: 10,
      color: danger ? '#b58488' : active ? '#82AA82' : 'var(--text-primary)',
      fontSize: 9, fontFamily: 'Georgia, serif',
      minWidth: 52,
      flex: '0 0 auto',
      transition: 'background .15s',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = active ? 'rgba(130,170,130,0.2)' : 'var(--hover-bg)')}
    onMouseLeave={e => (e.currentTarget.style.background = active ? 'rgba(130,170,130,0.12)' : 'none')}
  >
    <span className="material-symbols-outlined" style={{ fontSize: 19 }}>{icon}</span>
    <span style={{ whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.1, maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
  </button>
);

const PanelButton: React.FC<PanelButtonProps> = ({ icon, label, onClick, isLightTheme, danger, active }) => (
  <button
    onClick={onClick}
    title={label}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: active ? 'rgba(130,170,130,0.12)' : 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '8px 10px',
      borderRadius: 8,
      color: danger ? '#b58488' : active ? '#82AA82' : 'var(--text-primary)',
      fontSize: 13,
      fontFamily: 'Georgia, serif',
      width: '100%',
      textAlign: 'left',
      transition: 'background .15s',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = active ? 'rgba(130,170,130,0.2)' : 'var(--hover-bg)')}
    onMouseLeave={e => (e.currentTarget.style.background = active ? 'rgba(130,170,130,0.12)' : 'none')}
  >
    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
    <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
  </button>
);

interface MenuItemProps { label: string; icon: string; onClick: () => void; danger?: boolean; }
const MenuItem: React.FC<MenuItemProps> = ({ label, icon, onClick, danger }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'none', border: 'none', cursor: 'pointer',
      padding: '8px 10px', borderRadius: 8,
      color: danger ? '#b58488' : 'var(--text-primary)', fontSize: 13,
      fontFamily: 'Georgia, serif', width: '100%', textAlign: 'left',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = danger ? 'rgba(181,132,136,0.1)' : 'var(--hover-bg)')}
    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
  >
    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
    {label}
  </button>
);

interface BoardCardProps {
  board: BoardMeta;
  onOpen: () => void;
  onDelete: () => void;
  isLightTheme: boolean;
  owner?: BoardOwner | null;
  lastOpenedAt?: string | null;
  accessMode?: 'view' | 'edit';
  isRecent?: boolean;
}

const BoardCard: React.FC<BoardCardProps> = ({ board, onOpen, onDelete, isLightTheme, owner, lastOpenedAt, accessMode, isRecent }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formatOpenedAt = (s: string) =>
    new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div
      style={{
        background: 'var(--hover-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        transition: 'border-color .2s',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text-secondary)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
    >
      {/* Canvas preview placeholder */}
      <div
        onClick={onOpen}
        style={{
          height: 80,
          borderRadius: 8,
          background: isLightTheme ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 32, opacity: 0.25 }}>dashboard</span>
      </div>

      <div onClick={onOpen}>
        <div style={{ fontSize: 14, fontWeight: 400, marginBottom: 2, color: 'var(--text-primary)' }}>
          {board.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {formatDate(board.updated_at)}
          {board.is_public && (
            <span style={{ marginLeft: 6, opacity: 0.6 }}>• {board.share_mode === 'edit' ? 'публичное редактирование' : 'публичное'}</span>
          )}
          {isRecent && owner && (
            <div style={{ marginTop: 4, opacity: 0.85 }}>
              {owner.full_name || owner.login}
            </div>
          )}
          {lastOpenedAt && (
            <div style={{ marginTop: 4, opacity: 0.75 }}>
              Открыто: {formatOpenedAt(lastOpenedAt)}{accessMode ? ` • ${accessMode === 'edit' ? 'редактирование' : 'просмотр'}` : ''}
            </div>
          )}
        </div>
      </div>

      {confirmDelete ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onDelete}
            style={{
              flex: 1, background: '#b58488', color: '#fff', border: 'none',
              borderRadius: 6, padding: '5px 0', fontSize: 12, cursor: 'pointer',
              fontFamily: 'Georgia, serif',
            }}
          >
            Удалить
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{
              flex: 1, background: 'var(--hover-bg)', color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)', borderRadius: 6,
              padding: '5px 0', fontSize: 12, cursor: 'pointer',
              fontFamily: 'Georgia, serif',
            }}
          >
            Отмена
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
          style={{
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            fontSize: 11, cursor: 'pointer', textAlign: 'left',
            fontFamily: 'Georgia, serif', padding: 0,
          }}
        >
          Удалить
        </button>
      )}
    </div>
  );
};

export default BoardSection;
