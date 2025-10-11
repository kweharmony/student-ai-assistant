import React, { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import UploadDemo from './components/UploadDemo';
import Features from './components/Features';
import Footer from './components/Footer';
import AuthPage from './components/AuthPage';

function App() {
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');

  const toggleTheme = () => {
    setIsLightTheme(!isLightTheme);
  };

  const navigateToAuth = () => {
    setCurrentPage('auth');
  };

  const navigateToHome = () => {
    setCurrentPage('home');
  };

  if (currentPage === 'auth') {
    return <AuthPage onToggleTheme={toggleTheme} isLightTheme={isLightTheme} onNavigateHome={navigateToHome} />;
  }

  return (
    <div className={`min-h-screen flex flex-col overflow-x-hidden relative transition-all duration-500 ${
      isLightTheme ? 'light-theme' : ''
    }`} style={{
      fontFamily: 'Georgia, Times New Roman, serif',
      lineHeight: '1.8',
      color: 'var(--text-primary)',
      background: 'var(--bg-primary)'
    }}>
      
      <Header onToggleTheme={toggleTheme} isLightTheme={isLightTheme} onNavigateToAuth={navigateToAuth} />
      
      <main className="flex-1 px-8 md:px-15 py-30 md:py-40 max-w-7xl mx-auto w-full relative z-10">
        <Hero />
        <HowItWorks />
        <UploadDemo />
        <Features />
      </main>
      
      <Footer />
    </div>
  );
}

export default App;
