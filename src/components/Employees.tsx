import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Employee } from '../types';
import { Search, Plus, Briefcase, ChevronRight, Edit2, Trash2, CheckCircle2, Upload, Loader2, User, Key, ShieldCheck } from 'lucide-react';
import { createEmployeeAuth } from '../lib/adminAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Interactive } from './ui/Interactive';
import { Skeleton } from './ui/Skeleton';

export default function Employees() {
  const { user } = useAuth();
  const { employees, users: usersList, loading } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [form, setForm] = useState({ customId: '', fullName: '', position: '', dailySalary: '', email: '', loginPassword: '', photoURL: '', role: 'employee' as 'admin' | 'employee' | 'ceo' });
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const users = useMemo(() => {
    const map: Record<string, any> = {};
    usersList.forEach(u => {
      if (u.employeeId) map[u.employeeId] = u;
    });
    return map;
  }, [usersList]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, photoURL: reader.result as string }));
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error", error);
      setIsUploading(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const dailySalary = parseFloat(form.dailySalary);
      const hourlyRate = dailySalary / 8;
      
      let finalCustomId = form.customId || '';

      // Check for duplicate ID
      if (finalCustomId) {
        const isDuplicate = employees.some(emp => 
          emp.customId === finalCustomId && 
          (!editingEmployee || emp.id !== editingEmployee.id)
        );

        if (isDuplicate) {
          // If duplicate, get the next one
          const nextId = getNextEmployeeId(form.position);
          alert(`Employee ID "${finalCustomId}" already exists. Re-assigning to next available ID: ${nextId}`);
          finalCustomId = nextId;
        }
      } else if (form.role === 'employee') {
        // Auto-generate if empty for regular employees
        finalCustomId = getNextEmployeeId(form.position);
      }
      
      if (editingEmployee) {
        await updateDoc(doc(db, 'employees', editingEmployee.id), {
          customId: finalCustomId,
          fullName: form.fullName,
          position: form.position || 'Staff',
          dailySalary,
          hourlyRate,
          email: form.email || '',
          loginPassword: form.loginPassword || '',
          photoURL: form.photoURL || '',
          role: form.role || 'employee'
        });
        setEditingEmployee(null);
      } else {
        await addDoc(collection(db, 'employees'), {
          customId: finalCustomId,
          fullName: form.fullName,
          position: form.position || 'Staff',
          status: 'active',
          dailySalary,
          hourlyRate,
          email: form.email || '',
          loginPassword: form.loginPassword || '',
          photoURL: form.photoURL || '',
          role: form.role || 'employee',
          createdAt: new Date().toISOString(),
          uid: user.uid
        });
      }
      setIsAddOpen(false);
      setForm({ customId: '', fullName: '', position: '', dailySalary: '', email: '', loginPassword: '', photoURL: '', role: 'employee' });
    } catch (error) {
      handleFirestoreError(error, editingEmployee ? OperationType.UPDATE : OperationType.CREATE, 'employees');
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'employees', id));
      setSelectedEmployee(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'employees');
    }
  };

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setForm({
      customId: emp.customId || '',
      fullName: emp.fullName,
      position: emp.position || '',
      dailySalary: emp.dailySalary.toString(),
      email: emp.email || '',
      loginPassword: emp.loginPassword || '',
      photoURL: emp.photoURL || '',
      role: emp.role || 'employee'
    });
    setSelectedEmployee(null);
    setIsAddOpen(true);
  };

  const handleProvisionAccount = async () => {
    if (!form.email || !form.loginPassword) {
      alert("Please provide both email and password first.");
      return;
    }

    if (form.loginPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setIsProvisioning(true);
    try {
      await createEmployeeAuth(form.email, form.loginPassword);
      alert("Employee login account provisioned successfully! They can now log in using these credentials.");
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        alert("This email is already registered in Firebase Identity! The employee record has been successfully linked. They can log in with their existing Google account or password.");
      } else {
        console.error("Provisioning error:", error);
        alert("Error provisioning account: " + error.message);
      }
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleUpdateStatus = async (emp: Employee) => {
    if (!user) return;
    try {
      const newStatus = emp.status === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'employees', emp.id), { status: newStatus });
      setSelectedEmployee({ ...emp, status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'employees');
    }
  };

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deactivated'>('active');
  const [isRearranging, setIsRearranging] = useState(false);
  const [sortOption, setSortOption] = useState<'alphabetical' | 'id'>('alphabetical');

  const getNextEmployeeId = (position: string = '') => {
    const posLower = position.toLowerCase();
    const prefix = posLower.includes('labor') ? 'LEL' 
                 : posLower.includes('skill') ? 'LEK' 
                 : 'LE';

    const idsWithPrefix = employees
      .filter(e => (e.role === 'employee' || !e.role) && e.customId?.startsWith(`${prefix}-`))
      .map(e => {
        const match = e.customId?.match(new RegExp(`${prefix}-(\\d+)`));
        return match ? parseInt(match[1]) : 0;
      });
    const maxId = idsWithPrefix.length > 0 ? Math.max(...idsWithPrefix) : 0;
    const nextId = maxId + 1;
    return `${prefix}-${nextId.toString().padStart(3, '0')}`;
  };

  const handleRearrangeIds = async () => {
    if (!user) return;
    
    setIsRearranging(true);
    try {
      const regularEmployees = employees
        .filter(e => e.role === 'employee' || !e.role)
        .sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeA - timeB;
        });

      let laborCount = 0;
      let skilledCount = 0;
      let otherCount = 0;

      for (let i = 0; i < regularEmployees.length; i++) {
        const emp = regularEmployees[i];
        const posLower = (emp.position || '').toLowerCase();
        let newId = '';

        if (posLower.includes('labor')) {
          laborCount++;
          newId = `LEL-${laborCount.toString().padStart(3, '0')}`;
        } else if (posLower.includes('skill')) {
          skilledCount++;
          newId = `LEK-${skilledCount.toString().padStart(3, '0')}`;
        } else {
          otherCount++;
          newId = `LE-${otherCount.toString().padStart(3, '0')}`;
        }

        if (emp.customId !== newId) {
          await updateDoc(doc(db, 'employees', emp.id), { customId: newId });
        }
      }
    } catch (error) {
      console.error("Error rearranging IDs:", error);
    } finally {
      setIsRearranging(false);
    }
  };

  const counts = useMemo(() => {
    return {
      all: employees.length,
      active: employees.filter(e => e.status === 'active' || !e.status).length,
      deactivated: employees.filter(e => e.status === 'inactive').length
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (statusFilter === 'active') {
      list = employees.filter(e => e.status === 'active' || !e.status);
    } else if (statusFilter === 'deactivated') {
      list = employees.filter(e => e.status === 'inactive');
    }
    
    return list.filter(emp => 
        (emp.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (emp.position && emp.position.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [statusFilter, employees, searchQuery]);

  // Grouping logic
  const groupedEmployees: Record<string, Employee[]> = {};
  filteredEmployees.forEach(emp => {
    const position = (emp.position || 'Staff').charAt(0).toUpperCase() + (emp.position || 'Staff').slice(1).toLowerCase();
    if (!groupedEmployees[position]) groupedEmployees[position] = [];
    groupedEmployees[position].push(emp);
  });
  
  const sortedPositions = Object.keys(groupedEmployees).sort();

  sortedPositions.forEach(pos => {
    groupedEmployees[pos].sort((a, b) => {
      if (sortOption === 'alphabetical') {
        return (a.fullName || '').localeCompare(b.fullName || '');
      } else {
        return (a.customId || '').localeCompare(b.customId || '', undefined, { numeric: true, sensitivity: 'base' });
      }
    });
  });

  return (
    <div className="h-full flex flex-col relative">
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tight">HR Management</h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Total Workforce: {counts.all} Employees</p>
            {(user?.email === 'marqueznorthed@gmail.com' || employees.find(e => e.uid === user?.uid)?.role === 'admin' || employees.find(e => e.uid === user?.uid)?.role === 'ceo') && (
              <button 
                onClick={handleRearrangeIds}
                disabled={isRearranging}
                className="mt-3 text-[10px] font-black uppercase tracking-widest text-white hover:text-blue-300 transition-colors flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg border border-blue-500 shadow-lg disabled:opacity-50"
              >
                {isRearranging ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Rearrange LE-IDs
              </button>
            )}
          </div>
          
          <div className="flex bg-slate-950 p-1 rounded-xl border border-white/10 shrink-0">
            <button 
                className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${statusFilter === 'all' ? 'bg-white/10 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}
                onClick={() => setStatusFilter('all')}
            >
              All
              <span className={`px-1.5 py-0.5 rounded-md ${statusFilter === 'all' ? 'bg-white/20' : 'bg-white/5'}`}>{counts.all}</span>
            </button>
            <button 
                className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${statusFilter === 'active' ? 'bg-white/10 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}
                onClick={() => setStatusFilter('active')}
            >
              Active
              <span className={`px-1.5 py-0.5 rounded-md ${statusFilter === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5'}`}>{counts.active}</span>
            </button>
            <button 
                className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${statusFilter === 'deactivated' ? 'bg-white/10 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}
                onClick={() => setStatusFilter('deactivated')}
            >
              Deactivated
              <span className={`px-1.5 py-0.5 rounded-md ${statusFilter === 'deactivated' ? 'bg-rose-500/20 text-rose-400' : 'bg-white/5'}`}>{counts.deactivated}</span>
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative group flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
            <Input 
              placeholder="Search employees..." 
              className="pl-10 bg-transparent border border-white/10 rounded-xl h-12 text-white placeholder:text-slate-500 focus-visible:ring-blue-500 transition-all font-bold"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as 'alphabetical' | 'id')}
            className="bg-slate-950 border border-white/10 rounded-xl px-3 h-12 text-[10px] font-black uppercase tracking-widest text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="alphabetical">Sort A-Z</option>
            <option value="id">Sort by ID</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pb-20">
        {loading ? (
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div key={i}>
                <Skeleton className="h-4 w-24 mb-3 ml-1" />
                <div className="space-y-3">
                  <Skeleton count={3} className="h-20 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          sortedPositions.map(position => (
            <div key={position}>
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-1 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" /> {position}
              </h2>
              <div className="space-y-4">
                {groupedEmployees[position].map(emp => (
                    <Interactive 
                      key={emp.id} 
                      onClick={() => setSelectedEmployee(emp)}
                      className="bg-white/5 backdrop-blur-xl p-4 flex flex-row items-center gap-4 border border-white/10 hover:border-blue-500 transition-all rounded-[24px] shadow-2xl relative overflow-hidden group"
                    >
                      <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 overflow-hidden border border-blue-500/20 shadow-inner group-hover:scale-110 transition-transform">
                        {emp.photoURL ? (
                          <img src={emp.photoURL} alt={emp.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          emp.fullName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3 className="font-black text-white italic uppercase tracking-tighter text-sm sm:text-base leading-none">{emp.fullName}</h3>
                          {emp.customId && (
                            <span className="text-[8px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest whitespace-nowrap">
                              {emp.customId}
                            </span>
                          )}
                          {users[emp.id] && (
                            <div className="w-4 h-4 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]" title="Account Linked">
                              <ShieldCheck className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] sm:text-xs mt-2">
                          <div className="flex items-center gap-1.5 text-white/50 font-black uppercase tracking-wider">
                            <Briefcase className="w-3 h-3 text-blue-500" />
                            <span className="truncate max-w-[80px] sm:max-w-none">{emp.position || 'Staff'}</span>
                          </div>
                          <div className="font-black text-cyan-400 flex items-center gap-0.5 whitespace-nowrap shadow-sm italic">
                            <span className="text-[9px] opacity-70">₱</span>
                            <span className="tracking-widest">{emp.dailySalary.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-[0.15em] border transition-colors hidden xs:block ${
                          emp.status === 'active' || !emp.status 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                            : 'bg-white/5 text-white/30 border-white/10'
                        }`}>
                          {(emp.status === 'inactive') ? 'Deactivated' : (emp.status || 'Active')}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                          <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white" />
                        </div>
                      </div>
                    </Interactive>
                ))}
              </div>
            </div>
          ))
        )}
        {!loading && filteredEmployees.length === 0 && (
          <div className="text-center py-10 text-slate-500 dark:text-slate-400">
            No employees found.
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) {
          setEditingEmployee(null);
          setForm({ customId: '', fullName: '', position: '', dailySalary: '', email: '', loginPassword: '', photoURL: '', role: 'employee' });
        } else if (!editingEmployee) {
          setForm(prev => ({ ...prev, customId: '' }));
        }
      }}>
        <DialogTrigger render={<button className="absolute bottom-6 right-2 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95 z-10" />}>
          <Plus className="w-6 h-6" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4">
            <div 
              className="relative w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors group"
              onClick={() => fileInputRef.current?.click()}
            >
              {form.photoURL ? (
                <img src={form.photoURL} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-slate-400">
                  <Upload className="w-8 h-8 mb-1" />
                  <span className="text-[10px] font-bold uppercase">Upload</span>
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Edit2 className="w-6 h-6 text-white" />
              </div>
            </div>
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            {form.photoURL && (
              <button 
                type="button"
                onClick={() => setForm(prev => ({ ...prev, photoURL: '' }))}
                className="mt-2 text-xs font-bold text-red-500 hover:underline"
              >
                Remove Photo
              </button>
            )}
          </div>
          <form onSubmit={handleAddEmployee} className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
            <div className="space-y-2">
              <Label>Employee ID (Optional)</Label>
              <Input value={form.customId} onChange={e => setForm({...form, customId: e.target.value})} placeholder="Auto-generates (e.g. LEL/LEK) based on Position" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input required value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Input required value={form.position} onChange={e => setForm({...form, position: e.target.value})} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Account Role</Label>
              <select 
                value={form.role} 
                onChange={e => setForm({...form, role: e.target.value as any})}
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
              >
                <option value="employee">Employee</option>
                <option value="ceo">CEO</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Daily Salary (₱)</Label>
              <Input required type="number" step="0.01" value={form.dailySalary} onChange={e => setForm({...form, dailySalary: e.target.value})} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Email Address (Optional)</Label>
              <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="employee@example.com" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Login Password {editingEmployee && "(Hidden)"}</Label>
              <div className="flex gap-2">
                <Input 
                  type="password" 
                  value={form.loginPassword} 
                  onChange={e => setForm({...form, loginPassword: e.target.value})} 
                  placeholder="Min 6 chars" 
                  className="rounded-xl flex-1" 
                />
              </div>
            </div>

            {editingEmployee && (
              <div className="pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl h-10"
                  onClick={handleProvisionAccount}
                  disabled={isProvisioning}
                >
                  {isProvisioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  {isProvisioning ? 'Provisioning...' : 'Provision/Link Login Account'}
                </Button>
                <p className="text-[10px] text-slate-400 mt-1 text-center">
                  This creates a Firebase Auth user for the employee.
                </p>
              </div>
            )}
            
            <Button type="submit" className="w-full rounded-xl h-12 bg-blue-600 hover:bg-blue-700 mt-2">
              {editingEmployee ? 'Update Employee Record' : 'Save Employee'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold text-2xl shrink-0 overflow-hidden">
                    {selectedEmployee.photoURL ? (
                      <img src={selectedEmployee.photoURL} alt={selectedEmployee.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      selectedEmployee.fullName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-slate-900 dark:text-white">{selectedEmployee.fullName}</h3>
                    <p className="text-slate-500 dark:text-slate-400">
                      {selectedEmployee.customId ? `${selectedEmployee.customId} • ` : ''}{selectedEmployee.position || 'Staff'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => openEdit(selectedEmployee)} className="rounded-full w-10 h-10">
                    <Edit2 className="w-4 h-4 text-slate-600" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDeleteEmployee(selectedEmployee.id)} className="rounded-full w-10 h-10 border-red-200 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl col-span-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">Employee ID</div>
                  <div className="font-bold text-slate-900 dark:text-white">{selectedEmployee.customId || 'No ID assigned'}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl col-span-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">Email Address</div>
                  <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-2">
                    {selectedEmployee.email || 'None provided'}
                    {users[selectedEmployee.id] && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                  </div>
                </div>
                {selectedEmployee.loginPassword && (
                   <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl col-span-2">
                    <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1 flex items-center gap-1">
                      <Key className="w-3 h-3" /> Login Password
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">
                      {selectedEmployee.loginPassword}
                    </div>
                  </div>
                )}
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">Daily Salary</div>
                  <div className="font-bold text-slate-900 dark:text-white">₱ {selectedEmployee.dailySalary.toFixed(2)}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">Hourly Rate</div>
                  <div className="font-bold text-slate-900 dark:text-white">₱ {selectedEmployee.hourlyRate.toFixed(2)}</div>
                </div>
              </div>

              {(selectedEmployee.birthday || selectedEmployee.sex || selectedEmployee.civilStatus || selectedEmployee.religion || selectedEmployee.sssNumber || selectedEmployee.philhealthNumber || selectedEmployee.pagibigNumber || selectedEmployee.tinNumber) && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Personal & Government Data</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedEmployee.birthday && (
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Birthday</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedEmployee.birthday}</span>
                      </div>
                    )}
                    {selectedEmployee.sex && (
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Sex</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedEmployee.sex}</span>
                      </div>
                    )}
                    {selectedEmployee.civilStatus && (
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Civil Status</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedEmployee.civilStatus}</span>
                      </div>
                    )}
                    {selectedEmployee.religion && (
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Religion</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedEmployee.religion}</span>
                      </div>
                    )}
                    {selectedEmployee.sssNumber && (
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">SSS Number</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedEmployee.sssNumber}</span>
                      </div>
                    )}
                    {selectedEmployee.philhealthNumber && (
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">PhilHealth No.</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedEmployee.philhealthNumber}</span>
                      </div>
                    )}
                    {selectedEmployee.pagibigNumber && (
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Pag-IBIG / HDMF</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedEmployee.pagibigNumber}</span>
                      </div>
                    )}
                    {selectedEmployee.tinNumber && (
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">TIN Number</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedEmployee.tinNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(selectedEmployee.emergencyContactName || selectedEmployee.emergencyContactRelation || selectedEmployee.emergencyContactPhone) && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 text-red-600 dark:text-red-400">Emergency Contact</h4>
                  <div className="bg-red-50/30 dark:bg-red-900/10 p-3 rounded-xl border border-red-100/50 dark:border-red-900/20">
                    <div className="font-bold text-slate-900 dark:text-white">{selectedEmployee.emergencyContactName || 'No Name Provided'}</div>
                    <div className="flex items-center justify-between mt-1 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">{selectedEmployee.emergencyContactRelation || 'Relation Unknown'}</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{selectedEmployee.emergencyContactPhone || 'No Phone'}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">Account Status</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Currently {selectedEmployee.status === 'inactive' ? 'Deactivated' : (selectedEmployee.status || 'active')}
                    </div>
                  </div>
                  <Button 
                    variant={selectedEmployee.status === 'active' || !selectedEmployee.status ? 'destructive' : 'default'}
                    onClick={() => handleUpdateStatus(selectedEmployee)}
                    className="rounded-xl"
                  >
                    {selectedEmployee.status === 'active' || !selectedEmployee.status ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
