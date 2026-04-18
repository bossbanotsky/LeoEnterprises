import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, Calculator, Clock, Settings, Wallet, Hammer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { SmartText } from './ui/SmartText';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { companyInfo } = useCompanyInfo();

  const navItems = [
    { path: '/', label: 'Dash', icon: LayoutDashboard },
    { path: '/employees', label: 'Staff', icon: Users },
    { path: '/attendance', label: 'Attend', icon: Clock },
    { path: '/pakyaw', label: 'Pakyaw', icon: Hammer },
    { path: '/cash-advance', label: 'Advance', icon: Wallet },
    { path: '/payroll', label: 'Payroll', icon: Calculator },
    { path: '/settings', label: 'Gear', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text-main overflow-hidden relative">
      {/* Decorative Atmospheric Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full" />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-emerald-600/5 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <header className="h-16 glass backdrop-blur-2xl border-b border-black/5 flex items-center justify-between px-6 sticky top-0 z-50 shadow-sm">
        <div className="font-bold text-lg text-slate-900 tracking-tight flex items-center gap-3 truncate pr-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/10 shrink-0 glossy-base after:absolute after:inset-0 after:bg-white/10 after:rounded-xl">
            <LayoutDashboard className="w-5 h-5 text-white relative z-10" />
          </div>
          <SmartText className="truncate font-black uppercase tracking-widest text-sm opacity-90">{companyInfo.name}</SmartText>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-white border border-black/5 text-slate-900 rounded-full flex items-center justify-center font-bold text-sm shadow-inner glossy-base">
            <SmartText className="relative z-10">{user?.email?.[0].toUpperCase() || 'A'}</SmartText>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto pb-24 relative z-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="h-full p-4 lg:p-8 max-w-6xl mx-auto w-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 max-w-[95%] w-[440px] glass backdrop-blur-3xl border border-black/5 flex items-center justify-around px-2 z-50 py-2 rounded-2xl shadow-xl shadow-black/5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-14 h-12 gap-1 transition-all duration-500 relative group`}
            >
              {isActive && (
                <motion.div 
                  layoutId="nav-glow"
                  className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full"
                />
              )}
              <Icon className={`w-5 h-5 transition-all duration-500 relative z-10 ${isActive ? 'text-blue-600 scale-110' : 'text-slate-400 group-hover:text-slate-600'}`} />
              <span className={`text-[8px] font-black tracking-[0.1em] uppercase relative z-10 transition-all duration-500 ${isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
