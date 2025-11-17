import React from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import UploadDemo from './components/UploadDemo';
import Features from './components/Features';
import Footer from './components/Footer';
import AuthPage from './components/AuthPage';
import AccountPage from './components/AccountPage';
import PricingPage from './components/PricingPage';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
// @ts-ignore
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Компонент для главной страницы
const HomePage = () => {
  const { isLightTheme, toggleTheme } = useTheme();
  
  return (
    <div className={`min-h-screen flex flex-col overflow-x-hidden relative transition-all duration-500 ${
      isLightTheme ? 'light-theme' : ''
    }`} style={{
      fontFamily: 'Georgia, Times New Roman, serif',
      lineHeight: '1.8',
      color: 'var(--text-primary)',
      background: 'var(--bg-primary)'
    }}>
      
      <Header onToggleTheme={toggleTheme} isLightTheme={isLightTheme} />

      <main className="flex-1 px-4 sm:px-8 md:px-15 py-10 sm:py-20 md:py-30 max-w-7xl mx-auto w-full relative z-10">
        <Hero />
        <HowItWorks />
        <UploadDemo />
        <Features />
      </main>
      
      <Footer />
    </div>
  );
};

// Компоненты страниц с использованием контекста
const AuthPageWrapper = () => {
  const { isLightTheme, toggleTheme } = useTheme();
  return <AuthPage onToggleTheme={toggleTheme} isLightTheme={isLightTheme} />;
};

const AccountPageWrapper = () => {
  const { isLightTheme, toggleTheme } = useTheme();
  return <AccountPage onToggleTheme={toggleTheme} isLightTheme={isLightTheme} />;
};

const PricingPageWrapper = () => {
  const { isLightTheme, toggleTheme } = useTheme();
  return <PricingPage onToggleTheme={toggleTheme} isLightTheme={isLightTheme} />;
};

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPageWrapper />} />
          <Route path="/account" element={<AccountPageWrapper />} />
          <Route path="/pricing" element={<PricingPageWrapper />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
