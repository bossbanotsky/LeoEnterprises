import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Employee, CashAdvance as CashAdvanceType } from '../types';
import { Search, Plus, Wallet, Trash2, Edit2 } from 'lucide-react';
import { SmartText } from './ui/SmartText';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { format, parseISO } from 'date-fns';

export default function CashAdvance() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cashAdvances, setCashAdvances] = useState<CashAdvanceType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), amount: '' });

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const emps: Employee[] = [];
      snapshot.forEach((doc) => emps.push({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(emps.sort((a, b) => a.fullName.localeCompare(b.fullName)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'employees'));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'cashAdvances'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const advances: CashAdvanceType[] = [];
      snapshot.forEach((doc) => advances.push({ id: doc.id, ...doc.data() } as CashAdvanceType));
      setCashAdvances(advances);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'cashAdvances'));
    return () => unsubscribe();
  }, [user]);

  const handleAddCashAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.employeeId || !form.amount) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, 'cashAdvances', editingId), {
          employeeId: form.employeeId,
          date: form.date,
          amount: parseFloat(form.amount)
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'cashAdvances'), {
          employeeId: form.employeeId,
          date: form.date,
          amount: parseFloat(form.amount),
          createdAt: new Date().toISOString(),
          uid: user.uid
        });
      }
      setIsAddOpen(false);
      setForm({ employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), amount: '' });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'cashAdvances');
    }
  };

  const openEdit = (ca: CashAdvanceType) => {
    setEditingId(ca.id);
    setForm({
      employeeId: ca.employeeId,
      date: ca.date,
      amount: ca.amount.toString()
    });
    setIsAddOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'cashAdvances', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'cashAdvances');
    }
  };

  const filteredAdvances = cashAdvances.filter(ca => {
    const emp = employees.find(e => e.id === ca.employeeId);
    return emp?.fullName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="h-full flex flex-col relative w-full">
      <div className="mb-4">
        <SmartText as="h1" className="text-2xl font-bold text-slate-900 mb-4 tracking-tight uppercase">Cash Advances</SmartText>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input 
            placeholder="Search by employee name..." 
            className="pl-10 bg-white border-slate-200 rounded-xl h-12"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-20 w-full pr-1">
        {filteredAdvances.map(ca => {
          const emp = employees.find(e => e.id === ca.employeeId);
          return (
            <div key={ca.id} className="bento-card bg-white p-4 flex flex-row items-center gap-4 border-black/5">
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center font-bold shrink-0 border border-orange-100 shadow-inner">
                <Wallet className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <SmartText as="h3" className="font-bold text-slate-900 truncate block leading-tight text-base tracking-tight">{emp?.fullName || 'Unknown Employee'}</SmartText>
                <SmartText className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 block opacity-70 italic">
                  {format(parseISO(ca.date), 'MMMM dd, yyyy')}
                </SmartText>
              </div>
              <div className="shrink-0 text-right">
                <SmartText className="font-black text-lg text-slate-900 tracking-tighter">
                  ₱{ca.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </SmartText>
                <div className="flex justify-end gap-3 mt-2">
                  <button 
                    onClick={() => openEdit(ca)}
                    className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-1 font-bold uppercase tracking-widest"
                  >
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(ca.id)}
                    className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1 font-bold uppercase tracking-widest"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filteredAdvances.length === 0 && (
          <div className="text-center py-10 text-slate-400 italic text-sm">
            No cash advance records found for this period.
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) {
          setEditingId(null);
          setForm({ employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), amount: '' });
        }
      }}>
        <DialogTrigger render={<button className="absolute bottom-6 right-2 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95 z-10" />}>
          <Plus className="w-6 h-6" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Cash Advance' : 'Add Cash Advance'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCashAdvance} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <select 
                required 
                value={form.employeeId} 
                onChange={e => setForm({...form, employeeId: e.target.value})}
                className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
              >
                <option value="" disabled>Select an employee</option>
                {employees
                  .filter(e => e.status === 'active' || !e.status)
                  .sort((a, b) => a.fullName.localeCompare(b.fullName))
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="rounded-xl h-12" />
            </div>
            <div className="space-y-2">
              <Label>Amount (Php)</Label>
              <Input required type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="rounded-xl h-12" />
            </div>
            <Button type="submit" className="w-full rounded-xl h-12 bg-blue-600 hover:bg-blue-700">
              {editingId ? 'Update Cash Advance' : 'Save Cash Advance'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
