import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { Users, CheckCircle, XCircle, Clock, Hammer, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { SmartText } from './ui/SmartText';
import { Input } from './ui/input';

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

    return () => {
      unsubscribeEmps();
      if (unsubscribeAtt) {
        unsubscribeAtt();
      }
    };
  }, [user, selectedDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <SmartText as="h1" className="text-2xl font-bold text-slate-900">Overview</SmartText>
          <SmartText className="text-slate-500 text-sm">Welcome back to {companyInfo.name}</SmartText>
        </div>
        
        <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-1 group">
          <button 
            onClick={handlePrevDate}
            className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1.5 px-1 py-1 bg-slate-50 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-blue-500 ml-1" />
            <Input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              className="border-0 h-7 text-xs font-black bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 w-[110px] p-0 text-slate-900"
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

      <div className="grid grid-cols-1 gap-4">
        <div className="bento-card flex-col p-6 bg-white border-blue-50 relative overflow-hidden group hover:border-blue-200">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
          <div className="flex items-center gap-3 text-blue-600 mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100">
              <Users className="w-5 h-5" />
            </div>
            <SmartText className="text-xs font-bold uppercase tracking-widest">Total Employees</SmartText>
          </div>
          <SmartText className="text-4xl font-black text-slate-900 tracking-tight leading-none block">{stats.totalEmployees}</SmartText>
          <SmartText className="text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-wider block">Active Personnel</SmartText>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bento-card flex-col p-5 bg-white border-emerald-50 relative overflow-hidden group hover:border-emerald-200">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <CheckCircle className="w-4 h-4" />
              <SmartText className="text-[10px] font-bold uppercase tracking-widest">Present</SmartText>
            </div>
            <SmartText className="text-3xl font-black text-slate-900 tracking-tight leading-none block">{stats.present}</SmartText>
          </div>

          <div className="bento-card flex-col p-5 bg-white border-sky-50 relative overflow-hidden group hover:border-sky-200">
            <div className="flex items-center gap-2 text-sky-600 mb-2">
              <Clock className="w-4 h-4" />
              <SmartText className="text-[10px] font-bold uppercase tracking-widest">UT</SmartText>
            </div>
            <SmartText className="text-3xl font-black text-slate-900 tracking-tight leading-none block">{stats.ut}</SmartText>
          </div>

          <div className="bento-card flex-col p-5 bg-white border-amber-50 relative overflow-hidden group hover:border-amber-200">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <Hammer className="w-4 h-4" />
              <SmartText className="text-[10px] font-bold uppercase tracking-widest">Pakyaw</SmartText>
            </div>
            <SmartText className="text-3xl font-black text-slate-900 tracking-tight leading-none block">{stats.pakyaw}</SmartText>
          </div>

          <div className="bento-card flex-col p-5 bg-white border-rose-50 relative overflow-hidden group hover:border-rose-200">
            <div className="flex items-center gap-2 text-rose-600 mb-2">
              <XCircle className="w-4 h-4" />
              <SmartText className="text-[10px] font-bold uppercase tracking-widest">Absent</SmartText>
            </div>
            <SmartText className="text-3xl font-black text-slate-900 tracking-tight leading-none block">{stats.absent}</SmartText>
          </div>
        </div>
      </div>
    </div>
  );
}
