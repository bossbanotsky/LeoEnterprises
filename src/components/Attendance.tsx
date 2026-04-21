import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc, orderBy, deleteField } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Employee, Attendance as AttendanceType, PakyawJob } from '../types';
import { format, parseISO, eachDayOfInterval, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { ChevronDown, ChevronUp, Check, X, ChevronLeft, ChevronRight, Calendar, Calculator } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Skeleton } from './ui/Skeleton';

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
  const [loading, setLoading] = useState(true);

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
      setEmployees(emps.filter(e => (e.status === 'active' || !e.status) && e.role !== 'ceo' && e.role !== 'admin').sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setLoading(false);
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
    if (att.status === 'present' || att.status === 'ut' || att.status === 'hd') {
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
    if (field === 'status' && (value === 'present' || value === 'hd') && !updated.timeIn) { 
      if (value === 'hd') {
        updated.timeIn = '07:00'; 
        updated.timeOut = '12:00';
      } else {
        updated.timeIn = '07:00'; 
        updated.timeOut = '16:00'; 
      }
    }
    
    // Calculation of hours when present/ut/hd (not absent or pakyaw)
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
      
      // Auto-set status: 
      // 7:00 to 12:00 is HD (Half Day)
      if (tIn === '07:00' && tOut === '12:00') {
        updated.status = 'hd';
      } else if ((regDuration + otDuration) < 8) {
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
    <div className="h-full flex flex-col w-full p-2 sm:px-4 space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight shrink-0">Attendance</h1>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
          <button 
            className={`flex-1 sm:px-6 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'mark' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            onClick={() => setActiveTab('mark')}
          >
            Mark
          </button>
          <button 
            className={`flex-1 sm:px-6 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'report' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            onClick={() => setActiveTab('report')}
          >
            Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
        {activeTab === 'mark' ? (
          <div className="bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1 max-w-sm group">
            <button 
              onClick={handlePrevDate}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <div className="flex flex-col flex-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Selected Date</span>
                <Input 
                  type="date" 
                  value={singleDate} 
                  onChange={e => setSingleDate(e.target.value)} 
                  className="rounded-none h-6 w-full font-black bg-transparent border-0 text-xs p-0 focus-visible:ring-0 focus-visible:ring-offset-0" 
                />
              </div>
            </div>
            <button 
              onClick={handleNextDate}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="col-span-full grid grid-cols-2 gap-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block leading-none">Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-lg h-9 w-full font-semibold bg-slate-50 dark:bg-slate-900 border-0 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block leading-none">End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-lg h-9 w-full font-semibold bg-slate-50 dark:bg-slate-900 border-0 text-sm" />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-20 px-1">
        {loading ? (
          <div className="space-y-4">
            <Skeleton count={5} className="h-40 w-full mb-3 rounded-2xl" />
          </div>
        ) : activeTab === 'mark' ? (
          <div className="grid grid-cols-1 gap-3">
            {employees.map(emp => {
              const att = attendanceData[`${emp.id}_${singleDate}`] || { status: 'absent', timeIn: '07:00', timeOut: '16:00' };
              const isHD = att.status === 'hd' || (att.timeIn === '07:00' && att.timeOut === '12:00');
              const isUT = (att.status === 'ut' || (att.status === 'present' && (att.regularHours || 0) < 8 && (att.regularHours || 0) > 0)) && !isHD;
              const isPresent = att.status === 'present' && !isUT && !isHD;
              const isPakyaw = att.status === 'pakyaw';

              return (
                <div key={emp.id} className="bento-card bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                        {emp.photoURL ? (
                          <img src={emp.photoURL} alt={emp.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          emp.fullName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-white truncate">{emp.fullName}</h3>
                          <span className="text-[10px] text-slate-400 font-medium">Rate: ₱{emp.dailySalary}</span>
                        </div>
                        <div className="flex gap-1 mt-0.5">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            isPresent ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            isPakyaw ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            isHD ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                            isUT ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' :
                            'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                          }`}>
                            {isHD ? 'Half Day' : isPresent ? 'Present' : isPakyaw ? 'Pakyaw' : isUT ? 'UT' : 'Absent'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-blue-600 dark:text-blue-400">₱{calculateDailyPay(emp, `${emp.id}_${singleDate}`).toLocaleString()}</div>
                      <div className="text-[8px] text-slate-400 uppercase font-bold tracking-tighter">Earned Today</div>
                    </div>
                  </div>
                  
                   {(isPresent || isUT || isHD) && (
                    <div className="space-y-3 mb-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Time In</Label>
                          <Input type="time" value={att?.timeIn || '07:00'} onChange={e => handleAttendanceChange(emp.id, singleDate, 'timeIn', e.target.value)} className="h-8 rounded-lg bg-slate-50 dark:bg-slate-900 border-0 font-mono text-xs p-2" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Time Out</Label>
                          <Input type="time" value={att?.timeOut || '16:00'} onChange={e => handleAttendanceChange(emp.id, singleDate, 'timeOut', e.target.value)} className="h-8 rounded-lg bg-slate-50 dark:bg-slate-900 border-0 font-mono text-xs p-2" />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex-1 text-center border-r border-slate-100 dark:border-slate-800 last:border-0">
                          <div className="text-[8px] font-bold text-slate-400 uppercase">Regular</div>
                          <div className="text-xs font-black text-slate-900 dark:text-white">{att.regularHours || 0}h</div>
                        </div>
                        <div className="flex-1 text-center border-r border-slate-100 dark:border-slate-800 last:border-0">
                          <div className="text-[8px] font-bold text-emerald-500 uppercase">Overtime</div>
                          <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">{(att.otHours || 0).toFixed(1)}h</div>
                        </div>
                        {(isUT || (att.regularHours || 0) < 8) && (
                          <div className="flex-1 text-center border-r border-slate-100 dark:border-slate-800 last:border-0">
                            <div className="text-[8px] font-bold text-amber-500 uppercase">Undertime</div>
                            <div className="text-xs font-black text-amber-600 dark:text-amber-400">
                              {Math.max(0, 8 - (att.regularHours || 0)).toFixed(1)}h
                            </div>
                          </div>
                        )}
                        <div className="flex-1 text-center">
                          <div className="text-[8px] font-bold text-blue-500 uppercase tracking-tight">Daily Pay</div>
                          <div className="text-xs font-black text-blue-600 dark:text-blue-400">
                            ₱{calculateDailyPay(emp, `${emp.id}_${singleDate}`).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {isPakyaw && (
                    <div className="space-y-3 mb-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                       <div className="space-y-1">
                         <Label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Assigned Contracts (This Date)</Label>
                         {pakyawJobs.filter(j => j.startDate === singleDate && j.employeeIds.includes(emp.id)).length > 0 ? (
                           <div className="space-y-1">
                             {pakyawJobs.filter(j => j.startDate === singleDate && j.employeeIds.includes(emp.id)).map(job => (
                               <div key={job.id} className="flex justify-between items-center text-[10px] px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                                 <div className="flex flex-col">
                                   <span className="text-slate-700 dark:text-slate-300 font-bold truncate max-w-[140px] leading-tight">{job.description}</span>
                                   <span className="text-[8px] text-slate-400 font-medium uppercase">{job.status}</span>
                                 </div>
                                 <span className={`font-black ${job.status === 'completed' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                                   ₱{(job.totalPrice / Math.max(1, job.employeeIds.length)).toLocaleString()}
                                 </span>
                               </div>
                             ))}
                           </div>
                         ) : (
                           <div className="text-[10px] text-slate-400 italic px-2 py-1">No contracts found for this date.</div>
                         )}
                       </div>

                       <div>
                         <Label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Primary Reference Job</Label>
                         <select value={att?.pakyawJobId || ''} onChange={(e) => handleAttendanceChange(emp.id, singleDate, 'pakyawJobId', e.target.value)} className="w-full h-9 px-3 rounded-lg border-0 bg-slate-50 dark:bg-slate-900 text-xs font-semibold">
                          <option value="">-- Select Job --</option>
                          {pakyawJobs.map(job => <option key={job.id} value={job.id}>{job.description}</option>)}
                        </select>
                       </div>

                       <div className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                          <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Estimated Pakyaw Pay</span>
                          <span className="text-sm font-black text-amber-700 dark:text-amber-300">
                            ₱{calculateDailyPay(emp, `${emp.id}_${singleDate}`).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                       </div>
                    </div>
                  )}

                  <div className="grid grid-cols-5 gap-1.5 mt-auto">
                    <button 
                      onClick={() => handleAttendanceChange(emp.id, singleDate, 'status', 'present')} 
                      className={`py-2 text-[9px] rounded-xl font-bold transition-all border ${isPresent ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-emerald-300'}`}
                    >
                      Present
                    </button>
                    <button 
                      onClick={() => handleAttendanceChange(emp.id, singleDate, 'status', 'pakyaw')} 
                      className={`py-2 text-[9px] rounded-xl font-bold transition-all border ${isPakyaw ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-amber-300'}`}
                    >
                      Pakyaw
                    </button>
                    <button 
                      onClick={() => handleAttendanceChange(emp.id, singleDate, 'status', 'hd')} 
                      className={`py-2 text-[9px] rounded-xl font-bold transition-all border ${isHD ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                    >
                      HD
                    </button>
                    <button 
                      onClick={() => handleAttendanceChange(emp.id, singleDate, 'status', 'ut')} 
                      className={`py-2 text-[9px] rounded-xl font-bold transition-all border ${isUT ? 'bg-sky-500 text-white border-sky-500 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-sky-300'}`}
                    >
                      UT
                    </button>
                    <button 
                      onClick={() => handleAttendanceChange(emp.id, singleDate, 'status', 'absent')} 
                      className={`py-2 text-[9px] rounded-xl font-bold transition-all border ${att.status === 'absent' ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-rose-300'}`}
                    >
                      Absent
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {employees.length > 0 && (
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 sm:p-5 text-white shadow-lg shadow-blue-200 dark:shadow-none mb-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 opacity-80 uppercase tracking-widest text-[10px] font-bold">
                    <Calculator className="w-3 h-3" />
                    Period Overview
                  </div>
                  <span className="text-[10px] font-medium bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                    {format(parseISO(startDate), 'MMM dd')} - {format(parseISO(endDate), 'MMM dd')}
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-black tracking-tight">₱{calculateGrandTotal().toLocaleString()}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">Grand Total Earnings</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold leading-tight">{employees.length}</div>
                    <div className="text-[9px] font-medium uppercase tracking-wider opacity-70">Employees</div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
            {employees.map(emp => (
              <div key={emp.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:border-blue-300 transition-colors">
                <div 
                  className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors" 
                  onClick={() => setExpandedEmp(expandedEmp === emp.id ? null : emp.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                      {emp.photoURL ? (
                        <img src={emp.photoURL} alt={emp.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        emp.fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-white truncate">{emp.fullName}</h3>
                        <span className="text-[10px] text-slate-400 font-medium">Rate: ₱{emp.dailySalary}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                          <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {dates.filter(d => {
                              const att = attendanceData[`${emp.id}_${d}`];
                              return att?.status === 'present' && (att.regularHours === undefined || att.regularHours >= 8);
                            }).length} Pres
                          </span>
                          <span className="text-[8px] font-bold text-rose-700 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {dates.filter(d => !attendanceData[`${emp.id}_${d}`] || attendanceData[`${emp.id}_${d}`]?.status === 'absent').length} Abs
                          </span>
                          <span className="text-[8px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {dates.filter(d => attendanceData[`${emp.id}_${d}`]?.status === 'pakyaw').length} Paky
                          </span>
                          <span className="text-[8px] font-bold text-sky-700 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {dates.filter(d => {
                              const att = attendanceData[`${emp.id}_${d}`];
                              const isHDLocal = att?.status === 'hd' || (att?.timeIn === '07:00' && att?.timeOut === '12:00');
                              return (att?.status === 'ut' || (att?.status === 'present' && att?.regularHours !== undefined && att?.regularHours < 8)) && !isHDLocal;
                            }).length} UT
                          </span>
                          <span className="text-[8px] font-bold text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {dates.filter(d => {
                              const att = attendanceData[`${emp.id}_${d}`];
                              return att?.status === 'hd' || (att?.timeIn === '07:00' && att?.timeOut === '12:00');
                            }).length} HD
                          </span>
                          <span className="text-[8px] font-bold text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {dates.reduce((sum, d) => sum + (attendanceData[`${emp.id}_${d}`]?.otHours || 0), 0).toFixed(1)} OT
                          </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 sm:ml-4">
                    <div className="text-right">
                      <div className="text-[11px] sm:text-xs font-black text-blue-600 dark:text-blue-400">₱{calculatePeriodTotal(emp).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      <div className="text-[8px] text-slate-400 uppercase font-bold tracking-tighter leading-none">Total Period</div>
                    </div>
                    <div className="p-1 sm:p-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      {expandedEmp === emp.id ? <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />}
                    </div>
                  </div>
                </div>
                
                {expandedEmp === emp.id && (
                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                    {dates.map(date => {
                      const att = attendanceData[`${emp.id}_${date}`] || { status: 'absent', timeIn: '07:00', timeOut: '16:00' };
                      const isHD_detail = att.status === 'hd' || (att.timeIn === '07:00' && att.timeOut === '12:00');
                      const isUT_detail = (att.status === 'ut' || (att.status === 'present' && (att.regularHours || 0) < 8 && (att.regularHours || 0) > 0)) && !isHD_detail;
                      const isPresent_detail = att.status === 'present' && !isUT_detail && !isHD_detail;
                      const isAbs_detail = (att.status === 'absent' || (!att.status && !att.regularHours)) && !isHD_detail && !isUT_detail && !isPresent_detail;

                      return (
                        <div key={date} className="pt-4 first:pt-4 border-b last:border-0 border-slate-100 dark:border-slate-800 pb-4">
                          <div className="flex justify-between items-center mb-3">
                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{format(parseISO(date), 'MMM dd, EEE')}</span>
                            <div className="flex gap-2 text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-700">
                               {(isPresent_detail || isUT_detail || isHD_detail) && (
                                  <>
                                    <span className="text-slate-500">Reg: {att.regularHours || 0}h</span>
                                    {att.otHours ? <span className="text-emerald-600">OT: {att.otHours.toFixed(1)}h</span> : null}
                                    {isUT_detail ? <span className="text-amber-600">UT: {(8 - (att.regularHours || 0)).toFixed(1)}h</span> : null}
                                    {isHD_detail ? <span className="text-indigo-600">HD</span> : null}
                                    <span className="text-blue-600 dark:text-blue-400 border-l border-slate-200 dark:border-slate-700 ml-1 pl-2">₱{calculateDailyPay(emp, `${emp.id}_${date}`).toLocaleString()}</span>
                                  </>
                               )}
                               {isAbs_detail && <span className="text-rose-600">Absent</span>}
                               {att?.status === 'pakyaw' && (
                                 <>
                                   <span className="text-amber-600">Pakyaw</span>
                                   <span className="text-blue-600 dark:text-blue-400 border-l border-slate-200 dark:border-slate-700 ml-1 pl-2 font-black">
                                     ₱{calculateDailyPay(emp, `${emp.id}_${date}`).toLocaleString()}
                                   </span>
                                 </>
                               )}
                            </div>
                            {att?.status === 'pakyaw' && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {pakyawJobs.filter(j => j.startDate === date && j.employeeIds.includes(emp.id)).map(job => (
                                  <span key={job.id} className="text-[8px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900/30">
                                    {job.description}: ₱{(job.totalPrice / Math.max(1, job.employeeIds.length)).toLocaleString()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 mb-3">
                            <button onClick={() => handleAttendanceChange(emp.id, date, 'status', 'present')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg ${isPresent_detail ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}>Present</button>
                            <button onClick={() => handleAttendanceChange(emp.id, date, 'status', 'pakyaw')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg ${att?.status === 'pakyaw' ? 'bg-amber-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}>Pakyaw</button>
                            <button onClick={() => handleAttendanceChange(emp.id, date, 'status', 'hd')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg ${isHD_detail ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}>HD</button>
                            <button onClick={() => handleAttendanceChange(emp.id, date, 'status', 'ut')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg ${isUT_detail ? 'bg-sky-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}>UT</button>
                            <button onClick={() => handleAttendanceChange(emp.id, date, 'status', 'absent')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg ${isAbs_detail ? 'bg-rose-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}>Absent</button>
                          </div>
                          
                          {(att?.status === 'present' || att?.status === 'ut' || att?.status === 'hd') && (
                            <div className="grid grid-cols-2 gap-2">
                              <Input type="time" value={att?.timeIn || '07:00'} onChange={e => handleAttendanceChange(emp.id, date, 'timeIn', e.target.value)} className="h-9 text-xs font-mono rounded-lg bg-white dark:bg-slate-800 border-0" />
                              <Input type="time" value={att?.timeOut || '16:00'} onChange={e => handleAttendanceChange(emp.id, date, 'timeOut', e.target.value)} className="h-9 text-xs font-mono rounded-lg bg-white dark:bg-slate-800 border-0" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);
}
