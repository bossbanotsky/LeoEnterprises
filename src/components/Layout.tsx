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
      <header className="h-24 bg-transparent backdrop-blur-sm border-b border-white/5 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-[100] gap-4">
        {/* Subtle gradient fade at the very top for extra readability */}
        <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-black/60 to-transparent pointer-events-none -z-10" />
        
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group shrink-0 max-w-full">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900/80 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 overflow-hidden shadow-2xl border border-white/20 group-hover:rotate-3 transition-transform backdrop-blur-md">
              <span className="text-white font-black text-xl sm:text-2xl">L</span>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xl sm:text-3xl font-black tracking-[0.25em] sm:tracking-tighter text-white leading-none drop-shadow-xl group-hover:text-blue-400 transition-all uppercase whitespace-nowrap">
                LEO <span className="text-blue-500 font-black italic underline decoration-blue-500/20 underline-offset-4">ENTERPRISES</span>
              </span>
              <span className="text-[7px] sm:text-[11px] font-black text-white/60 uppercase tracking-[0.4em] sm:tracking-[0.6em] mt-1.5 italic leading-none whitespace-nowrap border-t border-white/10 pt-1">Operational Command System</span>
            </div>
          </Link>
        </div>
        
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button 
            onClick={logout} 
            className="p-3.5 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/40 rounded-2xl transition-all duration-300 shadow-xl group active:scale-90 shrink-0"
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
            className="h-full p-2 sm:p-4 lg:p-8 max-w-7xl mx-auto w-full mb-28"
          >
            <div className="bg-slate-950/30 backdrop-blur-3xl rounded-[40px] p-4 sm:p-10 min-h-[75vh] relative overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <div className="relative z-10 text-left">
                <Outlet />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/30 backdrop-blur-3xl border-t border-white/10 flex flex-row items-center overflow-x-auto overflow-y-hidden z-50 pb-[env(safe-area-inset-bottom)] h-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-[0_-15px_30px_rgba(0,0,0,0.4)] snap-x snap-mandatory px-4 gap-1 scroll-smooth no-scrollbar">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          // Custom color coding per module
          const getModuleColor = (label: string) => {
            switch(label.toLowerCase()) {
              case 'dash': return 'from-indigo-500 to-blue-600';
              case 'chat': return 'from-sky-400 to-blue-500';
              case 'news': return 'from-amber-400 to-orange-600';
              case 'staff': return 'from-emerald-400 to-teal-600';
              case 'attend': return 'from-rose-400 to-red-600';
              case 'pakyaw': return 'from-violet-400 to-purple-600';
              case 'advance': return 'from-cyan-400 to-blue-600';
              case 'payroll': return 'from-lime-400 to-green-600';
              case 'gallery': return 'from-pink-400 to-rose-600';
              case 'gear': return 'from-slate-400 to-slate-600';
              default: return 'from-blue-500 to-indigo-700';
            }
          };

          const getLabelColor = (label: string) => {
             switch(label.toLowerCase()) {
              case 'dash': return 'text-indigo-400';
              case 'chat': return 'text-sky-400';
              case 'news': return 'text-amber-400';
              case 'staff': return 'text-emerald-400';
              case 'attend': return 'text-rose-400';
              case 'pakyaw': return 'text-violet-400';
              case 'advance': return 'text-cyan-400';
              case 'payroll': return 'text-lime-400';
              case 'gallery': return 'text-pink-400';
              case 'gear': return 'text-slate-400';
              default: return 'text-blue-400';
            }
          };

          const moduleColor = getModuleColor(item.label);
          const labelColor = getLabelColor(item.label);

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center justify-center min-w-[64px] flex-1 h-full gap-1 transition-all duration-300 relative group outline-none shrink-0 snap-center touch-manipulation"
            >
              <div className="relative flex items-center justify-center w-[40px] h-[40px]">
                {/* Active Indicator with Color Coding */}
                {isActive && (
                  <motion.div 
                    layoutId="active-nav-bg"
                    className={`absolute inset-0 bg-gradient-to-br ${moduleColor} rounded-2xl shadow-xl z-0 ring-2 ring-white/20`}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                
                {!isActive && (
                  <div className="absolute inset-0 bg-white/5 rounded-2xl opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 z-0" />
                )}

                <Icon 
                  className={`w-[20px] h-[20px] transition-all duration-300 z-10 relative 
                  ${isActive ? 'text-white scale-110' : 'text-white/30 group-hover:text-white'}`} 
                />
              </div>
              <span className={`text-[8px] font-black tracking-widest uppercase transition-all duration-200 ${isActive ? labelColor : 'text-white/20'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
