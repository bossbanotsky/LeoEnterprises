import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, LayoutGrid, UsersRound, Receipt, Clock, Settings2, WalletCards, Pickaxe, Megaphone, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar({ navItems }: { navItems: { path: string; label: string; icon: any }[] }) {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();

  return (
    <motion.div
      animate={{ width: isOpen ? 240 : 72 }}
      className="fixed left-0 top-0 h-screen bg-slate-900/40 backdrop-blur-3xl border-r border-white/20 z-50 flex flex-col shadow-2xl transition-all duration-300"
    >
      {/* Logo / Header */}
      <div className="h-16 flex items-center px-4 justify-between border-b border-white/10">
        {isOpen && (
          <span className="font-bold text-lg text-white tracking-tight">
            Banotsky
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="text-white hover:bg-white/20"
        >
          {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </Button>
      </div>

      {/* Nav Items */}
      <div className="flex-1 py-4 flex flex-col gap-1 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group
                ${isActive 
                  ? 'bg-white/20 text-white shadow-lg border border-white/20' 
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'}`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {isOpen && <span className="font-semibold truncate text-slate-50">{item.label}</span>}
              {!isOpen && (
                <div className="absolute left-full ml-2 px-3 py-2 bg-slate-900/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-white/10 backdrop-blur-md">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
