import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, deleteDoc, getDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { recordTransaction, deleteTransaction } from '../services/financeService';
import { Droplets, Snowflake, Plus, FileText, CheckCircle, Clock, Trash2, X, Users, CreditCard, DollarSign, User, Edit2 } from 'lucide-react';
import { Account, Employee } from '../types';

interface DailySupply {
  id: string;
  date: string;
  itemType: 'Ice' | 'Water' | 'Ice & Water' | 'Other';
  quantity: number | string;
  basePrice?: number;
  totalCost: number;
  paymentMethod: 'company' | 'employee' | 'debt';
  employeeId?: string; // If employee paid, who needs reimbursement
  supplierName?: string; // If debt, who we owe
  reimbursed: boolean;
  debtPaid?: boolean;
  chargedAccountIds: string[];
  notes: string;
  financeTransactionIds?: string[];
  createdAt: string;
  recordedBy?: string;
}

export default function DailySupplies() {
  const { user } = useAuth();
  const { employees } = useData();
  const [supplies, setSupplies] = useState<DailySupply[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<DailySupply | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'pending' | 'settled' | 'all'>('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Ice' | 'Water' | 'Ice & Water' | 'Other'>('all');

  // Form state

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    itemType: 'Ice & Water' as DailySupply['itemType'],
    quantity: '' as number | string,
    basePrice: '' as number | string,
    paymentMethod: 'company' as 'company' | 'employee' | 'debt',
    employeeId: '',
    supplierName: '',
    chargedAccountIds: [] as string[],
    notes: '',
  });

  const parsedQuantity = parseFloat(String(formData.quantity)) || 0;
  const parsedBasePrice = parseFloat(String(formData.basePrice)) || 0;
  const totalCost = parsedQuantity * parsedBasePrice;

  useEffect(() => {
    if (!user) return;
    const unsubSupplies = onSnapshot(query(collection(db, 'dailySupplies'), orderBy('date', 'desc')), (snap) => {
      setSupplies(snap.docs.map(d => ({ id: d.id, ...d.data() } as DailySupply)));
      setLoading(false);
    });

    const unsubAccounts = onSnapshot(collection(db, 'accounts'), (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
    });

    return () => {
      unsubSupplies();
      unsubAccounts();
    };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || totalCost <= 0) return;
    if (formData.paymentMethod === 'company' && formData.chargedAccountIds.length === 0) return;
    if (formData.paymentMethod === 'employee' && !formData.employeeId) return;
    if (formData.paymentMethod === 'debt' && !formData.supplierName) return;

    try {
      const supplyData: any = {
        date: formData.date,
        itemType: formData.itemType,
        quantity: parsedQuantity,
        basePrice: parsedBasePrice,
        totalCost: totalCost,
        paymentMethod: formData.paymentMethod,
        reimbursed: false,
        debtPaid: false,
        chargedAccountIds: formData.chargedAccountIds,
        notes: formData.notes,
        createdAt: new Date().toISOString(),
        recordedBy: user.uid,
        financeTransactionIds: []
      };

      if (formData.paymentMethod === 'employee') supplyData.employeeId = formData.employeeId;
      if (formData.paymentMethod === 'debt') supplyData.supplierName = formData.supplierName;

      if (editingSupply) {
        supplyData.updatedAt = new Date().toISOString();
        // Remove fields we don't want to overwrite
        delete supplyData.createdAt;
        delete supplyData.recordedBy;
        delete supplyData.financeTransactionIds;
        delete supplyData.reimbursed;
        delete supplyData.debtPaid;

        await updateDoc(doc(db, 'dailySupplies', editingSupply.id), supplyData);
      } else {
        // If company is paying directly, auto-deduct from selected accounts
        let txIds: string[] = [];
        if (formData.paymentMethod === 'company' && formData.chargedAccountIds.length > 0) {
          const splitAmount = totalCost / formData.chargedAccountIds.length;
          for (const targetAccId of formData.chargedAccountIds) {
            try {
              const txRef = await recordTransaction(
                targetAccId,
                'expense',
                splitAmount,
                'Supplies',
                `${formData.itemType} Supply${formData.quantity ? ` - ${formData.quantity}` : ''}` + (formData.chargedAccountIds.length > 1 ? ' (Split)' : ''),
                undefined,
                user.uid,
                formData.date,
                'supplies'
              );
              if (txRef && typeof txRef === 'string') {
                 txIds.push(txRef);
              }
            } catch (err) {
              console.error("Error charging account:", err);
            }
          }
        }

        supplyData.financeTransactionIds = txIds;
        await addDoc(collection(db, 'dailySupplies'), supplyData);
      }
      
      setIsAddOpen(false);
      setEditingSupply(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        itemType: 'Ice & Water',
        quantity: '',
        basePrice: '',
        paymentMethod: 'company',
        employeeId: '',
        supplierName: '',
        chargedAccountIds: [],
        notes: '',
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSettleDebt = async (supply: DailySupply) => {
    const selectedAcc = supply.chargedAccountIds.length > 0 ? supply.chargedAccountIds[0] : (accounts.find(a => a.isDefault)?.id || accounts[0]?.id);
    if (!selectedAcc) {
      alert("No finance account found to settle debt.");
      return;
    }

    try {
      // Create payment transaction
      const txRef = await recordTransaction(
        selectedAcc,
        'expense',
        supply.totalCost,
        'Supplies',
        `Debt settled to supplier (${supply.supplierName}) for ${supply.itemType} on ${supply.date}`,
        undefined,
        user?.uid,
        new Date().toISOString().split('T')[0],
        'supplies'
      );

      // Update supply record
      const updateData: any = {
        debtPaid: true,
        debtPaidAt: new Date().toISOString()
      };
      if (txRef && typeof txRef === 'string') {
         updateData.settlementTransactionId = txRef;
      }

      await updateDoc(doc(db, 'dailySupplies', supply.id), updateData);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReimburse = async (supply: DailySupply) => {
    const selectedAcc = supply.chargedAccountIds.length > 0 ? supply.chargedAccountIds[0] : (accounts.find(a => a.isDefault)?.id || accounts[0]?.id);
    if (!selectedAcc) {
      alert("No finance account found to process reimbursement.");
      return;
    }

    try {
      // Create reimbursement transaction
      const txRef = await recordTransaction(
        selectedAcc,
        'expense',
        supply.totalCost,
        'Supplies',
        `Reimbursement to employee for ${supply.itemType} on ${supply.date}`,
        undefined,
        user?.uid,
        new Date().toISOString().split('T')[0],
        'supplies'
      );

      // Update supply record
      const updateData: any = {
        reimbursed: true,
        reimbursedAt: new Date().toISOString()
      };
      if (txRef && typeof txRef === 'string') {
         updateData.settlementTransactionId = txRef;
      }

      await updateDoc(doc(db, 'dailySupplies', supply.id), updateData);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUndoSettleDebt = async (supply: DailySupply) => {
    try {
      if ((supply as any).settlementTransactionId) {
        await deleteTransaction((supply as any).settlementTransactionId);
      }
      if (supply.financeTransactionIds && supply.financeTransactionIds.length > 0) {
        for (const txId of supply.financeTransactionIds) {
          await deleteTransaction(txId);
        }
      }
      await updateDoc(doc(db, 'dailySupplies', supply.id), {
        debtPaid: false,
        debtPaidAt: deleteField(),
        settlementTransactionId: deleteField(),
        financeTransactionIds: deleteField()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleUndoReimburse = async (supply: DailySupply) => {
    try {
      if ((supply as any).settlementTransactionId) {
        await deleteTransaction((supply as any).settlementTransactionId);
      }
      if (supply.financeTransactionIds && supply.financeTransactionIds.length > 0) {
        for (const txId of supply.financeTransactionIds) {
          await deleteTransaction(txId);
        }
      }
      await updateDoc(doc(db, 'dailySupplies', supply.id), {
        reimbursed: false,
        reimbursedAt: deleteField(),
        settlementTransactionId: deleteField(),
        financeTransactionIds: deleteField()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteSupply = async (supply: DailySupply) => {
    try {
      if (supply.financeTransactionIds && supply.financeTransactionIds.length > 0) {
        for (const txId of supply.financeTransactionIds) {
          await deleteTransaction(txId);
        }
      }
      if ((supply as any).settlementTransactionId) {
        await deleteTransaction((supply as any).settlementTransactionId);
      }
      await deleteDoc(doc(db, 'dailySupplies', supply.id));
      setDeleteConfirmId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenEdit = (supply: DailySupply) => {
    setEditingSupply(supply);
    setFormData({
      date: supply.date,
      itemType: supply.itemType,
      quantity: supply.quantity || '',
      basePrice: supply.basePrice || '',
      paymentMethod: supply.paymentMethod,
      employeeId: supply.employeeId || '',
      supplierName: supply.supplierName || '',
      chargedAccountIds: supply.chargedAccountIds || [],
      notes: supply.notes || '',
    });
    setIsAddOpen(true);
  };

  const getEmployeeName = (id: string | undefined) => {
    if (!id) return '';
    return employees.find(e => e.id === id)?.fullName || 'Unknown';
  };

  const filteredSupplies = supplies.filter(supply => {
    const isSettled = supply.paymentMethod === 'company' || supply.reimbursed || supply.debtPaid;
    
    // View mode filter
    if (viewMode === 'pending' && isSettled) return false;
    if (viewMode === 'settled' && !isSettled) return false;
    
    // Type filter
    if (typeFilter !== 'all' && supply.itemType !== typeFilter) return false;

    return true;
  });

  const unpaidDebtsTotal = supplies
    .filter(s => s.paymentMethod === 'debt' && !s.debtPaid)
    .reduce((sum, s) => sum + (typeof s.totalCost === 'number' ? s.totalCost : 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end mb-6 bg-indigo-900/40 p-6 rounded-3xl border border-indigo-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
           <Droplets className="w-48 h-48 rotate-12" />
        </div>
        <div className="relative z-10 w-full">
          <div className="flex justify-between w-full items-start mb-4">
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Droplets className="text-indigo-400 w-8 h-8"/> Daily Supplies Tracker
              </h2>
              <p className="text-indigo-200 text-sm max-w-md mt-1">Manage ice, water, and daily operational supplies.</p>
            </div>
            
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Unpaid Debts</span>
              <p className="text-2xl font-black text-rose-400">₱{unpaidDebtsTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
          </div>
          
          <div className="flex justify-between w-full items-center mb-4 flex-wrap gap-4">
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex gap-2 bg-slate-900/50 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('pending')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'pending' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setViewMode('settled')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'settled' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Settled
                </button>
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  All
                </button>
              </div>

              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as any)}
                className="bg-slate-900/50 text-slate-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 focus:outline-none"
              >
                <option value="all">All Items</option>
                <option value="Ice">Ice</option>
                <option value="Water">Water</option>
                <option value="Ice & Water">Ice & Water</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <button
              onClick={() => {
                setEditingSupply(null);
                setFormData({
                  date: new Date().toISOString().split('T')[0],
                  itemType: 'Ice & Water',
                  quantity: '',
                  basePrice: '',
                  paymentMethod: 'company',
                  employeeId: '',
                  supplierName: '',
                  chargedAccountIds: [],
                  notes: '',
                });
                setIsAddOpen(true);
              }}
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg active:scale-95 flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Record Supply
            </button>
          </div>
          </div>
        </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSupplies.map(supply => (
          <div key={supply.id} className="bg-slate-900 border border-white/5 p-5 rounded-2xl relative overflow-hidden hover:border-indigo-500/30 transition-all flex flex-col justify-between">
            {supply.itemType === 'Ice' && <Snowflake className="absolute -right-4 -top-4 w-24 h-24 text-blue-500/5 rotate-12" />}
            {(supply.itemType === 'Water' || supply.itemType === 'Ice & Water') && <Droplets className="absolute -right-4 -top-4 w-24 h-24 text-blue-500/5 rotate-12" />}
            
            <div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">{supply.itemType}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(supply.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-indigo-400 tracking-tighter">₱{supply.totalCost.toLocaleString()}</p>
                  {supply.quantity && (
                    <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">
                      Qty: {supply.quantity} {supply.basePrice ? `× ₱${supply.basePrice.toLocaleString()}` : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3 relative z-10 mb-6">
                <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 space-y-2">
                  <div className="flex justify-between items-center bg-slate-950/30 p-2 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Payment</span>
                    <span className="text-[10px] font-black text-white uppercase flex items-center gap-1 text-right">
                      {supply.paymentMethod === 'company' ? (
                        <><CreditCard className="w-3 h-3 text-emerald-400" /> Company Paid</>
                      ) : supply.paymentMethod === 'employee' ? (
                        <><User className="w-3 h-3 text-amber-400" /> Employee Paid</>
                      ) : (
                        <><Clock className="w-3 h-3 text-rose-400" /> Debt to {supply.supplierName}</>
                      )}
                    </span>
                  </div>

                  {supply.paymentMethod === 'employee' && (
                    <div className="flex justify-between items-center p-2">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Paid By</span>
                      <span className="text-[10px] font-bold text-amber-400 truncate max-w-[120px]">{getEmployeeName(supply.employeeId)}</span>
                    </div>
                  )}

                  {supply.paymentMethod === 'debt' && (
                    <div className="flex justify-between items-center p-2">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Owed To</span>
                      <span className="text-[10px] font-bold text-rose-400 truncate max-w-[120px]">{supply.supplierName}</span>
                    </div>
                  )}

                  {supply.paymentMethod === 'company' && supply.chargedAccountIds.length > 0 && (
                    <div className="flex justify-between items-start p-2">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Charged To</span>
                      <div className="flex flex-col items-end gap-1">
                        {supply.chargedAccountIds.map(accId => {
                          const acc = accounts.find(a => a.id === accId);
                          return acc ? <span key={accId} className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-black tracking-tighter truncate max-w-[120px]">{acc.name}</span> : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {supply.notes && (
                  <p className="text-xs text-slate-400 italic bg-white/5 p-2 rounded-lg border-l-2 border-indigo-500/50">
                    "{supply.notes}"
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-between items-end relative z-10 pt-4 border-t border-white/5 mt-auto">
              <div>
                {supply.paymentMethod === 'employee' && (
                  supply.reimbursed ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">
                        <CheckCircle className="w-3 h-3" /> Reimbursed
                      </span>
                      <button 
                        onClick={() => handleUndoReimburse(supply)} 
                        className="text-[9px] text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all font-bold tracking-widest uppercase px-2 py-1 rounded"
                      >
                        Undo
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleReimburse(supply)}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 transition-all px-3 py-1.5 rounded-lg border border-amber-500/20"
                    >
                      <DollarSign className="w-3 h-3" /> Process Reimbursement
                    </button>
                  )
                )}
                {supply.paymentMethod === 'debt' && (
                  supply.debtPaid ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">
                        <CheckCircle className="w-3 h-3" /> Debt Settled
                      </span>
                      <button 
                        onClick={() => handleUndoSettleDebt(supply)} 
                        className="text-[9px] text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all font-bold tracking-widest uppercase px-2 py-1 rounded"
                      >
                        Undo
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleSettleDebt(supply)}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-all px-3 py-1.5 rounded-lg border border-rose-500/20"
                    >
                      <DollarSign className="w-3 h-3" /> Settle Debt
                    </button>
                  )
                )}
                {supply.paymentMethod === 'company' && (
                   <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">
                     <CheckCircle className="w-3 h-3" /> Recorded
                   </span>
                )}
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => handleOpenEdit(supply)}
                  className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {deleteConfirmId === supply.id ? (
                  <div className="flex bg-rose-500/10 rounded-lg overflow-hidden border border-rose-500/20">
                    <button onClick={() => deleteSupply(supply)} className="px-2 py-1 text-[10px] font-black uppercase text-rose-500 hover:bg-rose-500 hover:text-white transition-all">Confirm</button>
                    <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 text-[10px] font-black uppercase text-slate-400 hover:bg-slate-700 transition-all">Cancel</button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setDeleteConfirmId(supply.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredSupplies.length === 0 && !loading && (
           <div className="col-span-full py-12 text-center bg-slate-900 border border-white/5 rounded-3xl">
              <Droplets className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No supply records found</p>
           </div>
        )}
      </div>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl w-full max-w-lg shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                {editingSupply ? <Edit2 className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />} 
                {editingSupply ? 'Edit Supply' : 'Record Supply'}
              </h2>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full bg-slate-800/50 border border-white/10 px-3 py-2 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Type</label>
                  <select
                    required
                    value={formData.itemType}
                    onChange={e => setFormData({...formData, itemType: e.target.value as DailySupply['itemType']})}
                    className="w-full bg-slate-800/50 border border-white/10 px-3 py-2 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  >
                    <option value="Ice">Ice</option>
                    <option value="Water">Water</option>
                    <option value="Ice & Water">Ice & Water</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.quantity}
                    onChange={e => setFormData({...formData, quantity: e.target.value === '' ? '' : parseFloat(e.target.value) || 0})}
                    className="w-full bg-slate-800/50 border border-white/10 px-3 py-2 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Base Price / Unit (₱)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="0.00"
                    value={formData.basePrice}
                    onChange={e => setFormData({...formData, basePrice: e.target.value === '' ? '' : parseFloat(e.target.value) || 0})}
                    className="w-full bg-slate-800/50 border border-white/10 px-3 py-2 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="bg-slate-800/30 p-2 px-3 rounded-lg border border-indigo-500/20 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Cost</span>
                <span className="text-lg font-black text-indigo-400">₱{totalCost.toLocaleString()}</span>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1 mb-1 block">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, paymentMethod: 'company'})}
                    className={`py-2 px-1 rounded-lg font-black uppercase text-[9px] tracking-wide transition-all border leading-tight ${formData.paymentMethod === 'company' ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/50 shadow-inner' : 'bg-slate-800/50 text-slate-400 border-white/5 hover:bg-slate-800'}`}
                  >
                    Paid by<br/>Company
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, paymentMethod: 'employee'})}
                    className={`py-2 px-1 rounded-lg font-black uppercase text-[9px] tracking-wide transition-all border leading-tight ${formData.paymentMethod === 'employee' ? 'bg-amber-500/20 text-amber-500 border-amber-500/50 shadow-inner' : 'bg-slate-800/50 text-slate-400 border-white/5 hover:bg-slate-800'}`}
                  >
                    Paid by<br/>Employee
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, paymentMethod: 'debt'})}
                    className={`py-2 px-1 rounded-lg font-black uppercase text-[9px] tracking-wide transition-all border leading-tight ${formData.paymentMethod === 'debt' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-inner' : 'bg-slate-800/50 text-slate-400 border-white/5 hover:bg-slate-800'}`}
                  >
                    Debt to<br/>Supplier
                  </button>
                </div>
              </div>

              {formData.paymentMethod === 'employee' ? (
                <div className="space-y-1 animate-fade-in">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Select Employee</label>
                  <select
                    required
                    value={formData.employeeId}
                    onChange={e => setFormData({...formData, employeeId: e.target.value})}
                    className="w-full bg-slate-800/50 border border-white/10 px-3 py-2 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.fullName}</option>
                    ))}
                  </select>
                </div>
              ) : formData.paymentMethod === 'debt' ? (
                <div className="space-y-1 animate-fade-in">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Supplier Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ice Delivery Co."
                    value={formData.supplierName}
                    onChange={e => setFormData({...formData, supplierName: e.target.value})}
                    className="w-full bg-slate-800/50 border border-white/10 px-3 py-2 rounded-lg text-white text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1 flex justify-between">
                  <span>Charge to Account(s)</span>
                  <span className="text-indigo-400 lowercase font-medium normal-case tracking-normal text-xs">{formData.chargedAccountIds.length > 1 ? 'Split equally' : ''}</span>
                </label>
                <div className="max-h-[100px] overflow-y-auto space-y-1 bg-slate-800/30 p-2 rounded-lg border border-white/5 custom-scrollbar">
                  {accounts.map(acc => (
                    <label key={acc.id} className="flex items-center justify-between p-1.5 rounded-md bg-white/5 hover:bg-white/10 cursor-pointer group">
                      <div className="flex items-center gap-2">
                         <input
                           type="checkbox"
                           checked={formData.chargedAccountIds.includes(acc.id)}
                           onChange={(e) => {
                             const newIds = e.target.checked 
                               ? [...formData.chargedAccountIds, acc.id]
                               : formData.chargedAccountIds.filter(id => id !== acc.id);
                             setFormData({...formData, chargedAccountIds: newIds});
                           }}
                           className="rounded border-slate-600 bg-slate-800 text-indigo-500"
                         />
                         <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{acc.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">₱{acc.balance.toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Bought from new supplier"
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full bg-slate-800/50 border border-white/10 px-3 py-2 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={formData.paymentMethod === 'company' && formData.chargedAccountIds.length === 0}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                >
                  {editingSupply ? 'Update Supply' : 'Record Supply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
