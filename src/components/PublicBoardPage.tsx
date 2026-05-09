import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Excalidraw, serializeAsJSON } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import excalidrawStyles from './excalidrawStyles';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface BoardPublicDetail {
  id: string;
  title: string;
  data: string | null;
  share_mode: 'view' | 'edit';
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
  const [saveMsg, setSaveMsg] = useState('');
  const clientId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const isExternalUpdate = useRef(false);
  const sseRef = useRef<EventSource | null>(null);

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

        // If edit-mode but not authenticated — redirect to login with return URL
        if (detail.share_mode === 'edit' && !isAuthenticated) {
          navigate(`/auth?redirectTo=/board/${shareToken}`);
          return;
        }

        setBoardDetail(detail);
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

  // ── auto-save for edit mode ─────────────────────────────────────────────────
  const handleChange = useCallback(() => {
    if (isExternalUpdate.current) {
      isExternalUpdate.current = false;
      return;
    }
    if (!boardDetail?.can_edit || !excalidrawAPI.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const api = excalidrawAPI.current;
      if (!api || !boardDetail) return;
      const data = serializeAsJSON(
        api.getSceneElements(),
        api.getAppState(),
        api.getFiles(),
        'local',
      );
      const res = await fetch(`${API_BASE}/api/boards/${boardDetail.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, client_id: clientId.current }),
      });
      if (res.ok) {
        setSaveMsg('Сохранено');
        setTimeout(() => setSaveMsg(''), 2000);
      }
    }, 2000);
  }, [boardDetail, authToken]);

  // ── manual save ─────────────────────────────────────────────────────────────
  const handleManualSave = async () => {
    if (!boardDetail?.can_edit || !excalidrawAPI.current) return;
    const api = excalidrawAPI.current;
    const data = serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'local');
    setSaveMsg('Сохранение…');
    const res = await fetch(`${API_BASE}/api/boards/${boardDetail.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, client_id: clientId.current }),
    });
    if (res.ok) {
      setSaveMsg('Сохранено');
      setTimeout(() => setSaveMsg(''), 2000);
    } else {
      setSaveMsg('Ошибка сохранения');
      setTimeout(() => setSaveMsg(''), 2000);
    }
  };

  // ── SSE real-time subscription ──────────────────────────────────────────────
  useEffect(() => {
    if (!boardDetail?.can_edit) return;
    const es = new EventSource(
      `${API_BASE}/api/boards/${boardDetail.id}/stream?client_id=${clientId.current}`
    );
    sseRef.current = es;

    es.addEventListener('board.update', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        isExternalUpdate.current = true;
        excalidrawAPI.current?.updateScene({ elements: parsed.elements, appState: parsed.appState, files: parsed.files });
      } catch {
        // ignore invalid SSE data
      }
    });

    es.onerror = () => {};

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [boardDetail?.id]);

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
