import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutGrid, UsersRound, Receipt, Clock, Settings2, WalletCards, Pickaxe, LogOut, Megaphone, MessageSquare, GalleryHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { Button } from './ui/button';
import BrandBackground from './BrandBackground';

export default function Layout() {
  const { user, userData, logout } = useAuth();
  const location = useLocation();
  const { companyInfo } = useCompanyInfo();

  const adminNavItems = [
    { path: '/admin-dashboard', label: 'Dash', icon: LayoutGrid },
    { path: '/admin-dashboard/messenger', label: 'Chat', icon: MessageSquare },
    { path: '/admin-dashboard/announcements', label: 'News', icon: Megaphone },
    { path: '/admin-dashboard/employees', label: 'Staff', icon: UsersRound },
    { path: '/admin-dashboard/attendance', label: 'Attend', icon: Clock },
    { path: '/admin-dashboard/pakyaw', label: 'Pakyaw', icon: Pickaxe },
    { path: '/admin-dashboard/cash-advance', label: 'Advance', icon: WalletCards },
    { path: '/admin-dashboard/payroll', label: 'Payroll', icon: Receipt },
    { path: '/admin-dashboard/gallery', label: 'Gallery', icon: GalleryHorizontal },
    { path: '/admin-dashboard/settings', label: 'Gear', icon: Settings2 },
  ];

  const employeeNavItems = [
    { path: '/employee-dashboard', label: 'Portal', icon: LayoutGrid },
    { path: '/employee-dashboard/messenger', label: 'Chat', icon: MessageSquare },
  ];

  const ceoNavItems = [
    { path: '/ceo-dashboard', label: 'Executive', icon: LayoutGrid },
    { path: '/ceo-dashboard/messenger', label: 'Chat', icon: MessageSquare },
  ];

  const navItems = userData?.role === 'admin' 
    ? adminNavItems 
    : userData?.role === 'ceo' 
      ? ceoNavItems 
      : employeeNavItems;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white overflow-hidden relative">
      {/* Brand Background */}
      <BrandBackground />

      {/* Header */}
      <header className="h-16 bg-slate-950/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 sticky top-0 z-10 shadow-2xl">
        <div className="font-bold text-lg text-white tracking-tight flex items-center gap-2 truncate pr-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/logo.png" alt="LEO Enterprises" className="w-full h-full object-contain" />
          </div>
          <span className="truncate uppercase text-xs tracking-[0.2em] opacity-80">{companyInfo.name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-md overflow-hidden border border-white/20">
            {userData?.photoURL ? (
              <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
            ) : (
              userData?.fullName?.[0].toUpperCase() || user?.email?.[0].toUpperCase() || 'A'
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="text-slate-400 hover:text-red-400 hover:bg-red-500/10">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Quota Limitation Notice */}
      <AnimatePresence>
        {useAuth().isQuotaLimited && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500 text-white text-[10px] font-bold py-1.5 px-4 text-center overflow-hidden shrink-0 border-b border-amber-600 shadow-inner"
          >
            <div className="flex items-center justify-center gap-2">
              <span role="img" aria-label="alert">⚠️</span>
              DATABASE QUOTA REACHED: Viewing cached data. Some recent changes may be missing.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto pb-24 relative z-1 antialiased">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="h-full p-4 max-w-3xl mx-auto w-full"
          >
            <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/10 p-4 sm:p-6 min-h-[60vh] shadow-2xl relative overflow-hidden">
              {/* Subtle inner glow */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
              <Outlet />
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/10 dark:bg-slate-900/10 backdrop-blur-3xl border-t border-white/10 dark:border-slate-800/10 flex flex-row items-center overflow-x-auto overflow-y-hidden z-50 pb-[env(safe-area-inset-bottom)] h-[calc(4rem+env(safe-area-inset-bottom))] shadow-[0_-10px_15px_rgba(0,0,0,0.05)] snap-x snap-mandatory px-4 gap-1 scroll-smooth no-scrollbar will-change-transform">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center justify-center min-w-[56px] flex-1 h-full gap-0.5 transition-all duration-300 relative group outline-none shrink-0 snap-center touch-manipulation"
            >
              <div className="relative flex items-center justify-center w-[34px] h-[34px] mt-1">
                {/* Active Indicator */}
                {isActive && (
                  <motion.div 
                    layoutId="active-nav-bg"
                    className="absolute inset-0 bg-gradient-to-b from-blue-500 to-indigo-700 rounded-xl shadow-lg z-0"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                
                {isActive ? null : (
                  <div className="absolute inset-0 bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-md rounded-xl opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-0" />
                )}

                <Icon 
                  className={`w-[18px] h-[18px] transition-all duration-300 z-10 relative 
                  ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-600'}`} 
                />
              </div>
              <span className={`text-[7px] sm:text-[8px] font-bold tracking-tight uppercase transition-all duration-200 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
