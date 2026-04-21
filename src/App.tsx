import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './components/Dashboard';
import Employees from './components/Employees';
import Attendance from './components/Attendance';
import CashAdvance from './components/CashAdvance';
import Pakyaw from './components/Pakyaw';
import Payroll from './components/Payroll';
import GalleryManagement from './components/GalleryManagement';
import Settings from './components/Settings';
import Logs from './components/Logs';
import Announcements from './components/Announcements';
import Messenger from './components/Messenger';
import EmployeeDashboard from './components/EmployeeDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const { user, userData, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bold text-slate-400 uppercase tracking-widest animate-pulse">Establishing Session...</div>;
  if (!user) return <Navigate to="/" />;
  
  if (requireAdmin && userData?.role !== 'admin') {
    return <Navigate to="/employee-dashboard" replace />;
  }
  
  // If at employee dashboard but is an admin, redirect to admin side
  if (!requireAdmin && userData?.role === 'admin' && location.pathname.startsWith('/employee-dashboard')) {
    return <Navigate to="/admin-dashboard" replace />;
  }
  
  return <>{children}</>;
};

const AuthRedirect = () => {
  const { user, userData, loading } = useAuth();
  if (loading) return null;
  if (user && userData) {
    return <Navigate to={userData.role === 'admin' ? "/admin-dashboard" : "/employee-dashboard"} replace />;
  }
  return <LandingPage />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AuthRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin-dashboard" element={<ProtectedRoute requireAdmin><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="messenger" element={<Messenger />} />
              <Route path="employees" element={<Employees />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="cash-advance" element={<CashAdvance />} />
              <Route path="pakyaw" element={<Pakyaw />} />
              <Route path="payroll" element={<Payroll />} />
              <Route path="gallery" element={<GalleryManagement />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="settings" element={<Settings />} />
              <Route path="settings/logs" element={<Logs />} />
            </Route>

            {/* Employee Routes */}
            <Route path="/employee-dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<EmployeeDashboard />} />
              <Route path="messenger" element={<Messenger />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
