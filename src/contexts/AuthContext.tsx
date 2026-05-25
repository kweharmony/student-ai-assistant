import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// ==================== Types ====================

export interface StudentProfile {
  group_name: string | null;
  course: number | null;
  faculty: string | null;
}

export interface TeacherProfile {
  department: string | null;
  position: string | null;
  academic_degree: string | null;
}

export interface User {
  id: string;
  login: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  is_group_head: boolean;
  can_choose_role: boolean;
  stream_id: string | null;
  stream: { id: string; name: string } | null;
  full_name: string | null;
  avatar_url: string | null;
  avatar_emoji: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  student_profile: StudentProfile | null;
  teacher_profile: TeacherProfile | null;
}

export interface RegisterData {
  email: string;
  password: string;
  role: 'student' | 'teacher';
  stream_id?: string;
  full_name?: string;
  group_name?: string;
  course?: number;
  faculty?: string;
  department?: string;
  position?: string;
  academic_degree?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<string>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

// ==================== Context ====================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// ==================== Provider ====================

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Токен хранится только в памяти (не в localStorage) — защита от XSS.
  // После перезагрузки страницы сессия восстанавливается через httpOnly cookie
  // вызовом GET /api/auth/refresh.
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // всегда true пока не проверили cookie

  const clearAuth = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const fetchMe = useCallback(async (t: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) {
        clearAuth();
        return;
      }
      const data: User = await res.json();
      setUser(data);
    } catch {
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  }, [clearAuth]);

  // При монтировании пробуем восстановить сессию через httpOnly cookie.
  // Если cookie валиден — получаем свежий токен и помещаем его в state.
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          credentials: 'include', // отправляет httpOnly cookie автоматически
        });
        if (!res.ok) {
          setIsLoading(false);
          return;
        }
        const { access_token } = await res.json();
        setToken(access_token);
        await fetchMe(access_token);
      } catch {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Actions ----

  const login = useCallback(async (data: LoginData) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // получаем httpOnly cookie
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
      if (err.detail && typeof err.detail === 'object' && !Array.isArray(err.detail) && err.detail.message) {
        const e = new Error(err.detail.message) as any;
        e.blockInfo = err.detail;
        throw e;
      }
      throw new Error(err.detail || 'Ошибка входа');
    }

    const { access_token } = await res.json();
    setToken(access_token);
    await fetchMe(access_token);
  }, [fetchMe]);

  const register = useCallback(async (data: RegisterData): Promise<string> => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // получаем httpOnly cookie
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
      throw new Error(err.detail || 'Ошибка регистрации');
    }

    const { access_token, generated_login } = await res.json();
    setToken(access_token);
    await fetchMe(access_token);
    return generated_login;
  }, [fetchMe]);

  const logout = useCallback(async () => {
    // Сначала немедленно очищаем стейт, чтобы navigate('/') не вызывал
    // setState на размонтированном компоненте
    const currentToken = token;
    clearAuth();
    // Затем в фоне отзываем токен на сервере (некритично при ошибке)
    fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
    }).catch(() => undefined);
  }, [clearAuth, token]);

  const updateUser = useCallback((u: User) => setUser(u), []);

  // useMemo предотвращает пересоздание объекта value при каждом рендере провайдера,
  // что устраняет каскадные ре-рендеры TipTap-редактора и других подписчиков.
  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    updateUser,
  }), [user, token, isLoading, login, register, logout, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ==================== Hook ====================

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
