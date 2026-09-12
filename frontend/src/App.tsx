import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Trainees from './pages/Trainees';
import Personnel from './pages/Personnel';
import Security from './pages/Security';
import Directory from './pages/Directory';
import Enrollment from './pages/Enrollment';
import Devices from './pages/Devices';
import Users from './pages/Users';
import Configuration from './pages/Configuration';
import Reports from './pages/Reports';

// Placeholders for other pages
const Attendance = () => <div className="p-4 text-white">Attendance Page - Coming Soon</div>;

const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const { user, isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background text-primary"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="trainees" element={<Trainees />} />
        <Route path="personnel" element={<Personnel />} />
        <Route path="security" element={<Security />} />
        <Route path="directory" element={<Directory />} />
        <Route path="enrollment" element={<Enrollment />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="reports" element={<Reports />} />
        <Route path="devices" element={<Devices />} />
        <Route path="users" element={<Users />} />
        <Route path="settings" element={<Configuration />} />
        <Route path="configuration" element={<Configuration />} />
      </Route>
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
