import React, { useState, useEffect } from 'react';
import { recordTransaction } from '../services/financeService';
import { collection, onSnapshot, addDoc, updateDoc, query, orderBy, deleteDoc, doc, getDoc, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Invoice, InvoiceItem } from '../types';
import { Search, Plus, FileText, Trash2, Edit2, Package, Save, X, PlusCircle, Trash, History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { format, parseISO } from 'date-fns';

export default function Billing() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [repairedContainers, setRepairedContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [form, setForm] = useState({
    invoiceNumber: '',
    customerName: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending' as 'pending' | 'paid' | 'cancelled',
    containers: [] as InvoiceItem[]
  });

  const [newContainer, setNewContainer] = useState({ code: '', note: '', price: '' });
  const [editingContainerIndex, setEditingContainerIndex] = useState<number | null>(null);
  const [viewHistoryCode, setViewHistoryCode] = useState<string | null>(null);

  const totalSum = form.containers.reduce((acc, curr) => acc + (curr.price || 0), 0);

  useEffect(() => {
    if (!user) return;
    const qInvoices = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
    const unsubscribeInvoices = onSnapshot(qInvoices, (snapshot) => {
      const list: Invoice[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Invoice);
      });
      setInvoices(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'invoices');
    });

    const qContainers = query(collection(db, 'containerRepairs'), orderBy('createdAt', 'desc'));
    const unsubscribeContainers = onSnapshot(qContainers, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRepairedContainers(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'containerRepairs');
    });

    return () => {
      unsubscribeInvoices();
      unsubscribeContainers();
    };
  }, [user]); // Removed invoices from dependency array to avoid unnecessary re-subscriptions

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.invoiceNumber) return;

    try {
      const invoiceData = {
        invoiceNumber: form.invoiceNumber,
        customerName: form.customerName,
        date: form.date,
        status: form.status,
        containers: form.containers,
        totalSum: totalSum,
        updatedAt: new Date().toISOString(),
        uid: user.uid
      };
      
      let wasPaid = false;
      let oldTotalSum = 0;
      const invoiceRef = editingId ? doc(db, 'invoices', editingId) : null;

      if (editingId && invoiceRef) {
        const oldDoc = await getDoc(invoiceRef);
        const oldData = oldDoc.data();
        wasPaid = oldData?.status === 'paid';
        oldTotalSum = oldData?.totalSum || 0;
      }

      let referenceId = editingId;
      if (editingId && invoiceRef) {
        await updateDoc(invoiceRef, invoiceData);
      } else {
        const docRef = await addDoc(collection(db, 'invoices'), {
          ...invoiceData,
          createdAt: new Date().toISOString()
        });
        referenceId = docRef.id;
      }

      if (form.status === 'paid' && !wasPaid) {
        // Find a cash account
        console.log('Recording income transaction for invoice:', form.invoiceNumber, totalSum);
        const cashAccQ = query(collection(db, 'accounts'), where('type', '==', 'cash'));
        const accSnap = await getDocs(cashAccQ);
        const accountId = accSnap.empty ? null : accSnap.docs[0].id;
        
        await recordTransaction(
            accountId,
            'income',
            totalSum,
            'Billing',
            `Payment for Invoice #${form.invoiceNumber}`,
            referenceId || 'inv-paid',
            user.uid
        );
        console.log('Transaction recorded successfully');
      } else if (wasPaid && form.status !== 'paid') {
        // REVERSAL LOGIC: Invoice was previously paid, now it's not.
        // Record a negative transaction (expense) to correct the balance.
        console.log('Recording reversal for invoice:', form.invoiceNumber, oldTotalSum);
        const cashAccQ = query(collection(db, 'accounts'), where('type', '==', 'cash'));
        const accSnap = await getDocs(cashAccQ);
        const accountId = accSnap.empty ? null : accSnap.docs[0].id;

        await recordTransaction(
            accountId,
            'expense', // Correct balance by recording as expense (or adjustment)
            oldTotalSum,
            'Billing',
            `Reversal of Payment for Invoice #${form.invoiceNumber} (Status changed to ${form.status})`,
            referenceId ? `${referenceId}-reversal` : 'inv-reversal',
            user.uid
        );
        console.log('Reversal transaction recorded');
      }

      setIsAddOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'invoices');
    }
  };

  const resetForm = () => {
    setForm({
      invoiceNumber: '',
      customerName: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      status: 'pending',
      containers: []
    });
    setEditingId(null);
    setNewContainer({ code: '', note: '', price: '' });
    setEditingContainerIndex(null);
  };

  const openEdit = (invoice: Invoice) => {
    setEditingId(invoice.id);
    setForm({
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName || '',
      date: invoice.date,
      status: invoice.status,
      containers: invoice.containers || []
    });
    setIsAddOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const invoiceRef = doc(db, 'invoices', id);
      const invoiceSnap = await getDoc(invoiceRef);
      if (invoiceSnap.exists()) {
        const data = invoiceSnap.data();
        if (data.status === 'paid') {
          // Find a cash account
          const cashAccQ = query(collection(db, 'accounts'), where('type', '==', 'cash'));
          const accSnap = await getDocs(cashAccQ);
          const accountId = accSnap.empty ? null : accSnap.docs[0].id;

          await recordTransaction(
            accountId,
            'expense',
            data.totalSum || 0,
            'Billing',
            `Reversal: Invoice #${data.invoiceNumber} deleted`,
            `${id}-reversal`,
            user?.uid
          );
        }
      }
      await deleteDoc(invoiceRef);
      setDeleteConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'invoices');
    }
  };

  const addContainerItem = () => {
    if (!newContainer.code || !newContainer.price) return;
    const priceAuto = parseFloat(newContainer.price) || 0;
    
    const updatedContainers = [...form.containers];
    
    // Try to infer type from repairedContainers if it matches
    const matchedRepaired = repairedContainers.find(c => {
      const codeDisplay = c.type === 'foreign' ? `${c.localCode} - ${c.foreignCode}` : `${c.localCode} - ${c.localCode}`;
      return codeDisplay === newContainer.code;
    });

    const newItem: InvoiceItem = { 
      code: newContainer.code, 
      note: newContainer.note, 
      price: priceAuto,
      type: matchedRepaired ? matchedRepaired.type as 'local' | 'foreign' : undefined
    };

    if (editingContainerIndex !== null) {
      updatedContainers[editingContainerIndex] = newItem;
    } else {
      updatedContainers.push(newItem);
    }

    setForm({
      ...form,
      containers: updatedContainers
    });
    setNewContainer({ code: '', note: '', price: '' });
    setEditingContainerIndex(null);
  };

  const editContainerItem = (index: number) => {
    const item = form.containers[index];
    setNewContainer({
      code: item.code,
      note: item.note || '',
      price: item.price.toString()
    });
    setEditingContainerIndex(index);
  };

  const removeContainerItem = (index: number) => {
    const updated = [...form.containers];
    updated.splice(index, 1);
    setForm({ ...form, containers: updated });
    if (editingContainerIndex === index) {
      setEditingContainerIndex(null);
      setNewContainer({ code: '', note: '', price: '' });
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (inv.customerName && inv.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    inv.containers.some(c => c.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col relative w-full pt-2">
      <div className="px-4 mb-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Billing & Invoices</h1>
          <Dialog open={isAddOpen} onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              resetForm();
            } else if (!editingId) {
               // Automatically add unbilled repaired containers for a new invoice
               const billedCodes = invoices.flatMap(inv => (inv.containers || []).map(c => c.code));
               const unbilled = repairedContainers.filter(c => {
                 const code = c.type === 'foreign' ? `${c.localCode} - ${c.foreignCode}` : `${c.localCode} - ${c.localCode}`;
                 return c.status === 'repaired' && code && !billedCodes.includes(code);
               });
               if (unbilled.length > 0) {
                 setForm(prev => ({
                   ...prev,
                   containers: unbilled.map(c => ({
                     code: c.type === 'foreign' ? `${c.localCode} - ${c.foreignCode}` : `${c.localCode} - ${c.localCode}`,
                     note: c.note || '',
                     price: 17000,
                     type: c.type
                   }))
                 }));
               }
            }
          }}>
            <DialogTrigger render={<Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center gap-2" />}>
              <Plus className="w-5 h-5" /> Create Invoice
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Invoice' : 'Create New Invoice'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveInvoice} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Invoice #</Label>
                    <Input 
                      required
                      placeholder="INV-001"
                      value={form.invoiceNumber}
                      onChange={e => setForm({...form, invoiceNumber: e.target.value})}
                      className="rounded-xl border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Date</Label>
                    <Input 
                      type="date"
                      value={form.date}
                      onChange={e => setForm({...form, date: e.target.value})}
                      className="rounded-xl border-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Customer / Name</Label>
                  <Input 
                    placeholder="Customer Name"
                    value={form.customerName}
                    onChange={e => setForm({...form, customerName: e.target.value})}
                    className="rounded-xl border-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</Label>
                  <select 
                    value={form.status}
                    onChange={e => setForm({...form, status: e.target.value as any})}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-2">
                  <div className="flex items-center justify-between mt-2 mb-2">
                    <Label className="text-sm font-bold text-slate-700">Container Codes</Label>
                    {repairedContainers.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const existingCodes = form.containers.map(c => c.code);
                          const toAdd = repairedContainers
                            .filter(c => {
                              const codeDisplay = c.type === 'foreign' ? `${c.localCode} - ${c.foreignCode}` : `${c.localCode} - ${c.localCode}`;
                              const isBilled = invoices.some(inv => inv.status !== 'cancelled' && inv.containers.some(ic => ic.code === codeDisplay));
                              return c.status === 'repaired' && codeDisplay && !existingCodes.includes(codeDisplay) && !isBilled;
                            })
                            .map(c => ({
                              code: c.type === 'foreign' ? `${c.localCode} - ${c.foreignCode}` : `${c.localCode} - ${c.localCode}`,
                              note: c.note || '',
                              price: 17000,
                              type: c.type
                            }));
                          
                          if (toAdd.length > 0) {
                            setForm({
                              ...form,
                              containers: [...form.containers, ...toAdd]
                            });
                          }
                        }}
                        className="text-xs h-7 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      >
                        Auto-add Repaired
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2 mb-3">
                    {form.containers.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={() => setViewHistoryCode(item.code)}
                                className="text-xs font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline flex items-center gap-1 text-left min-w-0 flex-1"
                              >
                                <History className="w-3 h-3 shrink-0" />
                                <span className="">{item.code}</span>
                              </button>
                               {item.type && (
                                 <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                                   item.type === 'foreign' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                 }`}>
                                   {item.type === 'foreign' ? 'F' : 'L'}
                                 </span>
                               )}
                            </div>
                            <div className="text-xs font-black text-indigo-600 truncate">₱{item.price?.toLocaleString()}</div>
                          </div>
                          {item.note && <div className="text-[10px] text-slate-500 truncate">{item.note}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            type="button" 
                            onClick={() => editContainerItem(idx)}
                            className="text-slate-400 hover:text-indigo-600 p-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => removeContainerItem(idx)}
                            className="text-slate-400 hover:text-red-600 p-1"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {form.containers.length === 0 && (
                      <div className="text-center py-2 text-xs text-slate-400 italic">No containers added yet.</div>
                    )}
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl space-y-3">
                    {repairedContainers.length > 0 && (
                      <select
                        value=""
                        onChange={e => {
                          const code = e.target.value;
                          if (!code) return;
                          const selected = repairedContainers.find(c => (c.type === 'foreign' ? `${c.localCode} - ${c.foreignCode}` : `${c.localCode} - ${c.localCode}`) === code);
                          if (selected) {
                            setNewContainer({
                              code: code,
                              note: selected.note || '',
                              price: selected.type === 'foreign' ? '17000' : '17000'
                            });
                          }
                        }}
                        className="w-full text-xs h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Select Repaired Container...</option>
                        {repairedContainers
                          .filter(c => {
                            const codeDisplay = c.type === 'foreign' ? `${c.localCode} - ${c.foreignCode}` : `${c.localCode} - ${c.localCode}`;
                            const isBilled = invoices.some(inv => inv.status !== 'cancelled' && inv.containers.some(ic => ic.code === codeDisplay));
                            return c.status === 'repaired' && codeDisplay && !form.containers.some(fc => fc.code === codeDisplay) && !isBilled;
                          })
                          .map(c => {
                            const codeDisplay = c.type === 'foreign' ? `${c.localCode} - ${c.foreignCode}` : `${c.localCode} - ${c.localCode}`;
                            return (
                              <option key={c.id} value={codeDisplay || ''}>
                                {codeDisplay} ({c.type}) {c.note ? `- ${c.note}` : ''}
                              </option>
                            );
                          })}
                      </select>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        placeholder="Code (e.g. C-123)"
                        value={newContainer.code}
                        onChange={e => setNewContainer({...newContainer, code: e.target.value.toUpperCase()})}
                        className="text-xs h-8"
                      />
                      <select
                        value={newContainer.price}
                        onChange={e => setNewContainer({...newContainer, price: e.target.value})}
                        className="w-full text-xs h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Select Price</option>
                        <option value="15000">₱15,000 - No Top Board</option>
                        <option value="17000">₱17,000 - Fully Repaired</option>
                      </select>
                    </div>
                    <Input 
                      placeholder="Note (optional)"
                      value={newContainer.note}
                      onChange={e => setNewContainer({...newContainer, note: e.target.value})}
                      className="text-xs h-8"
                    />
                    <Button 
                      type="button" 
                      onClick={addContainerItem}
                      variant="outline" 
                      className={`w-full text-xs h-8 flex items-center gap-2 border-dashed ${
                        editingContainerIndex !== null 
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                          : 'border-indigo-200 text-indigo-600'
                      }`}
                    >
                      {editingContainerIndex !== null ? (
                        <>
                          <Save className="w-4 h-4" /> Update Item
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-4 h-4" /> Add Container
                        </>
                      )}
                    </Button>
                    {editingContainerIndex !== null && (
                      <Button 
                        type="button" 
                        onClick={() => {
                          setEditingContainerIndex(null);
                          setNewContainer({ code: '', note: '', price: '' });
                        }}
                        variant="ghost" 
                        className="w-full text-xs h-8"
                      >
                        Cancel Edit
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-700">Total Sum:</span>
                    <span className="text-lg font-black text-indigo-600">₱{totalSum.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-indigo-600 text-white rounded-xl px-8">
                    {editingId ? 'Update Invoice' : 'Create Invoice'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 transition-colors group-focus-within:text-indigo-500" />
          <Input 
            placeholder="Search invoice number, customer or container..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-12 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-20">
        {filteredInvoices.map(invoice => (
          <div key={invoice.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-500 border border-slate-200 dark:border-slate-700">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white">#{invoice.invoiceNumber}</h3>
                    <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded ${
                      invoice.status === 'paid' ? 'bg-green-100 text-green-700' : 
                      invoice.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {invoice.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{format(parseISO(invoice.date), 'MMMM dd, yyyy')}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-indigo-600">₱{invoice.totalSum?.toLocaleString() || '0'}</div>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(invoice)} className="h-7 w-7 text-slate-400 hover:text-blue-500">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(invoice.id)} className="h-7 w-7 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50/50 dark:bg-slate-900/20">
               {invoice.customerName && (
                 <div className="mb-3">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Customer</span>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{invoice.customerName}</p>
                 </div>
               )}
               
               <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Containers ({invoice.containers?.length || 0})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {invoice.containers?.map((c, i) => (
                      <div key={i} className="flex flex-col p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-2 mb-1">
                           <div className="flex items-center gap-1.5 min-w-0">
                             <Package className="w-3 h-3 text-indigo-500 shrink-0" />
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setViewHistoryCode(c.code);
                               }}
                               className="text-xs font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline flex items-center gap-1 text-left min-w-0 flex-1"
                             >
                               <span className="">{c.code}</span>
                             </button>
                             {c.type && (
                               <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                                 c.type === 'foreign' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                               }`}>
                                 {c.type === 'foreign' ? 'F' : 'L'}
                               </span>
                             )}
                           </div>
                           <span className="text-[10px] font-black text-indigo-600 shrink-0">₱{c.price?.toLocaleString()}</span>
                        </div>
                        {c.note && <p className="text-[10px] text-slate-500 dark:text-slate-400 italic line-clamp-1">{c.note}</p>}
                      </div>
                    ))}
                    {(!invoice.containers || invoice.containers.length === 0) && (
                      <div className="col-span-full py-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        No containers assigned to this invoice.
                      </div>
                    )}
                  </div>
               </div>
            </div>
          </div>
        ))}

        {filteredInvoices.length === 0 && !loading && (
          <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/20 rounded-3xl border border-slate-200 border-dashed dark:border-slate-800 flex flex-col items-center">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-4" />
            <p className="font-bold text-slate-600 dark:text-slate-400">No invoices found.</p>
            <p className="text-sm text-slate-400 mt-1">Start by creating your first billing invoice.</p>
          </div>
        )}
        
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Are you sure you want to delete this invoice? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="bg-transparent border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* History Dialog */}
      <Dialog open={!!viewHistoryCode} onOpenChange={(open) => !open && setViewHistoryCode(null)}>
        <DialogContent className="sm:max-w-[400px] bg-slate-900 border-slate-800 text-slate-100 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-400" />
              Status History
            </DialogTitle>
            <DialogDescription className="text-slate-400 flex flex-col pt-1">
              <span className="font-mono text-indigo-300 text-xs bg-indigo-500/10 px-2 py-1 rounded inline-flex self-start">
                Code: {viewHistoryCode}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4 space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
            {(() => {
              let activeContainer = repairedContainers.find(c => {
                const codeDisplay = c.type === 'foreign' ? `${c.localCode} - ${c.foreignCode}` : `${c.localCode} - ${c.localCode}`;
                return codeDisplay === viewHistoryCode;
              });

              if (!activeContainer) {
                // Try searching in invoices
                for (const inv of invoices) {
                   const found = inv.containers.find(c => c.code === viewHistoryCode);
                   if (found) {
                     activeContainer = { 
                       ...found,
                       history: [] // Since we don't have direct history here, maybe just show invoice history?
                     };
                     break;
                   }
                }
              }

              if (!activeContainer || !activeContainer.history || activeContainer.history.length === 0) {
                return (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    No history found for this container.
                  </div>
                );
              }

              // Include invoice details in history if container isbilled
              const historyWithInvoices = [...activeContainer.history];
              
              // Find if this container is on any invoice to add that to history as well
              const codeDisplay = activeContainer.type === 'foreign' ? `${activeContainer.localCode} - ${activeContainer.foreignCode}` : `${activeContainer.localCode} - ${activeContainer.localCode}`;
              const billedInvoices = invoices.filter(inv => inv.status !== 'cancelled' && inv.containers.some(ic => ic.code === codeDisplay));
              
              billedInvoices.forEach(inv => {
                 historyWithInvoices.push({
                   status: 'Invoiced',
                   timestamp: inv.createdAt,
                   note: `Invoiced as #${inv.invoiceNumber} for ${inv.customerName || 'Customer'}`,
                   updatedBy: 'system'
                 });
              });

              return historyWithInvoices.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((h: any, i: number) => (
                <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  {/* Timeline icon */}
                  <div className="flex items-center justify-center w-4 h-4 rounded-full border-4 border-slate-900 bg-slate-400 group-[.is-active]:bg-indigo-500 text-slate-500 group-[.is-active]:text-indigo-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 translate-x-[2px] md:translate-x-0"></div>
                  
                  {/* Card */}
                  <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-slate-800 border border-slate-700/50 shadow-md transform transition-all group-hover:scale-[1.02]">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        h.status === 'active' ? 'text-blue-400' :
                        h.status === 'repairing' ? 'text-amber-400' :
                        h.status === 'Invoiced' ? 'text-purple-400' :
                        'text-emerald-400'
                      }`}>
                        {h.status}
                      </span>
                      <time className="text-[10px] font-medium text-slate-500">
                        {new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </time>
                    </div>
                    {h.note && (
                      <p className="text-xs text-slate-300 mt-2 bg-slate-900/50 p-2 rounded-lg italic">
                        {h.note}
                      </p>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
          <DialogFooter className="pt-4 sm:justify-end border-t border-slate-800 mt-6">
            <Button variant="outline" onClick={() => setViewHistoryCode(null)} className="w-full sm:w-auto bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
