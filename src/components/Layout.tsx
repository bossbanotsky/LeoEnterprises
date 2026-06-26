import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutGrid, UsersRound, Receipt, Clock, Settings2, WalletCards, Pickaxe, LogOut, Megaphone, GalleryHorizontal, Briefcase, Wallet, ChevronDown, ChevronRight, Menu, X, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { Button } from './ui/button';

export default function Layout() {
  const { user, userData, logout } = useAuth();
  const location = useLocation();
  const { companyInfo } = useCompanyInfo();
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Human Resources': false,
    'Operations': false,
  });

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const adminGroups = [
    {
      label: 'Main',
      isIndependent: true,
      items: [
        { path: '/admin-dashboard', label: 'Dashboard', icon: LayoutGrid, color: 'text-amber-500' },
        { path: '/admin-dashboard/announcements', label: 'Announcements', icon: Megaphone, color: 'text-amber-600' },
      ]
    },
    {
      label: 'Human Resources',
      icon: UsersRound,
      color: 'text-rose-500',
      items: [
        { path: '/admin-dashboard/employees', label: 'Employees', icon: UsersRound, color: 'text-emerald-500' },
        { path: '/admin-dashboard/attendance', label: 'Attendance', icon: Clock, color: 'text-rose-500' },
        { path: '/admin-dashboard/cash-advance', label: 'Cash Advance', icon: WalletCards, color: 'text-amber-500' },
        { path: '/admin-dashboard/payroll', label: 'Payroll', icon: Receipt, color: 'text-white' },
      ]
    },
    {
      label: 'Operations',
      icon: Briefcase,
      color: 'text-blue-500',
      items: [
        { path: '/admin-dashboard/pakyaw', label: 'Pakyaw', icon: Pickaxe, color: 'text-orange-500' },
        { path: '/admin-dashboard/project-management', label: 'Projects', icon: Briefcase, color: 'text-blue-500' },
      ]
    },
    {
      label: 'Corporate',
      isIndependent: true,
      items: [
        { path: '/admin-dashboard/finance', label: 'Finance', icon: Wallet, color: 'text-emerald-500' },
        { path: '/admin-dashboard/gallery', label: 'Gallery', icon: GalleryHorizontal, color: 'text-white' },
      ]
    },
    {
      label: 'System',
      isIndependent: true,
      items: [
        { path: '/admin-dashboard/settings', label: 'Settings', icon: Settings2, color: 'text-stone-400' },
      ]
    }
  ];

  const employeeGroups = [
    {
      label: 'Main',
      isIndependent: true,
      items: [
        { path: '/employee-dashboard', label: 'Portal', icon: LayoutGrid, color: 'text-amber-500' },
      ]
    }
  ];

  const ceoGroups = [
    {
      label: 'Main',
      isIndependent: true,
      items: [
        { path: '/ceo-dashboard', label: 'Executive', icon: LayoutGrid, color: 'text-amber-500' },
      ]
    }
  ];

  const navGroups = userData?.role === 'admin' 
    ? adminGroups 
    : userData?.role === 'ceo' 
      ? ceoGroups 
      : employeeGroups;

  // Auto-expand group if active route is inside it
  useState(() => {
    navGroups.forEach(group => {
      if (group.items.some(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'))) {
        setExpandedGroups(prev => ({ ...prev, [group.label]: true }));
      }
    });
  });

  return (
    <div className="min-h-screen flex bg-transparent text-white overflow-hidden relative w-full">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={`fixed lg:static top-0 bottom-0 left-0 z-[200] bg-black/95 border-r border-white/20 transition-all duration-300 flex flex-col
          ${mobileSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
          ${sidebarOpen ? 'lg:w-64' : 'lg:w-20'}
        `}
      >
        <div className="h-20 sm:h-24 flex items-center justify-between px-4 border-b border-white/20 shrink-0">
          <Link to="/" className={`flex items-center gap-3 group shrink-0 overflow-hidden ${sidebarOpen ? 'w-full' : 'w-auto mx-auto'}`} onClick={() => setMobileSidebarOpen(false)}>
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-md border border-white/40 group-hover:scale-105 transition-transform p-0.5">
              <img src="/src/assets/images/lp_logo_final_1781661072015.jpg" alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            {sidebarOpen && (
              <div className="flex flex-col min-w-0 flex-1 justify-center text-left whitespace-nowrap">
                <span className="text-lg font-black text-white uppercase tracking-wider leading-none">L & P</span>
                <span className="text-[10px] font-black italic text-white/70 uppercase">Trading & Services</span>
              </div>
            )}
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 no-scrollbar">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!group.isIndependent && sidebarOpen && (
                group.icon ? (
                  <button 
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <group.icon className="w-3.5 h-3.5" />
                      <span>{group.label}</span>
                    </div>
                    {expandedGroups[group.label] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                ) : (
                  <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/50">
                    {group.label}
                  </div>
                )
              )}
              
              {(group.isIndependent || !sidebarOpen || !group.icon || expandedGroups[group.label]) && (
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.path || (item.path !== '/admin-dashboard' && location.pathname.startsWith(item.path + '/'));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                          ${isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/70 hover:text-white'}
                          ${!sidebarOpen ? 'justify-center' : ''}
                        `}
                        title={!sidebarOpen ? item.label : undefined}
                      >
                        {isActive && (
                          <motion.div 
                            layoutId="active-nav-indicator"
                            className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-white rounded-r-full"
                          />
                        )}
                        <Icon className={`w-5 h-5 shrink-0 ${isActive ? item.color : 'text-white/50 group-hover:text-white'}`} />
                        {sidebarOpen && (
                          <span className="font-bold text-sm tracking-wide truncate">{item.label}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/20 shrink-0">
          <button 
            onClick={logout} 
            className={`flex items-center gap-3 w-full p-2.5 bg-red-900/20 hover:bg-red-900/40 text-red-500 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-all duration-300
              ${!sidebarOpen ? 'justify-center' : ''}
            `}
            title="Logout"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span className="font-bold text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Quota Warning Banner */}
        <AnimatePresence>
          {useAuth().isQuotaLimited && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-amber-600/10 border-b border-amber-600/20 backdrop-blur-md overflow-hidden shrink-0 z-[100]"
            >
              <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest italic animate-pulse">
                  Strategic Reserve Triggered: Data Viewing Mode (Cached)
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="h-20 sm:h-24 bg-black/50 backdrop-blur-sm border-b border-white/10 flex items-center justify-between px-4 sm:px-8 shrink-0 z-50">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 -ml-2 text-white hover:bg-white/10 rounded-lg lg:hidden transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex p-2 -ml-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Operational Command System</span>
              <span className="text-sm sm:text-lg font-black text-white uppercase tracking-wider">{userData?.role === 'admin' ? 'Administrator' : userData?.role === 'ceo' ? 'Executive' : 'Employee'} Portal</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-bold text-white">{userData?.email}</span>
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{userData?.role}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center border-2 border-black shadow-lg">
              <span className="font-black text-white">{userData?.email?.charAt(0).toUpperCase() || 'U'}</span>
            </div>
          </div>
        </header>

        {/* Main Scrollable Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto relative z-1 antialiased p-2 sm:p-4 lg:p-8">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="max-w-7xl mx-auto w-full h-full pb-12"
            >
              <div className="bg-black/80 rounded-[30px] sm:rounded-[40px] p-4 sm:p-6 lg:p-10 min-h-[80vh] relative overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-white">
                <div className="relative z-10">
                  <Outlet />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

