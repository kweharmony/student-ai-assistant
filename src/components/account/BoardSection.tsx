import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Excalidraw, exportToBlob, exportToSvg, serializeAsJSON } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface BoardMeta {
  id: string;
  title: string;
  is_public: boolean;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

interface BoardDetail extends BoardMeta {
  data: string | null;
}

interface BoardSectionProps {
  isLightTheme: boolean;
  onCanvasMode?: (active: boolean) => void;
}

type Mode = 'modal' | 'canvas';

const BoardSection: React.FC<BoardSectionProps> = ({ isLightTheme, onCanvasMode }) => {
  const { token } = useAuth();

  // ── modal state ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('modal');
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [shareInput, setShareInput] = useState('');
  const [shareError, setShareError] = useState('');
  const [createError, setCreateError] = useState('');

  // ── canvas state ─────────────────────────────────────────────────────────────
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [boardTitle, setBoardTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);
  const excalidrawAPI = useRef<ExcalidrawImperativeAPI | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── save panel ───────────────────────────────────────────────────────────────
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // ── share panel ──────────────────────────────────────────────────────────────
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [activeBoard, setActiveBoard] = useState<BoardMeta | null>(null);

  // ── exit prompt ──────────────────────────────────────────────────────────────
  const [exitPrompt, setExitPrompt] = useState(false);

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

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

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
    setMode('canvas');
    onCanvasMode?.(true);
  };

  // ── open board by share link ─────────────────────────────────────────────────
  const openByShareLink = async () => {
    setShareError('');
    const match = shareInput.match(/\/public\/([A-Za-z0-9_-]+)/);
    const token_ = match ? match[1] : shareInput.trim();
    if (!token_) { setShareError('Введите ссылку или токен'); return; }
    const res = await fetch(`${API_BASE}/api/boards/public/${token_}`);
    if (!res.ok) { setShareError('Полотно не найдено или ссылка недействительна'); return; }
    const detail: BoardDetail = await res.json();
    let parsed: any = { elements: [], appState: {} };
    if (detail.data) {
      try { parsed = JSON.parse(detail.data); } catch {}
    }
    setInitialData(parsed);
    setActiveBoardId(null); // read-only, no id for saving
    setBoardTitle(detail.title + ' (только просмотр)');
    setActiveBoard(null);
    setMode('canvas');
    onCanvasMode?.(true);
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

  // ── auto-save on change ──────────────────────────────────────────────────────
  const handleChange = useCallback(() => {
    if (!activeBoardId || !excalidrawAPI.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const api = excalidrawAPI.current;
      if (!api) return;
      const data = serializeAsJSON(
        api.getSceneElements(),
        api.getAppState(),
        api.getFiles(),
        'local',
      );
      await fetch(`${API_BASE}/api/boards/${activeBoardId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ data }),
      });
    }, 2000);
  }, [activeBoardId, authHeaders]);

  // ── save to profile (manual) ─────────────────────────────────────────────────
  const saveToProfile = async () => {
    if (!activeBoardId || !excalidrawAPI.current) return;
    setSaving(true);
    const api = excalidrawAPI.current;
    const data = serializeAsJSON(
      api.getSceneElements(),
      api.getAppState(),
      api.getFiles(),
      'local',
    );
    const res = await fetch(`${API_BASE}/api/boards/${activeBoardId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ data, title: boardTitle }),
    });
    setSaving(false);
    if (res.ok) {
      setSaveMsg('Сохранено');
      setTimeout(() => setSaveMsg(''), 2000);
    }
  };

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
  const enableShare = async () => {
    if (!activeBoardId) return;
    const res = await fetch(`${API_BASE}/api/boards/${activeBoardId}/share`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (res.ok) {
      const updated: BoardMeta = await res.json();
      setActiveBoard(updated);
    }
  };

  const disableShare = async () => {
    if (!activeBoardId) return;
    const res = await fetch(`${API_BASE}/api/boards/${activeBoardId}/share`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) {
      const updated: BoardMeta = await res.json();
      setActiveBoard(updated);
    }
  };

  const copyShareLink = () => {
    if (!activeBoard?.share_token) return;
    const link = `${window.location.origin}/board/${activeBoard.share_token}`;
    navigator.clipboard.writeText(link);
    setSaveMsg('Ссылка скопирована');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  // ── save title ────────────────────────────────────────────────────────────────
  const saveTitle = async () => {
    setEditingTitle(false);
    if (!activeBoardId) return;
    await fetch(`${API_BASE}/api/boards/${activeBoardId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ title: boardTitle }),
    });
  };

  // ── exit ──────────────────────────────────────────────────────────────────────
  const handleExitRequest = () => setExitPrompt(true);

  const confirmExit = async (saveFirst: boolean) => {
    if (saveFirst) await saveToProfile();
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setExitPrompt(false);
    setMode('modal');
    setActiveBoardId(null);
    setInitialData(null);
    setActiveBoard(null);
    onCanvasMode?.(false);
    fetchBoards();
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
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#fff' }}>
        <style>{`.excalidraw .ToolIcon__library, .excalidraw [title="Library"], .excalidraw [aria-label="Library"] { display: none !important; }`}</style>
        {/* Excalidraw fills entire viewport */}
        {initialData !== null && (
          <Excalidraw
            excalidrawAPI={(api) => { excalidrawAPI.current = api; }}
            initialData={initialData}
            onChange={handleChange}
            theme={isLightTheme ? 'light' : 'dark'}
            UIOptions={{
              canvasActions: {
                saveToActiveFile: false,
                loadScene: false,
                export: false,
                toggleTheme: false,
              },
            }}
          />
        )}

        {/* ── Floating left panel (vertically centered) ── */}
        <div style={{
          position: 'fixed',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: isLightTheme ? 'rgba(255,255,245,0.96)' : 'rgba(30,22,24,0.96)',
          border: '1px solid var(--border-color)',
          borderRadius: 14,
          padding: '12px 8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(12px)',
          minWidth: 44,
        }}>
          {/* Board title */}
          <div style={{ padding: '0 4px 6px', borderBottom: '1px solid var(--border-color)' }}>
            {editingTitle ? (
              <input
                autoFocus
                value={boardTitle}
                onChange={e => setBoardTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => e.key === 'Enter' && saveTitle()}
                style={{
                  width: 130,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--text-secondary)',
                  color: 'var(--text-primary)',
                  fontFamily: 'Georgia, serif',
                  fontSize: 13,
                  outline: 'none',
                  padding: '2px 0',
                }}
              />
            ) : (
              <button
                onClick={() => activeBoardId && setEditingTitle(true)}
                title="Переименовать"
                style={{
                  background: 'none', border: 'none', cursor: activeBoardId ? 'pointer' : 'default',
                  color: 'var(--text-primary)', fontFamily: 'Georgia, serif', fontSize: 13,
                  maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  padding: 0,
                }}
              >
                {boardTitle}
              </button>
            )}
          </div>

          {/* Save status */}
          {saveMsg && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', padding: '0 4px' }}>
              {saveMsg}
            </div>
          )}

          {/* Save button + dropdown */}
          {activeBoardId && (
            <div style={{ position: 'relative' }}>
              <PanelButton
                icon="save"
                label="Сохранить"
                onClick={() => setSaveMenuOpen(o => !o)}
                isLightTheme={isLightTheme}
              />
              {saveMenuOpen && (
                <div style={{
                  position: 'absolute', left: 50, top: 0,
                  background: isLightTheme ? '#fffdf5' : '#1e1618',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10, padding: 8, minWidth: 180,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  zIndex: 400,
                }}>
                  <MenuItem label="Сохранить на профиль" icon="cloud_upload" onClick={async () => { await saveToProfile(); setSaveMenuOpen(false); }} />
                  <MenuItem label="Скачать PNG" icon="image" onClick={exportPNG} />
                  <MenuItem label="Скачать SVG" icon="vector_square" onClick={exportSVG} />
                  <MenuItem label="Скачать JSON" icon="data_object" onClick={exportJSON} />
                </div>
              )}
            </div>
          )}

          {/* Share button */}
          {activeBoardId && (
            <div style={{ position: 'relative' }}>
              <PanelButton
                icon="share"
                label="Поделиться"
                onClick={() => setShareMenuOpen(o => !o)}
                isLightTheme={isLightTheme}
              />
              {shareMenuOpen && (
                <div style={{
                  position: 'absolute', left: 50, top: 0,
                  background: isLightTheme ? '#fffdf5' : '#1e1618',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10, padding: 12, minWidth: 220,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  zIndex: 400,
                }}>
                  {activeBoard?.is_public ? (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        Публичная ссылка активна
                      </div>
                      <div style={{
                        fontSize: 11, wordBreak: 'break-all', marginBottom: 8,
                        color: 'var(--text-primary)', opacity: 0.7,
                      }}>
                        {`${window.location.origin}/board/${activeBoard.share_token}`}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ ...btnPrimary, fontSize: 12, padding: '6px 12px' }} onClick={copyShareLink}>Скопировать</button>
                        <button style={{ ...btnSecondary, fontSize: 12, padding: '6px 12px' }} onClick={disableShare}>Отключить</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        Публичный доступ отключён
                      </div>
                      <button style={{ ...btnPrimary, fontSize: 12, padding: '6px 14px' }} onClick={enableShare}>
                        Включить ссылку
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />

          {/* Exit button */}
          <PanelButton
            icon="logout"
            label="Выйти"
            onClick={handleExitRequest}
            isLightTheme={isLightTheme}
            danger
          />
        </div>

        {/* ── Exit confirmation prompt ── */}
        {exitPrompt && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              ...surface,
              borderRadius: 16,
              padding: 32,
              maxWidth: 380,
              width: '90%',
              fontFamily: 'Georgia, serif',
            }}>
              <div style={{ fontSize: 20, fontWeight: 400, marginBottom: 12, color: 'var(--text-primary)' }}>
                Выйти с полотна?
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
                {activeBoardId
                  ? 'Несохранённые изменения будут потеряны. Сохранить перед выходом?'
                  : 'Вы просматривали полотно в режиме только для чтения.'}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button style={btnSecondary} onClick={() => setExitPrompt(false)}>Отмена</button>
                {activeBoardId && (
                  <button style={btnSecondary} onClick={() => confirmExit(false)}>Выйти без сохранения</button>
                )}
                <button style={btnPrimary} onClick={() => confirmExit(activeBoardId ? true : false)}>
                  {activeBoardId ? 'Сохранить и выйти' : 'Выйти'}
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
      <h1 style={{ fontSize: 32, fontWeight: 300, marginBottom: 8 }}>Полотно</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15 }}>
        Интерактивная доска для визуализации лекций, рисунков и схем
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 700 }}>

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
}

const PanelButton: React.FC<PanelButtonProps> = ({ icon, label, onClick, isLightTheme, danger }) => (
  <button
    onClick={onClick}
    title={label}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '8px 10px',
      borderRadius: 8,
      color: danger ? '#b58488' : 'var(--text-primary)',
      fontSize: 13,
      fontFamily: 'Georgia, serif',
      width: '100%',
      textAlign: 'left',
      transition: 'background .15s',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
  >
    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
    <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
  </button>
);

interface MenuItemProps { label: string; icon: string; onClick: () => void; }
const MenuItem: React.FC<MenuItemProps> = ({ label, icon, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'none', border: 'none', cursor: 'pointer',
      padding: '8px 10px', borderRadius: 8,
      color: 'var(--text-primary)', fontSize: 13,
      fontFamily: 'Georgia, serif', width: '100%', textAlign: 'left',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
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
}

const BoardCard: React.FC<BoardCardProps> = ({ board, onOpen, onDelete, isLightTheme }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const formatDate = (s: string) =>
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
            <span style={{ marginLeft: 6, opacity: 0.6 }}>• публичное</span>
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
