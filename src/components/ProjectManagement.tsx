import React, { useState } from 'react';
import Billing from './Billing';
import ContainerRepairList from './ContainerRepairList';
import { Briefcase, FileText, Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ProjectManagement() {
  const [activeTab, setActiveTab] = useState<'billing' | 'container'>('container');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-none flex items-center gap-3">
            <span className="w-2 h-10 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.6)]"></span>
            Project Mgmt
          </h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 ml-5 italic opacity-80">
            Container Operations & Billing
          </p>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('container')}
          className={`px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-t-lg transition-colors flex items-center gap-2 ${
            activeTab === 'container' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Wrench className="w-4 h-4" /> Container Repair
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={`px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-t-lg transition-colors flex items-center gap-2 ${
            activeTab === 'billing' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText className="w-4 h-4" /> Billing
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'container' && <ContainerRepairList />}
          {activeTab === 'billing' && <Billing />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
