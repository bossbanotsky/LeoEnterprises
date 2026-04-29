import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, query, orderBy, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Employee, PakyawJob } from '../types';
import { Search, Plus, Hammer, Trash2, Edit2, CheckSquare, Square, ChevronRight, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';

export default function Pakyaw() {
  const { user } = useAuth();
  const { employees, pakyawJobs: jobs, loading: dataLoading } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkCreateAttendance, setBulkCreateAttendance] = useState(true);
  
  const [viewMode, setViewMode] = useState<'active' | 'archives'>('active');
  
  const [payrollStartDate, setPayrollStartDate] = useState(() => localStorage.getItem('payrollStartDate') || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [payrollEndDate, setPayrollEndDate] = useState(() => localStorage.getItem('payrollEndDate') || format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem('payrollStartDate', payrollStartDate);
    localStorage.setItem('payrollEndDate', payrollEndDate);
    window.dispatchEvent(new Event('payrollDateChange'));
  }, [payrollStartDate, payrollEndDate]);

  useEffect(() => {
    const handleStorage = () => {
      const savedStart = localStorage.getItem("payrollStartDate");
      const savedEnd = localStorage.getItem("payrollEndDate");
      if (savedStart && savedStart !== payrollStartDate) setPayrollStartDate(savedStart);
      if (savedEnd && savedEnd !== payrollEndDate) setPayrollEndDate(savedEnd);
    };
    window.addEventListener("payrollDateChange", handleStorage);
    return () => {
      window.removeEventListener("payrollDateChange", handleStorage);
    };
  }, [payrollStartDate, payrollEndDate]);

  const toggleEmployee = (empId: string) => {
    const newSet = new Set(expandedEmployees);
    if (newSet.has(empId)) newSet.delete(empId);
    else newSet.add(empId);
    setExpandedEmployees(newSet);
  };
  
  const [form, setForm] = useState({ 
    containerNumber: '',
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
      
      if (!editingId) {
        // Prevent duplicate jobs
        const isDuplicate = jobs.some(j => 
          j.status === 'pending' &&
          (j.containerNumber || '').toLowerCase().trim() === (form.containerNumber || '').toLowerCase().trim() &&
          j.description.toLowerCase().trim() === form.description.toLowerCase().trim() &&
          j.employeeIds.some(id => form.employeeIds.includes(id))
        );
        
        if (isDuplicate) {
          alert("Duplicate Job Detected: One or more selected workers are already assigned to a pending job with this EXACT Container Number and Description. Please review to avoid duplicates.");
          return;
        }
      }

      if (editingId) {
        await updateDoc(doc(db, 'pakyawJobs', editingId), {
          containerNumber: form.containerNumber,
          description: form.description,
          startDate: form.startDate,
          status: form.status,
          totalPrice: parseFloat(form.totalPrice),
          employeeIds: form.employeeIds
        });
        setEditingId(null);
      } else {
        const jobRef = await addDoc(collection(db, 'pakyawJobs'), {
          containerNumber: form.containerNumber,
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
      setForm({ containerNumber: '', description: '', startDate: format(new Date(), 'yyyy-MM-dd'), status: 'pending', totalPrice: '', employeeIds: [] });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'pakyawJobs');
    }
  };

  const openEdit = (job: PakyawJob) => {
    setEditingId(job.id);
    setForm({
      containerNumber: job.containerNumber || '',
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
    const matchesSearch = job.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (job.containerNumber && job.containerNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTab = viewMode === 'active' ? job.status === 'pending' : job.status === 'completed';
    const matchesDate = job.startDate >= payrollStartDate && job.startDate <= payrollEndDate;
    return matchesSearch && matchesTab && matchesDate;
  });

  const jobsByEmployee = new Map<string, PakyawJob[]>();
  filteredJobs.forEach(job => {
    // Use a Set to ensure we only count the job once per unique employee ID
    const uniqueEmpIds = new Set(job.employeeIds);
    uniqueEmpIds.forEach(empId => {
      const empsJobs = jobsByEmployee.get(empId) || [];
      empsJobs.push(job);
      jobsByEmployee.set(empId, empsJobs);
    });
  });

  const groupedEmployees = Array.from(jobsByEmployee.entries()).map(([empId, empJobs]) => ({
    employee: employees.find(e => e.id === empId),
    jobs: Array.from(new Set(empJobs.map(j => j.id))).map(id => empJobs.find(j => j.id === id)!),
  })).filter(g => g.employee).sort((a, b) => (a.employee?.fullName || '').localeCompare(b.employee?.fullName || ''));

  return (
    <div className="h-full flex flex-col relative w-full pt-2">
      <div className="mb-4 shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pakyaw Contracts</h1>
          <div className="flex gap-2 items-center text-sm font-semibold">
            <Input
              type="date"
              value={payrollStartDate}
              onChange={(e) => setPayrollStartDate(e.target.value)}
              className="h-9 w-[130px] rounded-lg bg-white dark:bg-slate-800"
            />
             <span className="text-slate-400">to</span>
            <Input
              type="date"
              value={payrollEndDate}
              onChange={(e) => setPayrollEndDate(e.target.value)}
              className="h-9 w-[130px] rounded-lg bg-white dark:bg-slate-800"
            />
          </div>
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
        {groupedEmployees.map(({ employee, jobs }) => (
          <div key={employee.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <button 
              onClick={() => toggleEmployee(employee.id)}
              className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                  {employee.fullName.charAt(0)}
                </div>
                <div className="text-left flex flex-col">
                  <span className="font-bold text-slate-900 dark:text-white text-base">{employee.fullName}</span>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold pt-0.5">
                    {jobs.length} {viewMode === 'active' ? 'active' : 'archived'} contract{jobs.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="text-slate-400">
                {expandedEmployees.has(employee.id) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </div>
            </button>
            
            {expandedEmployees.has(employee.id) && (
              <div className="p-3 bg-white dark:bg-slate-900 grid grid-cols-1 gap-3">
                {jobs.map(job => {
                  const splitAmount = job.totalPrice / Math.max(1, job.employeeIds.length);
                  return (
                    <div key={job.id} className="border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden group">
                      {job.status === 'completed' && (
                        <div className="absolute top-0 right-0 py-1 px-3 bg-green-500 text-white text-[9px] font-bold uppercase tracking-widest rounded-bl-xl shadow-sm">
                          Completed
                        </div>
                      )}
                      <div className="flex flex-row items-start gap-4">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          <Hammer className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight break-words pr-2">
                            {job.containerNumber ? <span className="text-indigo-600 dark:text-indigo-400 mr-1.5">[{job.containerNumber}]</span> : null}
                            {job.description}
                          </h3>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                            <span>{format(parseISO(job.startDate), 'MMM dd, yyyy')}</span>
                            <span>•</span>
                            <span>{job.employeeIds.length} worker{job.employeeIds.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="mt-2.5 flex items-center gap-4">
                             <div>
                               <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-0.5">Total Pay</div>
                               <div className="font-bold text-slate-900 dark:text-white text-sm">₱{job.totalPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                             </div>
                             <div>
                               <div className="text-[10px] text-indigo-500 dark:text-indigo-400 uppercase font-bold tracking-wider mb-0.5">Their Share</div>
                               <div className="font-bold text-indigo-700 dark:text-indigo-400 text-sm">₱{splitAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                             </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 mt-1 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 w-full items-center">
                        {job.status === 'pending' && (
                          <button 
                            onClick={() => {
                              if (!user) return;
                              updateDoc(doc(db, 'pakyawJobs', job.id), { 
                                status: 'completed',
                                completedAt: new Date().toISOString()
                              });
                            }}
                            className="text-xs text-green-600 dark:text-green-500 hover:text-green-800 flex items-center gap-1 font-bold"
                          >
                            <CheckSquare className="w-3.5 h-3.5" /> Mark Finished
                          </button>
                        )}
                        <button 
                          onClick={() => openEdit(job)}
                          className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 font-medium ml-auto"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(job.id)}
                          className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 flex items-center gap-1 font-medium"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {job.status === 'pending' ? 'Cancel' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        
        {groupedEmployees.length === 0 && (
          <div className="text-center py-10 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-slate-200 border-dashed dark:border-slate-800">
            <Hammer className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="font-medium text-slate-600 dark:text-slate-300">{viewMode === 'active' 
              ? 'No pending Pakyaw jobs for this date range.' 
              : 'No archived Pakyaw jobs for this date range.'}</p>
            <p className="text-xs mt-1">Try adjusting the dates or search query.</p>
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) {
          setEditingId(null);
          setForm({ containerNumber: '', description: '', startDate: format(new Date(), 'yyyy-MM-dd'), status: 'pending', totalPrice: '', employeeIds: [] });
        }
      }}>
        <DialogTrigger render={<button className="absolute bottom-6 right-2 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center transition-transform active:scale-95 z-10" />}>
          <Plus className="w-6 h-6" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-[460px] max-h-[85vh] flex flex-col rounded-3xl p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                <Hammer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              {editingId ? 'Edit Pakyaw Job' : 'New Pakyaw Job'}
            </DialogTitle>
          </div>
          <form onSubmit={handleSaveJob} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Container Number</Label>
                <Input 
                  value={form.containerNumber || ''} 
                  onChange={e => setForm({...form, containerNumber: e.target.value})} 
                  placeholder="e.g. #402"
                  className="rounded-xl h-12 bg-slate-50 dark:bg-slate-800 border-none focus:ring-indigo-500" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Job Description</Label>
                <Input 
                  required 
                  value={form.description || ''} 
                  onChange={e => setForm({...form, description: e.target.value})} 
                  placeholder="e.g. Grinding"
                  className="rounded-xl h-12 bg-slate-50 dark:bg-slate-800 border-none focus:ring-indigo-500" 
                />
              </div>
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
              <div className="space-y-1.5 p-1 mb-2">
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

            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
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
