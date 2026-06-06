import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Excalidraw, serializeAsJSON } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import excalidrawStyles from './excalidrawStyles';
import { mergeExcalidrawElements } from '../utils/boardSync';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_BASE = API_BASE.replace(/^http(s?):\/\//, (_, secure) => (secure ? 'wss://' : 'ws://'));
const SEND_DEBOUNCE_MS = 150;

interface BoardPublicDetail {
  id: string;
  title: string;
  data: string | null;
  share_mode: 'view' | 'edit';
  show_cursors?: boolean;
  can_edit: boolean;
  owner: {
    id: string;
    login: string;
    full_name: string | null;
  } | null;
}

const PublicBoardPage: React.FC = () => {
  const { token: shareToken } = useParams<{ token: string }>();
  const { isLightTheme } = useTheme();
  const { token: authToken, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // ── board data ──────────────────────────────────────────────────────────────
  const [boardDetail, setBoardDetail] = useState<BoardPublicDetail | null>(null);
  const [initialData, setInitialData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // ── canvas state ────────────────────────────────────────────────────────────
  const excalidrawAPI = useRef<ExcalidrawImperativeAPI | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastSentData = useRef<string | null>(null);
  // Каждая запись: метаданные + target (последняя пришедшая точка) и display
  // (текущая отрисованная). rAF плавно двигает display к target — Вариант 1.
  const collaboratorsRef = useRef<Map<string, any>>(new Map());
  const animationFrame = useRef<number | null>(null);
  const lastPointerSent = useRef<number>(0);
  // Показ курсоров — настройка доски (меняет только владелец в своей панели).
  const showCursorsRef = useRef(true);
  const [saveMsg, setSaveMsg] = useState('');

  const authHeaders = useCallback(
    (): Record<string, string> | undefined => {
      if (!authToken) return undefined;
      return {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      };
    },
    [authToken]
  );

  // ── fetch board ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!shareToken || authLoading) return;
    (async () => {
      try {
        const h = authHeaders();
        const res = await fetch(`${API_BASE}/api/boards/public/${shareToken}`, {
          headers: h,
        });
        if (!res.ok) { setError('Полотно не найдено или ссылка недействительна'); return; }
        const detail: BoardPublicDetail = await res.json();

        if (detail.share_mode === 'edit' && !isAuthenticated) {
          navigate(`/auth?redirectTo=/board/${shareToken}`);
          return;
        }

        setBoardDetail(detail);
        showCursorsRef.current = detail.show_cursors !== false;
        let parsed: any = { elements: [], appState: {} };
        if (detail.data) { try { parsed = JSON.parse(detail.data); } catch {} }
        setInitialData(parsed);
      } catch {
        setError('Ошибка загрузки полотна');
      } finally {
        setLoading(false);
      }
    })();
  }, [shareToken, authLoading, isAuthenticated, authHeaders, navigate]);

  const persistBoardData = useCallback(async (data: string) => {
    if (!boardDetail?.id || !authToken) return;
    try {
      await fetch(`${API_BASE}/api/boards/${boardDetail.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
    } catch {
      // ignore
    }
  }, [boardDetail?.id, authToken]);

  // ── real-time send (throttle 100ms) ─────────────────────────────────────────
  const handleChange = useCallback(() => {
    if (!boardDetail?.can_edit || !excalidrawAPI.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const api = excalidrawAPI.current;
      if (!api) return;
      const data = serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'local');
      if (lastSentData.current === data) return;
      lastSentData.current = data;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'update', data }));
      } else {
        persistBoardData(data);
      }
    }, SEND_DEBOUNCE_MS);
  }, [boardDetail, persistBoardData]);

  const pendingRemoteUpdate = useRef<any | null>(null);

  const isUserInteracting = useCallback(() => {
    const api = excalidrawAPI.current;
    if (!api) return false;
    const state = api.getAppState();
    return Boolean(state.draggingElement || state.editingElement || state.isResizing || state.isRotating);
  }, []);

  const applyRemoteUpdate = useCallback((msg: any) => {
    if (!excalidrawAPI.current) return;
    const api = excalidrawAPI.current;
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
    // Не перехватываем прокрутку/зум зрителя — берём только цвет фона.
    const localState = api.getAppState();
    const safeAppState = {
      viewBackgroundColor: nextAppState?.viewBackgroundColor ?? localState.viewBackgroundColor,
    };
    // Сначала регистрируем файлы (картинки), иначе элемент-изображение
    // отрисуется силуэтом без бинаря. addFiles ждёт массив, а serializeAsJSON
    // отдаёт files словарём { fileId: BinaryFileData } — конвертируем.
    if (nextFiles && api.addFiles) {
      const filesArray = Array.isArray(nextFiles) ? nextFiles : Object.values(nextFiles);
      if (filesArray.length) api.addFiles(filesArray);
    }
    // Сливаем по версиям, чтобы не затирать параллельные правки (п.4).
    const merged = Array.isArray(nextElements)
      ? mergeExcalidrawElements(api.getSceneElements(), nextElements)
      : api.getSceneElements();
    api.updateScene({ elements: merged, appState: safeAppState });
  }, []);

  // ── manual save (persists to DB + send real-time) ───────────────────────────
  const handleManualSave = async () => {
    if (!boardDetail?.can_edit || !excalidrawAPI.current) return;
    const api = excalidrawAPI.current;
    const data = serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'local');
    setSaveMsg('Сохранение…');
    // real-time push
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'update', data }));
    }
    // persist to DB
    const res = await fetch(`${API_BASE}/api/boards/${boardDetail.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    if (res.ok) {
      setSaveMsg('Сохранено');
      setTimeout(() => setSaveMsg(''), 2000);
    } else {
      setSaveMsg('Ошибка сохранения');
      setTimeout(() => setSaveMsg(''), 2000);
    }
  };

  // ── WebSocket subscription ──────────────────────────────────────────────────
  // Отрисовывает соавторов по их display-позициям (сглаженным).
  const applyCollaborators = useCallback(() => {
    const map = new Map<string, any>();
    collaboratorsRef.current.forEach((c, id) => {
      map.set(id, {
        pointer: c.display ?? c.target,
        username: c.username,
        color: c.color,
      });
    });
    excalidrawAPI.current?.updateScene({ collaborators: map } as any);
  }, []);

  // rAF-цикл: на каждом кадре подтягиваем display к target (lerp). Когда все
  // курсоры «доехали», цикл останавливается — нагрузки в покое нет.
  const stepAnimation = useCallback(() => {
    const LERP = 0.25;
    const EPS = 0.5; // px в координатах сцены — считаем «доехавшим»
    let moving = false;
    collaboratorsRef.current.forEach((c) => {
      if (!c.target) return;
      if (!c.display) { c.display = { ...c.target }; return; }
      const dx = c.target.x - c.display.x;
      const dy = c.target.y - c.display.y;
      if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) {
        c.display = { ...c.target };
        return;
      }
      c.display = { x: c.display.x + dx * LERP, y: c.display.y + dy * LERP };
      moving = true;
    });
    applyCollaborators();
    if (moving) {
      animationFrame.current = requestAnimationFrame(stepAnimation);
    } else {
      animationFrame.current = null;
    }
  }, [applyCollaborators]);

  const ensureAnimating = useCallback(() => {
    if (animationFrame.current == null) {
      animationFrame.current = requestAnimationFrame(stepAnimation);
    }
  }, [stepAnimation]);

  useEffect(() => {
    if (!boardDetail?.id) return;
    const boardId = boardDetail.id;
    let closedByCleanup = false;
    let reconnectDelay = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (closedByCleanup) return;
      // Аутентификация: одноразовый тикет (п.10) для вошедших; аноним — без query.
      let query = '';
      if (authToken) {
        query = `?token=${authToken}`;
        try {
          const res = await fetch(`${API_BASE}/api/boards/${boardId}/ws-ticket`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
          });
          if (res.ok) {
            const { ticket } = await res.json();
            if (ticket) query = `?ticket=${ticket}`;
          }
        } catch { /* fallback to token */ }
      }
      if (closedByCleanup) return;

      const ws = new WebSocket(`${WS_BASE}/api/boards/${boardId}/ws${query}`);
      wsRef.current = ws;

      ws.onopen = () => { reconnectDelay = 1000; };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'update' && excalidrawAPI.current) {
            if (isUserInteracting()) { pendingRemoteUpdate.current = msg; return; }
            applyRemoteUpdate(msg);
          } else if (msg.type === 'pointer' && msg.sender_id) {
            if (!showCursorsRef.current) return;
            const hasPos = typeof msg.x === 'number' && typeof msg.y === 'number';
            const existing = collaboratorsRef.current.get(msg.sender_id);
            collaboratorsRef.current.set(msg.sender_id, {
              ...existing,
              target: hasPos ? { x: msg.x, y: msg.y } : undefined,
              username: msg.username,
              color: { background: msg.color || '#888', stroke: msg.color || '#888' },
            });
            ensureAnimating();
          } else if (msg.type === 'leave' && msg.sender_id) {
            collaboratorsRef.current.delete(msg.sender_id);
            applyCollaborators();
          } else if (msg.type === 'settings') {
            showCursorsRef.current = msg.show_cursors !== false;
            if (!showCursorsRef.current) { collaboratorsRef.current.clear(); applyCollaborators(); }
          }
        } catch {
          // ignore
        }
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        wsRef.current = null;
        collaboratorsRef.current.clear();
        applyCollaborators();
        if (closedByCleanup) return;
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 15000);
      };
    };

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (animationFrame.current != null) { cancelAnimationFrame(animationFrame.current); animationFrame.current = null; }
      collaboratorsRef.current.clear();
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [boardDetail?.id, authToken, applyRemoteUpdate, isUserInteracting, applyCollaborators, ensureAnimating]);

  // Отправка позиции курсора соавторам (throttled) для presence (п.9).
  const handlePointerUpdate = useCallback((payload: any) => {
    if (!showCursorsRef.current) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (now - lastPointerSent.current < 60) return;
    lastPointerSent.current = now;
    const p = payload?.pointer;
    if (!p) return;
    ws.send(JSON.stringify({ type: 'pointer', x: p.x, y: p.y }));
  }, []);

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

  if (loading || authLoading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', fontFamily: 'Georgia, serif', color: 'var(--text-secondary)',
    }}>
      <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
      background: 'var(--bg-primary)', fontFamily: 'Georgia, serif',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3, color: 'var(--text-primary)' }}>
        link_off
      </span>
      <div style={{ fontSize: 18, color: 'var(--text-primary)' }}>{error}</div>
      <Link to="/" style={{
        color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none',
        borderBottom: '1px solid var(--border-color)', paddingBottom: 2,
      }}>
        Перейти на главную
      </Link>
    </div>
  );

  const viewMode = !boardDetail?.can_edit;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: isLightTheme ? '#fffff0' : '#1f1516' }}
      data-ext-ui-theme={isLightTheme ? 'light' : 'dark'}
    >
      <style>{excalidrawStyles}</style>
      {initialData !== null && (
        <Excalidraw
          excalidrawAPI={(api) => { excalidrawAPI.current = api; }}
          initialData={initialData}
          onChange={viewMode ? undefined : handleChange}
          onPointerUpdate={handlePointerUpdate}
          isCollaborating
          viewModeEnabled={viewMode}
          theme="light"
          langCode="ru-RU"
          UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false, export: false, toggleTheme: false } }}
        />
      )}

      {/* Branded overlay panel */}
      <div style={{
        position: 'fixed',
        left: 12,
        top: '80%',
        transform: 'translateY(-50%)',
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        background: isLightTheme ? 'rgba(255,253,245,0.96)' : 'rgba(20,16,18,0.96)',
        border: '1px solid var(--border-color)',
        borderRadius: 14,
        padding: '12px 10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        backdropFilter: 'blur(12px)',
        minWidth: 160,
        fontFamily: 'Georgia, serif',
      }}>
        {/* Title */}
        <div style={{
          padding: '0 4px 8px',
          borderBottom: '1px solid var(--border-color)',
          fontSize: 13,
          color: isLightTheme ? '#2b1c1d' : '#fffff0',
          maxWidth: 160,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {boardDetail?.title}
        </div>

        {/* Mode badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 6px',
          fontSize: 11,
          color: isLightTheme ? '#5c4446' : '#c8c8b0',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            {viewMode ? 'visibility' : 'edit'}
          </span>
          {viewMode ? 'Только просмотр' : 'Редактирование'}
        </div>

        {saveMsg && (
          <div style={{
            fontSize: 11, color: '#82AA82', padding: '2px 6px',
          }}>
            {saveMsg}
          </div>
        )}

        <div style={{ height: 1, background: 'var(--border-color)', margin: '2px 0' }} />

        {/* Save button (edit mode only) */}
        {!viewMode && (
          <button
            onClick={handleManualSave}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 8,
              color: isLightTheme ? '#2b1c1d' : '#fffff0',
              fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
              transition: 'background .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
            Сохранить
          </button>
        )}

        {/* Back to site */}
        <Link to={isAuthenticated ? '/account' : '/auth'} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', borderRadius: 8,
          color: isLightTheme ? '#2b1c1d' : '#fffff0',
          fontSize: 13, textDecoration: 'none',
          transition: 'background .15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {isAuthenticated ? 'account_circle' : 'login'}
          </span>
          {isAuthenticated ? 'В аккаунт' : 'Войти на сайт'}
        </Link>
      </div>
    </div>
  );
};

export default PublicBoardPage;
