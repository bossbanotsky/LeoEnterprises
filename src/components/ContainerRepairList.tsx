import React, { useState, useEffect, useMemo } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc, deleteDoc, arrayUnion, where, getDocs, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { ContainerRepair, Invoice } from "../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Loader2, Plus, Wrench, Edit, Trash2 } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

export default function ContainerRepairList() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [containers, setContainers] = useState<ContainerRepair[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState<'local' | 'foreign'>('local');
  const [localCode, setLocalCode] = useState("");
  const [foreignCode, setForeignCode] = useState("");

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'active' | 'repairing' | 'repaired'>('active');
  const [status, setStatus] = useState<'active' | 'repairing' | 'repaired'>('active');
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!user) return;
    const qContainers = query(collection(db, "containerRepairs"), orderBy("createdAt", "desc"));
    const unsubContainers = onSnapshot(qContainers, (snapshot) => {
      const res: ContainerRepair[] = [];
      snapshot.forEach(d => res.push({ id: d.id, ...d.data() } as ContainerRepair));
      setContainers(res);
      setLoading(false);
    });

    const qInvoices = query(collection(db, "invoices"), orderBy("createdAt", "desc"));
    const unsubInvoices = onSnapshot(qInvoices, (snapshot) => {
      const res: Invoice[] = [];
      snapshot.forEach(d => res.push({ id: d.id, ...d.data() } as Invoice));
      setInvoices(res);
    });

    return () => {
        unsubContainers();
        unsubInvoices();
    };
  }, [user]);

  const filteredContainers = useMemo(() => {
    return containers.filter(c => {
        if ((c.status || 'active') !== activeTab) return false;
        
        // If it's in the repaired tab, check if it's already billed
        if (c.status === 'repaired') {
            const codeDisplay = c.type === 'foreign' ? `${c.localCode} - ${c.foreignCode}` : `${c.localCode} - ${c.localCode}`;
            const isBilled = invoices.some(inv => inv.status !== 'cancelled' && inv.containers.some(ic => ic.code === codeDisplay));
            return !isBilled;
        }
        return true;
    });
  }, [containers, activeTab, invoices]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setType('local');
    setLocalCode("");
    setForeignCode("");
    setStatus('active');
    setNote("");
    setIsAddOpen(true);
  };

  const handleOpenEdit = (c: ContainerRepair) => {
    setEditingId(c.id);
    setType(c.type);
    setLocalCode(c.localCode || "");
    setForeignCode(c.foreignCode || "");
    setStatus(c.status || 'active');
    setNote(c.note || "");
    setIsAddOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      // Fetch container to get code
      const docRef = doc(db, "containerRepairs", id);
      const containerDoc = await getDoc(docRef);
      const data = containerDoc.data() as ContainerRepair;

      if (data) {
        const containerCode = (data.type === 'foreign' ? `${data.localCode} - ${data.foreignCode}` : `${data.localCode} - ${data.localCode}`).trim();
        const q = query(collection(db, 'pakyawJobs'), where('containerNumber', '==', containerCode));
        const snapshot = await getDocs(q);
        for (const jobDoc of snapshot.docs) {
          // If we delete the container repair, should we delete the Pakyaw job?
          // User says "should be minus", delete the job seems equivalent to "minus".
          const attQuery = query(collection(db, 'attendance'), where('pakyawJobId', '==', jobDoc.id));
          const attSnapshot = await getDocs(attQuery);
          for (const attDoc of attSnapshot.docs) {
            await deleteDoc(attDoc.ref);
          }
          await deleteDoc(jobDoc.ref);
        }
      }

      await deleteDoc(docRef);
      showToast("Container Repair and associated jobs/attendance deleted successfully", "success");
      setDeleteConfirmId(null);
    } catch (error) {
      console.error(error);
      showToast("Failed to delete container repair", "error");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (type === 'local' && !localCode) {
      showToast("Local code is required for local containers.", "error");
      return;
    }
    if (type === 'foreign' && !foreignCode) {
      showToast("Foreign code is required for foreign containers.", "error");
      return;
    }

    setIsAdding(true);
    try {
      const historyEntry = {
        status,
        timestamp: new Date().toISOString(),
        note: note || null,
        updatedBy: user.uid,
      };

      if (editingId) {
        await setDoc(doc(db, "containerRepairs", editingId), {
          type,
          localCode: localCode || null,
          foreignCode: type === 'foreign' ? foreignCode : localCode,
          status,
          note: note || null,
          updatedAt: new Date().toISOString(),
          history: arrayUnion(historyEntry),
        }, { merge: true });
        
        // If status changed to repaired, complete associated Pakyaw jobs
        if (status === 'repaired') {
          const containerCode = (type === 'foreign' ? `${localCode} - ${foreignCode}` : `${localCode} - ${localCode}`).trim();
          console.log('Completing Pakyaw jobs for container:', containerCode);
          const q = query(
            collection(db, 'pakyawJobs'), 
            where('containerNumber', '==', containerCode),
            where('status', '==', 'pending')
          );
          const snapshot = await getDocs(q);
          console.log('Found Pakyaw jobs to complete. Count:', snapshot.size);
          for (const jobDoc of snapshot.docs) {
            console.log('Completing job:', jobDoc.id, 'Data:', jobDoc.data());
            await updateDoc(jobDoc.ref, { 
              status: 'completed',
              completedAt: new Date().toISOString()
            });
            
            // Also update attendance records to completed for this job
            const attQuery = query(collection(db, 'attendance'), where('pakyawJobId', '==', jobDoc.id));
            const attSnapshot = await getDocs(attQuery);
            console.log('Found attendance records to update:', attSnapshot.size);
            // No need to update status to 'completed' as this isn't a valid attendance status.
            // The job completion is tracked by 'status' in PakyawJob, which is used for calculation.
          }
        }
        
        showToast("Container Repair updated successfully", "success");
      } else {
        await addDoc(collection(db, "containerRepairs"), {
          type,
          localCode: localCode || null,
          foreignCode: type === 'foreign' ? foreignCode : localCode,
          status,
          note: note || null,
          createdAt: new Date().toISOString(),
          createdBy: user.uid,
          history: [historyEntry],
        });
        showToast("Container Repair added successfully", "success");
      }
      setIsAddOpen(false);
      setType('local');
      setLocalCode("");
      setForeignCode("");
    } catch (error) {
      console.error(error);
      showToast("Failed to save container repair", "error");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center bg-slate-900/40 p-6 rounded-2xl border border-white/5 shadow-xl">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4">
          <div className="w-12 h-12 shrink-0 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/20 shadow-inner">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Container Repair</h2>
            <p className="text-sm text-slate-400 mt-1">Manage local and foreign container repairs.</p>
          </div>
        </div>
        <Button onClick={handleOpenAdd} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg border border-indigo-500/50">
          <Plus className="w-4 h-4 mr-2" /> Add Container
        </Button>
      </div>

      <div className="flex space-x-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-t-lg transition-colors flex items-center gap-2 ${
            activeTab === 'active' ? 'bg-indigo-500/20 text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Waiting List
        </button>
        <button
          onClick={() => setActiveTab('repairing')}
          className={`px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-t-lg transition-colors flex items-center gap-2 ${
            activeTab === 'repairing' ? 'bg-amber-500/20 text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Repairing
        </button>
        <button
          onClick={() => setActiveTab('repaired')}
          className={`px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-t-lg transition-colors flex items-center gap-2 ${
            activeTab === 'repaired' ? 'bg-emerald-500/20 text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Repaired
        </button>
      </div>

      <div className="bg-slate-900/40 border border-white/5 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 text-slate-400 border-b border-white/5 uppercase tracking-wider text-[10px] font-black">
                  <th className="p-4">Type</th>
                  <th className="p-4">Foreign Code</th>
                  <th className="p-4">Local Code</th>
                  <th className="p-4">Note</th>
                  <th className="p-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-slate-300">
                {filteredContainers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No containers found.
                    </td>
                  </tr>
                ) : (
                  filteredContainers.map((c) => (
                    <tr key={c.id} onClick={() => handleOpenEdit(c)} className="hover:bg-slate-800/30 transition-colors cursor-pointer group">
                      <td className="p-4 font-bold">
                        <span className={`px-2 py-1 rounded text-xs uppercase tracking-widest ${
                          c.type === 'foreign' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                          'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}>
                          {c.type}
                        </span>
                      </td>
                      <td className="p-4 group-hover:text-white transition-colors whitespace-nowrap">{c.type === 'foreign' ? c.foreignCode || "-" : c.localCode || "-"}</td>
                      <td className="p-4 group-hover:text-white transition-colors whitespace-nowrap">{c.localCode || "-"}</td>
                      <td className="p-4 max-w-[200px] truncate group-hover:text-white transition-colors" title={c.note || ""}>{c.note || "-"}</td>
                      <td className="p-4 text-slate-400 text-xs whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} Container Repair</DialogTitle>
            <DialogDescription className="text-slate-400">{editingId ? "Edit an existing" : "Add a new"} local or foreign container</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Container Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={type === 'local'} onChange={() => setType('local')} className="text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700" />
                  <span className="text-sm">Local</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={type === 'foreign'} onChange={() => setType('foreign')} className="text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700" />
                  <span className="text-sm">Foreign</span>
                </label>
              </div>
            </div>

            {type === 'foreign' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Foreign Code *</label>
                <input
                  type="text"
                  required
                  value={foreignCode}
                  onChange={(e) => setForeignCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Enter foreign code"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Local Code {type === 'local' ? '*' : '(Optional)'}
              </label>
              <input
                type="text"
                required={type === 'local'}
                value={localCode}
                onChange={(e) => setLocalCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="Enter local code"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={status === 'active'} onChange={() => setStatus('active')} className="text-indigo-500 focus:ring-indigo-500 bg-slate-800 border-slate-700" />
                  <span className="text-sm text-indigo-400 font-bold uppercase tracking-widest">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={status === 'repairing'} onChange={() => setStatus('repairing')} className="text-amber-500 focus:ring-amber-500 bg-slate-800 border-slate-700" />
                  <span className="text-sm text-amber-500 font-bold uppercase tracking-widest">Repairing</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={status === 'repaired'} onChange={() => setStatus('repaired')} className="text-emerald-500 focus:ring-emerald-500 bg-slate-800 border-slate-700" />
                  <span className="text-sm text-emerald-500 font-bold uppercase tracking-widest">Repaired</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Note (Optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[80px]"
                placeholder="Enter any notes about this repair"
              />
            </div>

            <DialogFooter className="pt-4 flex w-full sm:justify-between items-center sm:space-x-0">
              {editingId ? (
                <Button type="button" variant="outline" onClick={() => { setIsAddOpen(false); setDeleteConfirmId(editingId); }} className="bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20 hover:text-red-400">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              ) : <div />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="bg-transparent border-slate-700 hover:bg-slate-800 text-slate-300">
                  Cancel
                </Button>
                <Button type="submit" disabled={isAdding} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {isAdding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Save"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete this container repair? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="bg-transparent border-slate-700 hover:bg-slate-800 text-slate-300">
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
