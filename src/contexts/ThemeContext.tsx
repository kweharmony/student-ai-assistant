import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ThemeContextType {
  isLightTheme: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isLightTheme, setIsLightTheme] = useState<boolean>(() => {
    const saved = localStorage.getItem('isLightTheme');
    return saved ? JSON.parse(saved) : false; // По умолчанию тёмная тема
  });

  useEffect(() => {
    localStorage.setItem('isLightTheme', JSON.stringify(isLightTheme));
  }, [isLightTheme]);

  const toggleTheme = () => {
    setIsLightTheme(!isLightTheme);
  };

  return (
    <ThemeContext.Provider value={{ isLightTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

