import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
  full_name: string | null;
  avatar_url: string | null;
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
  full_name?: string;
  group_name?: string;
  course?: number;
  faculty?: string;
  department?: string;
  position?: string;
  academic_degree?: string;
}

export interface LoginData {
  login: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<string>;
  logout: () => void;
  updateUser: (user: User) => void;
}

// ==================== Context ====================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'mindesync_token';

// ==================== Provider ====================

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem(TOKEN_KEY));

  const saveToken = (t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  };

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // Fetch current user by token on mount / token change
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

  useEffect(() => {
    if (token) {
      fetchMe(token);
    } else {
      setIsLoading(false);
    }
  }, [token, fetchMe]);

  // ---- Actions ----

  const login = async (data: LoginData) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
      throw new Error(err.detail || 'Ошибка входа');
    }

    const { access_token } = await res.json();
    saveToken(access_token);
    await fetchMe(access_token);
  };

  const register = async (data: RegisterData): Promise<string> => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
      throw new Error(err.detail || 'Ошибка регистрации');
    }

    const { access_token, generated_login } = await res.json();
    saveToken(access_token);
    await fetchMe(access_token);
    return generated_login;
  };

  const logout = () => {
    clearAuth();
  };

  const updateUser = (u: User) => setUser(u);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
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
