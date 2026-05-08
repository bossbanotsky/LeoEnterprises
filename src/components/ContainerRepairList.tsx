import React, { useState, useEffect, useMemo } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc, deleteDoc, arrayUnion, where, getDocs, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { ContainerRepair, Invoice } from "../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Loader2, Plus, Wrench, Edit, Trash2, LayoutGrid, List } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

const PLATFORMS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;
type RepairPlatform = typeof PLATFORMS[number];

export default function ContainerRepairList() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [containers, setContainers] = useState<ContainerRepair[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    type: 'local' as 'local' | 'foreign',
    localCode: "",
    foreignCode: "",
    status: 'active' as 'active' | 'repairing' | 'repaired',
    platform: null as RepairPlatform | null,
    hasBV: false,
    hasAV: false,
    note: ""
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'repairing' | 'repaired'>('active');
  const [viewMode, setViewMode] = useState<'list' | 'platform'>('list');

  const [repairedSortOrder, setRepairedSortOrder] = useState<'asc' | 'desc'>('asc');

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
    let filtered = containers.filter(c => {
        if ((c.status || 'active') !== activeTab) return false;
        
        // If it's in the repaired tab, check if it's already billed
        if (c.status === 'repaired') {
            const codeDisplay = c.type === 'foreign' ? `${c.localCode} - ${c.foreignCode}` : `${c.localCode} - ${c.localCode}`;
            const isBilled = invoices.some(inv => (inv.status === 'billing' || inv.status === 'paid') && inv.containers.some(ic => ic.code === codeDisplay));
            return !isBilled;
        }
        return true;
    });

    if (activeTab === 'repairing') {
      filtered = filtered.sort((a, b) => {
        if (a.platform && !b.platform) return -1;
        if (!a.platform && b.platform) return 1;
        if (a.platform && b.platform) return a.platform.localeCompare(b.platform);
        return 0;
      });
    } else if (activeTab === 'repaired') {
      filtered = filtered.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt).getTime();
        return repairedSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      });
    }

    return filtered;
  }, [containers, activeTab, invoices, repairedSortOrder]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
        type: 'local',
        localCode: "",
        foreignCode: "",
        status: 'active',
        platform: null,
        hasBV: false,
        hasAV: false,
        note: ""
    });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (c: ContainerRepair) => {
    setEditingId(c.id);
    setFormData({
        type: c.type,
        localCode: c.localCode || "",
        foreignCode: c.foreignCode || "",
        status: c.status || 'active',
        platform: c.platform || null,
        hasBV: c.hasBV || false,
        hasAV: c.hasAV || false,
        note: c.note || ""
    });
    setIsAddOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredContainers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredContainers.map(c => c.id));
    }
  };

  const handleBulkStatusChange = async (newStatus: 'active' | 'repairing' | 'repaired') => {
    try {
      for (const id of selectedIds) {
        const docRef = doc(db, "containerRepairs", id);
        const containerDoc = await getDoc(docRef);
        const data = containerDoc.data() as ContainerRepair;
        if (!data) continue;

        await updateDoc(docRef, {
            status: newStatus,
            updatedAt: new Date().toISOString(),
            history: arrayUnion({
              status: newStatus,
              timestamp: new Date().toISOString(),
              note: `Bulk update to ${newStatus}`,
              updatedBy: user?.uid,
            })
        });

        if (newStatus === 'repaired') {
            const containerCode = (data.type === 'foreign' ? `${data.localCode} - ${data.foreignCode}` : `${data.localCode} - ${data.localCode}`).trim();
            const q = query(
              collection(db, 'pakyawJobs'), 
              where('containerNumber', '==', containerCode),
              where('status', '==', 'pending')
            );
            const snapshot = await getDocs(q);
            for (const jobDoc of snapshot.docs) {
              await updateDoc(jobDoc.ref, { 
                status: 'completed',
                completedAt: new Date().toISOString()
              });
            }
        }
      }
      showToast(`Selected containers updated to ${newStatus}`, "success");
      setSelectedIds([]);
    } catch (error) {
       console.error(error);
       showToast("Failed to update selected containers", "error");
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedIds.map(async (id) => {
          const docRef = doc(db, "containerRepairs", id);
          const containerDoc = await getDoc(docRef);
          const data = containerDoc.data() as ContainerRepair;

          if (data) {
            const containerCode = (data.type === 'foreign' ? `${data.localCode} - ${data.foreignCode}` : `${data.localCode} - ${data.localCode}`).trim();
            const q = query(collection(db, 'pakyawJobs'), where('containerNumber', '==', containerCode));
            const snapshot = await getDocs(q);
            for (const jobDoc of snapshot.docs) {
                const attQuery = query(collection(db, 'attendance'), where('pakyawJobId', '==', jobDoc.id));
                const attSnapshot = await getDocs(attQuery);
                for (const attDoc of attSnapshot.docs) {
                  await deleteDoc(attDoc.ref);
                }
                await deleteDoc(jobDoc.ref);
            }
          }
          await deleteDoc(docRef);
      }));
      showToast("Selected containers and associated items deleted successfully", "success");
      setSelectedIds([]);
    } catch (error) {
       console.error(error);
       showToast("Failed to delete selected containers", "error");
    }
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
    if (formData.type === 'local' && !formData.localCode) {
      showToast("Local code is required for local containers.", "error");
      return;
    }
    if (formData.type === 'foreign' && !formData.foreignCode) {
      showToast("Foreign code is required for foreign containers.", "error");
      return;
    }

    setIsAdding(true);
    try {
      // Check for duplicates
      const currentContainerCode = (formData.type === 'foreign' ? `${formData.localCode} - ${formData.foreignCode}` : `${formData.localCode} - ${formData.localCode}`).trim().toUpperCase();
      
      const isDuplicate = containers.some(c => {
        if (c.id === editingId) return false;
        const code = (c.type === 'foreign' ? `${c.localCode} - ${c.foreignCode}` : `${c.localCode} - ${c.localCode}`).trim().toUpperCase();
        return code === currentContainerCode;
      });

      if (isDuplicate) {
        showToast(`Container "${currentContainerCode}" already exists in the repair list.`, "error");
        setIsAdding(false);
        return;
      }

      const historyEntry = {
        status: formData.status,
        platform: formData.status === 'repairing' ? formData.platform : null,
        hasBV: formData.hasBV,
        hasAV: formData.hasAV,
        timestamp: new Date().toISOString(),
        note: formData.note || null,
        updatedBy: user.uid,
      };

      if (editingId) {
        await setDoc(doc(db, "containerRepairs", editingId), {
          type: formData.type,
          localCode: formData.localCode || null,
          foreignCode: formData.type === 'foreign' ? formData.foreignCode : formData.localCode,
          status: formData.status,
          platform: formData.status === 'repairing' ? formData.platform : null,
          hasBV: formData.hasBV,
          hasAV: formData.hasAV,
          note: formData.note || null,
          updatedAt: new Date().toISOString(),
          history: arrayUnion(historyEntry),
        }, { merge: true });
        
        // If status changed to repaired, complete associated Pakyaw jobs
        if (formData.status === 'repaired') {
          const containerCode = (formData.type === 'foreign' ? `${formData.localCode} - ${formData.foreignCode}` : `${formData.localCode} - ${formData.localCode}`).trim();
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
          }
        }
        
        showToast("Container Repair updated successfully", "success");
      } else {
        await addDoc(collection(db, "containerRepairs"), {
          type: formData.type,
          localCode: formData.localCode || null,
          foreignCode: formData.type === 'foreign' ? formData.foreignCode : formData.localCode,
          status: formData.status,
          platform: formData.status === 'repairing' ? formData.platform : null,
          hasBV: formData.hasBV,
          hasAV: formData.hasAV,
          note: formData.note || null,
          createdAt: new Date().toISOString(),
          createdBy: user.uid,
          history: [historyEntry],
        });
        showToast("Container Repair added successfully", "success");
      }
      setIsAddOpen(false);
      setFormData({
        type: 'local',
        localCode: "",
        foreignCode: "",
        status: 'active',
        platform: null,
        hasBV: false,
        hasAV: false,
        note: ""
      });
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

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-white/10">
            <span className="text-sm text-slate-300">{selectedIds.length} container(s) selected</span>
            <Button onClick={() => handleBulkStatusChange('active')} className="bg-slate-700 hover:bg-slate-600">Mark Active</Button>
            <Button onClick={() => handleBulkStatusChange('repairing')} className="bg-amber-600 hover:bg-amber-700">Mark Repairing</Button>
            <Button onClick={() => handleBulkStatusChange('repaired')} className="bg-emerald-600 hover:bg-emerald-700">Mark Repaired</Button>
            <Button onClick={handleBulkDelete} variant="destructive">Delete Selected</Button>
        </div>
      )}

      <div className="flex border-b border-white/10 mt-6 relative overflow-x-auto pb-1 custom-scrollbar w-full">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-3 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap min-w-max ${
            activeTab === 'active' ? 'bg-indigo-500/20 text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Waiting List
        </button>
        <button
          onClick={() => setActiveTab('repairing')}
          className={`px-3 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap min-w-max ${
            activeTab === 'repairing' ? 'bg-amber-500/20 text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Repairing
        </button>
        <button
          onClick={() => setActiveTab('repaired')}
          className={`px-3 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap min-w-max ${
            activeTab === 'repaired' ? 'bg-emerald-500/20 text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Repaired
        </button>
        {activeTab === 'repairing' && (
          <div className="ml-auto flex bg-slate-950/50 rounded-lg p-1 border border-white/5 self-center">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg shrink-0' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('platform')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'platform' ? 'bg-indigo-600 text-white shadow-lg shrink-0' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        )}
        {activeTab === 'repaired' && (
          <div className="ml-auto flex bg-slate-950/50 rounded-lg p-1 border border-white/5 self-center items-center gap-2 px-3">
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden sm:inline">Sort:</span>
             <select 
               value={repairedSortOrder}
               onChange={(e) => setRepairedSortOrder(e.target.value as 'asc' | 'desc')}
               className="bg-transparent text-xs font-black text-emerald-400 focus:outline-none cursor-pointer tracking-widest appearance-none pr-1"
             >
               <option value="asc" className="bg-slate-900 text-emerald-400">Oldest to Newest</option>
               <option value="desc" className="bg-slate-900 text-emerald-400">Newest to Oldest</option>
             </select>
          </div>
        )}
      </div>

      {activeTab === 'repairing' && viewMode === 'platform' ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          {PLATFORMS.map(p => {
            const containerOnPlatform = filteredContainers.find(c => c.platform === p);
            return (
              <div key={p} className={`bg-slate-900/40 p-4 sm:p-6 rounded-3xl border-2 transition-all min-h-[140px] flex flex-col justify-between ${containerOnPlatform ? 'border-amber-500/30 bg-amber-500/5' : 'border-dashed border-white/5'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-sm sm:text-xl font-black italic tracking-tighter ${containerOnPlatform ? 'text-amber-500' : 'text-slate-700'}`}>{p}</h3>
                  {containerOnPlatform && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleOpenEdit(containerOnPlatform)}
                      className="h-6 w-6 sm:h-8 sm:w-8 p-0 text-slate-400 hover:text-white hover:bg-white/5"
                    >
                      <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  )}
                </div>
                
                {containerOnPlatform ? (
                  <div className="space-y-1">
                    <p className="text-xs sm:text-base font-black text-white leading-none truncate" title={containerOnPlatform.type === 'foreign' ? containerOnPlatform.foreignCode : containerOnPlatform.localCode}>
                      {containerOnPlatform.type === 'foreign' ? containerOnPlatform.foreignCode : containerOnPlatform.localCode}
                    </p>
                    <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">
                      {containerOnPlatform.localCode && containerOnPlatform.type === 'foreign' && `Local: ${containerOnPlatform.localCode}`}
                    </p>
                    <div className="mt-2 flex items-center gap-1 sm:gap-1.5 flex-wrap">
                       <span className="text-[7px] sm:text-[8px] font-black bg-slate-800 text-slate-300 px-1 sm:px-1.5 py-0.5 rounded border border-white/10 uppercase tracking-widest">
                         {containerOnPlatform.type}
                       </span>
                       <span className="text-[7px] sm:text-[8px] font-black bg-amber-500/20 text-amber-500 px-1 sm:px-1.5 py-0.5 rounded border border-amber-500/30 uppercase tracking-widest">IN REPAIR</span>
                       {containerOnPlatform.hasBV && <span className="text-[7px] sm:text-[8px] font-black bg-indigo-500/20 text-indigo-400 px-1 py-0.5 rounded border border-indigo-500/30">BV</span>}
                       {containerOnPlatform.hasAV && <span className="text-[7px] sm:text-[8px] font-black bg-emerald-500/20 text-emerald-500 px-1 py-0.5 rounded border border-emerald-500/30">AV</span>}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-2xl bg-slate-950/30 mt-2">
                    <p className="text-[8px] sm:text-[10px] font-black text-slate-600 uppercase tracking-widest">AVAILABLE</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
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
                  <th className="p-4 w-10"><input type="checkbox" checked={selectedIds.length === filteredContainers.length && filteredContainers.length > 0} onChange={toggleSelectAll} /></th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Platform</th>
                  <th className="p-4">BV/AV</th>
                  <th className="p-4">Foreign Code</th>
                  <th className="p-4">Local Code</th>
                  <th className="p-4">Invoice Status</th>
                  <th className="p-4">Note</th>
                  <th className="p-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-slate-300">
                {filteredContainers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No containers found.
                    </td>
                  </tr>
                ) : (
                  filteredContainers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="p-4"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                      <td className="p-4 font-bold" onClick={() => handleOpenEdit(c)}>
                        <span className={`px-2 py-1 rounded text-xs uppercase tracking-widest ${
                          c.type === 'foreign' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                          'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}>
                          {c.type}
                        </span>
                      </td>
                      <td className="p-4" onClick={() => handleOpenEdit(c)}>
                        {c.platform ? (
                          <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded border border-indigo-500/20 uppercase tracking-widest">
                            {c.platform}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-bold text-[10px] uppercase tracking-widest">-</span>
                        )}
                      </td>
                      <td className="p-4" onClick={() => handleOpenEdit(c)}>
                         <div className="flex gap-1">
                            <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold border ${c.hasBV ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-600'}`} title="Before Video">BV</div>
                            <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold border ${c.hasAV ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-600'}`} title="After Video">AV</div>
                         </div>
                      </td>
                      <td className="p-4 group-hover:text-white transition-colors whitespace-nowrap" onClick={() => handleOpenEdit(c)}>{c.type === 'foreign' ? c.foreignCode || "-" : c.localCode || "-"}</td>
                      <td className="p-4 group-hover:text-white transition-colors whitespace-nowrap" onClick={() => handleOpenEdit(c)}>{c.localCode || "-"}</td>
                      <td className="p-4 whitespace-nowrap" onClick={() => handleOpenEdit(c)}>
                        {(() => {
                          const containerCode = (c.type === 'foreign' ? `${c.localCode} - ${c.foreignCode}` : `${c.localCode} - ${c.localCode}`).trim();
                          const linkedInvoice = invoices.find(inv => 
                            inv.status !== 'cancelled' && 
                            inv.containers.some(ic => ic.code === containerCode)
                          );
                          
                          if (!linkedInvoice) return <span className="text-slate-600">-</span>;
                          
                          return (
                            <div className="flex flex-col gap-1">
                               <span className="text-[10px] font-bold text-white bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30">
                                 #{linkedInvoice.invoiceNumber}
                               </span>
                               <span className={`text-[8px] font-black uppercase px-1 py-0.5 rounded text-center ${
                                  linkedInvoice.status === 'paid' ? 'bg-green-500/10 text-green-500' :
                                  linkedInvoice.status === 'billing' ? 'bg-indigo-500/10 text-indigo-400' :
                                  'bg-amber-500/10 text-amber-500'
                               }`}>
                                 {linkedInvoice.status}
                               </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-4 max-w-[200px] truncate group-hover:text-white transition-colors" onClick={() => handleOpenEdit(c)} title={c.note || ""}>{c.note || "-"}</td>
                      <td className="p-4 text-slate-400 text-xs whitespace-nowrap" onClick={() => handleOpenEdit(c)}>{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} Container Repair</DialogTitle>
            <DialogDescription className="text-slate-400">{editingId ? "Edit an existing" : "Add a new"} local or foreign container</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-2.5 pt-1">
            <div className="space-y-0.5">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Container Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={formData.type === 'local'} onChange={() => setFormData({...formData, type: 'local'})} className="w-3 h-3 text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700" />
                  <span className="text-[10px] uppercase font-bold text-slate-400">Local</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={formData.type === 'foreign'} onChange={() => setFormData({...formData, type: 'foreign'})} className="w-3 h-3 text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700" />
                  <span className="text-[10px] uppercase font-bold text-slate-400">Foreign</span>
                </label>
              </div>
            </div>

            {formData.type === 'foreign' && (
              <div className="space-y-0.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Foreign Code *</label>
                <input
                  type="text"
                  required
                  value={formData.foreignCode}
                  onChange={(e) => setFormData({...formData, foreignCode: e.target.value.toUpperCase()})}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  placeholder="Enter foreign code"
                />
              </div>
            )}

            <div className="space-y-0.5">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Local Code {formData.type === 'local' ? '*' : '(Optional)'}
              </label>
              <input
                type="text"
                required={formData.type === 'local'}
                value={formData.localCode}
                onChange={(e) => setFormData({...formData, localCode: e.target.value.toUpperCase()})}
                className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                placeholder="Enter local code"
              />
            </div>

            <div className="space-y-0.5">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={formData.status === 'active'} onChange={() => setFormData({...formData, status: 'active'})} className="w-3 h-3 text-indigo-500 focus:ring-indigo-500 bg-slate-800 border-slate-700" />
                  <span className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">Active</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={formData.status === 'repairing'} onChange={() => setFormData({...formData, status: 'repairing'})} className="w-3 h-3 text-amber-500 focus:ring-amber-500 bg-slate-800 border-slate-700" />
                  <span className="text-[9px] text-amber-500 font-black uppercase tracking-widest">Repairing</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={formData.status === 'repaired'} onChange={() => setFormData({...formData, status: 'repaired'})} className="w-3 h-3 text-emerald-500 focus:ring-emerald-500 bg-slate-800 border-slate-700" />
                  <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">Repaired</span>
                </label>
              </div>
            </div>

            {formData.status === 'repairing' && (
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Assign Platform</label>
                <div className="grid grid-cols-4 gap-1">
                  {PLATFORMS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormData({...formData, platform: p})}
                      className={`py-1 rounded-lg text-[10px] font-black transition-all border ${formData.platform === p ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-white/10 text-slate-500 hover:text-white'}`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, platform: null})}
                    className={`py-1 px-2 rounded-lg text-[10px] font-black transition-all border col-span-2 ${formData.platform === null ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-950 border-white/10 text-slate-500'}`}
                  >
                    None
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-0.5">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Video Tracking</label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-slate-950/50 border border-white/5 hover:bg-slate-950 transition-colors">
                  <input type="checkbox" checked={formData.hasBV} onChange={(e) => setFormData({...formData, hasBV: e.target.checked})} className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Before Video (BV)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-slate-950/50 border border-white/5 hover:bg-slate-950 transition-colors">
                  <input type="checkbox" checked={formData.hasAV} onChange={(e) => setFormData({...formData, hasAV: e.target.checked})} className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">After Video (AV)</span>
                </label>
              </div>
            </div>

            <div className="space-y-0.5">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Note (Optional)</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({...formData, note: e.target.value})}
                className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 min-h-[50px] resize-none"
                placeholder="Enter notes..."
              />
            </div>

            {editingId && containers.find(c => c.id === editingId)?.history && (
              <div className="mt-4 space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 block pb-1">Activity Log</label>
                <div className="space-y-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                  {containers.find(c => c.id === editingId)?.history?.slice().reverse().map((h, i) => (
                    <div key={i} className="relative pl-3 border-l border-white/10 py-0.5">
                      <div className="absolute -left-[4px] top-1.5 w-1.5 h-1.5 rounded-full bg-slate-700 border border-slate-900" />
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col">
                           <span className={`text-[8px] font-black uppercase tracking-tighter ${
                             h.status === 'active' ? 'text-indigo-400' :
                             h.status === 'repairing' ? 'text-amber-500' :
                             'text-emerald-500'
                           }`}>
                             {h.status} {h.platform && <span className="text-white ml-1">@ {h.platform}</span>}
                           </span>
                           <div className="flex gap-1 mt-0.5">
                              {h.hasBV && <span className="text-[7px] font-bold bg-indigo-500/10 text-indigo-400 px-1 rounded">BV</span>}
                              {h.hasAV && <span className="text-[7px] font-bold bg-emerald-500/10 text-emerald-400 px-1 rounded">AV</span>}
                           </div>
                           {h.note && <p className="text-[9px] text-slate-400 italic">"{h.note}"</p>}
                        </div>
                        <span className="text-[7px] text-slate-500 whitespace-nowrap text-right">
                          {new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
