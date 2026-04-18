import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Employee, Attendance as AttendanceType } from '../types';
import { format, parseISO, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';

export default function Attendance() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  const [activeTab, setActiveTab] = useState<'mark' | 'report'>('mark');
  
  const [singleDate, setSingleDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [startDate, setStartDate] = useState(() => localStorage.getItem('attendanceStartDate') || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => localStorage.getItem('attendanceEndDate') || format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  
  useEffect(() => {
    localStorage.setItem('attendanceStartDate', startDate);
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem('attendanceEndDate', endDate);
  }, [endDate]);
  
  const [attendanceData, setAttendanceData] = useState<Record<string, Partial<AttendanceType>>>({});
  const [error, setError] = useState<string | null>(null);
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const emps: Employee[] = [];
      snapshot.forEach((doc) => emps.push({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(emps
        .filter(e => e.status === 'active' || !e.status)
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
      );
    }, (error) => {
      setError('Failed to load employees');
      handleFirestoreError(error, OperationType.GET, 'employees');
    });
    return () => unsubscribe();
  }, [user]);

  const queryStart = activeTab === 'mark' ? singleDate : startDate;
  const queryEnd = activeTab === 'mark' ? singleDate : endDate;

  useEffect(() => {
    if (!user || !queryStart || !queryEnd) return;
    try {
      const q = query(
        collection(db, 'attendance'),
        where('date', '>=', queryStart),
        where('date', '<=', queryEnd)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const atts: Record<string, Partial<AttendanceType>> = {};
        snapshot.forEach(doc => {
          const data = doc.data() as AttendanceType;
          atts[`${data.employeeId}_${data.date}`] = { ...data, id: doc.id };
        });
        setAttendanceData(atts);
      }, (error) => {
        setError('Failed to load attendance');
        handleFirestoreError(error, OperationType.GET, 'attendance');
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Invalid date range", error);
    }
  }, [user, queryStart, queryEnd]);

  const dates = useMemo(() => {
    if (activeTab === 'mark') return [singleDate];
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      if (start > end) return [];
      return eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'));
    } catch (e) {
      return [];
    }
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
      otHours: 0
    };
    
    let updated: Partial<AttendanceType> = { ...current, [field]: value };
    
    if (field === 'status' && value === 'present' && !current.timeIn) {
      updated.timeIn = '07:00';
      updated.timeOut = '16:00';
    }

    if ((field === 'timeIn' || field === 'timeOut' || field === 'status') && updated.status === 'present') {
      const tIn = updated.timeIn || '07:00';
      const tOut = updated.timeOut || '16:00';
      
      const [inH, inM] = tIn.split(':').map(Number);
      const [outH, outM] = tOut.split(':').map(Number);
      
      let diff = (outH + outM / 60) - (inH + inM / 60);
      if (diff < 0) diff += 24; 
      
      if (diff > 5) diff -= 1;
      
      updated.regularHours = Math.min(8, Math.max(0, diff));
      updated.otHours = Math.max(0, diff - 8);
    } else if (updated.status === 'absent') {
      updated.regularHours = 0;
      updated.otHours = 0;
    }

    setAttendanceData(prev => ({ ...prev, [key]: updated }));

    if (!user) return;
    try {
      const docId = updated.id || `${employeeId}_${date}`;
      const { id, ...dataToSave } = updated;
      await setDoc(doc(db, 'attendance', docId), {
        ...dataToSave,
        employeeId,
        date,
        userId: user.uid,
        createdAt: updated.createdAt || new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      setError(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
    }
  };

  const toggleExpand = (empId: string) => {
    setExpandedEmp(expandedEmp === empId ? null : empId);
  };

  return (
    <div className="h-full flex flex-col relative">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Attendance</h1>
        
        <div className="flex bg-slate-200/60 dark:bg-slate-800 p-1.5 rounded-2xl">
          <button 
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'mark' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
            onClick={() => setActiveTab('mark')}
          >
            Mark Attendance
          </button>
          <button 
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'report' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
            onClick={() => setActiveTab('report')}
          >
            Date Range Report
          </button>
        </div>
      </div>

      {activeTab === 'mark' ? (
        <div className="bento-card flex-col bg-white dark:bg-slate-800 p-4 mb-4 shrink-0 shadow-sm border border-slate-200 dark:border-slate-700">
          <Label className="text-xs text-slate-500 mb-1.5">Date</Label>
          <Input 
            type="date" 
            value={singleDate} 
            onChange={e => setSingleDate(e.target.value)} 
            className="rounded-xl h-12 w-full font-medium" 
          />
        </div>
      ) : (
        <div className="bento-card overflow-hidden bg-white dark:bg-slate-800 p-4 mb-4 shrink-0 flex gap-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs text-slate-500">Start Date</Label>
            <Input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="rounded-xl h-11 w-full font-medium" 
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs text-slate-500">End Date</Label>
            <Input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              className="rounded-xl h-11 w-full font-medium" 
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 pb-20">
        {activeTab === 'mark' ? (
          employees.map(emp => {
            const att = attendanceData[`${emp.id}_${singleDate}`];
            const isPresent = att?.status === 'present';
            const isAbsent = att?.status === 'absent';

            return (
              <div key={emp.id} className="bento-card flex-col bg-white dark:bg-slate-800 p-5 relative overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="mb-4">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight mb-0.5">{emp.fullName}</h3>
                  <div className="text-xs text-slate-500 font-medium tracking-wide">{(emp.dailySalary || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}/day</div>
                </div>
                
                <div className="flex gap-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <button 
                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm transition-colors font-bold ${
                      isPresent 
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30' 
                        : 'bg-white text-emerald-600 hover:bg-emerald-50/50 dark:bg-slate-800 dark:text-emerald-500'
                    }`}
                    onClick={() => handleAttendanceChange(emp.id, singleDate, 'status', 'present')}
                  >
                    {isPresent && <Check className="w-5 h-5 shrink-0" />} Present
                  </button>
                  <div className="w-px bg-slate-200 dark:bg-slate-700" />
                  <button 
                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm transition-colors font-bold ${
                      isAbsent 
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30' 
                        : 'bg-rose-50/20 text-rose-600 hover:bg-rose-50/50 dark:bg-slate-800 dark:text-rose-500'
                    }`}
                    onClick={() => handleAttendanceChange(emp.id, singleDate, 'status', 'absent')}
                  >
                    {isAbsent && <X className="w-5 h-5 shrink-0" />} Absent
                  </button>
                </div>

                {isPresent && (
                  <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-2 fade-in">
                     <div className="space-y-1.5 cursor-pointer">
                       <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Time In</Label>
                       <Input 
                         type="time" 
                         value={att.timeIn || '07:00'} 
                         onChange={(e) => handleAttendanceChange(emp.id, singleDate, 'timeIn', e.target.value)}
                         className="h-11 rounded-xl bg-slate-50 dark:bg-slate-900 font-medium text-center"
                       />
                     </div>
                     <div className="space-y-1.5">
                       <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Time Out</Label>
                       <Input 
                         type="time" 
                         value={att.timeOut || '16:00'} 
                         onChange={(e) => handleAttendanceChange(emp.id, singleDate, 'timeOut', e.target.value)}
                         className="h-11 rounded-xl bg-slate-50 dark:bg-slate-900 font-medium text-center"
                       />
                     </div>
                     <div className="space-y-1.5">
                       <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider relative">Reg. Hrs</Label>
                       <Input 
                         type="number" step="0.5"
                         value={att.regularHours || 0} 
                         onChange={(e) => handleAttendanceChange(emp.id, singleDate, 'regularHours', parseFloat(e.target.value) || 0)}
                         className="h-11 rounded-xl bg-slate-50 dark:bg-slate-900 font-medium text-center"
                       />
                     </div>
                     <div className="space-y-1.5">
                       <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">OT Hrs</Label>
                       <Input 
                         type="number" step="0.5"
                         value={att.otHours || 0} 
                         onChange={(e) => handleAttendanceChange(emp.id, singleDate, 'otHours', parseFloat(e.target.value) || 0)}
                         className="h-11 rounded-xl bg-slate-50 dark:bg-slate-900 font-medium text-center"
                       />
                     </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          employees.map(emp => {
            const isExpanded = expandedEmp === emp.id;
            
            let presentDays = 0;
            let absentDays = 0;
            let totalHours = 0;
            let totalOt = 0;
            let totalPay = 0;

            const hourlyRate = (emp.dailySalary || 0) / 8;

            dates.forEach(d => {
              const att = attendanceData[`${emp.id}_${d}`];
              if (att?.status === 'present') {
                presentDays++;
                totalHours += (att.regularHours || 0);
                totalOt += (att.otHours || 0);
              } else {
                absentDays++;
              }
            });

            totalPay = (totalHours * hourlyRate) + (totalOt * hourlyRate);

            return (
              <div key={emp.id} className="bento-card flex-col bg-white dark:bg-slate-800 p-0 overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
                <div 
                  className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  onClick={() => toggleExpand(emp.id)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">{emp.fullName}</h3>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                  
                  <div className="flex gap-2 flex-wrap mb-4">
                    <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 leading-none">
                      <Check className="w-3 h-3" /> {presentDays} Present
                    </span>
                    <span className="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 leading-none">
                      <X className="w-3 h-3" /> {absentDays} Absent
                    </span>
                    <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 leading-none">
                      ₱{totalPay.toFixed(2)} earned
                    </span>
                  </div>

                  <div className="grid grid-cols-3 divide-x border-y border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 -mx-4 -mb-4 text-center">
                    <div className="py-2.5">
                      <div className="text-[10px] text-slate-500 mb-0.5 font-medium tracking-wide">Total Hours</div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{totalHours.toFixed(1)}</div>
                    </div>
                    <div className="py-2.5">
                      <div className="text-[10px] text-slate-500 mb-0.5 font-medium tracking-wide">OT Hours</div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{totalOt.toFixed(1)}</div>
                    </div>
                    <div className="py-2.5">
                      <div className="text-[10px] text-slate-500 mb-0.5 font-medium tracking-wide">Total Pay</div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">₱{totalPay.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-white dark:bg-slate-800 pt-0">
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {dates.map(date => {
                        const att = attendanceData[`${emp.id}_${date}`];
                        const isPresent = att?.status === 'present';
                        const isAbsent = !isPresent; // Automatically consider unmarked as absent
                        const dateObj = parseISO(date);
                        const dailyPay = isPresent ? ((att.regularHours || 0) * hourlyRate) + ((att.otHours || 0) * hourlyRate) : 0;

                        return (
                          <div 
                            key={date} 
                            className={`p-4 ${isPresent ? 'bg-emerald-50/20 dark:bg-emerald-900/5' : 'bg-rose-50/30 dark:bg-rose-900/5'}`}
                          >
                            <div className="flex justify-between items-center mb-3">
                              <div className="font-bold text-slate-900 dark:text-white text-sm">
                                {format(dateObj, 'EEE, MMM dd, yyyy')}
                              </div>
                              <select 
                                className={`rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer ${isPresent ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}
                                value={isPresent ? 'present' : 'absent'}
                                onChange={(e) => {
                                  handleAttendanceChange(emp.id, date, 'status', e.target.value);
                                }}
                              >
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                              </select>
                            </div>

                            {isPresent && (
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in slide-in-from-top-1">
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Time In</Label>
                                  <Input 
                                    type="time" 
                                    value={att?.timeIn || '07:00'} 
                                    onChange={(e) => handleAttendanceChange(emp.id, date, 'timeIn', e.target.value)}
                                    className="h-9 rounded-lg bg-white dark:bg-slate-900 font-medium text-xs text-center"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Time Out</Label>
                                  <Input 
                                    type="time" 
                                    value={att?.timeOut || '16:00'} 
                                    onChange={(e) => handleAttendanceChange(emp.id, date, 'timeOut', e.target.value)}
                                    className="h-9 rounded-lg bg-white dark:bg-slate-900 font-medium text-xs text-center"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center">
                                    <Label className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Reg. Hrs</Label>
                                  </div>
                                  <Input 
                                    type="number" step="0.5"
                                    value={att?.regularHours || 0} 
                                    onChange={(e) => handleAttendanceChange(emp.id, date, 'regularHours', parseFloat(e.target.value) || 0)}
                                    className="h-9 rounded-lg bg-white dark:bg-slate-900 font-medium text-xs text-center"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">OT Hrs</Label>
                                  <Input 
                                    type="number" step="0.5"
                                    value={att?.otHours || 0} 
                                    onChange={(e) => handleAttendanceChange(emp.id, date, 'otHours', parseFloat(e.target.value) || 0)}
                                    className="h-9 rounded-lg bg-white dark:bg-slate-900 font-medium text-xs text-center"
                                  />
                                </div>
                              </div>
                            )}

                            <div className="text-right mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                              {isPresent ? (
                                <div className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                                  Earned: ₱{dailyPay.toFixed(2)}
                                </div>
                              ) : (
                                <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                  Absent
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        
        {employees.length === 0 && (
          <div className="text-center py-10 text-slate-500 dark:text-slate-400">
            No active employees found.
          </div>
        )}
      </div>
    </div>
  );
}
