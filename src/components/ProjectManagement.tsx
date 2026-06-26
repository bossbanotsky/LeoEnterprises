import React, { useState } from 'react';
import Billing from './Billing';
import ContainerRepairList from './ContainerRepairList';
import { Briefcase, FileText, Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ProjectManagement() {
  const [activeTab, setActiveTab] = useState<'billing' | 'container' | 'invoices'>('container');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-none flex items-center gap-3">
            <span className="w-2 h-10 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.6)]"></span>
            Project Mgmt
          </h1>
          <p className="text-white text-[10px] font-black uppercase tracking-[0.3em] mt-2 ml-5 italic opacity-80">
            Container Operations & Billing
          </p>
        </div>
      </div>

      <div className="flex space-x-1 sm:space-x-2 border-b border-white/30 pb-2 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('container')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-sm font-bold uppercase tracking-widest rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap min-w-max ${
            activeTab === 'container' ? 'bg-indigo-600 text-white' : 'text-white hover:text-white hover:bg-white/5'
          }`}
        >
          <Wrench className="w-3 h-3 sm:w-4 sm:h-4" /> Container Repair
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-sm font-bold uppercase tracking-widest rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap min-w-max ${
            activeTab === 'invoices' ? 'bg-indigo-600 text-white' : 'text-white hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText className="w-3 h-3 sm:w-4 sm:h-4" /> Invoices
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-sm font-bold uppercase tracking-widest rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap min-w-max ${
            activeTab === 'billing' ? 'bg-indigo-600 text-white' : 'text-white hover:text-white hover:bg-white/5'
          }`}
        >
          <Briefcase className="w-3 h-3 sm:w-4 sm:h-4" /> Billing
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
          {activeTab === 'invoices' && <Billing mode="invoices" />}
          {activeTab === 'billing' && <Billing mode="billing" />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
