import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, Calculator, Clock, Settings, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCompanyInfo } from '../hooks/useCompanyInfo';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { companyInfo } = useCompanyInfo();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/employees', label: 'Employees', icon: Users },
    { path: '/attendance', label: 'Attendance', icon: Clock },
    { path: '/cash-advance', label: 'Advances', icon: Wallet },
    { path: '/payroll', label: 'Payroll', icon: Calculator },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-hidden relative">
      {/* Decorative Sea Waves */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-40 dark:opacity-20">
        <svg className="absolute top-0 left-0 w-full h-64 -translate-y-1/2 fill-blue-400/20" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,144C672,139,768,181,864,181.3C960,181,1056,139,1152,122.7C1248,107,1344,117,1392,122.7L1440,128L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path>
        </svg>
        <svg className="absolute bottom-0 left-0 w-full h-96 translate-y-1/3 fill-blue-500/10" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,250.7C960,235,1056,181,1152,149.3C1248,117,1344,107,1392,101.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>

      {/* Header */}
      <header className="h-16 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between px-4 sticky top-0 z-10">
        <div className="font-bold text-lg text-blue-700 dark:text-blue-300 tracking-tight flex items-center gap-2 truncate pr-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <span className="truncate">{companyInfo.name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-md">
            {user?.email?.[0].toUpperCase() || 'A'}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto pb-24 relative z-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="h-full p-4 max-w-3xl mx-auto w-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg border-t border-blue-100 dark:border-blue-900/30 flex items-center justify-around px-2 z-20 pb-[env(safe-area-inset-bottom)] h-[calc(4.5rem+env(safe-area-inset-bottom))]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-all duration-300 relative ${
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-blue-500'
              }`}
            >
              {isActive && (
                <motion.div 
                  layoutId="nav-active"
                  className="absolute inset-x-0 -top-[1px] h-1 bg-blue-600 dark:bg-blue-400 rounded-full mx-4"
                />
              )}
              <Icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'scale-110 stroke-[2.5px]' : 'stroke-2'}`} />
              <span className={`text-[10px] font-bold tracking-wide uppercase ${isActive ? 'opacity-100' : 'opacity-70'}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
