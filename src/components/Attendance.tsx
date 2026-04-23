import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc, orderBy, deleteField } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Employee, Attendance as AttendanceType, PakyawJob } from '../types';
import { format, parseISO, eachDayOfInterval, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { ChevronDown, ChevronUp, Check, X, ChevronLeft, ChevronRight, Calendar, Calculator, Download } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Skeleton } from './ui/Skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Attendance() {
  const { user } = useAuth();
  const { employees: allEmps, pakyawJobs, loading: dataLoading } = useData();
  const [activeTab, setActiveTab] = useState<'mark' | 'report'>('mark');
  const [singleDate, setSingleDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [startDate, setStartDate] = useState(() => localStorage.getItem('attendanceStartDate') || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => localStorage.getItem('attendanceEndDate') || format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [attendanceData, setAttendanceData] = useState<Record<string, Partial<AttendanceType>>>({});
  const [error, setError] = useState<string | null>(null);
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const employees = useMemo(() => {
    return allEmps.filter(e => (e.status === 'active' || !e.status) && e.role !== 'ceo' && e.role !== 'admin').sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [allEmps]);
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState<'bulk' | 'individual'>('bulk');
  const [exportEmpId, setExportEmpId] = useState<string>('all');

  useEffect(() => {
    localStorage.setItem('attendanceStartDate', startDate);
    localStorage.setItem('attendanceEndDate', endDate);
  }, [startDate, endDate]);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      try {
        const { getDocs, collection, query, where } = await import('firebase/firestore');
        
        // Initial Attendance Fetch for selected range
        const queryStart = activeTab === 'mark' ? singleDate : startDate;
        const queryEnd = activeTab === 'mark' ? singleDate : endDate;

        const attQ = query(collection(db, 'attendance'), where('date', '>=', queryStart), where('date', '<=', queryEnd));
        
        let attSnap;
        try {
          // Try server fetch
          attSnap = await getDocs(attQ);
        } catch (e: any) {
          console.warn("Server fetch failed.", e.message);
        }

        const atts: Record<string, Partial<AttendanceType>> = {};
        if (attSnap) {
          attSnap.forEach(doc => { 
            const data = doc.data() as AttendanceType; 
            atts[`${data.employeeId}_${data.date}`] = { ...data, id: doc.id }; 
          });
        }
        setAttendanceData(atts);
        setLoading(false);
      } catch (error: any) {
        // Silently handle quota
        const isQuota = error?.message?.toLowerCase().includes('quota') || 
                        error?.message?.toLowerCase().includes('resource-exhausted');
        if (!isQuota) {
          setError('Failed to load data');
          handleFirestoreError(error, OperationType.GET, 'attendance_fetch');
        }
        setLoading(false);
      }
    };

    fetchData();
  }, [user, activeTab, startDate, endDate, singleDate]);

  const dates = useMemo(() => {
    if (activeTab === 'mark') return [singleDate];
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      if (start > end) return [];
      return eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'));
    } catch { return []; }
  }, [activeTab, startDate, endDate, singleDate]);

  const calculateDailyPay = useCallback((emp: Employee, key: string) => {
    const att = attendanceData[key];
    if (!att || att.status === 'absent') return 0;
    if (att.status === 'pakyaw') {
      const date = key.split('_')[1];
      const jobs = pakyawJobs.filter(j => j.startDate === date && j.employeeIds.includes(emp.id));
      return jobs.reduce((sum, j) => sum + (j.totalPrice / (j.employeeIds.length || 1)), 0);
    }
    const hourlyRate = emp.dailySalary / 8;
    return ((att.regularHours || 0) + (att.otHours || 0)) * hourlyRate;
  }, [attendanceData, pakyawJobs]);

  const calculatePeriodTotal = useCallback((emp: Employee) => {
    return dates.reduce((sum, date) => sum + calculateDailyPay(emp, `${emp.id}_${date}`), 0);
  }, [dates, calculateDailyPay]);

  const calculateGrandTotal = useCallback(() => {
    return employees.reduce((sum, emp) => sum + calculatePeriodTotal(emp), 0);
  }, [employees, calculatePeriodTotal]);

  const handlePrevDate = () => {
    setSingleDate(prev => format(subDays(parseISO(prev), 1), 'yyyy-MM-dd'));
  };

  const handleNextDate = () => {
    setSingleDate(prev => format(addDays(parseISO(prev), 1), 'yyyy-MM-dd'));
  };

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

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const periodString = activeTab === 'mark' 
      ? format(parseISO(singleDate), 'MMMM d, yyyy')
      : `${format(parseISO(startDate), 'MMM d, yyyy')} to ${format(parseISO(endDate), 'MMM d, yyyy')}`;

    doc.setFontSize(16);
    doc.text('Attendance Report', 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${periodString}`, 14, 28);
    
    let yPos = 35;
    
    const employeesToExport = exportScope === 'individual' && exportEmpId !== 'all'
      ? employees.filter(e => e.id === exportEmpId)
      : employees;

    employeesToExport.forEach((emp, index) => {
      // Add a small gap between tables if printing multiple, unless it's a bulk table
      if (exportScope === 'individual' && index > 0) {
        yPos += 10;
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
      }

      const tableData = dates.map(date => {
        const att = attendanceData[`${emp.id}_${date}`];
        let statusDisplay = 'Absent';
        let timeInOut = '-- / --';
        let reg = '0.0';
        let ot = '0.0';
        let detail = `₱${calculateDailyPay(emp, `${emp.id}_${date}`).toLocaleString(undefined, {minimumFractionDigits: 2})}`;

        if (att) {
          if (att.status === 'hd') statusDisplay = 'Half Day';
          else if (att.status === 'present') statusDisplay = 'Present';
          else if (att.status === 'pakyaw') statusDisplay = 'Pakyaw';
          else if (att.status === 'ut') statusDisplay = 'Undertime';
          
          if (att.status === 'present' || att.status === 'ut' || att.status === 'hd') {
            timeInOut = `${att.timeIn || '--'} - ${att.timeOut || '--'}`;
            reg = (att.regularHours || 0).toString();
            ot = (att.otHours || 0).toString();
          }
          if (att.status === 'pakyaw') {
            const jobs = pakyawJobs.filter(j => j.startDate === date && j.employeeIds.includes(emp.id));
            if (jobs.length > 0) {
               detail += ` (${jobs.map(j => j.description).join(', ')})`;
            }
          }
        }

        return [
          format(parseISO(date), 'MMM dd (EEE)'),
          statusDisplay,
          timeInOut,
          reg,
          ot,
          detail
        ];
      });

      if (exportScope === 'individual') {
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Employee: ${emp.fullName} (${emp.position || 'Staff'})`, 14, yPos);
        yPos += 5;
        
        autoTable(doc, {
          startY: yPos,
          head: [['Date', 'Status', 'Time', 'Reg', 'OT', 'Amount (₱) / Details']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 8 },
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 5;
        
        // Add footer for this employee
        doc.setFontSize(9);
        doc.text(`Total Period Amount: ₱${calculatePeriodTotal(emp).toLocaleString(undefined, {minimumFractionDigits: 2})}`, 14, yPos);
        yPos += 5;
      }
    });

    if (exportScope === 'bulk') {
      // Bulk view: summarize by employee rather than per day, or flattened if single date
      if (activeTab === 'mark') {
         const bulkData = employeesToExport.map(emp => {
            const att = attendanceData[`${emp.id}_${singleDate}`];
            let statusDisplay = 'Absent';
            let timeInOut = '-- / --';
            let reg = '0.0';
            let ot = '0.0';
            if (att) {
              if (att.status === 'hd') statusDisplay = 'Half Day';
              else if (att.status === 'present') statusDisplay = 'Present';
              else if (att.status === 'pakyaw') statusDisplay = 'Pakyaw';
              else if (att.status === 'ut') statusDisplay = 'Undertime';
              timeInOut = `${att.timeIn || '--:--'} - ${att.timeOut || '--:--'}`;
              reg = (att.regularHours || 0).toString();
              ot = (att.otHours || 0).toString();
            }
            return [
              emp.fullName,
              statusDisplay,
              timeInOut,
              reg,
              ot,
              `₱${calculateDailyPay(emp, `${emp.id}_${singleDate}`).toLocaleString()}`
            ];
         });
         
         autoTable(doc, {
            startY: yPos,
            head: [['Name', 'Status', 'Time', 'Reg', 'OT', 'Amount (₱)']],
            body: bulkData,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] },
            styles: { fontSize: 8 },
          });
      } else {
         // Range Bulk Review
         const bulkData: any[] = [];
         
         employeesToExport.forEach(emp => {
            // Add a row to group by employee? To make the report clearer. Let's add a shaded row for the Employee name before their dates.
            bulkData.push([{ content: `Employee: ${emp.fullName}`, colSpan: 6, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }, '']);
            
            let periodTotal = 0;

            dates.forEach(d => {
               const att = attendanceData[`${emp.id}_${d}`];
               
               let statusDisplay = 'Absent';
               let timeInOut = '-- / --';
               let reg = '0.0';
               let ot = '0.0';
               
               const dailyPay = calculateDailyPay(emp, `${emp.id}_${d}`);
               periodTotal += dailyPay;
               
               let detail = `₱${dailyPay.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

               if (att) {
                 if (att.status === 'hd') statusDisplay = 'Half Day';
                 else if (att.status === 'present') statusDisplay = 'Present';
                 else if (att.status === 'pakyaw') statusDisplay = 'Pakyaw';
                 else if (att.status === 'ut') statusDisplay = 'Undertime';
                 
                 if (att.status === 'present' || att.status === 'ut' || att.status === 'hd') {
                   timeInOut = `${att.timeIn || '--'} - ${att.timeOut || '--'}`;
                   reg = (att.regularHours || 0).toString();
                   ot = (att.otHours || 0).toString();
                 }
                 if (att.status === 'pakyaw') {
                   const jobs = pakyawJobs.filter(j => j.startDate === d && j.employeeIds.includes(emp.id));
                   if (jobs.length > 0) {
                      detail += ` (${jobs.map(j => j.description).join(', ')})`;
                   }
                 }
               }
               
               bulkData.push([
                 format(parseISO(d), 'MMM dd'),
                 '', // Empty Name column since we used a group header
                 statusDisplay,
                 timeInOut,
                 reg,
                 ot,
                 detail
               ]);
            });

            // Employee Subtotal
            bulkData.push([{ content: `Subtotal`, colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `₱${periodTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`, styles: { fontStyle: 'bold' } }]);
         });
         
         autoTable(doc, {
            startY: yPos,
            head: [['Date', 'Name', 'Status', 'Time', 'Reg', 'OT', 'Amount (₱)']],
            body: bulkData,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] },
            styles: { fontSize: 8 },
            didDrawPage: function (data) {
               yPos = data.cursor ? data.cursor.y : 0;
            }
          });
          
          yPos = (doc as any).lastAutoTable.finalY + 10;
          doc.setFontSize(12);
          doc.text(`Grand Total: ₱${calculateGrandTotal().toLocaleString(undefined, {minimumFractionDigits: 2})}`, 14, yPos);
      }
    }

    doc.save(`Attendance_${activeTab}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    setShowExportModal(false);
  };

  return (
    <div className="h-full flex flex-col w-full p-2 sm:px-4 space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight shrink-0 uppercase italic">Attendance</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setShowExportModal(true)}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/10 text-white border border-white/20 font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl hover:bg-white/20 transition-all backdrop-blur-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Report</span>
          </button>
          <div className="flex bg-transparent p-1 rounded-xl border border-white/10 flex-1 sm:flex-none">
            <button 
              className={`flex-1 sm:px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'mark' ? 'bg-white/10 text-white shadow-xl border border-white/20' : 'text-white/40 hover:text-white'}`}
              onClick={() => setActiveTab('mark')}
            >
              Mark
            </button>
            <button 
              className={`flex-1 sm:px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'report' ? 'bg-white/10 text-white shadow-xl border border-white/20' : 'text-white/40 hover:text-white'}`}
              onClick={() => setActiveTab('report')}
            >
              Report
            </button>
          </div>
          <button 
            onClick={() => setShowExportModal(true)}
            className="sm:hidden flex items-center justify-center p-2 bg-white text-slate-900 rounded-xl shadow-lg"
          >
            <Download className="w-5 h-5" />
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
          <div className="col-span-full grid grid-cols-2 gap-2 bg-transparent p-3 rounded-xl border border-white/10 shadow-xl">
            <div className="space-y-1">
              <Label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block leading-none">Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-lg h-9 w-full font-bold bg-slate-950/50 border-white/10 text-white text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block leading-none">End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-lg h-9 w-full font-bold bg-slate-950/50 border-white/10 text-white text-sm" />
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
                <div key={emp.id} className="bento-card bg-transparent border border-white/10 flex flex-col p-4 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden border border-blue-500/20">
                        {emp.photoURL ? (
                          <img src={emp.photoURL} alt={emp.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          emp.fullName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white truncate">{emp.fullName}</h3>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">₱{emp.dailySalary}/d</span>
                        </div>
                        <div className="flex gap-1 mt-0.5">
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${
                            isPresent ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            isPakyaw ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            isHD ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                            isUT ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                            'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {isHD ? 'Half Day' : isPresent ? 'Present' : isPakyaw ? 'Pakyaw' : isUT ? 'UT' : 'Absent'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-cyan-400">₱{calculateDailyPay(emp, `${emp.id}_${singleDate}`).toLocaleString()}</div>
                      <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest leading-none">EARNED TODAY</div>
                    </div>
                  </div>
                  
                   {(isPresent || isUT || isHD) && (
                    <div className="space-y-3 mb-4 pt-2 border-t border-white/5">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black text-white/50 uppercase tracking-widest leading-none">Time In</Label>
                          <Input type="time" value={att?.timeIn || '07:00'} onChange={e => handleAttendanceChange(emp.id, singleDate, 'timeIn', e.target.value)} className="h-8 rounded-lg bg-white/5 border border-white/10 font-mono text-xs p-2 text-white" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black text-white/50 uppercase tracking-widest leading-none">Time Out</Label>
                          <Input type="time" value={att?.timeOut || '16:00'} onChange={e => handleAttendanceChange(emp.id, singleDate, 'timeOut', e.target.value)} className="h-8 rounded-lg bg-white/5 border border-white/10 font-mono text-xs p-2 text-white" />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex-1 text-center border-r border-white/10 last:border-0">
                          <div className="text-[8px] font-black text-white/40 uppercase tracking-widest">Regular</div>
                          <div className="text-xs font-black text-white">{att.regularHours || 0}h</div>
                        </div>
                        <div className="flex-1 text-center border-r border-white/10 last:border-0">
                          <div className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Overtime</div>
                          <div className="text-xs font-black text-emerald-400">{(att.otHours || 0).toFixed(1)}h</div>
                        </div>
                        {(isUT || (att.regularHours || 0) < 8) && (
                          <div className="flex-1 text-center border-r border-white/10 last:border-0">
                            <div className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Undertime</div>
                            <div className="text-xs font-black text-amber-400">
                              {Math.max(0, 8 - (att.regularHours || 0)).toFixed(1)}h
                            </div>
                          </div>
                        )}
                        <div className="flex-1 text-center">
                          <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Daily Pay</div>
                          <div className="text-xs font-black text-cyan-400">
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
                  <span className="text-[10px] font-medium bg-white/20 px-2 py-0.5 rounded-full">
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
    
      {/* Export Options Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="sm:max-w-md border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle>Export PDF Report</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-700 dark:text-slate-300">Period Selected:</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">
                  {activeTab === 'mark' ? format(parseISO(singleDate), 'MMMM d, yyyy') : `${format(parseISO(startDate), 'MMM d, yy')} - ${format(parseISO(endDate), 'MMM d, yy')}`}
                </span>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Export Scope</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setExportScope('bulk')}
                    className={`py-2 px-3 rounded-lg border font-bold text-xs transition-colors ${exportScope === 'bulk' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                  >
                    Bulk Report
                  </button>
                  <button
                    onClick={() => setExportScope('individual')}
                    className={`py-2 px-3 rounded-lg border font-bold text-xs transition-colors ${exportScope === 'individual' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                  >
                    Per Employee
                  </button>
                </div>
              </div>

              {exportScope === 'individual' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Select Employee</Label>
                  <select 
                    value={exportEmpId} 
                    onChange={(e) => setExportEmpId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Employees (Separate Pages)</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button 
              onClick={handleExportPDF}
              className="w-full h-11 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download {exportScope === 'bulk' ? 'Bulk Report' : 'Employee Report'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
  </div>
);
}
