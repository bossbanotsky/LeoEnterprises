import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Employees from './components/Employees';
import Attendance from './components/Attendance';
import CashAdvance from './components/CashAdvance';
import Pakyaw from './components/Pakyaw';
import Payroll from './components/Payroll';
import Settings from './components/Settings';
import Logs from './components/Logs';
import EmployeeDashboard from './components/EmployeeDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const { user, userData, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  if (requireAdmin && userData?.role !== 'admin') {
    return <Navigate to="/portal" />;
  }
  
  return <>{children}</>;
};

const IndexRedirect = () => {
  const { userData, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={userData?.role === 'admin' ? "/dashboard" : "/portal"} replace />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<IndexRedirect />} />
              <Route path="dashboard" element={<ProtectedRoute requireAdmin><Dashboard /></ProtectedRoute>} />
              <Route path="portal" element={<EmployeeDashboard />} />
              <Route path="employees" element={<ProtectedRoute requireAdmin><Employees /></ProtectedRoute>} />
              <Route path="attendance" element={<ProtectedRoute requireAdmin><Attendance /></ProtectedRoute>} />
              <Route path="cash-advance" element={<ProtectedRoute requireAdmin><CashAdvance /></ProtectedRoute>} />
              <Route path="pakyaw" element={<ProtectedRoute requireAdmin><Pakyaw /></ProtectedRoute>} />
              <Route path="payroll" element={<ProtectedRoute requireAdmin><Payroll /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute requireAdmin><Settings /></ProtectedRoute>} />
              <Route path="settings/logs" element={<ProtectedRoute requireAdmin><Logs /></ProtectedRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
