import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutGrid, UsersRound, Receipt, Clock, Settings2, WalletCards, Pickaxe, Megaphone, MessageSquare, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { Button } from './ui/button';
import Sidebar from './Sidebar';

export default function Layout() {
  const { user, userData, logout } = useAuth();
  const location = useLocation();
  const { companyInfo } = useCompanyInfo();

  const adminNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { path: '/messenger', label: 'Chat', icon: MessageSquare },
    { path: '/announcements', label: 'News', icon: Megaphone },
    { path: '/employees', label: 'Staff', icon: UsersRound },
    { path: '/attendance', label: 'Attendance', icon: Clock },
    { path: '/pakyaw', label: 'Pakyaw', icon: Pickaxe },
    { path: '/cash-advance', label: 'Advance', icon: WalletCards },
    { path: '/payroll', label: 'Payroll', icon: Receipt },
    { path: '/settings', label: 'Settings', icon: Settings2 },
  ];

  const employeeNavItems = [
    { path: '/portal', label: 'Portal', icon: LayoutGrid },
    { path: '/messenger', label: 'Chat', icon: MessageSquare },
  ];

  const navItems = userData?.role === 'admin' ? adminNavItems : employeeNavItems;

  return (
    <div className="min-h-screen flex bg-background text-foreground relative overflow-hidden">
      <Sidebar navItems={navItems} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ml-[72px] md:ml-[240px]">
        {/* Header */}
        <header className="h-16 bg-white/5 dark:bg-slate-900/5 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6 sticky top-0 z-40">
          <h1 className="font-bold text-lg text-white/90">
            {navItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
          </h1>
          <div className="flex items-center gap-3">
             <Button variant="ghost" onClick={logout} className="flex items-center gap-2 text-red-300 hover:text-red-100 hover:bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-2 text-sm font-bold">
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </Button>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
