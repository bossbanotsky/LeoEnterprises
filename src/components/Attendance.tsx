import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc, orderBy, deleteField } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Employee, Attendance as AttendanceType, PakyawJob } from '../types';
import { format, parseISO, eachDayOfInterval, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { ChevronDown, ChevronUp, Check, X, ChevronLeft, ChevronRight, Calendar, Calculator, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SmartText } from './ui/SmartText';
import { Input } from './ui/input';
import { Label } from './ui/label';

export default function Attendance() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pakyawJobs, setPakyawJobs] = useState<PakyawJob[]>([]);
  const [activeTab, setActiveTab] = useState<'mark' | 'report'>('mark');
  const [singleDate, setSingleDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [startDate, setStartDate] = useState(() => localStorage.getItem('attendanceStartDate') || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => localStorage.getItem('attendanceEndDate') || format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [attendanceData, setAttendanceData] = useState<Record<string, Partial<AttendanceType>>>({});
  const [error, setError] = useState<string | null>(null);
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('attendanceStartDate', startDate);
    localStorage.setItem('attendanceEndDate', endDate);
  }, [startDate, endDate]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'pakyawJobs'), orderBy('startDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobs: PakyawJob[] = [];
      snapshot.forEach((doc) => jobs.push({ id: doc.id, ...doc.data() } as PakyawJob));
      setPakyawJobs(jobs);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'pakyawJobs'));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const emps: Employee[] = [];
      snapshot.forEach((doc) => emps.push({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(emps.filter(e => e.status === 'active' || !e.status).sort((a, b) => a.fullName.localeCompare(b.fullName)));
    }, (error) => { setError('Failed to load employees'); handleFirestoreError(error, OperationType.GET, 'employees'); });
    return () => unsubscribe();
  }, [user]);

  const handlePrevDate = () => {
    setSingleDate(prev => format(subDays(parseISO(prev), 1), 'yyyy-MM-dd'));
  };

  const handleNextDate = () => {
    setSingleDate(prev => format(addDays(parseISO(prev), 1), 'yyyy-MM-dd'));
  };

  const queryStart = activeTab === 'mark' ? singleDate : startDate;
  const queryEnd = activeTab === 'mark' ? singleDate : endDate;

  const calculateDailyPay = (emp: Employee, attKey: string) => {
    const att = attendanceData[attKey];
    const date = attKey.split('_')[1];
    
    if (!att || att.status === 'absent') return 0;
    
    let totalPay = 0;

    // 1. Calculate Regular/OT Pay if applicable
    if (att.status === 'present' || att.status === 'ut') {
      const hourlyRate = emp.dailySalary / 8;
      const regPay = (att.regularHours || 0) * hourlyRate;
      const otPay = (att.otHours || 0) * hourlyRate;
      totalPay += regPay + otPay;
    }
    
    // 2. Calculate Pakyaw Pay (Sum of all completed pakyaw jobs for this employee on this date)
    const dailyPakyawJobs = pakyawJobs.filter(j => 
      j.startDate === date && 
      j.employeeIds.includes(emp.id)
    );

    if (dailyPakyawJobs.length > 0) {
      dailyPakyawJobs.forEach(job => {
        if (job.status === 'completed') {
          totalPay += job.totalPrice / Math.max(1, job.employeeIds.length);
        }
      });
    } else if (att.status === 'pakyaw' && att.pakyawJobId) {
      // Fallback for the specifically linked job
      const job = pakyawJobs.find(j => j.id === att.pakyawJobId);
      if (job && job.status === 'completed') {
        totalPay += job.totalPrice / Math.max(1, job.employeeIds.length);
      }
    }
    
    return totalPay;
  };

  const calculatePeriodTotal = (emp: Employee) => {
    return dates.reduce((total, date) => {
      return total + calculateDailyPay(emp, `${emp.id}_${date}`);
    }, 0);
  };

  const calculateGrandTotal = () => {
    return employees.reduce((total, emp) => {
      return total + calculatePeriodTotal(emp);
    }, 0);
  };

  useEffect(() => {
    if (!user || !queryStart || !queryEnd) return;
    const q = query(collection(db, 'attendance'), where('date', '>=', queryStart), where('date', '<=', queryEnd));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const atts: Record<string, Partial<AttendanceType>> = {};
      snapshot.forEach(doc => { const data = doc.data() as AttendanceType; atts[`${data.employeeId}_${data.date}`] = { ...data, id: doc.id }; });
      setAttendanceData(atts);
    }, (error) => { setError('Failed to load attendance'); handleFirestoreError(error, OperationType.GET, 'attendance'); });
    return () => unsubscribe();
  }, [user, queryStart, queryEnd]);

  const dates = useMemo(() => {
    if (activeTab === 'mark') return [singleDate];
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      if (start > end) return [];
      return eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'));
    } catch { return []; }
  }, [activeTab, startDate, endDate, singleDate]);

  const handleAttendanceChange = async (employeeId: string, date: string, field: keyof AttendanceType, value: any) => {
    setError(null);
    const key = `${employeeId}_${date}`;
    const current = attendanceData[key] || { 
      employeeId, 
      date, 
      status: 'absent', 
      timeIn: '07:00', 
      timeOut: '16:00', 
      regularHours: 0, 
      otHours: 0,
      pakyawJobId: undefined
    };
    
    // Create new updated object
    let updated: Partial<AttendanceType> = { ...current, [field]: value };
    
    // Auto-calculate for Present status
    if (field === 'status' && value === 'present' && !updated.timeIn) { 
      updated.timeIn = '07:00'; 
      updated.timeOut = '16:00'; 
    }
    
    // Calculation of hours when present/ut (not absent or pakyaw)
    if (updated.status !== 'absent' && updated.status !== 'pakyaw') {
      const tIn = updated.timeIn || '07:00';
      const tOut = updated.timeOut || '16:00';
      const [inH, inM] = tIn.split(':').map(Number);
      const [outH, outM] = tOut.split(':').map(Number);
      
      const start = inH + inM / 60;
      let end = outH + outM / 60;
      if (end < start) end += 24; // Handle overnight if any
      
      const breakStart = 12.0;
      const breakEnd = 13.0;
      const otCutoff = 16.0;

      // 1. Calculate Regular Hours (Time before 16:00, excluding 12:00-13:00)
      const regRangeEnd = Math.min(end, otCutoff);
      let regDuration = Math.max(0, regRangeEnd - start);
      
      // Subtract intersection with break window
      const overlapStart = Math.max(start, breakStart);
      const overlapEnd = Math.min(regRangeEnd, breakEnd);
      const breakOverlap = Math.max(0, overlapEnd - overlapStart);
      regDuration -= breakOverlap;
      
      // 2. Calculate OT Hours (Time after 16:00)
      const otRangeStart = Math.max(start, otCutoff);
      const otDuration = Math.max(0, end - otRangeStart);

      updated.regularHours = parseFloat(regDuration.toFixed(2));
      updated.otHours = parseFloat(otDuration.toFixed(2));
      
      // Auto-set status: Total hours (Reg + OT) must be 8 for 'present'
      if ((regDuration + otDuration) < 8) {
        updated.status = 'ut';
      } else {
        updated.status = 'present';
      }
    } else {
      updated.regularHours = 0; 
      updated.otHours = 0;
    }
    
    // If status is not Pakyaw, ensure PakyawJobId is cleared
    if (updated.status !== 'pakyaw') {
      updated.pakyawJobId = undefined;
    }

    // Immediate local update for responsiveness
    setAttendanceData(prev => ({ ...prev, [key]: updated }));

    // Persist to Firebase
    if (!user) return;
    try {
      const docId = updated.id || `${employeeId}_${date}`;
      const { id, ...dataToSave } = updated;
      
      const finalDataToSave = { ...dataToSave };
      if (finalDataToSave.pakyawJobId === undefined) {
         finalDataToSave.pakyawJobId = deleteField() as any;
      }

      await setDoc(doc(db, 'attendance', docId), { 
        ...finalDataToSave, 
        employeeId, 
        date, 
        userId: user.uid, 
        createdAt: updated.createdAt || new Date().toISOString() 
      }, { merge: true });
    } catch (error) { 
      setError(`Save failed`); 
      handleFirestoreError(error, OperationType.WRITE, 'attendance'); 
    }
  };

  return (
    <div className="h-full flex flex-col w-full p-2 sm:px-4 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-1">
        <SmartText as="h1" className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase shrink-0 italic">Attendance</SmartText>
        <div className="flex glass p-1 rounded-2xl border border-black/5 w-full sm:w-auto shadow-sm">
          <button 
            className={`flex-1 sm:px-8 py-2.5 text-xs font-black tracking-widest uppercase rounded-xl transition-all duration-500 ${activeTab === 'mark' ? 'btn-premium text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            onClick={() => setActiveTab('mark')}
          >
            Mark
          </button>
          <button 
            className={`flex-1 sm:px-8 py-2.5 text-xs font-black tracking-widest uppercase rounded-xl transition-all duration-500 ${activeTab === 'report' ? 'btn-premium text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            onClick={() => setActiveTab('report')}
          >
            Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
        {activeTab === 'mark' ? (
          <div className="bento-card justify-between items-center py-2 px-3 sm:px-4 h-16 glossy-base border-black/5 bg-white">
            <button onClick={handlePrevDate} className="p-2.5 hover:bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all transform hover:scale-110 active:scale-95"><ChevronLeft className="w-5 h-5"/></button>
            <div className="flex flex-col items-center">
              <SmartText className="text-[10px] text-blue-600 font-black uppercase tracking-[0.2em] mb-1 opacity-70">Selected Date</SmartText>
              <SmartText as="span" className="text-sm font-black text-slate-900 tracking-tight">{format(parseISO(singleDate), 'EEEE, MMMM dd, yyyy')}</SmartText>
            </div>
            <button onClick={handleNextDate} className="p-2.5 hover:bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all transform hover:scale-110 active:scale-95"><ChevronRight className="w-5 h-5"/></button>
          </div>
        ) : (
          <div className="bento-card flex-col sm:flex-row justify-between items-center py-3 sm:py-2 px-4 h-auto sm:h-16 glossy-base border-black/5 bg-white gap-3 sm:gap-0">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100 shrink-0">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <SmartText className="text-xs font-black text-slate-600 uppercase tracking-widest opacity-80">Period Analysis</SmartText>
             </div>
             <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 flex-1 sm:w-40 sm:flex-none bg-slate-50 border-black/10 text-[10px] font-black uppercase text-slate-900 rounded-xl text-center shadow-sm" />
                <span className="text-slate-200 font-black shrink-0">-</span>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 flex-1 sm:w-40 sm:flex-none bg-slate-50 border-black/10 text-[10px] font-black uppercase text-slate-900 rounded-xl text-center shadow-sm" />
             </div>
          </div>
        )}
        
        {activeTab === 'mark' ? (
           <div className="bento-card items-center gap-4 py-2 px-5 h-16 border-blue-50 bg-blue-50/30">
             <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-blue-100 shadow-sm transition-transform hover:scale-110">
               <Users className="w-5 h-5 text-blue-600" />
             </div>
             <div>
               <SmartText className="text-[9px] font-black text-blue-500 uppercase tracking-[0.15em] leading-none opacity-60">Employees Active</SmartText>
               <SmartText className="text-2xl font-black text-slate-900 leading-none mt-1">{employees.length}</SmartText>
             </div>
           </div>
        ) : (
           <div className="bento-card items-center gap-4 py-2 px-5 h-16 border-emerald-50 bg-emerald-50/30">
             <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-emerald-100 shadow-sm transition-transform hover:scale-110">
               <Calculator className="w-5 h-5 text-emerald-600" />
             </div>
             <div className="flex-1">
               <SmartText className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.15em] leading-none opacity-60">Period Grand Total</SmartText>
               <SmartText className="text-2xl font-black text-emerald-600 leading-none mt-1 tracking-tighter">₱ {calculateGrandTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}</SmartText>
             </div>
           </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-20 px-1">
        {activeTab === 'mark' ? (
          <div className="grid grid-cols-1 gap-4">
            {employees.map(emp => {
              const att = attendanceData[`${emp.id}_${singleDate}`] || { status: 'absent', timeIn: '07:00', timeOut: '16:00' };
              const isUT = att.status === 'ut' || (att.status === 'present' && (att.regularHours || 0) < 8 && (att.regularHours || 0) > 0);
              const isPresent = att.status === 'present' && !isUT;
              const isPakyaw = att.status === 'pakyaw';
              const expanded = expandedEmp === emp.id;

              return (
                <div key={emp.id} className={`bento-card flex-col gap-0 p-0 overflow-hidden transition-all duration-700 border-black/5 ${expanded ? 'ring-2 ring-blue-500/10' : ''}`}>
                  <div 
                    className={`p-5 flex items-center justify-between cursor-pointer group transition-colors duration-500 ${expanded ? 'bg-blue-500/5' : 'hover:bg-blue-500/5'}`}
                    onClick={() => setExpandedEmp(expanded ? null : emp.id)}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-800 shadow-inner relative glossy-base border border-black/5">
                        <SmartText className="relative z-10">{emp.fullName[0]}</SmartText>
                        <div className={`absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white -translate-y-1/3 translate-x-1/3 shadow-sm ${
                          isPresent ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 
                          isPakyaw ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 
                          isUT ? 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.4)]' : 
                          'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                        }`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <SmartText className="text-sm font-black text-slate-900 uppercase tracking-tight group-hover:text-blue-500 transition-colors duration-300 truncate pr-2 leading-tight block">{emp.fullName}</SmartText>
                        <SmartText className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5 opacity-80 italic">{emp.position || 'Staff'}</SmartText>
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end gap-1.5 shrink-0 ml-4">
                       <SmartText className="text-sm font-black text-slate-900 tracking-widest">₱ {calculateDailyPay(emp, `${emp.id}_${singleDate}`).toLocaleString()}</SmartText>
                       <StatusBadge status={att?.status} hours={att?.regularHours} />
                    </div>
                  </div>

                  <AnimatePresence>
                    {expanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden bg-slate-50 shadow-inner"
                      >
                         <div className="p-6 space-y-8">
                            <div className="grid grid-cols-4 gap-2.5">
                               {['present', 'pakyaw', 'ut', 'absent'].map((s) => (
                                 <button
                                   key={s}
                                   onClick={(e) => { e.stopPropagation(); handleAttendanceChange(emp.id, singleDate, 'status', s); }}
                                   className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-500 border flex flex-col items-center gap-1.5 glossy-base ${
                                     att?.status === s 
                                     ? s === 'present' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                                     : s === 'pakyaw' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                                     : s === 'ut' ? 'bg-sky-500/10 border-sky-500/20 text-sky-600 shadow-[0_0_15px_rgba(14,165,233,0.1)]'
                                     : 'bg-rose-500/10 border-rose-500/20 text-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                                     : 'bg-white border-black/5 text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                                   }`}
                                 >
                                   {s}
                                 </button>
                               ))}
                            </div>

                            {(isPresent || isUT) && (
                              <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 opacity-70">Time In Shift</Label>
                                  <Input 
                                    type="time" 
                                    value={att?.timeIn || '07:00'} 
                                    onChange={e => handleAttendanceChange(emp.id, singleDate, 'timeIn', e.target.value)}
                                    className="h-14 bg-white border-black/5 text-slate-900 font-black rounded-2xl text-center text-lg focus:ring-blue-500/10 transition-all duration-500 shadow-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 opacity-70">Time Out Shift</Label>
                                  <Input 
                                    type="time" 
                                    value={att?.timeOut || '16:00'} 
                                    onChange={e => handleAttendanceChange(emp.id, singleDate, 'timeOut', e.target.value)}
                                    className="h-14 bg-white border-black/5 text-slate-900 font-black rounded-2xl text-center text-lg focus:ring-blue-500/10 transition-all duration-500 shadow-sm"
                                  />
                                </div>
                                <div className="col-span-2 glass border border-black/5 p-6 rounded-3xl flex gap-4 items-center shadow-sm relative overflow-hidden group">
                                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -translate-y-1/2 translate-x-1/2" />
                                   <div className="flex-1">
                                     <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60 mb-1">Shift Performance Pay</div>
                                     <div className="text-3xl font-black text-blue-600 tracking-tighter">₱ {calculateDailyPay(emp, `${emp.id}_${singleDate}`).toLocaleString()}</div>
                                   </div>
                                   <div className="w-px h-12 bg-black/5" />
                                   <div className="text-right min-w-[100px]">
                                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reg / OT Hrs</div>
                                      <div className="text-lg font-black text-slate-900 italic tracking-tighter">{att?.regularHours || 0} <span className="text-xs opacity-40 font-bold">REG</span> <span className="text-emerald-500">{(att?.otHours || 0).toFixed(1)}</span> <span className="text-xs text-emerald-600 font-bold uppercase">OT</span></div>
                                   </div>
                                </div>
                              </div>
                            )}

                            {isPakyaw && (
                              <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
                                 <div className="space-y-3">
                                   <Label className="text-[10px] font-black uppercase tracking-widest text-amber-500/70 ml-1 italic">Assigned Contracts Archive</Label>
                                   <div className="space-y-2">
                                     {pakyawJobs.filter(j => j.startDate === singleDate && j.employeeIds.includes(emp.id)).map(job => (
                                       <div key={job.id} className="flex justify-between items-center p-4 bg-white border border-amber-500/10 rounded-2xl hover:bg-amber-500/5 transition-colors duration-500 group shadow-sm">
                                         <div className="flex flex-col">
                                           <SmartText className="text-xs font-black text-slate-800 uppercase tracking-tight group-hover:text-amber-600 transition-colors duration-300">{job.description}</SmartText>
                                           <SmartText className="text-[9px] text-amber-500/60 font-black uppercase tracking-widest mt-1 opacity-80">{job.status}</SmartText>
                                         </div>
                                         <div className="text-right">
                                           <SmartText className="text-lg font-black text-amber-600 tracking-tighter">₱ {(job.totalPrice / Math.max(1, job.employeeIds.length)).toLocaleString()}</SmartText>
                                         </div>
                                       </div>
                                     ))}
                                     {pakyawJobs.filter(j => j.startDate === singleDate && j.employeeIds.includes(emp.id)).length === 0 && (
                                       <div className="text-center py-6 bg-white border border-dashed border-black/5 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">No active contracts found</div>
                                     )}
                                   </div>
                                   
                                   <div className="pt-2">
                                     <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-2 block opacity-80">Reference Job Hook</Label>
                                     <select 
                                      value={att?.pakyawJobId || ''} 
                                      onChange={(e) => handleAttendanceChange(emp.id, singleDate, 'pakyawJobId', e.target.value)} 
                                      className="w-full h-12 px-4 rounded-2xl border-black/5 bg-white text-xs font-black text-slate-600 uppercase tracking-widest focus:ring-amber-500/10 shadow-sm"
                                     >
                                      <option value="">-- NO REFERENCE --</option>
                                      {pakyawJobs.map(job => <option key={job.id} value={job.id} className="bg-white text-slate-900">{job.description.toUpperCase()}</option>)}
                                    </select>
                                   </div>
                                   
                                   <div className="mt-6 p-6 bg-amber-500/5 rounded-3xl border border-amber-500/10 flex justify-between items-center glossy-base">
                                      <SmartText className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] opacity-80">Accumulated Pakyaw Total</SmartText>
                                      <SmartText className="text-3xl font-black text-amber-600 tracking-tighter drop-shadow-sm">₱ {calculateDailyPay(emp, `${emp.id}_${singleDate}`).toLocaleString()}</SmartText>
                                   </div>
                                 </div>
                              </div>
                            )}
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-10 scrollbar-hide">
               {employees.map(emp => {
                 const totalPay = calculatePeriodTotal(emp);
                 const isExpandedSelected = expandedEmp === `report_${emp.id}`;
                 const stats = dates.reduce((acc, date) => {
                   const att = attendanceData[`${emp.id}_${date}`] || { status: 'absent' };
                   if (att.status === 'present') acc.present++;
                   if (att.status === 'absent') acc.absent++;
                   if (att.status === 'pakyaw') acc.pakyaw++;
                   if (att.status === 'ut') acc.ut++;
                   return acc;
                 }, { present: 0, absent: 0, pakyaw: 0, ut: 0 });

                 return (
                   <div key={emp.id} className={`bento-card flex-col gap-0 p-0 overflow-hidden border-black/5 transition-all duration-700 ${isExpandedSelected ? 'ring-2 ring-emerald-500/30 scale-[1.01] -translate-y-1' : ''}`}>
                    <div 
                        className={`p-6 flex items-center justify-between cursor-pointer group hover:bg-blue-500/5 transition-colors duration-500 ${isExpandedSelected ? 'bg-blue-500/5' : ''}`}
                        onClick={() => setExpandedEmp(isExpandedSelected ? null : `report_${emp.id}`)}
                      >
                        <div className="flex items-center gap-5 min-w-0 flex-1">
                          <div className="w-14 h-14 bg-slate-100 rounded-3xl flex items-center justify-center font-black text-slate-800 shadow-inner relative glossy-base border border-black/5">
                            <SmartText className="relative z-10 text-lg">{emp.fullName[0]}</SmartText>
                          </div>
                          <div className="min-w-0 flex-1">
                            <SmartText as="div" className="text-base font-black text-slate-900 uppercase tracking-tight group-hover:text-blue-500 transition-colors duration-300 truncate">{emp.fullName}</SmartText>
                            <div className="flex gap-3 items-center mt-1.5 overflow-x-auto scrollbar-hide">
                              <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20 shadow-sm shrink-0">₱ {totalPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              <SmartText className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] shrink-0">{stats.present + stats.ut}d <span className="opacity-40">PRESENT</span></SmartText>
                            </div>
                          </div>
                        </div>
                        <ChevronDown className={`w-6 h-6 text-slate-300 transition-transform duration-700 ml-4 ${isExpandedSelected ? 'rotate-180 text-blue-500' : 'group-hover:text-slate-500'}`} />
                      </div>

                      <AnimatePresence>
                        {isExpandedSelected && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden bg-slate-50 shadow-inner"
                          >
                             <div className="p-8 space-y-10">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                   <StatBox label="Present" val={stats.present} color="emerald" />
                                   <StatBox label="Pakyaw" val={stats.pakyaw} color="amber" />
                                   <StatBox label="UT Shift" val={stats.ut} color="sky" />
                                   <StatBox label="Absent" val={stats.absent} color="rose" />
                                </div>

                                <div className="space-y-6">
                                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1 opacity-80 border-l-2 border-emerald-500 pl-3">Daily Analytics Log</div>
                                   <div className="space-y-4">
                                     {dates.map(date => {
                                        const att = attendanceData[`${emp.id}_${date}`] || { status: 'absent' };
                                        const isPresent_detail = att.status === 'present';
                                        const isAbs_detail = att.status === 'absent';
                                        const isUT_detail = att.status === 'ut';

                                        return (
                                          <div key={date} className="glass border border-black/5 rounded-3xl p-6 transition-all duration-500 hover:border-blue-500/20 hover:bg-white relative overflow-hidden group shadow-sm">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                                              <div className="flex flex-col">
                                                <SmartText className="font-black text-[11px] text-slate-900 uppercase tracking-widest">{format(parseISO(date), 'MMM dd')}</SmartText>
                                                <SmartText className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 opacity-60 italic">{format(parseISO(date), 'EEEE')}</SmartText>
                                              </div>
                                              <div className="flex gap-4 items-center bg-slate-100/50 px-5 py-2.5 rounded-2xl border border-black/5 glossy-base overflow-x-auto scrollbar-hide">
                                                 {(isPresent_detail || isUT_detail) && (
                                                    <>
                                                      <div className="flex flex-col items-center shrink-0">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">REG</span>
                                                        <span className="text-xs font-black text-slate-900">{att.regularHours || 0}h</span>
                                                      </div>
                                                      <div className="w-px h-6 bg-black/5" />
                                                      {att.otHours ? (
                                                        <>
                                                          <div className="flex flex-col items-center shrink-0">
                                                            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">OT</span>
                                                            <span className="text-xs font-black text-emerald-500">{att.otHours.toFixed(1)}h</span>
                                                          </div>
                                                          <div className="w-px h-6 bg-black/5" />
                                                        </>
                                                      ) : null}
                                                      <div className="flex flex-col items-center pl-2 shrink-0">
                                                        <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">EARN</span>
                                                        <span className="text-sm font-black text-blue-600 tracking-tighter">₱ {calculateDailyPay(emp, `${emp.id}_${date}`).toLocaleString()}</span>
                                                      </div>
                                                    </>
                                                 )}
                                                 {att?.status === 'pakyaw' && (
                                                   <div className="flex flex-col items-center min-w-[120px] shrink-0">
                                                      <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">PAKYAW</span>
                                                      <span className="text-sm font-black text-amber-600 tracking-tighter">₱ {calculateDailyPay(emp, `${emp.id}_${date}`).toLocaleString()}</span>
                                                   </div>
                                                 )}
                                                 {isAbs_detail && <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] italic shrink-0">ABSENT</span>}
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-4 gap-2.5">
                                               {['present', 'pakyaw', 'ut', 'absent'].map(s => (
                                                 <button 
                                                   key={s} 
                                                   onClick={() => handleAttendanceChange(emp.id, date, 'status', s)} 
                                                   className={`py-2.5 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all duration-500 border ${
                                                     att?.status === s 
                                                     ? s === 'present' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                                                     : s === 'pakyaw' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                                                     : s === 'ut' ? 'bg-sky-500/10 border-sky-500/20 text-sky-600'
                                                     : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                                                     : 'bg-white border-black/5 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                                   }`}
                                                 >
                                                   {s}
                                                 </button>
                                               ))}
                                            </div>

                                            {(att?.status === 'present' || att?.status === 'ut') && (
                                              <div className="grid grid-cols-2 gap-4 mt-6 animate-in fade-in slide-in-from-top-1 duration-700">
                                                 <div className="space-y-1.5">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 opacity-80">Shift Start</span>
                                                    <Input type="time" value={att?.timeIn || '07:00'} onChange={e => handleAttendanceChange(emp.id, date, 'timeIn', e.target.value)} className="h-11 text-xs bg-white border-black/5 text-slate-900 font-black rounded-2xl text-center shadow-sm focus:ring-blue-500/10" />
                                                 </div>
                                                 <div className="space-y-1.5">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 opacity-80">Shift End</span>
                                                    <Input type="time" value={att?.timeOut || '16:00'} onChange={e => handleAttendanceChange(emp.id, date, 'timeOut', e.target.value)} className="h-11 text-xs bg-white border-black/5 text-slate-900 font-black rounded-2xl text-center shadow-sm focus:ring-blue-500/10" />
                                                 </div>
                                              </div>
                                            )}

                                            {att?.status === 'pakyaw' && (
                                               <div className="flex flex-wrap gap-2 mt-5">
                                                 {pakyawJobs.filter(j => j.startDate === date && j.employeeIds.includes(emp.id)).map(job => (
                                                   <span key={job.id} className="text-[9px] bg-white border border-amber-500/10 text-amber-600 px-4 py-2 rounded-2xl uppercase font-black tracking-tight glossy-base shadow-sm">
                                                     {job.description}: <span className="text-slate-900 ml-2">₱ {Math.round(job.totalPrice / Math.max(1, job.employeeIds.length)).toLocaleString()}</span>
                                                   </span>
                                                 ))}
                                                 {pakyawJobs.filter(j => j.startDate === date && j.employeeIds.includes(emp.id)).length === 0 && (
                                                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest italic opacity-60">No automated match</span>
                                                 )}
                                               </div>
                                            )}
                                          </div>
                                        );
                                     })}
                                   </div>
                                </div>
                             </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                   </div>
                 );
               })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const StatBox = ({ label, val, color }: { label: string, val: number, color: string }) => {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 shadow-sm',
    amber: 'text-amber-600 bg-amber-500/10 border-amber-500/20 shadow-sm',
    sky: 'text-sky-600 bg-sky-500/10 border-sky-500/20 shadow-sm',
    rose: 'text-rose-600 bg-rose-500/10 border-rose-500/20 shadow-sm',
  };
  return (
    <div className={`p-4 rounded-3xl glass border ${colors[color]} flex flex-col items-center justify-center text-center glossy-base`}>
       <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">{label}</div>
       <div className="text-xl font-black">{val}</div>
    </div>
  );
};

const StatusBadge = ({ status, hours }: { status?: string, hours?: number }) => {
  if (status === 'present') return <span className="text-[9px] bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-black uppercase tracking-widest shadow-sm">Present</span>;
  if (status === 'absent') return <span className="text-[9px] bg-rose-500/10 text-rose-600 px-2.5 py-1 rounded-lg border border-rose-500/20 font-black uppercase tracking-widest shadow-sm">Absent</span>;
  if (status === 'ut') return <span className="text-[9px] bg-sky-500/10 text-sky-600 px-2.5 py-1 rounded-lg border border-sky-500/20 font-black uppercase tracking-widest shadow-sm">Undertime</span>;
  if (status === 'pakyaw') return <span className="text-[9px] bg-amber-500/10 text-amber-600 px-2.5 py-1 rounded-lg border border-amber-500/20 font-black uppercase tracking-widest shadow-sm">Pakyaw</span>;
  return null;
};
