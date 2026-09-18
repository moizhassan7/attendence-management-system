import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Trainees from './pages/Trainees';
import Personnel from './pages/Personnel';
import Security from './pages/Security';
import Directory from './pages/Directory';
import Enrollment from './pages/Enrollment';
import Attendance from './pages/Attendance';
import Devices from './pages/Devices';
import Users from './pages/Users';
import Configuration from './pages/Configuration';
import Reports from './pages/Reports';
import Backup from './pages/Backup';
import LiveScreen from './pages/LiveScreen';

const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const { user, isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Institutional Website */}
      <Route path="/" element={<Home />} />

      {/* Staff & Officer Login */}
      <Route path="/login" element={<Login />} />
      
      {/* Full-screen Kiosk Route */}
      <Route 
        path="/live-screen" 
        element={
          <ProtectedRoute>
            <LiveScreen />
          </ProtectedRoute>
        } 
      />

      {/* Main Authenticated Layout & Portal */}
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/portal" element={<Navigate to="/dashboard" replace />} />
        <Route path="/trainees" element={<Trainees />} />
        <Route path="/personnel" element={<Personnel />} />
        <Route path="/security" element={<Security />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/enrollment" element={<Enrollment />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/users" element={<Users />} />
        <Route path="/settings" element={<Configuration />} />
        <Route path="/configuration" element={<Configuration />} />
        <Route path="/backup" element={<ProtectedRoute requireAdmin><Backup /></ProtectedRoute>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrandingProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </BrandingProvider>
    </ThemeProvider>
  );
};

export default App;
