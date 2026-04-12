import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Excalidraw } from '@excalidraw/excalidraw';
import { useTheme } from '../contexts/ThemeContext';
import excalidrawStyles from './excalidrawStyles';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const PublicBoardPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { isLightTheme } = useTheme();

  const [title, setTitle] = useState('');
  const [initialData, setInitialData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/boards/public/${token}`);
        if (!res.ok) { setError('Полотно не найдено или ссылка недействительна'); return; }
        const detail = await res.json();
        setTitle(detail.title);
        let parsed: any = { elements: [], appState: {} };
        if (detail.data) { try { parsed = JSON.parse(detail.data); } catch {} }
        setInitialData(parsed);
      } catch {
        setError('Ошибка загрузки полотна');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) return (
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: isLightTheme ? '#fffff0' : '#1f1516' }}>
      <style>{excalidrawStyles}</style>
      {initialData !== null && (
        <Excalidraw
          initialData={initialData}
          viewModeEnabled
          theme={isLightTheme ? 'light' : 'dark'}
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
          {title}
        </div>

        {/* View-only badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 6px',
          fontSize: 11,
          color: isLightTheme ? '#5c4446' : '#c8c8b0',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>visibility</span>
          Только просмотр
        </div>

        <div style={{ height: 1, background: 'var(--border-color)', margin: '2px 0' }} />

        {/* Back to site */}
        <Link to="/auth" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', borderRadius: 8,
          color: isLightTheme ? '#2b1c1d' : '#fffff0',
          fontSize: 13, textDecoration: 'none',
          transition: 'background .15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>login</span>
          Войти на сайт
        </Link>
      </div>
    </div>
  );
};

export default PublicBoardPage;
