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
import CEODashboard from './components/CEODashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: ('admin' | 'employee' | 'ceo')[] }) => {
  const { user, userData, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bold text-slate-400 uppercase tracking-widest animate-pulse">Establishing Session...</div>;
  if (!user || !userData) return <Navigate to="/" />;
  
  if (allowedRoles && !allowedRoles.includes(userData.role as any)) {
    if (userData.role === 'admin') return <Navigate to="/admin-dashboard" replace />;
    if (userData.role === 'ceo') return <Navigate to="/ceo-dashboard" replace />;
    return <Navigate to="/employee-dashboard" replace />;
  }
  
  // Strict prevention of mismatch if somehow role matches but path doesn't align visually 
  // (though allowedRoles handles this for standard routes)
  
  return <>{children}</>;
};

const AuthRedirect = () => {
  const { user, userData, loading } = useAuth();
  if (loading) return null;
  if (user && !userData) {
    // If they are logged in via Firebase Auth, but their email isn't in the 'employees' database yet
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">Account Pending</h2>
          <p className="text-slate-500 mb-6 text-sm">
            Your email ({user.email}) has been verified, but it hasn't been linked to an employee or CEO profile yet. Please ask your system administrator to add this exact email to the Staff Dashboard.
          </p>
          <button onClick={() => import('./firebase').then(m => m.logout())} className="w-full bg-slate-900 text-white rounded-xl py-3 font-bold hover:bg-slate-800">
            Sign Out & Try Again
          </button>
        </div>
      </div>
    );
  }
  if (user && userData) {
    if (userData.role === 'admin') return <Navigate to="/admin-dashboard" replace />;
    if (userData.role === 'ceo') return <Navigate to="/ceo-dashboard" replace />;
    return <Navigate to="/employee-dashboard" replace />;
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
            <Route path="/admin-dashboard" element={<ProtectedRoute allowedRoles={['admin']}><Layout /></ProtectedRoute>}>
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

            {/* CEO Routes */}
            <Route path="/ceo-dashboard" element={<ProtectedRoute allowedRoles={['ceo']}><Layout /></ProtectedRoute>}>
              <Route index element={<CEODashboard />} />
              <Route path="messenger" element={<Messenger />} />
            </Route>

            {/* Employee Routes */}
            <Route path="/employee-dashboard" element={<ProtectedRoute allowedRoles={['employee']}><Layout /></ProtectedRoute>}>
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
