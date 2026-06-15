import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc, orderBy, deleteField, deleteDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, addAuditLog } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Employee, Attendance as AttendanceType, PakyawJob, DailyProof } from '../types';
import { format, parseISO, eachDayOfInterval, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { ChevronDown, ChevronUp, Check, X, ChevronLeft, ChevronRight, Calendar, Calculator, Download, Plus, Camera, FileText, User, MapPin, RefreshCw } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Skeleton } from './ui/Skeleton';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import CameraCapture from './CameraCapture';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Attendance() {
  const { user } = useAuth();
  const { employees: allEmps, pakyawJobs, loading: dataLoading } = useData();
  const [activeTab, setActiveTab] = useState<'mark' | 'report'>('mark');
  const [singleDate, setSingleDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [startDate, setStartDate] = useState(() => localStorage.getItem('payrollStartDate') || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => localStorage.getItem('payrollEndDate') || format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceType[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [dailyProof, setDailyProof] = useState<DailyProof | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isSavingProof, setIsSavingProof] = useState(false);
  const [proofNotes, setProofNotes] = useState('');
  const [photographerName, setPhotographerName] = useState('');
  const [showProofPhoto, setShowProofPhoto] = useState(false);
  const [isProofExpanded, setIsProofExpanded] = useState(false);

  // Fetch Daily Proof for selected singleDate
  useEffect(() => {
    if (!user || activeTab !== 'mark') return;

    const proofQ = query(
      collection(db, 'dailyProofs'),
      where('date', '==', singleDate)
    );

    const unsubscribe = onSnapshot(proofQ, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data() as DailyProof;
        setDailyProof({ ...data, id: docSnap.id });
        setProofNotes(data.notes || '');
        setPhotographerName(data.photographer || '');
      } else {
        setDailyProof(null);
        setProofNotes('');
        setPhotographerName('');
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'dailyProofs');
    });

    return () => unsubscribe();
  }, [user, singleDate, activeTab]);

  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeletePhoto = async () => {
    if (!dailyProof || !user || !dailyProof.id) return;
    
    setIsDeletingPhoto(true);
    try {
      const proofRef = doc(db, 'dailyProofs', dailyProof.id);
      await setDoc(proofRef, {
        photoUrl: deleteField(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      await addAuditLog('Deleted Daily Proof Photo', 'DailyProof', `Deleted photo for ${singleDate}.`);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Delete photo error:', err);
      handleFirestoreError(err, OperationType.WRITE, 'dailyProofs');
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const handleSaveProof = async (photoUrl?: string) => {
    if (!user || !singleDate) return;
    
    // Optimization: Check if anything actually changed
    const isNotesChanged = proofNotes !== (dailyProof?.notes || '');
    const isNameChanged = photographerName !== (dailyProof?.photographer || '');
    
    // Only proceed if there's a new photo OR if text data changed
    if (!photoUrl && !isNotesChanged && !isNameChanged) {
      return;
    }

    setIsSavingProof(true);
    try {
      const proofId = dailyProof?.id || `proof_${singleDate}`;
      const proofData: Partial<DailyProof> = {
        date: singleDate,
        notes: proofNotes,
        photographer: photographerName,
        updatedAt: new Date().toISOString() as any,
        isTemporary: true
      };

      if (photoUrl) {
        proofData.photoUrl = photoUrl;
      }

      if (!dailyProof) {
        (proofData as any).createdAt = new Date().toISOString();
      }

      await setDoc(doc(db, 'dailyProofs', proofId), proofData, { merge: true });
      setShowCamera(false);
      
      // Only log if it's a significant update
      if (photoUrl || isNotesChanged || isNameChanged) {
        await addAuditLog('Saved Daily Proof', 'DailyProof', `Saved proof for ${singleDate}.`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'dailyProofs');
    } finally {
      setIsSavingProof(false);
    }
  };

  // Cleanup effect: Delete proofs older than 3 days after payroll payment
  useEffect(() => {
    if (!user) return;
    const cleanupOldProofs = async () => {
      try {
        const proofsRef = collection(db, 'dailyProofs');
        const q = query(proofsRef, where('payrollPaidAt', '!=', null));
        const snapshot = await getDocs(q);
        
        const now = new Date();
        const deletePromises = snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          if (data.payrollPaidAt) {
            const paidDate = new Date(data.payrollPaidAt);
            const diffDays = (now.getTime() - paidDate.getTime()) / (1000 * 3600 * 24);
            if (diffDays > 3) {
              await deleteDoc(doc(db, 'dailyProofs', docSnap.id));
            }
          }
        });
        await Promise.all(deletePromises);
      } catch (err) {
        console.error('Proof cleanup failed:', err);
      }
    };
    
    cleanupOldProofs();
  }, [user]);

  const employees = useMemo(() => {
    return allEmps
      .filter(e => (e.status === 'active' || !e.status) && (e.role || '').toLowerCase() !== 'ceo' && (e.role || '').toLowerCase() !== 'admin')
      .filter(e => {
        const matchesSearch = (e.fullName || '').toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        if (statusFilter === 'all' || activeTab === 'report') return true;

        const atts = attendanceData[`${e.id}_${singleDate}`] || [];
        
        if (statusFilter === 'absent') {
          return atts.length === 0 || atts.some(a => a.status === 'absent');
        }
        if (statusFilter === 'ot') {
          return atts.some(a => a.otHours > 0);
        }
        if (statusFilter === 'present') {
          return atts.some(a => a.status === 'present');
        }
        if (statusFilter === 'ut') {
          return atts.some(a => a.status === 'ut');
        }
        if (statusFilter === 'hd') {
          return atts.some(a => a.status === 'hd');
        }
        if (statusFilter === 'pakyaw') {
          return atts.some(a => a.status === 'pakyaw');
        }

        return true;
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [allEmps, searchTerm, statusFilter, attendanceData, singleDate, activeTab]);
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState<'bulk' | 'individual'>('bulk');
  const [exportEmpId, setExportEmpId] = useState<string>('all');
  const [exportStatusFilter, setExportStatusFilter] = useState<string>('all');

  useEffect(() => {
    localStorage.setItem('payrollStartDate', startDate);
    localStorage.setItem('payrollEndDate', endDate);
    window.dispatchEvent(new Event('payrollDateChange'));
  }, [startDate, endDate]);

  useEffect(() => {
    const handleStorage = () => {
      const savedStart = localStorage.getItem("payrollStartDate");
      const savedEnd = localStorage.getItem("payrollEndDate");
      if (savedStart) setStartDate(savedStart);
      if (savedEnd) setEndDate(savedEnd);
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("payrollDateChange", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("payrollDateChange", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Initial Attendance Fetch for selected range
    const queryStart = activeTab === 'mark' ? singleDate : startDate;
    const queryEnd = activeTab === 'mark' ? singleDate : endDate;

    const attQ = query(
      collection(db, 'attendance'), 
      where('date', '>=', queryStart), 
      where('date', '<=', queryEnd)
    );

    const unsubscribe = onSnapshot(attQ, (snapshot) => {
      const atts: Record<string, AttendanceType[]> = {};
      const uniqueDocs = Array.from(new Map(snapshot.docs.map(doc => [doc.id, doc])).values());
      
      uniqueDocs.forEach(docSnap => { 
        const data = docSnap.data() as AttendanceType; 
        const key = `${data.employeeId}_${data.date}`;
        if (!atts[key]) atts[key] = [];
        atts[key].push({ ...data, id: docSnap.id });
      });
      setAttendanceData(atts);
      setLoading(false);
    }, (error) => {
      const isQuota = error?.message?.toLowerCase().includes('quota') || 
                      error?.message?.toLowerCase().includes('resource-exhausted');
      if (!isQuota) {
        setError('Failed to load data');
        handleFirestoreError(error, OperationType.GET, 'attendance_live');
      }
      setLoading(false);
    });

    return () => unsubscribe();
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

  const calculateDailyPay = useCallback((emp: Employee, key: string, ignorePakyaw: boolean = false) => {
    const atts = attendanceData[key] || [];
    if (atts.length === 0) return 0;
    
    let total = 0;
    const date = key.split('_')[1];

    atts.forEach(att => {
      if (att.status === 'absent') return;
      
      // Use historical rate if available, fall back to current
      const rateToUse = att.hourlyRate || (emp.dailySalary / 8);

      if (att.status === 'pakyaw') {
        if (ignorePakyaw) return;
        const jobId = att.pakyawJobId;
        if (jobId) {
          const job = pakyawJobs.find(j => j.id === jobId);
          if (job && job.status === 'completed') {
             total += (job.totalPrice / (job.employeeIds.length || 1));
          }
        }
      } else {
        total += ((att.regularHours || 0) + (att.otHours || 0)) * rateToUse;
      }
    });

    return total;
  }, [attendanceData, pakyawJobs]);

  const calculatePeriodTotal = useCallback((emp: Employee) => {
    let total = 0;
    const countedJobIds = new Set<string>();

    dates.forEach(date => {
      const key = `${emp.id}_${date}`;
      const atts = attendanceData[key] || [];

      atts.forEach(att => {
        if (att.status === 'absent') return;

        // Use historical rate if available, fall back to current
        const rateToUse = att.hourlyRate || (emp.dailySalary / 8);

        if (att.status === 'pakyaw') {
          const jobId = att.pakyawJobId;
          if (jobId) {
            if (!countedJobIds.has(jobId)) {
              const job = pakyawJobs.find(j => j.id === jobId);
              if (job && job.status === 'completed') {
                total += (job.totalPrice / (job.employeeIds.length || 1));
                countedJobIds.add(jobId);
              }
            }
          }
        } else {
          total += ((att.regularHours || 0) + (att.otHours || 0)) * rateToUse;
        }
      });
    });
    return total;
  }, [dates, attendanceData, pakyawJobs]);

  const calculateGrandTotal = useCallback(() => {
    return employees.reduce((sum, emp) => sum + calculatePeriodTotal(emp), 0);
  }, [employees, calculatePeriodTotal]);

  const handlePrevDate = () => {
    setSingleDate(prev => format(subDays(parseISO(prev), 1), 'yyyy-MM-dd'));
  };

  const handleNextDate = () => {
    setSingleDate(prev => format(addDays(parseISO(prev), 1), 'yyyy-MM-dd'));
  };

  const deleteAttendance = async (id: string, employeeId: string, date: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'attendance', id));
    } catch (error) {
      setError('Delete failed');
      handleFirestoreError(error, OperationType.DELETE, 'attendance');
    }
  };

  const handleAttendanceChange = async (employeeId: string, date: string, field: keyof AttendanceType, value: any, recordId?: string) => {
    setError(null);

    // FIX: If we are clearing a pakyaw job ID, delete the record.
    if (field === 'pakyawJobId' && (!value || value === '')) {
       if (recordId) {
         try {
           await deleteDoc(doc(db, 'attendance', recordId));
           return; 
         } catch (error) {
           setError('Remove failed');
           handleFirestoreError(error, OperationType.DELETE, 'attendance');
           return;
         }
       }
    }

    const key = `${employeeId}_${date}`;
    const allRecords = attendanceData[key] || [];
    
    let current: Partial<AttendanceType>;
    if (recordId) {
      current = allRecords.find(r => r.id === recordId) || { id: recordId };
    } else {
      // If we are changing status to something that didn't exist, check if we should update an empty record or add new
      current = { 
        employeeId, 
        date, 
        status: 'present', 
        timeIn: '07:00', 
        timeOut: '16:00', 
        regularHours: 0, 
        otHours: 0,
        pakyawJobId: undefined
      };
    }
    
    // Create new updated object
    let updated: Partial<AttendanceType> = { ...current, [field]: value };
    
    // Auto-calculate for status changes to ensure times match the intent
    if (field === 'status') {
      if (value === 'absent') {
          // Delete all other records for this employee and date to prevent multiple records
          for (const rec of allRecords) {
              if (rec.id !== recordId) {
                 await deleteDoc(doc(db, 'attendance', rec.id));
              }
          }
      }

      if (value === 'hd') {
        updated.timeIn = '07:00'; 
        updated.timeOut = '12:00';
      } else if (value === 'present') {
        updated.timeIn = '07:00'; 
        updated.timeOut = '16:00'; 
      } else if (value === 'ut') {
        updated.timeIn = '08:00'; // Defaults to 1 hour late
        updated.timeOut = '16:00';
      } else if (value === 'absent' || value === 'pakyaw') {
        updated.timeIn = deleteField() as any;
        updated.timeOut = deleteField() as any;
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
      
      const shiftStart = 7.0;
      const shiftEnd = 16.0;
      const breakStart = 12.0;
      const breakEnd = 13.0;

      // 1. Early OT (Before 7am)
      const earlyOt = Math.max(0, Math.min(end, shiftStart) - start);
      
      // 2. Late OT (After 4pm)
      const lateOt = Math.max(0, end - Math.max(start, shiftEnd));

      // 3. Regular Range calculation
      const regRangeStart = Math.max(start, shiftStart);
      const regRangeEnd = Math.min(end, shiftEnd);
      
      let regDuration = Math.max(0, regRangeEnd - regRangeStart);
      
      // Subtract intersection with break window
      const overlapStart = Math.max(regRangeStart, breakStart);
      const overlapEnd = Math.min(regRangeEnd, breakEnd);
      const breakOverlap = Math.max(0, overlapEnd - overlapStart);
      regDuration -= breakOverlap;
      
      const otDuration = earlyOt + lateOt;

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

    // Persist to Firebase
    if (!user) return;
    try {
      const employee = allEmps.find(e => e.id === employeeId);
      const dailyRate = employee?.dailySalary || 0;
      const hourlyRate = dailyRate / 8;

      const docId = recordId || `${employeeId}_${date}_${Date.now()}`;
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
        dailyRate,
        hourlyRate,
        createdAt: updated.createdAt || new Date().toISOString() 
      }, { merge: true });
      await addAuditLog('Marked Attendance', 'Attendance', `Marked attendance for employee ID ${employeeId} on ${date}.`);
    } catch (error) { 
      setError(`Save failed`); 
      handleFirestoreError(error, OperationType.WRITE, 'attendance'); 
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const periodString = activeTab === 'mark' 
      ? format(parseISO(singleDate), 'MMMM d, yyyy')
      : `${format(parseISO(startDate), 'MMMM d, yyyy')} to ${format(parseISO(endDate), 'MMMM d, yyyy')}`;

    doc.setFontSize(16);
    doc.text('Attendance Report', 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${periodString}`, 14, 28);
    
    let yPos = 35;

    const matchesStatusFilter = (atts: any[]) => {
      if (exportStatusFilter === 'all') return true;
      if (exportStatusFilter === 'present_all') return atts.length > 0;
      if (exportStatusFilter === 'absent') return atts.length === 0;
      return atts.some(a => a.status === exportStatusFilter);
    };
    
    const employeesToExport = (exportScope === 'individual' && exportEmpId !== 'all'
      ? employees.filter(e => e.id === exportEmpId)
      : employees.filter(emp => {
          // In bulk mode, if we filter by status, we might want to only include employees 
          // who have at least one record matching that status in the period
          if (exportStatusFilter === 'all') return true;
          return dates.some(d => matchesStatusFilter(attendanceData[`${emp.id}_${d}`] || []));
      })).filter(emp => {
        // Double check if employee has any data at all if filtering
        if (exportStatusFilter === 'all') return true;
        return dates.some(d => matchesStatusFilter(attendanceData[`${emp.id}_${d}`] || []));
      });

    employeesToExport.forEach((emp, index) => {
      // Add a small gap between tables if printing multiple, unless it's a bulk table
      if (exportScope === 'individual' && index > 0) {
        yPos += 10;
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
      }

      const countedJobIdsInReport = new Set<string>();
      let filteredPeriodTotal = 0;
      
      const tableData = dates
        .filter(date => matchesStatusFilter(attendanceData[`${emp.id}_${date}`] || []))
        .map(date => {
          const atts = attendanceData[`${emp.id}_${date}`] || [];
          let statusDisplay = atts.length === 0 ? 'Absent' : atts.map(a => a.status.charAt(0).toUpperCase() + a.status.slice(1)).join(', ');
          let timeInOut = atts.map(a => (a.timeIn && a.timeOut) ? `${a.timeIn}-${a.timeOut}` : '').filter(Boolean).join('\n') || '-- / --';
          let reg = atts.reduce((s, a) => s + (a.regularHours || 0), 0).toFixed(1);
          let ot = atts.reduce((s, a) => s + (a.otHours || 0), 0).toFixed(1);
          
          // Calculate daily pay without automatic pakyaw multiplication
          let dailyRegPay = calculateDailyPay(emp, `${emp.id}_${date}`, true);
          let dailyPakyawPay = 0;
          
          const pakyawNotes = atts.filter(a => a.status === 'pakyaw')
            .map(a => {
              const job = pakyawJobs.find(j => j.id === a.pakyawJobId);
              if (job) {
                if (job.status === 'completed') {
                  if (!countedJobIdsInReport.has(job.id)) {
                    const share = (job.totalPrice / (job.employeeIds.length || 1));
                    dailyPakyawPay += share;
                    countedJobIdsInReport.add(job.id);
                    return `${job.description} (₱${share.toLocaleString()})`;
                  }
                  return `${job.description} (cont.)`;
                } else {
                  return `${job.description} (In Progress)`;
                }
              }
              return '';
            }).filter(Boolean).join(', ');

          const totalRowPay = dailyRegPay + dailyPakyawPay;
          filteredPeriodTotal += totalRowPay;
          let detail = `₱${totalRowPay.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
          if (pakyawNotes) detail += ` [${pakyawNotes}]`;

          return [
            format(parseISO(date), 'MMMM dd, yyyy (EEE)'),
            statusDisplay,
            timeInOut,
            reg,
            ot,
            detail
          ];
        });

      if (exportScope === 'individual' && tableData.length > 0) {
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
        doc.text(`Filtered Total: ₱${filteredPeriodTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 14, yPos);
        yPos += 5;
      }
    });

    if (exportScope === 'bulk') {
      // Bulk view: summarize by employee rather than per day, or flattened if single date
      if (activeTab === 'mark') {
         const bulkData = employeesToExport
          .filter(emp => matchesStatusFilter(attendanceData[`${emp.id}_${singleDate}`] || []))
          .map(emp => {
            const atts = attendanceData[`${emp.id}_${singleDate}`] || [];
            let statusDisplay = atts.length === 0 ? 'Absent' : atts.map(a => a.status.charAt(0).toUpperCase() + a.status.slice(1)).join(', ');
            let timeInOut = atts.map(a => (a.timeIn && a.timeOut) ? `${a.timeIn}-${a.timeOut}` : '').filter(Boolean).join('\n') || '-- / --';
            let reg = atts.reduce((s, a) => s + (a.regularHours || 0), 0).toFixed(1);
            let ot = atts.reduce((s, a) => s + (a.otHours || 0), 0).toFixed(1);
            
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
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
            styles: { fontSize: 8, textColor: [0, 0, 0], fillColor: [255, 255, 255] },
          });
      } else {
         // Range Bulk Review
         const bulkData: any[] = [];
         let grandFilteredTotal = 0;
         
         employeesToExport.forEach(emp => {
            const employeeMatchedDates = dates.filter(d => matchesStatusFilter(attendanceData[`${emp.id}_${d}`] || []));
            if (employeeMatchedDates.length === 0) return;

            // Add a row to group by employee
            bulkData.push([{ content: `Employee: ${emp.fullName}`, colSpan: 7, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }]);
            
            let periodTotal = 0;
            const countedJobsInBulk = new Set<string>();

            employeeMatchedDates.forEach(d => {
                const atts = attendanceData[`${emp.id}_${d}`] || [];
                
                let dailyRegPay = calculateDailyPay(emp, `${emp.id}_${d}`, true);
                let dailyPakyawPay = 0;
                
                const pakyawNotes = atts.filter(a => a.status === 'pakyaw')
                  .map(a => {
                    const job = pakyawJobs.find(j => j.id === a.pakyawJobId);
                    if (job) {
                      if (job.status === 'completed') {
                        if (!countedJobsInBulk.has(job.id)) {
                          const share = (job.totalPrice / (job.employeeIds.length || 1));
                          dailyPakyawPay += share;
                          countedJobsInBulk.add(job.id);
                          return `${job.description} (₱${share.toLocaleString()})`;
                        }
                        return `${job.description} (cont.)`;
                      } else {
                        return `${job.description} (In Progress)`;
                      }
                    }
                    return '';
                  }).filter(Boolean).join(', ');

                const totalRowPay = dailyRegPay + dailyPakyawPay;
                periodTotal += totalRowPay;
                
                let statusDisplay = atts.length === 0 ? 'Absent' : atts.map(a => a.status.charAt(0).toUpperCase() + a.status.slice(1)).join(', ');
                let timeInOut = atts.map(a => (a.timeIn && a.timeOut) ? `${a.timeIn}-${a.timeOut}` : '').filter(Boolean).join('\n') || '-- / --';
                let reg = atts.reduce((s, a) => s + (a.regularHours || 0), 0).toFixed(1);
                let ot = atts.reduce((s, a) => s + (a.otHours || 0), 0).toFixed(1);
                let detail = `₱${totalRowPay.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
                if (pakyawNotes) detail += ` [${pakyawNotes}]`;

                bulkData.push([
                  format(parseISO(d), 'MMMM dd, yyyy'),
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
            grandFilteredTotal += periodTotal;
         });
         
         autoTable(doc, {
            startY: yPos,
            head: [['Date', 'Name', 'Status', 'Time', 'Reg', 'OT', 'Amount (₱)']],
            body: bulkData,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
            styles: { fontSize: 8, textColor: [0, 0, 0], fillColor: [255, 255, 255] },
            didDrawPage: function (data) {
               yPos = data.cursor ? data.cursor.y : 0;
            }
          });
          
          yPos = (doc as any).lastAutoTable.finalY + 10;
          doc.setFontSize(12);
          doc.text(`Grand Filtered Total: ₱${grandFilteredTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 14, yPos);
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
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/10 text-white border border-white/20 font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl hover:bg-white/20 transition-all"
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
        <div className="flex gap-2">
          {activeTab === 'mark' ? (
            <div className="bg-white/5 p-2 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-1 flex-1 group">
              <button 
                onClick={handlePrevDate}
                className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-white/50 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 bg-slate-950/40 px-3 py-2 rounded-xl flex items-center gap-2 border border-white/5">
                <div className="w-1 h-6 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
                <div className="flex flex-col flex-1">
                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Selected Date</span>
                  <Input 
                    type="date" 
                    value={singleDate} 
                    onChange={e => setSingleDate(e.target.value)} 
                    className="rounded-none h-6 w-full font-black bg-transparent border-0 text-xs p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-white cursor-pointer [color-scheme:dark]" 
                  />
                </div>
              </div>
              <button 
                onClick={handleNextDate}
                className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-white/50 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 bg-transparent p-3 rounded-xl border border-white/10 shadow-xl flex-1 text-white">
              <div className="space-y-1">
                <Label className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1 block leading-none">Start Date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-lg h-10 w-full font-black bg-slate-950/50 border border-white/10 text-white text-sm focus:ring-2 focus:ring-blue-500/20 [color-scheme:dark]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1 block leading-none">End Date</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-lg h-10 w-full font-black bg-slate-950/50 border border-white/10 text-white text-sm focus:ring-2 focus:ring-blue-500/20 [color-scheme:dark]" />
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-white/5 p-2 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-1 group">
           <div className="flex-1 bg-slate-950/40 px-3 py-2 rounded-xl flex items-center gap-2 border border-white/5">
            <div className="w-1 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <div className="flex flex-col flex-1">
              <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">Search Employee</span>
              <Input 
                placeholder="Type name..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="rounded-none h-6 w-full font-black bg-transparent border-0 text-xs p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-white/20"
              />
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'mark' && (
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide px-1 -mt-1 sm:mt-0 no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'present', label: 'Present' },
            { id: 'absent', label: 'Absent' },
            { id: 'ut', label: 'Undertime' },
            { id: 'hd', label: 'Half Day' },
            { id: 'ot', label: 'With OT' },
            { id: 'pakyaw', label: 'Pakyaw' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border transition-all duration-300 ${
                statusFilter === f.id 
                ? 'bg-blue-600 text-white border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)]' 
                : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20 hover:text-white/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-20 px-1">
        {loading ? (
          <div className="space-y-4">
            <Skeleton count={5} className="h-40 w-full mb-3 rounded-2xl" />
          </div>
        ) : activeTab === 'mark' ? (
          <div className="grid grid-cols-1 gap-3">
            {/* Daily Proof Section */}
            <div className="bg-slate-900 border border-white/5 rounded-[32px] mb-4 overflow-hidden shadow-2xl relative">
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                <Camera className="w-16 h-16 text-white" />
              </div>
              
              <div className="p-5 sm:p-6">
                <div 
                  className="flex items-center justify-between cursor-pointer group"
                  onClick={() => setIsProofExpanded(!isProofExpanded)}
                >
                  <div className="flex-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] italic flex items-center gap-2 group-hover:text-blue-400 transition-colors">
                      Daily Group Proof
                      <motion.div
                        animate={{ rotate: isProofExpanded ? 180 : 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <ChevronDown className="w-4 h-4 text-white/40" />
                      </motion.div>
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-0.5">Verification requirement for current shift</p>
                  </div>
                  
                  {dailyProof?.photoUrl && (
                    <div className="flex items-center gap-2 pr-2">
                       <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Saved</span>
                       </div>
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {isProofExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                        <div className="space-y-4">
                          <div className="relative group/photo aspect-video bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-inner cursor-pointer">
                            {dailyProof?.photoUrl ? (
                              <>
                                <img 
                                  src={dailyProof.photoUrl} 
                                  alt="Daily Proof" 
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover/photo:scale-105" 
                                  onClick={() => setShowProofPhoto(true)}
                                />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/photo:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-10" onClick={(e) => { e.stopPropagation(); setShowProofPhoto(true); }}>
                                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center border border-white/20 shadow-2xl">
                                    <FileText className="w-6 h-6 text-white" />
                                  </div>
                                  <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] bg-black/40 px-3 py-1 rounded-full border border-white/5">Tap to View</span>
                                </div>
                              </>
                            ) : (
                              <div 
                                onClick={(e) => { e.stopPropagation(); setShowCamera(true); }}
                                className="w-full h-full flex flex-col items-center justify-center gap-3 hover:bg-white/5 transition-colors"
                              >
                                <div className="w-14 h-14 bg-white/5 text-white/40 rounded-full flex items-center justify-center border border-white/10 border-dashed group-hover:scale-110 transition-transform">
                                  <Camera className="w-7 h-7" />
                                </div>
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">No photo uploaded yet</span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {dailyProof?.photoUrl ? (
                              <>
                                <button 
                                  onClick={() => setShowCamera(true)}
                                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/5 text-white rounded-xl font-black uppercase text-[10px] tracking-widest border border-white/10 hover:bg-white/10 transition-all"
                                >
                                  <RefreshCw className="w-4 h-4 text-white/60" />
                                  Update Photo
                                </button>
                                <button 
                                  onClick={() => setShowDeleteConfirm(true)}
                                  className="px-4 py-3 bg-rose-500/10 text-rose-500 rounded-xl font-black uppercase text-[10px] tracking-widest border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all group"
                                >
                                  <X className="w-4 h-4 group-hover:scale-125 transition-transform" />
                                </button>
                              </>
                            ) : (
                              <button 
                                onClick={() => setShowCamera(true)}
                                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-blue-500 hover:scale-[1.02] active:scale-95 transition-all"
                              >
                                <Camera className="w-5 h-5" />
                                Open Camera
                              </button>
                            )}
                          </div>

                          <AnimatePresence>
                            {showDeleteConfirm && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="absolute inset-0 z-50 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center"
                              >
                                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-4">
                                  <X className="w-8 h-8 text-rose-500" />
                                </div>
                                <h4 className="text-sm font-black text-white uppercase tracking-widest italic mb-2">Delete Photo?</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-6 max-w-[200px]">This action cannot be undone. The proof photo will be removed from the record.</p>
                                
                                <div className="flex gap-3 w-full max-w-[240px]">
                                  <button 
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 h-12 bg-white/5 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 active:scale-95 transition-all"
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeletePhoto(); }}
                                    disabled={isDeletingPhoto}
                                    className="flex-1 h-12 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-rose-600/30 active:scale-95 transition-all disabled:opacity-50"
                                  >
                                    {isDeletingPhoto ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Photographer Details</Label>
                            <div className="relative group">
                              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-blue-500 transition-colors">
                                <User className="w-full h-full" />
                              </div>
                              <Input 
                                placeholder="Employee who took the proof..."
                                value={photographerName}
                                onChange={(e) => setPhotographerName(e.target.value)}
                                onBlur={() => handleSaveProof()}
                                className="h-12 pl-12 bg-white/5 border-white/10 text-white text-sm font-bold rounded-2xl focus:ring-blue-500/20 focus:bg-white/10 transition-all"
                              />
                            </div>
                          </div>

                          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                            <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5" />
                              Site Information
                            </h4>
                            <div className="flex flex-col gap-1">
                               <span className="text-xs font-bold text-white/80">{singleDate} (Current Shift)</span>
                               <span className="text-[10px] text-white/30 font-medium italic">Timestamp will be logged upon submission</span>
                            </div>
                          </div>

                          <div className="flex-1 flex flex-col space-y-1">
                            <Label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-1 flex justify-between">
                              Notes / Reason
                            </Label>
                            <textarea
                              placeholder="Add reason if no photo or other details..."
                              value={proofNotes}
                              onChange={(e) => setProofNotes(e.target.value)}
                              onBlur={() => handleSaveProof()}
                              className="flex-1 min-h-[100px] bg-white/5 border border-white/10 text-white text-xs font-medium p-3 rounded-2xl focus:ring-2 focus:ring-blue-500/20 resize-none placeholder:text-white/10"
                            />
                            {isSavingProof && (
                              <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest text-right mt-1 animate-pulse">
                                Saving...
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center justify-between px-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest italic">
                  Showing {employees.length} {employees.length === 1 ? 'employee' : 'employees'}
                </span>
                {statusFilter !== 'all' && (
                  <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-[8px] font-black text-blue-400 uppercase tracking-widest">
                    {statusFilter}
                  </span>
                )}
              </div>
              {(statusFilter !== 'all' || searchTerm) && (
                <button 
                  onClick={() => { setStatusFilter('all'); setSearchTerm(''); }}
                  className="text-[9px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1 hover:text-rose-300 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>

            {employees.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-center px-6 bg-white/[0.02] border border-white/5 rounded-[40px] mt-2">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <User className="w-8 h-8 text-white/20" />
                </div>
                <h4 className="text-sm font-black text-white uppercase tracking-widest italic mb-2">No Employees Found</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight max-w-[200px]">
                  {statusFilter !== 'all' 
                    ? `No one is marked as "${statusFilter}" on this date.` 
                    : "No matches found for your search term."}
                </p>
                <button 
                  onClick={() => { setStatusFilter('all'); setSearchTerm(''); }}
                  className="mt-6 px-6 py-2 bg-white/5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all"
                >
                  Show All Employees
                </button>
              </div>
            )}

            {employees.map(emp => {
              const atts = attendanceData[`${emp.id}_${singleDate}`] || [];
              const hasPakyaw = atts.some(a => a.status === 'pakyaw');
              
              return (
                <div key={emp.id} className="bg-slate-900/40 p-4 rounded-3xl border border-white/5 transition-colors hover:bg-slate-800/60">
                  <div 
                    className="flex items-center justify-between mb-4 cursor-pointer" 
                    onClick={() => setExpandedEmp(expandedEmp === emp.id ? null : emp.id)}
                  >
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
                          {atts.length > 0 ? (
                            atts.map((a, i) => (
                              <span key={`${a.id || 'new'}_${i}`} className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${
                                a.status === 'present' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                a.status === 'pakyaw' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                a.status === 'hd' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                                a.status === 'ut' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                                'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}>
                                {a.status}
                              </span>
                            ))
                          ) : (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              Absent
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-black text-cyan-400">
                          {hasPakyaw 
                            ? (atts.some(a => {
                                const job = pakyawJobs.find(j => j.id === a.pakyawJobId);
                                return job && job.status === 'completed';
                              }) ? `₱${calculateDailyPay(emp, `${emp.id}_${singleDate}`).toLocaleString()}` : 'IN PROGRESS')
                            : `₱${calculateDailyPay(emp, `${emp.id}_${singleDate}`).toLocaleString()}`}
                        </div>
                        <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest leading-none">
                          {hasPakyaw ? 'PAKYAW CONTRACT' : 'EARNED TODAY'}
                        </div>
                      </div>
                      {expandedEmp === emp.id ? <ChevronUp className="w-4 h-4 text-white/20" /> : <ChevronDown className="w-4 h-4 text-white/20" />}
                    </div>
                  </div>
                  
                  {expandedEmp === emp.id && (
                    <div className="space-y-4">
                      {atts.map((att, idx) => {
                        const isHD = att.status === 'hd' || (att.timeIn === '07:00' && att.timeOut === '12:00');
                        const isUT = (att.status === 'ut' || (att.status === 'present' && (att.regularHours || 0) < 8 && (att.regularHours || 0) > 0)) && !isHD;
                        const isPresent = att.status === 'present' && !isUT && !isHD;
                        const isPakyaw = att.status === 'pakyaw';

                        return (
                          <div 
                            key={`${att.id || 'new'}_${idx}`} 
                            className="pt-4 border-t border-white/5 bg-white/5 p-3 rounded-2xl relative group/card"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteAttendance(att.id, emp.id, singleDate);
                              }}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity shadow-lg z-10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            
                            {(isPresent || isUT || isHD) && (
                              <div className="space-y-3 mb-4">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-[9px] font-black text-white/50 uppercase tracking-widest leading-none">Time In</Label>
                                    <Input 
                                      type="time" 
                                      value={att?.timeIn || '07:00'} 
                                      onChange={e => handleAttendanceChange(emp.id, singleDate, 'timeIn', e.target.value, att.id)} 
                                      className="h-8 rounded-lg bg-white/5 border border-white/10 font-mono text-xs p-2 text-white [color-scheme:dark]" 
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[9px] font-black text-white/50 uppercase tracking-widest leading-none">Time Out</Label>
                                    <Input 
                                      type="time" 
                                      value={att?.timeOut || '16:00'} 
                                      onChange={e => handleAttendanceChange(emp.id, singleDate, 'timeOut', e.target.value, att.id)} 
                                      className="h-8 rounded-lg bg-white/5 border border-white/10 font-mono text-xs p-2 text-white [color-scheme:dark]" 
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 p-2 bg-slate-950/40 rounded-xl border border-white/5">
                                  <div className="flex-1 text-center border-r border-white/10">
                                    <div className="text-[8px] font-black text-white/40 uppercase tracking-widest">Regular</div>
                                    <div className="text-xs font-black text-white">{att.regularHours || 0}h</div>
                                  </div>
                                  <div className="flex-1 text-center border-r border-white/10">
                                    <div className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">OT</div>
                                    <div className="text-xs font-black text-emerald-400">{(att.otHours || 0).toFixed(1)}h</div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {isPakyaw && (
                              <div className="space-y-3 mb-4">
                                <div>
                                   <Label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Assigned Pakyaw Job</Label>
                                   <select 
                                     value={att?.pakyawJobId || ''} 
                                     onChange={(e) => handleAttendanceChange(emp.id, singleDate, 'pakyawJobId', e.target.value, att.id)} 
                                     className="w-full h-9 px-3 rounded-xl border-0 bg-slate-950/40 text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500/20"
                                   >
                                    <option value="">-- Select Job --</option>
                                    {pakyawJobs
                                      .filter(job => job.employeeIds.includes(emp.id) && (job.status === 'pending' || job.id === att.pakyawJobId))
                                      .map(job => <option key={job.id} value={job.id}>{job.containerNumber ? `[${job.containerNumber}] ` : ''}{job.description} (₱{job.totalPrice.toLocaleString()})</option>)
                                    }
                                  </select>
                                </div>

                                {att.pakyawJobId && (
                                   <div className="flex items-center justify-between p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                      <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Pakyaw Share</span>
                                      <span className="text-sm font-black text-amber-300">
                                        {(() => {
                                          const job = pakyawJobs.find(j => j.id === att.pakyawJobId);
                                          return job ? `₱${(job.totalPrice / (job.employeeIds.length || 1)).toLocaleString()}` : '₱0';
                                        })()}
                                      </span>
                                   </div>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-5 gap-1.5 mt-auto">
                              <button 
                                onClick={() => handleAttendanceChange(emp.id, singleDate, 'status', 'present', att.id)} 
                                className={`py-2 text-[8px] rounded-lg font-black uppercase tracking-widest transition-all border ${att.status === 'present' ? 'bg-emerald-600 text-white border-emerald-500/50 shadow-lg' : 'bg-white/5 text-white/40 border-white/10'}`}
                              >
                                Present
                              </button>
                              <button 
                                onClick={() => handleAttendanceChange(emp.id, singleDate, 'status', 'hd', att.id)} 
                                className={`py-2 text-[8px] rounded-lg font-black uppercase tracking-widest transition-all border ${att.status === 'hd' ? 'bg-indigo-600 text-white border-indigo-500/50 shadow-lg' : 'bg-white/5 text-white/40 border-white/10'}`}
                              >
                                Half Day
                              </button>
                              <button 
                                onClick={() => handleAttendanceChange(emp.id, singleDate, 'status', 'ut', att.id)} 
                                className={`py-2 text-[8px] rounded-lg font-black uppercase tracking-widest transition-all border ${att.status === 'ut' ? 'bg-sky-600 text-white border-sky-500/50 shadow-lg' : 'bg-white/5 text-white/40 border-white/10'}`}
                              >
                                Undertime
                              </button>
                              <button 
                                onClick={() => handleAttendanceChange(emp.id, singleDate, 'status', 'pakyaw', att.id)} 
                                className={`py-2 text-[8px] rounded-lg font-black uppercase tracking-widest transition-all border ${att.status === 'pakyaw' ? 'bg-amber-600 text-white border-amber-500/50 shadow-lg' : 'bg-white/5 text-white/40 border-white/10'}`}
                              >
                                Pakyaw
                              </button>
                               <button 
                                onClick={() => handleAttendanceChange(emp.id, singleDate, 'status', 'absent', att.id)} 
                                className={`py-2 text-[8px] rounded-lg font-black uppercase tracking-widest transition-all border ${att.status === 'absent' ? 'bg-rose-600 text-white border-rose-500/50 shadow-lg' : 'bg-white/5 text-white/40 border-white/10'}`}
                              >
                                Absent
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <button 
                        onClick={() => handleAttendanceChange(emp.id, singleDate, 'status', 'present')}
                        className="w-full py-3 bg-blue-500/10 border border-dashed border-blue-500/20 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-3 h-3" />
                        Add New Shift Interval
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {employees.length > 0 && (
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 sm:p-5 text-white shadow-lg shadow-blue-200 dark:shadow-none mb-2">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 opacity-80 uppercase tracking-widest text-[10px] font-bold">
                    <Calculator className="w-3 h-3" />
                    Period Overview
                  </div>
                  <span className="text-[10px] font-medium bg-white/20 px-2 py-0.5 rounded-full">
                    {format(parseISO(startDate), 'MMMM dd, yyyy')} - {format(parseISO(endDate), 'MMMM dd, yyyy')}
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
                              const atts = attendanceData[`${emp.id}_${d}`] || [];
                              return atts.some(a => a.status === 'present' && (a.regularHours === undefined || a.regularHours >= 8));
                            }).length} Pres
                          </span>
                          <span className="text-[8px] font-bold text-rose-700 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {dates.filter(d => {
                              const atts = attendanceData[`${emp.id}_${d}`] || [];
                              return atts.length === 0 || atts.every(a => a.status === 'absent');
                            }).length} Abs
                          </span>
                          <span className="text-[8px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {dates.filter(d => {
                              const atts = attendanceData[`${emp.id}_${d}`] || [];
                              return atts.some(a => a.status === 'pakyaw');
                            }).length} Paky
                          </span>
                          <span className="text-[8px] font-bold text-sky-700 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {dates.filter(d => {
                              const atts = attendanceData[`${emp.id}_${d}`] || [];
                              return atts.some(att => {
                                const isHDLocal = att?.status === 'hd' || (att?.timeIn === '07:00' && att?.timeOut === '12:00');
                                return (att?.status === 'ut' || (att?.status === 'present' && att?.regularHours !== undefined && att?.regularHours < 8)) && !isHDLocal;
                              });
                            }).length} UT
                          </span>
                          <span className="text-[8px] font-bold text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {dates.filter(d => {
                              const atts = attendanceData[`${emp.id}_${d}`] || [];
                              return atts.some(att => att?.status === 'hd' || (att?.timeIn === '07:00' && att?.timeOut === '12:00'));
                            }).length} HD
                          </span>
                          <span className="text-[8px] font-bold text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {dates.reduce((sum, d) => {
                              const atts = attendanceData[`${emp.id}_${d}`] || [];
                              return sum + atts.reduce((s, a) => s + (a.otHours || 0), 0);
                            }, 0).toFixed(1)} OT
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
                      const atts = attendanceData[`${emp.id}_${date}`] || [];
                      const hasRecordsDetail = atts.length > 0;

                      return (
                        <div key={date} className="pt-4 first:pt-4 border-b last:border-0 border-slate-100 dark:border-slate-800 pb-4">
                          <div className="flex justify-between items-center mb-3">
                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{format(parseISO(date), 'MMMM dd, yyyy (EEE)')}</span>
                            <div className="text-right">
                               <div className="text-[11px] font-black text-blue-600 dark:text-blue-400">₱{calculateDailyPay(emp, `${emp.id}_${date}`).toLocaleString()}</div>
                               <div className="text-[8px] text-slate-400 uppercase font-bold tracking-tighter leading-none">Day Total</div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {atts.map((att, attIdx) => {
                               const isHD_detail = att.status === 'hd' || (att.timeIn === '07:00' && att.timeOut === '12:00');
                               const isUT_detail = (att.status === 'ut' || (att.status === 'present' && (att.regularHours || 0) < 8 && (att.regularHours || 0) > 0)) && !isHD_detail;
                               const isPresent_detail = att.status === 'present' && !isUT_detail && !isHD_detail;
                               const isAbs_detail = att.status === 'absent';
                               const isPakyaw_detail = att.status === 'pakyaw';

                               return (
                                 <div key={att.id || attIdx} className="bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                   <div className="flex justify-between items-center mb-2">
                                     <div className="flex gap-2 text-[10px] font-bold p-1">
                                        {isPresent_detail && <span className="text-emerald-600">Present</span>}
                                        {isUT_detail && <span className="text-sky-600">Undertime</span>}
                                        {isHD_detail && <span className="text-indigo-600">Half Day</span>}
                                        {isAbs_detail && <span className="text-rose-600">Absent</span>}
                                        {isPakyaw_detail && <span className="text-amber-600">Pakyaw</span>}
                                     </div>
                                     <div className="flex gap-2 text-[10px] font-bold text-slate-500">
                                       {(isPresent_detail || isUT_detail || isHD_detail) && (
                                         <>
                                           <span>{att.timeIn} - {att.timeOut}</span>
                                           <span className="text-slate-400">({att.regularHours}h {att.otHours ? `+ ${att.otHours}h OT` : ''})</span>
                                         </>
                                       )}
                                       {att.dailyRate && (
                                         <span className="text-slate-400 border-l border-slate-200 dark:border-slate-700 pl-2">₱{att.dailyRate}/day</span>
                                       )}
                                       {isPakyaw_detail && (
                                         <span className="text-amber-600">
                                          {pakyawJobs.find(j => j.id === att.pakyawJobId) ? 
                                              (pakyawJobs.find(j => j.id === att.pakyawJobId)?.containerNumber ? `[${pakyawJobs.find(j => j.id === att.pakyawJobId)?.containerNumber}] ` : '') + (pakyawJobs.find(j => j.id === att.pakyawJobId)?.description || 'Job Assigned')
                                            : 'Job Assigned'}
                                         </span>
                                       )}
                                       <button 
                                         onClick={() => deleteAttendance(att.id, emp.id, date)}
                                         className="ml-2 text-rose-500 hover:text-rose-700"
                                       >
                                         <X className="w-3.5 h-3.5" />
                                       </button>
                                     </div>
                                   </div>

                                   <div className="flex gap-2 mb-2">
                                     <button onClick={() => handleAttendanceChange(emp.id, date, 'status', 'present', att.id)} className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg ${isPresent_detail ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}>Present</button>
                                     <button onClick={() => handleAttendanceChange(emp.id, date, 'status', 'pakyaw', att.id)} className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg ${isPakyaw_detail ? 'bg-amber-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}>Pakyaw</button>
                                     <button onClick={() => handleAttendanceChange(emp.id, date, 'status', 'hd', att.id)} className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg ${isHD_detail ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}>HD</button>
                                     <button onClick={() => handleAttendanceChange(emp.id, date, 'status', 'ut', att.id)} className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg ${isUT_detail ? 'bg-sky-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}>UT</button>
                                     <button onClick={() => handleAttendanceChange(emp.id, date, 'status', 'absent', att.id)} className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg ${isAbs_detail ? 'bg-rose-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}>Absent</button>
                                   </div>

                                   {(isPresent_detail || isUT_detail || isHD_detail) && (
                                     <div className="grid grid-cols-2 gap-2">
                                       <Input type="time" value={att?.timeIn || '07:00'} onChange={e => handleAttendanceChange(emp.id, date, 'timeIn', e.target.value, att.id)} className="h-8 text-[10px] font-mono rounded-lg bg-white dark:bg-slate-800 border-0 [color-scheme:dark]" />
                                       <Input type="time" value={att?.timeOut || '16:00'} onChange={e => handleAttendanceChange(emp.id, date, 'timeOut', e.target.value, att.id)} className="h-8 text-[10px] font-mono rounded-lg bg-white dark:bg-slate-800 border-0 [color-scheme:dark]" />
                                     </div>
                                   )}
                                   {isPakyaw_detail && (
                                     <select 
                                       value={att?.pakyawJobId || ''} 
                                       onChange={(e) => handleAttendanceChange(emp.id, date, 'pakyawJobId', e.target.value, att.id)} 
                                       className="w-full h-8 px-2 rounded-lg border-0 bg-white dark:bg-slate-800 text-[10px] font-semibold"
                                     >
                                      <option value="">-- Select Job --</option>
                                      {pakyawJobs
                                        .filter(job => job.employeeIds.includes(emp.id) && (job.status === 'pending' || job.id === att.pakyawJobId))
                                        .map(job => <option key={job.id} value={job.id}>{job.containerNumber ? `[${job.containerNumber}] ` : ''}{job.description}</option>)
                                      }
                                    </select>
                                   )}
                                 </div>
                               );
                            })}
                            
                            <button 
                              onClick={() => handleAttendanceChange(emp.id, date, 'status', 'present')}
                              className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold text-slate-400 hover:text-blue-500 hover:border-blue-200 transition-all flex items-center justify-center gap-2"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Record
                            </button>
                          </div>
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
    
      {/* Proof Photo Modal */}
      <Dialog open={showProofPhoto} onOpenChange={setShowProofPhoto}>
        <DialogContent className="max-w-2xl bg-black/90 border-white/10 p-0 overflow-hidden">
          {dailyProof?.photoUrl && (
            <div className="relative aspect-[4/3]">
              <img src={dailyProof.photoUrl} alt="Group Proof" className="w-full h-full object-contain shadow-2xl" />
              <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black to-transparent">
                <p className="text-white font-black uppercase text-xs">Proof for {format(parseISO(singleDate), 'MMMM d, yyyy')}</p>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-1">Shot by: {dailyProof.photographer || 'Unspecified'}</p>
                {dailyProof.notes && (
                  <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-[10px] font-medium text-white/80 whitespace-pre-wrap">{dailyProof.notes}</p>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setShowProofPhoto(false)}
                className="absolute top-4 right-4 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center border border-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Camera Capture UI */}
      {showCamera && (
        <CameraCapture 
          onCapture={(photo) => handleSaveProof(photo)}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Export Options Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="sm:max-w-md border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle>Export PDF Report</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-700 dark:text-slate-300">Period Selected:</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">
                  {activeTab === 'mark' ? format(parseISO(singleDate), 'MMMM d, yyyy') : `${format(parseISO(startDate), 'MMMM d, yyyy')} - ${format(parseISO(endDate), 'MMMM d, yyyy')}`}
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

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Attendance Status Filter</Label>
                <select 
                  value={exportStatusFilter} 
                  onChange={(e) => setExportStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Records (Present & Absent)</option>
                  <option value="present_all">Any Work Done (Exclude Absent)</option>
                  <option value="present">Present Only (Full Day)</option>
                  <option value="hd">Half-day Only</option>
                  <option value="ut">Undertime Only</option>
                  <option value="pakyaw">Pakyaw Only</option>
                  <option value="absent">Absent Only</option>
                </select>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Filters which rows to include in the report based on mark attendance status.
                </p>
              </div>
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
