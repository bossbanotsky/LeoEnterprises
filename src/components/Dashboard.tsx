import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { Announcement } from '../types';
import { Users, CheckCircle, XCircle, Clock, Hammer, Calendar, ChevronLeft, ChevronRight, Megaphone, Plus, Eye } from 'lucide-react';
import { format, addDays, subDays, parseISO, isPast } from 'date-fns';
import { Input } from './ui/input';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();
  const { companyInfo } = useCompanyInfo();
  const [selectedDate, setSelectedDate] = useState(() => localStorage.getItem('dashSelectedDate') || format(new Date(), 'yyyy-MM-dd'));
  const [stats, setStats] = useState({
    totalEmployees: 0,
    present: 0,
    absent: 0,
    ut: 0,
    pakyaw: 0
  });
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    localStorage.setItem('dashSelectedDate', selectedDate);
  }, [selectedDate]);

  const handlePrevDate = () => {
    setSelectedDate(prev => format(subDays(parseISO(prev), 1), 'yyyy-MM-dd'));
  };

  const handleNextDate = () => {
    setSelectedDate(prev => format(addDays(parseISO(prev), 1), 'yyyy-MM-dd'));
  };

  useEffect(() => {
    if (!user) return;
    
    let unsubscribeAtt: (() => void) | null = null;
    let activeEmpIds = new Set<string>();

    // Get active employees first to filter attendance
    const unsubscribeEmps = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const newActiveEmpIds = new Set<string>();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'active' || !data.status) {
          newActiveEmpIds.add(doc.id);
        }
      });
      activeEmpIds = newActiveEmpIds;
      
      setStats(prev => ({ ...prev, totalEmployees: activeEmpIds.size }));

      // Attendance for selected date
      const q = query(collection(db, 'attendance'), where('date', '==', selectedDate));
      
      if (unsubscribeAtt) {
        unsubscribeAtt();
      }

      unsubscribeAtt = onSnapshot(q, (attSnapshot) => {
        let present = 0;
        let ut = 0;
        let pakyaw = 0;
        const loggedIds = new Set<string>();

        attSnapshot.forEach(doc => {
          const data = doc.data();
          if (activeEmpIds.has(data.employeeId)) {
            loggedIds.add(data.employeeId);
            if (data.status === 'present') present++;
            else if (data.status === 'ut') ut++;
            else if (data.status === 'pakyaw') pakyaw++;
          }
        });

        // Implicitly absent = active employees who are NOT logged or are logged as 'absent'
        // Actually, we should count those explicitly 'absent' too
        let explicitAbsent = 0;
        attSnapshot.forEach(doc => {
          const data = doc.data();
          if (activeEmpIds.has(data.employeeId) && data.status === 'absent') explicitAbsent++;
        });

        const totalHandledButLogged = loggedIds.size;
        const missing = activeEmpIds.size - totalHandledButLogged;

        setStats(prev => ({ 
          ...prev, 
          present, 
          ut, 
          pakyaw, 
          absent: missing + explicitAbsent 
        }));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'attendance'));

    }, (error) => handleFirestoreError(error, OperationType.GET, 'employees'));

    const qAnn = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(3));
    const unsubscribeAnn = onSnapshot(qAnn, (snapshot) => {
      const data: Announcement[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Announcement));
      setRecentAnnouncements(data);
    });

    return () => {
      unsubscribeEmps();
      unsubscribeAnn();
      if (unsubscribeAtt) {
        unsubscribeAtt();
      }
    };
  }, [user, selectedDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Welcome back to {companyInfo.name}</p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1 group">
          <button 
            onClick={handlePrevDate}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1.5 px-1 py-1 bg-slate-50 dark:bg-slate-900 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-blue-500 ml-1" />
            <Input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              className="border-0 h-7 text-xs font-black bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 w-[110px] p-0"
            />
          </div>

          <button 
            onClick={handleNextDate}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bento-card flex-col bg-white dark:bg-slate-800 p-6 border-blue-100 dark:border-blue-900/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 mb-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest">Total Employees</span>
            </div>
            <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{stats.totalEmployees}</div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium uppercase tracking-wider">Active Personnel</div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bento-card flex-col bg-white dark:bg-slate-800 p-5 border-emerald-100 dark:border-emerald-900/30 relative overflow-hidden group">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Present</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stats.present}</div>
            </div>

            <div className="bento-card flex-col bg-white dark:bg-slate-800 p-5 border-sky-100 dark:border-sky-900/30 relative overflow-hidden group">
              <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">UT</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stats.ut}</div>
            </div>

            <div className="bento-card flex-col bg-white dark:bg-slate-800 p-5 border-amber-100 dark:border-amber-900/30 relative overflow-hidden group">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                <Hammer className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Pakyaw</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stats.pakyaw}</div>
            </div>

            <div className="bento-card flex-col bg-white dark:bg-slate-800 p-5 border-rose-100 dark:border-rose-900/30 relative overflow-hidden group">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-2">
                <XCircle className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Absent</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stats.absent}</div>
            </div>
          </div>
        </div>

        {/* Announcements Preview */}
        <div className="bento-card flex-col bg-white dark:bg-slate-800 p-6 border-slate-200 dark:border-slate-700 h-full">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Recent Notices</h3>
            </div>
            <Link to="/admin-dashboard/announcements" className="p-1 px-2 bg-blue-50 dark:bg-blue-900/40 text-[9px] font-bold text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors uppercase">
              Manage
            </Link>
          </div>
          
          <div className="space-y-4">
            {recentAnnouncements.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center gap-2 opacity-40">
                <Megaphone className="w-8 h-8 text-slate-300" />
                <p className="text-xs font-bold uppercase tracking-widest">No New Notices</p>
              </div>
            ) : (
              recentAnnouncements.map((ann, idx) => (
                <div key={ann.id} className={`group flex flex-col gap-1 pb-4 ${idx !== recentAnnouncements.length - 1 ? 'border-b border-slate-50 dark:border-slate-800' : ''}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {ann.title}
                    </h4>
                    {isPast(parseISO(ann.expiresAt)) && (
                      <span className="text-[8px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase">Archived</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1 italic">{ann.message}</p>
                  <Link to="/admin-dashboard/announcements" className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 text-[9px] text-slate-400">
                      <Eye className="w-3 h-3" /> Seen by {ann.viewedBy.length}
                    </div>
                  </Link>
                </div>
              ))
            )}
            
            <Link to="/admin-dashboard/announcements" className="block">
              <button className="w-full mt-2 h-10 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 text-[10px] font-bold uppercase tracking-widest">
                <Plus className="w-3.5 h-3.5" />
                Post New Notice
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
