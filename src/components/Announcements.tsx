import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Announcement, Employee } from '../types';
import { Megaphone, Plus, Trash2, Clock, Eye, Send, AlertCircle, CheckCircle2, History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { format, addDays, isPast, parseISO } from 'date-fns';

export default function Announcements() {
  const { user, userData } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    title: '',
    message: '',
    durationDays: '7',
    priority: 'medium' as 'low' | 'medium' | 'high'
  });

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Announcement[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Announcement));
      setAnnouncements(data);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'announcements'));

    const unsubscribeEmps = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const emps: Employee[] = [];
      snapshot.forEach(doc => emps.push({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(emps);
    });

    return () => {
      unsubscribe();
      unsubscribeEmps();
    };
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const now = new Date();
      const expiresAt = addDays(now, parseInt(form.durationDays));

      await addDoc(collection(db, 'announcements'), {
        title: form.title,
        message: form.message,
        postedBy: user.uid,
        authorName: userData?.fullName || 'Admin',
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        viewedBy: [],
        priority: form.priority
      });

      setIsAddOpen(false);
      setForm({ title: '', message: '', durationDays: '7', priority: 'medium' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'announcements');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this announcement?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'announcements');
    }
  };

  const activeAnnouncements = announcements.filter(a => !isPast(parseISO(a.expiresAt)));
  const pastAnnouncements = announcements.filter(a => isPast(parseISO(a.expiresAt)));

  const getViewers = (announcement: Announcement) => {
    return employees.filter(emp => announcement.viewedBy.includes(emp.uid || ''));
  };

  const getUnviewed = (announcement: Announcement) => {
    // Only count employees who have a linked UID
    const linkedEmployees = employees.filter(e => e.uid);
    return linkedEmployees.filter(emp => !announcement.viewedBy.includes(emp.uid || ''));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-blue-600" />
            Announcement Board
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Post important updates and track employee engagement.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="rounded-xl flex items-center gap-2 bg-blue-600 hover:bg-blue-700 h-11" />}>
            <Plus className="w-4 h-4" />
            New Announcement
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Compose Announcement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input 
                  required 
                  placeholder="e.g. Holiday Notice: Eid al-Fitr" 
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <textarea 
                  required
                  rows={4}
                  placeholder="Write your announcement details here..."
                  value={form.message}
                  onChange={e => setForm({...form, message: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration (Days)</Label>
                  <select 
                    value={form.durationDays}
                    onChange={e => setForm({...form, durationDays: e.target.value})}
                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  >
                    <option value="1">1 Day</option>
                    <option value="3">3 Days</option>
                    <option value="7">1 Week</option>
                    <option value="14">2 Weeks</option>
                    <option value="30">1 Month</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <select 
                    value={form.priority}
                    onChange={e => setForm({...form, priority: e.target.value as any})}
                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <Button type="submit" className="w-full rounded-xl h-12 bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2 mt-4">
                <Send className="w-4 h-4" />
                Post Announcement
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto space-y-8 pr-2">
        {/* Active Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Currently Active</h2>
          </div>
          <div className="grid gap-4">
            {activeAnnouncements.length === 0 ? (
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl py-8 text-center text-slate-400 text-sm">
                No active announcements.
              </div>
            ) : (
              activeAnnouncements.map(ann => (
                <div key={ann.id} className="bento-card p-5 group transition-all hover:border-blue-300 relative overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    ann.priority === 'high' ? 'bg-red-500' : ann.priority === 'medium' ? 'bg-blue-500' : 'bg-slate-300'
                  }`}></div>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">{ann.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          ann.priority === 'high' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {ann.priority}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-2 mb-4 leading-relaxed">
                        {ann.message}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Posted {format(parseISO(ann.createdAt), 'MMM d, h:mm a')}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Expires {format(parseISO(ann.expiresAt), 'MMM d')}
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedAnnouncement(ann);
                            setIsViewOpen(true);
                          }}
                          className="flex items-center gap-1.5 text-blue-600 hover:underline font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Viewed by {ann.viewedBy.length} employees
                        </button>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(ann.id)}
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Past Section */}
        <section className="pb-10">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Archived History</h2>
          </div>
          <div className="space-y-3">
            {pastAnnouncements.map(ann => (
              <div key={ann.id} className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100 transition-opacity">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{ann.title}</h4>
                  <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">
                    Expired {format(parseISO(ann.expiresAt), 'MMM d, yyyy')} • Seen by {ann.viewedBy.length}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => {
                    setSelectedAnnouncement(ann);
                    setIsViewOpen(true);
                  }}>
                    <Eye className="w-4 h-4 text-slate-400" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(ann.id)}>
                    <Trash2 className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-2xl p-0 overflow-hidden">
          {selectedAnnouncement && (
            <>
              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-lg leading-tight">{selectedAnnouncement.title}</h3>
                <p className="text-xs text-slate-500 mt-2">
                  Analytics for this announcement
                </p>
              </div>
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                    <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Viewed</div>
                    <div className="text-2xl font-black text-blue-700 dark:text-blue-300">{selectedAnnouncement.viewedBy.length}</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                    <div className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Unseen</div>
                    <div className="text-2xl font-black text-orange-700 dark:text-orange-300">
                      {getUnviewed(selectedAnnouncement).length}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Seen By</h4>
                  <div className="space-y-2">
                    {getViewers(selectedAnnouncement).map(view => (
                      <div key={view.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-bold">{view.fullName}</div>
                          <div className="text-[10px] text-slate-500">{view.position}</div>
                        </div>
                      </div>
                    ))}
                    {getViewers(selectedAnnouncement).length === 0 && (
                      <div className="text-center py-4 text-xs text-slate-500">No views recorded yet.</div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Pending Receipt</h4>
                  <div className="space-y-2">
                    {getUnviewed(selectedAnnouncement).map(notView => (
                      <div key={notView.id} className="flex items-center gap-3 bg-red-50/30 dark:bg-red-900/10 p-2 rounded-xl border border-red-100/30">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-bold">{notView.fullName}</div>
                          <div className="text-[10px] text-slate-500">{notView.position}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
