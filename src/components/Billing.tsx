import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Invoice, InvoiceItem } from '../types';
import { Search, Plus, FileText, Trash2, Edit2, Package, Save, X, PlusCircle, Trash } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { format, parseISO } from 'date-fns';

export default function Billing() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    invoiceNumber: '',
    customerName: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending' as 'pending' | 'paid' | 'cancelled',
    containers: [] as InvoiceItem[]
  });

  const [newContainer, setNewContainer] = useState({ code: '', note: '', price: '' });

  const totalSum = form.containers.reduce((acc, curr) => acc + (curr.price || 0), 0);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Invoice[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Invoice);
      });
      setInvoices(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'invoices');
    });
    return () => unsubscribe();
  }, [user]);

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

      if (editingId) {
        await updateDoc(doc(db, 'invoices', editingId), invoiceData);
      } else {
        await addDoc(collection(db, 'invoices'), {
          ...invoiceData,
          createdAt: new Date().toISOString()
        });
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
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await deleteDoc(doc(db, 'invoices', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'invoices');
    }
  };

  const addContainerItem = () => {
    if (!newContainer.code) return;
    const priceAuto = parseFloat(newContainer.price) || 0;
    setForm({
      ...form,
      containers: [...form.containers, { 
        code: newContainer.code, 
        note: newContainer.note, 
        price: priceAuto 
      }]
    });
    setNewContainer({ code: '', note: '', price: '' });
  };

  const removeContainerItem = (index: number) => {
    const updated = [...form.containers];
    updated.splice(index, 1);
    setForm({ ...form, containers: updated });
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (inv.customerName && inv.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    inv.containers.some(c => c.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col relative w-full pt-2">
      <div className="px-4 mb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Billing & Invoices</h1>
          <Dialog open={isAddOpen} onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger render={<Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-2" />}>
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
                  <Label className="text-sm font-bold text-slate-700 mb-2 block">Container Codes</Label>
                  <div className="space-y-2 mb-3">
                    {form.containers.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.code}</div>
                            <div className="text-xs font-black text-indigo-600 truncate">₱{item.price?.toLocaleString()}</div>
                          </div>
                          {item.note && <div className="text-[10px] text-slate-500 truncate">{item.note}</div>}
                        </div>
                        <button 
                          type="button" 
                          onClick={() => removeContainerItem(idx)}
                          className="text-red-400 hover:text-red-600 shrink-0"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {form.containers.length === 0 && (
                      <div className="text-center py-2 text-xs text-slate-400 italic">No containers added yet.</div>
                    )}
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        placeholder="Code (e.g. C-123)"
                        value={newContainer.code}
                        onChange={e => setNewContainer({...newContainer, code: e.target.value})}
                        className="text-xs h-8"
                      />
                      <Input 
                        type="number"
                        placeholder="Price (₱)"
                        value={newContainer.price}
                        onChange={e => setNewContainer({...newContainer, price: e.target.value})}
                        className="text-xs h-8"
                      />
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
                      className="w-full text-xs h-8 flex items-center gap-2 border-dashed border-indigo-200 text-indigo-600"
                    >
                      <PlusCircle className="w-4 h-4" /> Add Container
                    </Button>
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
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(invoice.id)} className="h-7 w-7 text-slate-400 hover:text-red-500">
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
                             <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.code}</span>
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
    </div>
  );
}
