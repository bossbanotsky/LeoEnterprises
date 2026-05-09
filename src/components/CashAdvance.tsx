import React, { useState, useEffect } from 'react';
import { recordTransaction, deleteTransactionsByReference } from '../services/financeService';
import { collection, onSnapshot, addDoc, updateDoc, query, orderBy, deleteDoc, doc, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, addAuditLog } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Employee, CashAdvance as CashAdvanceType } from '../types';
import { Search, Plus, Wallet, Trash2, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { format, parseISO } from 'date-fns';

export default function CashAdvance() {
  const { user } = useAuth();
  const { employees, cashAdvances, loading: dataLoading } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), amount: '', notes: '' });

  const handleAddCashAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.employeeId || !form.amount) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, 'cashAdvances', editingId), {
          employeeId: form.employeeId,
          date: form.date,
          amount: parseFloat(form.amount),
          remainingBalance: parseFloat(form.amount), // Special case: resetting balance on manual edit? User might want this.
          notes: form.notes || ''
        });
        await addAuditLog('Updated Cash Advance', 'Cash Advance', `Updated CA for employee ID ${form.employeeId} (₱${form.amount}).`);
        
        // Update Finance: Delete old and create new
        await deleteTransactionsByReference(editingId);
        
        const accSnap = await getDocs(query(collection(db, 'accounts'), where('type', '==', 'cash')));
        const accountId = accSnap.empty ? 'cash-account-id' : accSnap.docs[0].id;
        await recordTransaction(
          accountId,
          'expense',
          parseFloat(form.amount),
          'Cash Advance',
          `Updated Cash Advance for ${employees.find(e => e.id === form.employeeId)?.fullName || 'Employee'}`,
          editingId,
          user.uid
        );

        setEditingId(null);
      } else {
        const caRef = await addDoc(collection(db, 'cashAdvances'), {
          employeeId: form.employeeId,
          date: form.date,
          amount: parseFloat(form.amount),
          remainingBalance: parseFloat(form.amount),
          deductions: [],
          notes: form.notes || '',
          createdAt: new Date().toISOString(),
          uid: user.uid
        });
        await addAuditLog('Added Cash Advance', 'Cash Advance', `Added CA for employee ID ${form.employeeId} (₱${form.amount}).`);
        
        // Find a cash account
        const accSnap = await getDocs(query(collection(db, 'accounts'), where('type', '==', 'cash')));
        const accountId = accSnap.empty ? 'cash-account-id' : accSnap.docs[0].id;

        await recordTransaction(
            accountId,
            'expense',
            parseFloat(form.amount),
            'Cash Advance',
            `Cash Advance for ${employees.find(e => e.id === form.employeeId)?.fullName || 'Employee'}`,
            caRef.id,
            user.uid
        );
      }
      setIsAddOpen(false);
      setForm({ employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), amount: '', notes: '' });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'cashAdvances');
    }
  };

  const openEdit = (ca: CashAdvanceType) => {
    setEditingId(ca.id);
    setForm({
      employeeId: ca.employeeId,
      date: ca.date,
      amount: ca.amount.toString(),
      notes: ca.notes || ''
    });
    setIsAddOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      const ca = cashAdvances.find(a => a.id === id);
      const empName = employees.find(e => e.id === ca?.employeeId)?.fullName || ca?.employeeId;
      
      // Delete associated finance transactions
      await deleteTransactionsByReference(id);
      
      await deleteDoc(doc(db, 'cashAdvances', id));
      await addAuditLog('Deleted Cash Advance', 'Cash Advance', `Deleted CA for ${empName}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'cashAdvances');
    }
  };

  // Group advances by employee
  const groupedAdvances = cashAdvances.reduce((acc, ca) => {
    if (!acc[ca.employeeId]) {
      acc[ca.employeeId] = {
        employee: employees.find(e => e.id === ca.employeeId),
        advances: [],
        totalBalance: 0,
        totalOriginalAmount: 0,
        transactionCount: 0,
        repaymentCount: 0
      };
    }
    acc[ca.employeeId].advances.push(ca);
    acc[ca.employeeId].totalBalance += ca.remainingBalance;
    acc[ca.employeeId].totalOriginalAmount += ca.amount;
    acc[ca.employeeId].transactionCount += 1;
    acc[ca.employeeId].repaymentCount += (ca.deductions?.length || 0);
    return acc;
  }, {} as Record<string, { employee?: Employee, advances: CashAdvanceType[], totalBalance: number, totalOriginalAmount: number, transactionCount: number, repaymentCount: number }>);

  const employeeGroups = Object.values(groupedAdvances).filter(group => {
    const searchStr = searchQuery.toLowerCase();
    const nameMatch = group.employee?.fullName.toLowerCase().includes(searchStr);
    const notesMatch = group.advances.some(ca => (ca.notes || '').toLowerCase().includes(searchStr));
    
    const tabMatch = activeTab === 'active' ? group.totalBalance > 0 : group.totalBalance <= 0;
    
    return (nameMatch || notesMatch) && tabMatch;
  }).sort((a, b) => (a.employee?.fullName || '').localeCompare(b.employee?.fullName || ''));

  // Sort employees for the dropdown - include deactivated ones
  const sortedEmployees = [...employees].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return a.fullName.localeCompare(b.fullName);
  });

  return (
    <div className="h-full flex flex-col relative">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Cash Advances</h1>
        
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl mb-4">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'active' 
                ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Active ({Object.values(groupedAdvances).filter(g => g.totalBalance > 0).length})
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'archived' 
                ? 'bg-white dark:bg-slate-800 text-slate-600 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Archived ({Object.values(groupedAdvances).filter(g => g.totalBalance <= 0).length})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input 
            placeholder="Search by employee name..." 
            className="pl-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl h-12 shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-20">
        {employeeGroups.map(group => {
          const isExpanded = expandedEmployeeId === group.employee?.id;
          return (
            <div key={group.employee?.id} className="bento-card bg-white dark:bg-slate-800 overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 transition-all">
              {/* Header */}
              <div 
                onClick={() => setExpandedEmployeeId(isExpanded ? null : (group.employee?.id || null))}
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
              >
                <div className={`w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center font-bold shrink-0 ${isExpanded ? 'ring-2 ring-orange-500 ring-offset-2' : ''}`}>
                  <Wallet className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                    {group.employee?.fullName || 'Unknown Employee'}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                      {group.transactionCount} CA{group.transactionCount !== 1 ? 's' : ''} • {group.repaymentCount} Repayments
                    </span>
                    {group.employee?.status !== 'active' && group.employee?.status && (
                       <span className="text-[10px] font-bold bg-red-50 text-red-500 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                        {group.employee.status}
                       </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-black italic tracking-tighter ${group.totalBalance > 0 ? 'text-red-600' : 'text-emerald-500'}`}>
                    ₱{group.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest -mt-1">
                    Outstanding
                  </div>
                </div>
              </div>

              {/* Detail View */}
              {isExpanded && (
                <div className="bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-800 p-4 space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    {group.advances.sort((a, b) => b.date.localeCompare(a.date)).map(ca => (
                      <div key={ca.id} className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(parseISO(ca.date), 'MMMM dd, yyyy')}</div>
                              {ca.originPayrollId && (
                                <span className="text-[8px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded uppercase font-black tracking-tighter shadow-sm">
                                  AUTO-GENERATED
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
                              {ca.notes || 'No reason specified'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-slate-900 dark:text-white">₱{ca.remainingBalance.toLocaleString()}</div>
                            <div className="text-[10px] text-slate-400">Total: ₱{ca.amount.toLocaleString()}</div>
                          </div>
                        </div>

                        {ca.deductions && ca.deductions.length > 0 && (
                          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2 space-y-1 mt-2">
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Deduction History</div>
                            {ca.deductions.map((d, i) => (
                              <div key={i} className="flex justify-between items-start text-[10px] border-b border-slate-100 dark:border-slate-800 last:border-0 pb-1 last:pb-0">
                                <div className="flex flex-col">
                                  <span className="text-slate-500 font-medium">{format(parseISO(d.date), 'MMM dd, HH:mm')}</span>
                                  {d.period && <span className="text-[8px] text-slate-400 leading-none mt-0.5">Payroll: {d.period}</span>}
                                </div>
                                <span className="font-black text-blue-600">-₱{d.amount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-end gap-3 mt-3 pt-3 border-t border-slate-50 dark:border-slate-700/50">
                          <button 
                            onClick={() => openEdit(ca)}
                            className="text-[10px] uppercase font-black text-blue-500 hover:text-blue-700 flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                          <button 
                            onClick={() => handleDelete(ca.id)}
                            className="text-[10px] uppercase font-black text-red-500 hover:text-red-700 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {employeeGroups.length === 0 && (
          <div className="text-center py-20 flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
               <Wallet className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-900 dark:text-white font-bold">No Records Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
              {searchQuery ? `No matches for "${searchQuery}" in ${activeTab} tab.` : `All caught up! No ${activeTab} records to display.`}
            </p>
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) {
          setEditingId(null);
          setForm({ employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), amount: '', notes: '' });
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
                {sortedEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} {emp.status !== 'active' && emp.status ? `(${emp.status})` : ''}
                    </option>
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
            <div className="space-y-2">
              <Label>Notes / Reason (e.g. Grocery, Rice)</Label>
              <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="What's this for?" className="rounded-xl h-12" />
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
