import React from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import UploadDemo from './components/UploadDemo';
import Features from './components/Features';
import Footer from './components/Footer';
import AuthPage from './components/AuthPage';
import AccountPage from './components/account/AccountPage';
import PricingPage from './components/PricingPage';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Home page
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

// Auth page wrapper
const AuthPageWrapper = () => {
  const { isLightTheme, toggleTheme } = useTheme();
  return <AuthPage onToggleTheme={toggleTheme} isLightTheme={isLightTheme} />;
};

// Protected route — redirects to /auth if not logged in
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
        fontFamily: 'Georgia, serif',
      }}>
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/auth" replace />;
};

// Account page (protected)
const AccountPageWrapper = () => {
  const { isLightTheme, toggleTheme } = useTheme();
  return (
    <ProtectedRoute>
      <AccountPage onToggleTheme={toggleTheme} isLightTheme={isLightTheme} />
    </ProtectedRoute>
  );
};

// Pricing page
const PricingPageWrapper = () => {
  const { isLightTheme, toggleTheme } = useTheme();
  return <PricingPage onToggleTheme={toggleTheme} isLightTheme={isLightTheme} />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={<AuthPageWrapper />} />
            <Route path="/account" element={<AccountPageWrapper />} />
            <Route path="/pricing" element={<PricingPageWrapper />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
