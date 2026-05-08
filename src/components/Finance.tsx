import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc, updateDoc, getDoc, increment, where, limit, getDocs, getDocFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { recordTransaction } from '../services/financeService';
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, Banknote, Building2, CreditCard, Edit2, Trash2, X, FileText, User, Receipt, Search, PlusCircle } from 'lucide-react';
import { Account, Transaction, Invoice, Payroll, CashAdvance } from '../types';
import DailySupplies from './DailySupplies';

export default function Finance() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState<{
    name: string;
    type: 'cash' | 'bank' | 'wallet';
    balance: number;
    isDefault: boolean;
    department?: 'container' | 'junkshop' | 'other';
  }>({ name: '', type: 'cash', balance: 0, isDefault: false, department: 'other' });

  const [manualTransaction, setManualTransaction] = useState({
    accountIds: [] as string[],
    type: 'income' as 'income' | 'expense',
    amount: 0,
    category: 'Daily Operation',
    department: 'container' as 'container' | 'junkshop' | 'other',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [activeTab, setActiveTab] = useState<'all' | 'container' | 'junkshop' | 'supplies'>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, type: 'account' | 'transaction', transaction?: Transaction} | null>(null);

  const { user } = useAuth();
  const { employees } = useData();

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'accounts'), (snap) => {
      const accs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Account));
      setAccounts(accs);
    });
    const unsubTrans = onSnapshot(query(collection(db, 'transactions'), orderBy('createdAt', 'desc')), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    });
    return () => { unsub(); unsubTrans(); };
  }, [user]);

  const addAccount = async () => {
    if (editingId) {
      await updateDoc(doc(db, 'accounts', editingId), {
        ...newAccount,
        updatedAt: new Date().toISOString()
      });
    } else {
      await addDoc(collection(db, 'accounts'), { 
        ...newAccount, 
        createdAt: new Date().toISOString() 
      });
    }
    setIsAddAccountOpen(false);
    setEditingId(null);
    setNewAccount({ name: '', type: 'cash' as const, balance: 0, isDefault: false });
  };

  const openEdit = (acc: Account) => {
    setEditingId(acc.id);
    setNewAccount({ 
      name: acc.name, 
      type: acc.type, 
      balance: acc.balance, 
      isDefault: !!acc.isDefault,
      department: acc.department || 'other'
    });
    setIsAddAccountOpen(true);
  };

  const deleteAccount = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'accounts', id));
      setItemToDelete(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransactionClick = async (t: Transaction) => {
    if (!t.referenceId) return;
    setSelectedTransaction(t);
    setLoadingDetail(true);
    try {
      let collectionName = '';
      if (t.category === 'Billing') collectionName = 'invoices';
      else if (t.category === 'Payroll') collectionName = 'payrolls';
      else if (t.category === 'Cash Advance') collectionName = 'cashAdvances';

      if (collectionName) {
        const d = await getDoc(doc(db, collectionName, t.referenceId));
        if (d.exists()) {
          setDetailData({ ...d.data(), id: d.id });
        } else {
          setDetailData(null);
        }
      }
    } catch (e) {
      console.error(e);
      setDetailData(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const deleteTransaction = async (t: Transaction) => {
    try {
      await deleteDoc(doc(db, 'transactions', t.id));
      if (t.accountId) {
        try {
          const accountRef = doc(db, 'accounts', t.accountId);
          // Try to get fresh doc state from server, but fallback to regular getDoc if unavailable
          let accountSnap;
          try {
            accountSnap = await getDocFromServer(accountRef);
          } catch (serverError: any) {
            console.warn("getDocFromServer failed, falling back to cached getDoc:", serverError);
            accountSnap = await getDoc(accountRef);
          }
          
          if (accountSnap.exists()) {
            await updateDoc(accountRef, {
              balance: increment(t.type === 'income' ? -t.amount : t.amount)
            });
          }
        } catch (accError) {
          console.warn("Could not update account balance (account likely deleted):", accError);
        }
      }
      setItemToDelete(null);
    } catch (e) {
      console.error("Error deleting transaction:", e);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualTransaction.accountIds.length === 0 || manualTransaction.amount <= 0) return;

    try {
      const splitAmount = manualTransaction.amount / manualTransaction.accountIds.length;
      
      // If multiple accounts are selected, record a transaction for each
      for (const accId of manualTransaction.accountIds) {
        await recordTransaction(
          accId,
          manualTransaction.type,
          splitAmount,
          manualTransaction.category,
          manualTransaction.accountIds.length > 1 
            ? `${manualTransaction.description || manualTransaction.category} (Split)`
            : (manualTransaction.description || manualTransaction.category),
          undefined,
          user?.uid,
          manualTransaction.date,
          manualTransaction.department
        );
      }

      setIsTransactionModalOpen(false);
      setManualTransaction({
        accountIds: [],
        type: 'income',
        amount: 0,
        category: 'Daily Operation',
        department: 'container',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (e) {
      console.error(e);
    }
  };

  const filteredAccounts = accounts.filter(acc => {
    if (activeTab === 'all') return true;
    return acc.department === activeTab;
  });

  const totalBalance = filteredAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  
  const filteredTransactions = transactions.filter(t => {
    if (activeTab === 'all') return true;
    return t.department === activeTab;
  });

  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">Finance</h1>
          <p className="text-slate-400">Master ledger and financial overview</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              const defaultAcc = filteredAccounts.find(a => a.isDefault)?.id || filteredAccounts[0]?.id;
              setManualTransaction(prev => ({
                ...prev, 
                accountIds: defaultAcc ? [defaultAcc] : [],
                department: (activeTab === 'all' || activeTab === 'supplies') ? 'container' : activeTab as any
              }));
              setIsTransactionModalOpen(true);
            }} 
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-500 transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
          >
              <PlusCircle className="w-4 h-4"/> Record Entry
          </button>
          <button onClick={() => {
            setNewAccount({ name: '', type: 'cash', balance: 0, isDefault: false, department: (activeTab === 'all' || activeTab === 'supplies') ? 'other' : activeTab as any });
            setIsAddAccountOpen(true);
          }} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-500 transition-all active:scale-95">
              <Plus className="w-4 h-4"/> New Account
          </button>
        </div>
      </header>

      {/* Tabs Section */}
      <div className="flex gap-1 p-1 bg-slate-950/50 border border-white/5 rounded-xl max-w-full overflow-x-auto custom-scrollbar scroll-smooth snap-x">
        <button
          onClick={() => setActiveTab('all')}
          className={`snap-start shrink-0 px-2 sm:px-3 py-1.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab('container')}
          className={`snap-start shrink-0 px-2 sm:px-3 py-1.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'container' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
        >
          Container
        </button>
        <button
          onClick={() => setActiveTab('junkshop')}
          className={`snap-start shrink-0 px-2 sm:px-3 py-1.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'junkshop' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
        >
          Junkshop
        </button>
        <button
          onClick={() => setActiveTab('supplies')}
          className={`snap-start shrink-0 px-2 sm:px-3 py-1.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'supplies' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
        >
          Daily Supplies
        </button>
      </div>

      {activeTab === 'supplies' ? (
        <DailySupplies />
      ) : (
        <>
          {/* Account Overview Cards */}
          {filteredAccounts.length === 0 ? (
        <div className="bg-indigo-600/10 border border-indigo-500/20 p-8 rounded-3xl text-center">
            <Wallet className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">No accounts for this department</h2>
            <p className="text-slate-400 max-w-md mx-auto mb-6">Create an account or select another department to view financial movements.</p>
            <button onClick={() => {
              setNewAccount({ name: '', type: 'cash', balance: 0, isDefault: false, department: activeTab === 'all' ? 'other' : activeTab as any });
              setIsAddAccountOpen(true);
            }} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-500 transition-all">
                Create First Account
            </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-3xl border border-white/10 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white/70 text-[10px] font-black uppercase tracking-widest">
                  {activeTab === 'all' ? 'Consolidated Net Worth' : `${activeTab} Net Worth`}
                </h3>
                <Wallet className="w-4 h-4 text-white/50" />
              </div>
              <p className="text-3xl font-black text-white tracking-tight">₱{totalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          </div>
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Inflow</h3>
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-white tracking-tight text-emerald-400">₱{totalIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          </div>
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Outflow</h3>
                <ArrowDownRight className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-2xl font-black text-white tracking-tight text-rose-400">₱{totalExpense.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          </div>
        </div>
      )}

      {/* Account Cards */}
      {filteredAccounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {filteredAccounts.map(acc => (
            <div key={acc.id} className="bg-slate-900/80 p-5 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all">
                <div className='flex items-center justify-between mb-3'>
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${acc.type === 'cash' ? 'bg-emerald-500/10 text-emerald-400' : acc.type === 'bank' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                      {acc.type === 'cash' ? <Banknote className='w-4 h-4'/> : acc.type === 'bank' ? <Building2 className='w-4 h-4' /> : <CreditCard className='w-4 h-4' />}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase truncate max-w-[100px]">{acc.name}</h3>
                      {acc.department && activeTab === 'all' && (
                        <p className="text-[7px] font-black uppercase text-indigo-400 tracking-tighter">{acc.department}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {acc.isDefault && <span className="text-[8px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-black">DEFAULT</span>}
                    <button onClick={() => openEdit(acc)} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white">
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => setItemToDelete({ id: acc.id, type: 'account' })} className="p-1 hover:bg-rose-500/10 rounded text-slate-400 hover:text-rose-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-xl font-black text-white tracking-tight">₱{acc.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
          ))}
        </div>
      )}
      
      {/* Transaction List */}
      <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">
            {activeTab === 'all' ? 'Recent Transactions' : activeTab === 'container' ? 'Container Movements' : 'Junkshop Movements'}
          </h2>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{filteredTransactions.length} entries</span>
        </div>
        <div className="space-y-4">
          {filteredTransactions.map(t => (
            <div 
              key={t.id} 
              className={`flex justify-between items-center bg-slate-800/30 p-4 rounded-xl transition-all group ${t.referenceId ? 'cursor-pointer hover:bg-slate-800/50 border border-transparent hover:border-white/10' : ''}`}
            >
              <div onClick={() => handleTransactionClick(t)} className="flex-1">
                <div className='flex items-center gap-2'>
                  <p className='font-bold text-white'>{t.description}</p>
                  {t.department && t.department !== 'other' && activeTab === 'all' && (
                    <span className="text-[8px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">
                      {t.department}
                    </span>
                  )}
                  {t.referenceId && <span className='text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded uppercase font-black tracking-tighter'>Details Available</span>}
                </div>
                <p className='text-xs text-slate-400'>{t.category} • {new Date(t.date).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-4">
                <p className={`text-sm font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'} whitespace-nowrap`}>
                  {t.type === 'income' ? '+' : '-'}₱{t.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </p>
                <button 
                  onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: t.id, type: 'transaction', transaction: t }); }}
                  className="p-2 bg-white/5 hover:bg-rose-500/10 rounded-lg text-slate-500 hover:text-rose-400 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${selectedTransaction.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {selectedTransaction.category === 'Billing' ? <FileText /> : selectedTransaction.category === 'Payroll' ? <Receipt /> : <Wallet />}
                </div>
                <div>
                  <h2 className='text-2xl font-black text-white tracking-tight uppercase'>{selectedTransaction.category} Detail</h2>
                  <p className="text-slate-400 text-sm">{selectedTransaction.description}</p>
                </div>
              </div>
              <button onClick={() => setSelectedTransaction(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <X className="text-slate-400" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="animate-pulse space-y-4">
                <div className="h-20 bg-white/5 rounded-2xl"></div>
                <div className="h-40 bg-white/5 rounded-2xl"></div>
              </div>
            ) : detailData ? (
              <div className="space-y-6">
                {selectedTransaction.category === 'Billing' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Invoice Info</p>
                        <p className="text-white font-bold tracking-tight">#{detailData.invoiceNumber}</p>
                        <p className="text-slate-400 text-xs truncate">{detailData.customerName || 'No Customer Name'}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl text-right border border-white/5">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Amount</p>
                        <p className="text-emerald-400 text-lg font-black tracking-tight">₱{detailData.totalSum?.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-3 px-1">Attached Containers</h3>
                      <div className="space-y-2">
                        {detailData.containers?.map((c: any, i: number) => (
                          <div key={i} className="bg-white/5 p-3 rounded-xl flex justify-between items-center border border-white/5">
                            <div>
                              <p className="text-white font-bold text-sm tracking-tight">{c.code}</p>
                              {c.note && <p className="text-slate-500 text-[10px] italic">{c.note}</p>}
                            </div>
                            <div className="text-right">
                              <p className="text-white font-bold text-sm">₱{c.price.toLocaleString()}</p>
                              <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded uppercase font-black">{c.type}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {selectedTransaction.category === 'Payroll' && (
                  <>
                    <div className="bg-white/5 p-5 rounded-2x border border-white/5 space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Employee</p>
                        <p className="text-white font-bold text-xs">{employees.find(e => e.id === detailData.employeeId)?.fullName || 'Unknown Employee'}</p>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Pay Period</p>
                        <p className="text-white font-bold text-xs">{detailData.startDate} — {detailData.endDate}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Gross Pay</p>
                          <p className="text-white font-bold">₱{detailData.totalGrossPay?.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Deductions</p>
                          <p className="text-rose-400 font-bold">₱{detailData.cashAdvanceDeduction?.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    {detailData.cashAdvanceDetails?.length > 0 && (
                      <div>
                        <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-2 px-1 text-rose-400/80">Cash Advance Deducted</h3>
                        <div className="bg-rose-500/5 p-3 rounded-xl space-y-1 border border-rose-500/10">
                          {detailData.cashAdvanceDetails.map((d: string, i: number) => (
                            <p key={i} className="text-rose-400 text-[10px]">• {d}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {detailData.pakyawItems?.length > 0 && (
                      <div>
                        <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-2 px-1">Pakyaw Jobs Included</h3>
                        <div className="space-y-1">
                          {detailData.pakyawItems.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs bg-white/5 p-3 rounded-xl border border-white/5">
                              <span className="text-slate-400">{item.description}</span>
                              <span className="text-white font-bold tracking-tight">₱{item.amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {selectedTransaction.category === 'Cash Advance' && (
                  <div className="space-y-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center mb-4">
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Employee</p>
                        <p className="text-white font-bold text-xs">{employees.find(e => e.id === detailData.employeeId)?.fullName || 'Unknown Employee'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Original Amount</p>
                        <p className="text-white text-xl font-black tracking-tight">₱{detailData.amount?.toLocaleString()}</p>
                      </div>
                      <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Remaining Balance</p>
                        <p className={`text-xl font-black tracking-tight ${detailData.remainingBalance === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          ₱{detailData.remainingBalance?.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {detailData.deductions?.length > 0 && (
                      <div>
                        <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-3 px-1">Repayment History</h3>
                        <div className="space-y-2">
                          {detailData.deductions.map((d: any, i: number) => (
                            <div key={i} className="flex justify-between items-center text-xs bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                              <div className="flex items-center gap-2">
                                <Receipt className="w-3 h-3 text-slate-400" />
                                <span className="text-slate-400">Payroll Deduction • {new Date(d.date).toLocaleDateString()}</span>
                              </div>
                              <span className="text-emerald-400 font-bold tracking-tight">-₱{d.amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 space-y-4 bg-white/5 rounded-3xl border border-white/5">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                    <Search className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-slate-500 font-bold">Document Archive Not Found</p>
                <p className="text-slate-600 text-[10px] font-mono">REF: {selectedTransaction.referenceId}</p>
              </div>
            )}
            <div className="mt-8 pt-6 border-t border-white/5">
                <button onClick={() => setSelectedTransaction(null)} className="w-full py-3 bg-white/5 text-white font-bold rounded-2xl uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all">
                    Close Details
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Transaction Modal */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Record Financial Entry</h2>
              <button onClick={() => setIsTransactionModalOpen(false)} className="text-slate-500 hover:text-white">
                <X />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setManualTransaction({ ...manualTransaction, type: 'expense' })}
                  className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${manualTransaction.type === 'expense' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setManualTransaction({ ...manualTransaction, type: 'income' })}
                  className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${manualTransaction.type === 'income' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Income
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 tracking-[0.2em]">Select Account(s)</label>
                <div className="space-y-2 max-h-[150px] overflow-y-auto p-3 bg-slate-800 rounded-xl border border-white/5">
                   {filteredAccounts.map(acc => (
                     <label key={acc.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer group">
                       <div className="flex items-center gap-2">
                         <input 
                           type="checkbox"
                           className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                           checked={manualTransaction.accountIds.includes(acc.id)}
                           onChange={(e) => {
                             const ids = e.target.checked 
                               ? [...manualTransaction.accountIds, acc.id]
                               : manualTransaction.accountIds.filter(id => id !== acc.id);
                             setManualTransaction({...manualTransaction, accountIds: ids});
                           }}
                         />
                         <span className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{acc.name}</span>
                       </div>
                       <span className="text-[10px] font-mono text-slate-400">₱{acc.balance.toLocaleString()}</span>
                     </label>
                   ))}
                </div>
                {manualTransaction.accountIds.length > 1 && (
                  <p className="text-[9px] text-indigo-400 italic font-medium ml-1">Amount will be split equally between {manualTransaction.accountIds.length} accounts</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Department</label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualTransaction({ ...manualTransaction, department: 'container' })}
                    className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${manualTransaction.department === 'container' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-white/5 text-slate-400 hover:text-white'}`}
                  >
                    Container
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualTransaction({ ...manualTransaction, department: 'junkshop' })}
                    className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${manualTransaction.department === 'junkshop' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-white/5 text-slate-400 hover:text-white'}`}
                  >
                    Junkshop
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualTransaction({ ...manualTransaction, department: 'supplies' })}
                    className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${manualTransaction.department === 'supplies' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-white/5 text-slate-400 hover:text-white'}`}
                  >
                    Supplies
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualTransaction({ ...manualTransaction, department: 'other' })}
                    className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${manualTransaction.department === 'other' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-white/5 text-slate-400 hover:text-white'}`}
                  >
                    Other
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Date</label>
                  <input
                    required
                    type="date"
                    className="w-full bg-slate-800 border border-white/5 p-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={manualTransaction.date}
                    onChange={e => setManualTransaction({ ...manualTransaction, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Amount</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-white/5 p-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={manualTransaction.amount || ''}
                    onChange={e => setManualTransaction({ ...manualTransaction, amount: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Category</label>
                <select
                  required
                  className="w-full bg-slate-800 border border-white/5 p-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={manualTransaction.category}
                  onChange={e => setManualTransaction({ ...manualTransaction, category: e.target.value })}
                >
                  <option value="Daily Operation">Daily Operation</option>
                  <option value="Utility">Utility</option>
                  <option value="Transport">Transport</option>
                  <option value="Supplies">Supplies</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Wages">Wages</option>
                  <option value="Rent">Rent</option>
                  <option value="Personal">Personal</option>
                  <option value="Other Business">Other Business</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Electricity bill, fuel for truck..."
                  className="w-full bg-slate-800 border border-white/5 p-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={manualTransaction.description}
                  onChange={e => setManualTransaction({ ...manualTransaction, description: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className={`w-full py-4 mt-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl ${manualTransaction.type === 'expense' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'} text-white active:scale-95`}
              >
                Record {manualTransaction.type}
              </button>
            </form>
          </div>
        </div>
      )}
      {isAddAccountOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl border border-white/10 space-y-4">
            <h2 className='text-xl font-bold text-white'>{editingId ? 'Edit Account' : 'New Account'}</h2>
            <input 
              className='w-full p-2 bg-slate-700 rounded text-white' 
              placeholder='Account Name' 
              value={newAccount.name}
              onChange={e => setNewAccount({...newAccount, name: e.target.value})} 
            />
            <select 
              className='w-full p-2 bg-slate-700 rounded text-white' 
              value={newAccount.type}
              onChange={e => setNewAccount({...newAccount, type: e.target.value as any})}
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="wallet">E-Wallet</option>
            </select>
            <input 
              type='number' 
              className='w-full p-2 bg-slate-700 rounded text-white' 
              placeholder='Balance' 
              value={newAccount.balance}
              onChange={e => setNewAccount({...newAccount, balance: parseFloat(e.target.value)})} 
            />
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Department</label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setNewAccount({ ...newAccount, department: 'container' })}
                  className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${newAccount.department === 'container' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-white/5 text-slate-400 hover:text-white'}`}
                >
                  Container
                </button>
                <button
                  type="button"
                  onClick={() => setNewAccount({ ...newAccount, department: 'junkshop' })}
                  className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${newAccount.department === 'junkshop' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-white/5 text-slate-400 hover:text-white'}`}
                >
                  Junkshop
                </button>
                <button
                  type="button"
                  onClick={() => setNewAccount({ ...newAccount, department: 'supplies' })}
                  className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${newAccount.department === 'supplies' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-white/5 text-slate-400 hover:text-white'}`}
                >
                  Supplies
                </button>
                <button
                  type="button"
                  onClick={() => setNewAccount({ ...newAccount, department: 'other' })}
                  className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${newAccount.department === 'other' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-white/5 text-slate-400 hover:text-white'}`}
                >
                  General
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-slate-300">
              <input 
                type="checkbox" 
                checked={newAccount.isDefault}
                onChange={e => setNewAccount({...newAccount, isDefault: e.target.checked} as any)} 
              />
              <span className="text-sm">Set as Default Account</span>
            </label>
            <div className='flex gap-2 pt-2'>
              <button onClick={() => { setIsAddAccountOpen(false); setEditingId(null); }} className='w-full p-2 rounded bg-slate-600 text-white font-bold'>Cancel</button>
              <button onClick={addAccount} className='w-full p-2 rounded bg-indigo-600 text-white font-bold tracking-tight uppercase font-black'>{editingId ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Confirm Deletion</h2>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              {itemToDelete.type === 'account' 
                ? 'Are you sure you want to delete this account? Historical transactions will be preserved but the account will no longer be available for new records.'
                : 'Are you sure you want to delete this transaction? This action will permanently remove the record and reverse the balance impact on the associated account.'
              }
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => itemToDelete.type === 'account' ? deleteAccount(itemToDelete.id) : deleteTransaction(itemToDelete.transaction!)}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-600/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
