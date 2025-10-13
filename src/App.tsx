import React, { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import UploadDemo from './components/UploadDemo';
import Features from './components/Features';
import Footer from './components/Footer';
import AuthPage from './components/AuthPage';
import AccountPage from './components/AccountPage';
// @ts-ignore
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Компонент для главной страницы
const HomePage = ({ isLightTheme, onToggleTheme }: { isLightTheme: boolean; onToggleTheme: () => void }) => {
  return (
    <div className={`min-h-screen flex flex-col overflow-x-hidden relative transition-all duration-500 ${
      isLightTheme ? 'light-theme' : ''
    }`} style={{
      fontFamily: 'Georgia, Times New Roman, serif',
      lineHeight: '1.8',
      color: 'var(--text-primary)',
      background: 'var(--bg-primary)'
    }}>
      
      <Header onToggleTheme={onToggleTheme} isLightTheme={isLightTheme} />
      
      <main className="flex-1 px-8 md:px-15 py-30 md:py-40 max-w-7xl mx-auto w-full relative z-10">
        <Hero />
        <HowItWorks />
        <UploadDemo />
        <Features />
      </main>
      
      <Footer />
    </div>
  );
};

function App() {
  const [isLightTheme, setIsLightTheme] = useState(false);

  const toggleTheme = () => {
    setIsLightTheme(!isLightTheme);
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage isLightTheme={isLightTheme} onToggleTheme={toggleTheme} />} />
        <Route path="/auth" element={<AuthPage onToggleTheme={toggleTheme} isLightTheme={isLightTheme} />} />
        <Route path="/account" element={<AccountPage onToggleTheme={toggleTheme} isLightTheme={isLightTheme} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
