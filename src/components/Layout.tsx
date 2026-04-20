import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutGrid, UsersRound, Receipt, Clock, Settings2, WalletCards, Pickaxe, LogOut, Megaphone, MessageSquare, GalleryHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { Button } from './ui/button';
import EtherealMeshBackground from './EtherealMeshBackground';

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

  const navItems = userData?.role === 'admin' ? adminNavItems : employeeNavItems;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-hidden relative">
      {/* Ethereal Mesh Background */}
      <EtherealMeshBackground />

      {/* Header */}
      <header className="h-16 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between px-4 sticky top-0 z-10">
        <div className="font-bold text-lg text-blue-700 dark:text-blue-300 tracking-tight flex items-center gap-2 truncate pr-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <LayoutGrid className="w-5 h-5 text-white" />
          </div>
          <span className="truncate">{companyInfo.name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-md overflow-hidden border border-white/20">
            {userData?.photoURL ? (
              <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              userData?.fullName?.[0].toUpperCase() || user?.email?.[0].toUpperCase() || 'A'
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto pb-24 relative z-1 bg-white/5 dark:bg-slate-900/5 backdrop-blur-sm border-x border-white/5 dark:border-slate-800/5">
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
      <nav className="fixed bottom-0 left-0 right-0 bg-white/10 dark:bg-slate-900/10 backdrop-blur-3xl border-t border-white/10 dark:border-slate-800/10 flex flex-row items-center overflow-x-auto overflow-y-hidden z-50 pb-[env(safe-area-inset-bottom)] h-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-[0_-10px_15px_rgba(0,0,0,0.05)] snap-x snap-mandatory px-4 gap-1 scroll-smooth no-scrollbar">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center justify-center min-w-[60px] flex-1 h-full gap-0.5 transition-all duration-500 relative group outline-none shrink-0 snap-center"
            >
              <div className="relative flex items-center justify-center w-[38px] h-[38px] sm:w-10 sm:h-10 mt-1">
                {/* Active 3D Hyper-Realistic Indicator */}
                {isActive && (
                  <motion.div 
                    layoutId="active-icon-bg"
                    className="absolute inset-0 bg-gradient-to-b from-blue-400 via-blue-600 to-indigo-700 rounded-xl shadow-[0_4px_8px_rgba(37,99,235,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] z-0"
                    transition={{ type: "spring", stiffness: 450, damping: 25 }}
                  />
                )}
                
                {/* Hover Glass Base */}
                {!isActive && (
                  <div className="absolute inset-0 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 z-0 border border-white/50" />
                )}

                <Icon 
                  className={`w-[20px] h-[20px] sm:w-[22px] sm:h-[22px] transition-all duration-400 z-10 relative 
                  ${isActive ? 'text-white stroke-[2.5px]' : 'text-slate-400 dark:text-slate-500 stroke-[1.5px] group-hover:text-blue-600'}`} 
                />
              </div>
              <span className={`text-[8px] sm:text-[9px] font-black tracking-tighter uppercase transition-all duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
