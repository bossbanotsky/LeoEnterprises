import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutGrid, UsersRound, Receipt, Clock, Settings2, WalletCards, Pickaxe, LogOut, Megaphone, MessageSquare, GalleryHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { Button } from './ui/button';

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
    <div className="min-h-screen flex flex-col bg-transparent text-white overflow-hidden relative">
      {/* Header */}
      <header className="h-24 bg-transparent border-b border-white/5 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-[100] gap-4">
        {/* Optional: Subtle gradient fade at the very top for extra readability if needed, but keeping it transparent as requested */}
        <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-black/40 to-transparent pointer-events-none -z-10" />
        
        <div className="flex items-center gap-4 min-w-0 flex-shrink">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
            <div className="w-12 h-12 bg-slate-900/80 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden shadow-2xl border border-white/20 group-hover:rotate-3 transition-transform backdrop-blur-md">
              <span className="text-white font-black text-2xl">L</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tighter text-white leading-none drop-shadow-md">
                LEO <span className="text-blue-500 font-black italic tracking-normal">ENTERPRISES</span>
              </span>
              <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.3em] mt-1 italic drop-shadow-sm">Industrial Multi-Service</span>
            </div>
          </Link>
        </div>
        
        <div className="flex items-center gap-6 sm:gap-8">
          <div className="flex flex-col items-end hidden md:flex">
            <span className="text-sm font-black text-white uppercase tracking-wider drop-shadow-md">{userData?.fullName || 'User'}</span>
            <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest leading-none mt-1 drop-shadow-sm">{userData?.role || 'Portal'}</span>
          </div>
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-2xl border border-white/30 overflow-hidden transform hover:scale-110 transition-transform ring-4 ring-white/5">
            {userData?.photoURL ? (
              <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              (userData?.fullName?.[0] || user?.email?.[0] || 'A').toUpperCase()
            )}
          </div>
          
          <div className="h-8 w-px bg-white/20 mx-1 hidden sm:block"></div>

          <button 
            onClick={logout} 
            className="p-3 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 rounded-2xl transition-all duration-300 shadow-lg group active:scale-90 ml-2"
            title="Logout"
          >
            <LogOut className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          </button>
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
            className="h-full p-4 lg:p-8 max-w-7xl mx-auto w-full"
          >
            <div className="bg-transparent rounded-3xl p-4 sm:p-6 min-h-[60vh] relative overflow-hidden">
              {/* Subtle inner glow */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
              <Outlet />
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-transparent border-t border-white/10 dark:border-slate-800/10 flex flex-row items-center overflow-x-auto overflow-y-hidden z-50 pb-[env(safe-area-inset-bottom)] h-[calc(4rem+env(safe-area-inset-bottom))] shadow-[0_-10px_15px_rgba(0,0,0,0.05)] snap-x snap-mandatory px-4 gap-1 scroll-smooth no-scrollbar will-change-transform">
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
                  <div className="absolute inset-0 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-0" />
                )}

                <Icon 
                  className={`w-[18px] h-[18px] transition-all duration-300 z-10 relative 
                  ${isActive ? 'text-white' : 'text-white/40 group-hover:text-white'}`} 
                />
              </div>
              <span className={`text-[7px] sm:text-[8px] font-black tracking-tight uppercase transition-all duration-200 ${isActive ? 'text-blue-400' : 'text-white/30'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
