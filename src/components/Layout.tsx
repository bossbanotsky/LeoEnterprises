import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutGrid, UsersRound, Receipt, Clock, Settings2, WalletCards, Pickaxe, LogOut, Megaphone, GalleryHorizontal, Briefcase, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { Button } from './ui/button';

export default function Layout() {
  const { user, userData, logout } = useAuth();
  const location = useLocation();
  const { companyInfo } = useCompanyInfo();

  const adminNavItems = [
    { path: '/admin-dashboard', label: 'Dash', icon: LayoutGrid },
    { path: '/admin-dashboard/announcements', label: 'News', icon: Megaphone },
    { path: '/admin-dashboard/employees', label: 'Staff', icon: UsersRound },
    { path: '/admin-dashboard/attendance', label: 'Attend', icon: Clock },
    { path: '/admin-dashboard/pakyaw', label: 'Pakyaw', icon: Pickaxe },
    { path: '/admin-dashboard/cash-advance', label: 'Advance', icon: WalletCards },
    { path: '/admin-dashboard/payroll', label: 'Payroll', icon: Receipt },
    { path: '/admin-dashboard/finance', label: 'Finance', icon: Wallet },
    { path: '/admin-dashboard/project-management', label: 'Projects', icon: Briefcase },
    { path: '/admin-dashboard/gallery', label: 'Gallery', icon: GalleryHorizontal },
    { path: '/admin-dashboard/settings', label: 'Gear', icon: Settings2 },
  ];

  const employeeNavItems = [
    { path: '/employee-dashboard', label: 'Portal', icon: LayoutGrid },
  ];

  const ceoNavItems = [
    { path: '/ceo-dashboard', label: 'Executive', icon: LayoutGrid },
  ];

  const navItems = userData?.role === 'admin' 
    ? adminNavItems 
    : userData?.role === 'ceo' 
      ? ceoNavItems 
      : employeeNavItems;

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-foreground overflow-hidden relative">
      {/* Quota Warning Banner */}
      <AnimatePresence>
        {useAuth().isQuotaLimited && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-600/10 border-b border-amber-600/20 backdrop-blur-md overflow-hidden relative z-[200]"
          >
            <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest italic animate-pulse">
                Strategic Reserve Triggered: Data Viewing Mode (Cached)
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-20 sm:h-24 bg-slate-900/50 backdrop-blur-md border-b border-amber-600/10 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-[100] gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group shrink-0 max-w-full">
            <div className="w-8 h-8 sm:w-11 sm:h-11 bg-amber-600 rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-md border border-amber-500/20 group-hover:scale-105 transition-transform">
              <span className="text-white font-black text-xs sm:text-base">L&P</span>
            </div>
            <div className="flex flex-col min-w-0 flex-1 justify-center text-left">
              <div className="flex flex-row items-baseline gap-x-1.5 leading-none">
                <span className="text-sm sm:text-lg lg:text-xl font-black text-foreground uppercase tracking-wider">
                  L & P
                </span>
                <span className="text-amber-600 text-[9px] sm:text-sm lg:text-base font-black italic underline decoration-amber-600/20 underline-offset-2 uppercase whitespace-nowrap">
                  TRADING AND SERVICES
                </span>
              </div>
              <span className="text-[6px] sm:text-[9px] font-black text-stone-500 uppercase tracking-wider mt-1 border-t border-stone-205 pt-0.5 whitespace-nowrap leading-none">Operational Command System</span>
            </div>
          </Link>
        </div>
        
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button 
            onClick={logout} 
            className="p-2 sm:p-3 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-transparent rounded-xl transition-all duration-300 shadow-sm active:scale-90"
            title="Logout"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

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
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-[40px] p-4 sm:p-10 min-h-[75vh] relative overflow-hidden border border-amber-600/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-foreground">
              <div className="relative z-10 text-left">
                <Outlet />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/50 backdrop-blur-2xl border-t border-amber-600/10 flex flex-row items-center overflow-x-auto overflow-y-hidden z-50 pb-[env(safe-area-inset-bottom)] h-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-[0_-10px_35px_rgba(0,0,0,0.3)] snap-x snap-mandatory px-4 gap-1 scroll-smooth no-scrollbar">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          // Custom color coding per module
          const getModuleColor = (label: string) => {
            switch(label.toLowerCase()) {
              case 'dash': return 'from-amber-500 to-amber-600';
              case 'chat': return 'from-teal-500 to-teal-600';
              case 'news': return 'from-amber-650 to-amber-700';
              case 'staff': return 'from-emerald-500 to-emerald-600';
              case 'attend': return 'from-rose-500 to-rose-600';
              case 'pakyaw': return 'from-amber-600 to-orange-600';
              case 'advance': return 'from-amber-500 to-amber-700';
              case 'payroll': return 'from-brand-600 to-amber-600';
              case 'finance': return 'from-emerald-600 to-teal-600';
              case 'billing': return 'from-emerald-500 to-teal-600';
              case 'gallery': return 'from-amber-500 to-stone-800';
              case 'gear': return 'from-stone-600 to-stone-800';
              default: return 'from-amber-500 to-amber-605';
            }
          };

          const getLabelColor = (label: string) => {
            switch(label.toLowerCase()) {
              case 'dash': return 'text-amber-500';
              case 'chat': return 'text-teal-500';
              case 'news': return 'text-amber-500';
              case 'staff': return 'text-emerald-500';
              case 'attend': return 'text-rose-500';
              case 'pakyaw': return 'text-orange-500';
              case 'advance': return 'text-amber-500';
              case 'payroll': return 'text-amber-500';
              case 'finance': return 'text-emerald-500';
              case 'billing': return 'text-emerald-500';
              case 'gallery': return 'text-amber-500';
              case 'gear': return 'text-stone-300';
              default: return 'text-amber-500';
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
                    className={`absolute inset-0 bg-gradient-to-br ${moduleColor} rounded-2xl shadow-md z-0`}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                
                {!isActive && (
                  <div className="absolute inset-0 bg-amber-50 rounded-2xl opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 z-0" />
                )}

                <Icon 
                  className={`w-[20px] h-[20px] transition-all duration-300 z-10 relative 
                  ${isActive ? 'text-white scale-110' : 'text-stone-400 group-hover:text-amber-500'}`} 
                />
              </div>
              <span className={`text-[8px] font-black tracking-widest uppercase transition-all duration-200 ${isActive ? labelColor : 'text-stone-400'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
