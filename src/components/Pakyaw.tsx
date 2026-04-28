import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, query, orderBy, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Employee, PakyawJob } from '../types';
import { Search, Plus, Hammer, Trash2, Edit2, CheckSquare, Square } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { format, parseISO } from 'date-fns';

export default function Pakyaw() {
  const { user } = useAuth();
  const { employees, pakyawJobs: jobs, loading: dataLoading } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkCreateAttendance, setBulkCreateAttendance] = useState(true);
  
  const [viewMode, setViewMode] = useState<'active' | 'archives'>('active');
  
  const [form, setForm] = useState({ 
    description: '', 
    startDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending' as 'pending' | 'completed',
    totalPrice: '',
    employeeIds: [] as string[]
  });

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.description || !form.totalPrice || form.employeeIds.length === 0) return;
    try {
      let pjwId = editingId;
      if (editingId) {
        await updateDoc(doc(db, 'pakyawJobs', editingId), {
          description: form.description,
          startDate: form.startDate,
          status: form.status,
          totalPrice: parseFloat(form.totalPrice),
          employeeIds: form.employeeIds
        });
        setEditingId(null);
      } else {
        const jobRef = await addDoc(collection(db, 'pakyawJobs'), {
          description: form.description,
          startDate: form.startDate,
          status: form.status,
          totalPrice: parseFloat(form.totalPrice),
          employeeIds: form.employeeIds,
          createdAt: new Date().toISOString(),
          uid: user.uid
        });
        pjwId = jobRef.id;

        if (bulkCreateAttendance) {
          for (const empId of form.employeeIds) {
            const attId = `${empId}_${form.startDate}`;
            await setDoc(doc(db, 'attendance', attId), {
              employeeId: empId,
              date: form.startDate,
              status: 'pakyaw',
              pakyawJobId: pjwId,
              regularHours: 0,
              otHours: 0,
              createdAt: new Date().toISOString(),
              userId: user.uid
            }, { merge: true });
          }
        }
      }
      setIsAddOpen(false);
      setForm({ description: '', startDate: format(new Date(), 'yyyy-MM-dd'), status: 'pending', totalPrice: '', employeeIds: [] });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'pakyawJobs');
    }
  };

  const openEdit = (job: PakyawJob) => {
    setEditingId(job.id);
    setForm({
      description: job.description,
      startDate: job.startDate,
      status: job.status,
      totalPrice: job.totalPrice.toString(),
      employeeIds: [...job.employeeIds]
    });
    setIsAddOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'pakyawJobs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'pakyawJobs');
    }
  };

  const toggleEmployeeSelection = (empId: string) => {
    if (form.employeeIds.includes(empId)) {
      setForm(prev => ({ ...prev, employeeIds: prev.employeeIds.filter(id => id !== empId) }));
    } else {
      setForm(prev => ({ ...prev, employeeIds: [...prev.employeeIds, empId] }));
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = viewMode === 'active' ? job.status === 'pending' : job.status === 'completed';
    return matchesSearch && matchesTab;
  });

  return (
    <div className="h-full flex flex-col relative w-full pt-2">
      <div className="mb-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pakyaw Contracts</h1>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <Button 
              variant={viewMode === 'active' ? 'secondary' : 'ghost'} 
              className="h-8 text-[11px] px-3 rounded-lg font-bold"
              onClick={() => setViewMode('active')}
            >Active</Button>
            <Button 
              variant={viewMode === 'archives' ? 'secondary' : 'ghost'} 
              className="h-8 text-[11px] px-3 rounded-lg font-bold"
              onClick={() => setViewMode('archives')}
            >Archives</Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input 
            placeholder="Search container / job name..." 
            className="pl-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl h-12"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-20 w-full pr-1">
        {filteredJobs.map(job => {
          const splitAmount = job.totalPrice / (job.employeeIds.length || 1);
          return (
            <div key={job.id} className="bento-card bg-white dark:bg-slate-800 p-4 flex flex-col gap-3 group relative overflow-hidden">
              {job.status === 'completed' && (
                <div className="absolute top-0 right-0 py-1 px-3 bg-green-500 text-white text-[9px] font-bold uppercase tracking-widest rounded-bl-xl shadow-sm">
                  Completed
                </div>
              )}
              <div className="flex flex-row items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-bold shrink-0">
                  <Hammer className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white truncate">{job.description}</h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {format(parseISO(job.startDate), 'MMM dd, yyyy')} • {job.employeeIds.length} worker{job.employeeIds.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-black text-lg text-slate-900 dark:text-white">
                    ₱{job.totalPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 mt-0.5">
                    ₱{splitAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} each
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800/50">
                <span className="font-semibold text-slate-900 dark:text-slate-300">Workers: </span>
                {job.employeeIds.map(id => {
                  const e = employees.find(emp => emp.id === id);
                  return e ? e.fullName : 'Unknown';
                }).join(', ')}
              </div>

              <div className="flex justify-end gap-3 mt-1">
                {job.status === 'pending' && (
                  <button 
                    onClick={() => {
                      if (!user) return;
                      updateDoc(doc(db, 'pakyawJobs', job.id), { 
                        status: 'completed',
                        completedAt: new Date().toISOString()
                      });
                    }}
                    className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1 font-bold"
                  >
                    <CheckSquare className="w-3 h-3" /> Mark Finished
                  </button>
                )}
                <button 
                  onClick={() => openEdit(job)}
                  className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 font-medium"
                >
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button 
                  onClick={() => handleDelete(job.id)}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium"
                >
                  <Trash2 className="w-3 h-3" /> {job.status === 'pending' ? 'Cancel Job' : 'Delete'}
                </button>
              </div>
            </div>
          );
        })}
        {filteredJobs.length === 0 && (
          <div className="text-center py-10 text-slate-500 dark:text-slate-400">
            {viewMode === 'active' 
              ? 'No pending piece-rate / pakyaw jobs found.' 
              : 'No completed/archived jobs found.'
            }
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) {
          setEditingId(null);
          setForm({ description: '', startDate: format(new Date(), 'yyyy-MM-dd'), status: 'pending', totalPrice: '', employeeIds: [] });
        }
      }}>
        <DialogTrigger render={<button className="absolute bottom-6 right-2 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center transition-transform active:scale-95 z-10" />}>
          <Plus className="w-6 h-6" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-[460px] rounded-3xl p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                <Hammer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              {editingId ? 'Edit Pakyaw Job' : 'New Pakyaw Job'}
            </DialogTitle>
          </div>
          <form onSubmit={handleSaveJob} className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Container / Job Description</Label>
              <Input 
                required 
                value={form.description || ''} 
                onChange={e => setForm({...form, description: e.target.value})} 
                placeholder="e.g. Repair 20ft Container #402"
                className="rounded-xl h-12 bg-slate-50 dark:bg-slate-800 border-none focus:ring-indigo-500" 
              />
            </div>
            
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Start Date</Label>
                  <Input 
                    required 
                    type="date" 
                    value={form.startDate || ''} 
                    onChange={e => setForm({...form, startDate: e.target.value})} 
                    className="rounded-xl h-12 bg-slate-50 dark:bg-slate-800 border-none focus:ring-indigo-500" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</Label>
                  <select
                    value={form.status}
                    onChange={e => setForm({...form, status: e.target.value as 'pending' | 'completed'})}
                    className="flex h-12 w-full rounded-xl border-none bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Price (₱)</Label>
                <Input 
                  required 
                  type="number" 
                  step="0.01" 
                  value={form.totalPrice || ''} 
                  onChange={e => setForm({...form, totalPrice: e.target.value})} 
                  className="rounded-xl h-12 bg-slate-50 dark:bg-slate-800 border-none font-bold text-indigo-600 focus:ring-indigo-500" 
                />
              </div>

              {!editingId && (
                <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                  <input 
                    type="checkbox" 
                    id="bulkCreate"
                    checked={bulkCreateAttendance}
                    onChange={e => setBulkCreateAttendance(e.target.checked)}
                    className="w-5 h-5 accent-indigo-600 cursor-pointer"
                  />
                  <Label htmlFor="bulkCreate" className="text-sm text-indigo-900 dark:text-indigo-200 cursor-pointer font-medium">
                    Automatically mark workers as "Pakyaw" for {form.startDate}
                  </Label>
                </div>
              )}

            <div className="space-y-2 pt-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                <span>Select Workers to Split</span>
                <span className="text-[10px] text-indigo-600 normal-case bg-indigo-50 px-2 py-0.5 rounded-full">
                  Total will divide by {Math.max(1, form.employeeIds.length)}
                </span>
              </Label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-1">
                {employees
                  .filter(e => e.status === 'active' || !e.status)
                  .map(emp => {
                    const isSelected = form.employeeIds.includes(emp.id);
                    return (
                      <div 
                        key={emp.id}
                        onClick={() => toggleEmployeeSelection(emp.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-white border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/50'}`}
                      >
                        <div className={`p-0.5 rounded-md ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`}>
                          {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${isSelected ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-300'}`}>
                            {emp.fullName}
                          </p>
                        </div>
                      </div>
                    );
                })}
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={form.employeeIds.length === 0} className="w-full rounded-xl h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-md shadow-indigo-600/20">
                {editingId ? 'Update Contract' : 'Save & Divide Payment'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
