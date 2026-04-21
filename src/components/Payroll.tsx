import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { Employee, Attendance, CashAdvance } from '../types';
import { format, parseISO, eachDayOfInterval, isWithinInterval } from "date-fns";
import { calculateAttendanceHours } from "../lib/payrollUtils";
import { Calendar, ChevronRight, FileText, Download, Trash2, Loader2, Users, CreditCard, CheckCircle, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Skeleton } from './ui/Skeleton';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function Payroll() {
  const { user } = useAuth();
  const { companyInfo } = useCompanyInfo();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [startDate, setStartDate] = useState(() => localStorage.getItem('payrollStartDate') || format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(() => localStorage.getItem('payrollEndDate') || format(new Date(), 'yyyy-MM-15'));

  useEffect(() => {
    localStorage.setItem('payrollStartDate', startDate);
    window.dispatchEvent(new Event('payrollDateChange'));
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem('payrollEndDate', endDate);
    window.dispatchEvent(new Event('payrollDateChange'));
  }, [endDate]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [bulkPayrolls, setBulkPayrolls] = useState<any[]>([]);
  const [selectedBulkId, setSelectedBulkId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'process' | 'archives'>('process');
  const [archivedBulkRuns, setArchivedBulkRuns] = useState<any[]>([]);
  
  // NEW PREVIEW STATE
  const [previewData, setPreviewData] = useState<{
    payrollsToSave: any[],
    bulkTotalPay: number,
    targetEmployees: Employee[]
  } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  const payslipRef = useRef<HTMLDivElement>(null);

  const handleMarkAsPaid = async (bulkId: string) => {
    try {
      await updateDoc(doc(db, 'bulkPayrolls', bulkId), {
        status: 'paid',
        paidAt: new Date().toISOString()
      });
      
      // Send emails to employees who have them
      const payrollsQ = query(collection(db, 'payrolls'), where('bulkId', '==', bulkId));
      const payrollsSnap = await getDocs(payrollsQ);
      
      await Promise.all(payrollsSnap.docs.map(async (payrollDoc) => {
        try {
          // Also stamp the individual payroll doc as paid so employees can safely query it without reading bulkPayrolls
          await updateDoc(doc(db, 'payrolls', payrollDoc.id), {
            status: 'paid'
          });
        } catch (updateError) {
          console.error("Failed to update individual payroll status:", updateError);
        }

        const pData = payrollDoc.data();
        const emp = employees.find(e => e.id === pData.employeeId);
        if (emp?.email && emp.email.trim() !== '') {
          console.log(`Sending payslip email to ${emp.fullName} at ${emp.email}`);
          try {
            await fetch('/api/send-payslip', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: emp.email,
                employeeName: emp.fullName,
                period: `${format(parseISO(startDate), 'MMM dd')} - ${format(parseISO(endDate), 'MMM dd, yyyy')}`,
                totalPay: pData.totalPay,
                deduction: pData.cashAdvanceDeduction,
                grossPay: pData.totalGrossPay,
                companyName: companyInfo.name
              })
            });
          } catch (e) {
            console.error('Failed to send email:', e);
          }
        }
      }));

      setSelectedBulkId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'bulkPayrolls');
    }
  };

  const handleExportPDF = async () => {
    if (!payslipRef.current || !selectedPayslip) return;
    
    setIsExporting(true);
    try {
      // Temporarily remove max-height to capture full content
      const originalStyle = payslipRef.current.style.maxHeight;
      payslipRef.current.style.maxHeight = 'none';
      
      const canvas = await html2canvas(payslipRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: payslipRef.current.scrollWidth,
        windowHeight: payslipRef.current.scrollHeight,
        onclone: (clonedDoc) => {
          const payslip = clonedDoc.querySelector('.payslip-mockup');
          if (payslip) {
            // Force hex colors on the clone to avoid oklch issues
            (payslip as HTMLElement).style.color = '#0f172a';
            (payslip as HTMLElement).style.backgroundColor = '#ffffff';
            
            // Recursively find and fix oklch/oklab colors in computed styles
            const allElements = payslip.querySelectorAll('*');
            allElements.forEach(el => {
              const style = window.getComputedStyle(el);
              const isUnsupported = (val: string) => val.includes('oklch') || val.includes('oklab');
              
              if (isUnsupported(style.color)) (el as HTMLElement).style.setProperty('color', '#0f172a', 'important');
              if (isUnsupported(style.backgroundColor) && !style.backgroundColor.includes('rgba(0, 0, 0, 0)')) {
                (el as HTMLElement).style.setProperty('background-color', '#ffffff', 'important');
              }
              if (isUnsupported(style.borderColor)) (el as HTMLElement).style.setProperty('border-color', '#e2e8f0', 'important');
            });
          }
        }
      });
      
      // Restore original style
      payslipRef.current.style.maxHeight = originalStyle;
      
      const imgData = canvas.toDataURL('image/png');
      
      // A5 is exactly half of A4 (A4 is 210x297mm, A5 is 148.5x210mm)
      // When orientation is landscape, it's 210mm wide by 148.5mm high
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a5'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgRatio = canvas.height / canvas.width;
      const pdfRatio = pdfHeight / pdfWidth;
      
      let finalWidth = pdfWidth;
      let finalHeight = pdfWidth * imgRatio;
      
      if (imgRatio > pdfRatio) {
        finalHeight = pdfHeight;
        finalWidth = pdfHeight / imgRatio;
      }
      
      // Center the image vertically
      const marginX = (pdfWidth - finalWidth) / 2;
      const marginY = (pdfHeight - finalHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', marginX, marginY, finalWidth, finalHeight);
      pdf.save(`payslip_${selectedPayslip.employee.fullName.replace(/\s+/g, '_')}_${startDate}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkExportPDF = async () => {
    if (displayedPayrolls.length === 0) return;
    
    setIsExporting(true);
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a5'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      for (let i = 0; i < displayedPayrolls.length; i++) {
        const payslip = displayedPayrolls[i];
        
        // We set the selected payslip so the hidden DOM node renders it
        setSelectedPayslip(payslip);
        
        // Wait for React to render the dialog DOM
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (payslipRef.current) {
          const originalStyle = payslipRef.current.style.maxHeight;
          payslipRef.current.style.maxHeight = 'none';
          
          const canvas = await html2canvas(payslipRef.current, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: payslipRef.current.scrollWidth,
            windowHeight: payslipRef.current.scrollHeight,
            onclone: (clonedDoc) => {
              const domPayslip = clonedDoc.querySelector('.payslip-mockup');
              if (domPayslip) {
                (domPayslip as HTMLElement).style.color = '#0f172a';
                (domPayslip as HTMLElement).style.backgroundColor = '#ffffff';
                const allElements = domPayslip.querySelectorAll('*');
                allElements.forEach(el => {
                  const style = window.getComputedStyle(el);
                  const isUnsupported = (val: string) => val.includes('oklch') || val.includes('oklab');
                  if (isUnsupported(style.color)) (el as HTMLElement).style.setProperty('color', '#0f172a', 'important');
                  if (isUnsupported(style.backgroundColor) && !style.backgroundColor.includes('rgba(0, 0, 0, 0)')) {
                    (el as HTMLElement).style.setProperty('background-color', '#ffffff', 'important');
                  }
                  if (isUnsupported(style.borderColor)) (el as HTMLElement).style.setProperty('border-color', '#e2e8f0', 'important');
                });
              }
            }
          });
          
          payslipRef.current.style.maxHeight = originalStyle;
          
          const imgData = canvas.toDataURL('image/png');
          const imgRatio = canvas.height / canvas.width;
          const pdfRatio = pdfHeight / pdfWidth;
          
          let finalWidth = pdfWidth;
          let finalHeight = pdfWidth * imgRatio;
          
          if (imgRatio > pdfRatio) {
            finalHeight = pdfHeight;
            finalWidth = pdfHeight / imgRatio;
          }
          
          const marginX = (pdfWidth - finalWidth) / 2;
          const marginY = (pdfHeight - finalHeight) / 2;
          
          if (i > 0) {
            pdf.addPage();
          }
          pdf.addImage(imgData, 'PNG', marginX, marginY, finalWidth, finalHeight);
        }
      }
      
      // Close dialog when done and save
      setSelectedPayslip(null);
      pdf.save(`Bulk_Payroll_${format(parseISO(startDate), 'MMM_dd')}_${format(parseISO(endDate), 'MMM_dd_yyyy')}.pdf`);
    } catch (error) {
      console.error('Error exporting bulk PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const emps: Employee[] = [];
      snapshot.forEach((doc) => emps.push({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(emps.sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setLoadingInitial(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'employees'));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || employees.length === 0 || viewMode !== 'process') return;
    
    const q = query(
      collection(db, 'payrolls'),
      where('startDate', '==', startDate),
      where('endDate', '==', endDate)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPayrolls: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const emp = employees.find(e => e.id === data.employeeId);
        if (emp) {
          fetchedPayrolls.push({
            id: docSnap.id,
            employee: emp,
            ...data
          });
        }
      });
      setPayrollData(fetchedPayrolls);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'payrolls'));

    // Fetch Bulk Payrolls (only non-paid ones for the active view, or we can filter locally)
    const bulkQ = query(
      collection(db, 'bulkPayrolls'),
      where('startDate', '==', startDate),
      where('endDate', '==', endDate)
    );

    const unsubscribeBulk = onSnapshot(bulkQ, (snapshot) => {
      const fetchedBulk: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.status !== 'paid') {
          fetchedBulk.push({ id: docSnap.id, ...data });
        }
      });
      setBulkPayrolls(fetchedBulk.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'bulkPayrolls'));

    return () => {
      unsubscribe();
      unsubscribeBulk();
    };
  }, [user, employees, startDate, endDate, viewMode]);

  // Fetch Archives
  useEffect(() => {
    if (!user || viewMode !== 'archives') return;
    const q = query(collection(db, 'bulkPayrolls'), where('status', '==', 'paid'));
    const unsub = onSnapshot(q, (snapshot) => {
      const runs: any[] = [];
      snapshot.forEach(doc => runs.push({ id: doc.id, ...doc.data() }));
      runs.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
      setArchivedBulkRuns(runs);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'bulkPayrolls'));
    return () => unsub();
  }, [user, viewMode]);

  // Fetch individual payrolls for a selected archive run
  useEffect(() => {
    if (!user || employees.length === 0 || viewMode !== 'archives' || !selectedBulkId) return;
    const q = query(collection(db, 'payrolls'), where('bulkId', '==', selectedBulkId));
    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedPayrolls: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        
        // AUTO-FIX: If the bulk run is closed but individual payrolls don't have the status tag, fix it here
        if (data.status !== 'paid') {
          updateDoc(doc(db, 'payrolls', docSnap.id), { status: 'paid' }).catch(console.error);
        }
        
        const emp = employees.find(e => e.id === data.employeeId);
        if (emp) fetchedPayrolls.push({ id: docSnap.id, employee: emp, ...data });
      });
      setPayrollData(fetchedPayrolls);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'payrolls'));
    return () => unsub();
  }, [user, employees, viewMode, selectedBulkId]);

  const handlePreviewPayroll = async () => {
    if (!startDate || !endDate || employees.length === 0) return;
    setIsLoading(true);
    try {
      const targetEmployees = (selectedEmployeeId === 'all' 
        ? employees.filter(e => (!e.position || !e.position.toLowerCase().includes("ceo")) && e.role !== "ceo") 
        : employees.filter(e => e.id === selectedEmployeeId));

      const q = query(
        collection(db, 'attendance'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const snapshot = await getDocs(q);
      const allAtts: Attendance[] = [];
      snapshot.forEach(doc => allAtts.push({ id: doc.id, ...doc.data() } as Attendance));

      const caQuery = query(
        collection(db, 'cashAdvances'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const caSnapshot = await getDocs(caQuery);
      const allCa: CashAdvance[] = [];
      caSnapshot.forEach(doc => allCa.push({ id: doc.id, ...doc.data() } as CashAdvance));

      const pjQuery = query(
        collection(db, 'pakyawJobs'),
        where('startDate', '>=', startDate),
        where('startDate', '<=', endDate)
      );
      const pjSnapshot = await getDocs(pjQuery);
      const allPj: any[] = [];
      pjSnapshot.forEach(doc => allPj.push({ id: doc.id, ...doc.data() }));

      const dateRange = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate)
      }).map(d => format(d, 'yyyy-MM-dd'));

      let bulkTotalPay = 0;
      const payrollsToSave: any[] = [];

      for (const emp of targetEmployees) {
        const empAtts = allAtts.filter(a => a.employeeId === emp.id);
        const empCa = allCa.filter(ca => ca.employeeId === emp.id);
        const empPjw = allPj.filter(pj => pj.employeeIds.includes(emp.id));
        
        let totalPresent = 0;
        let totalHalfDays = 0;
        let totalUndertimeDays = 0;
        let totalUndertimeHours = 0;
        let undertimeDetails: string[] = [];
        let totalAbsent = 0;
        let absentDates: string[] = [];
        let totalRegularHours = 0;
        let totalOtHours = 0;
        let cashAdvanceDeduction = 0;
        let cashAdvanceDetails: string[] = [];
        let totalPakyawPay = 0;
        let pakyawDetails: string[] = [];

        empCa.forEach(ca => {
          cashAdvanceDeduction += ca.amount;
          cashAdvanceDetails.push(`${format(parseISO(ca.date), 'MMM dd')}: ₱${ca.amount.toFixed(2)}${ca.notes ? ' (' + ca.notes + ')' : ''}`);
        });
        
        empPjw.forEach(pj => {
          const splitAmount = pj.totalPrice / Math.max(1, pj.employeeIds.length);
          if (pj.status === 'completed') {
            totalPakyawPay += splitAmount;
            pakyawDetails.push(`${pj.description}: ₱${splitAmount.toFixed(2)}`);
          } else {
            pakyawDetails.push(`${pj.description}: PENDING (Not Finished)`);
          }
        });

        dateRange.forEach(date => {
          const att = empAtts.find(a => a.date === date);
          
          if (att) {
            const { regHrs, otHrs } = calculateAttendanceHours(att);

            const dailyWorkLog = `${format(parseISO(date), 'MMM dd')}: ${regHrs}h Reg${otHrs ? `, ${otHrs}h OT` : ''}${att.status === 'hd' ? ' (HD)' : ''}`;

            const isHDRun = att.status === 'hd' || (att.timeIn === '07:00' && att.timeOut === '12:00');

            if (att.status === 'present' || att.status === 'ut' || att.status === 'hd') {
              // Check for Undertime (total worked hours < 8)
              if (isHDRun) {
                // Count as HD but add to total regular hours
                totalHalfDays++;
                totalRegularHours += regHrs;
              } else if ((regHrs + otHrs) < 8) {
                totalUndertimeDays++;
                totalUndertimeHours += regHrs;
                totalRegularHours += regHrs;
                undertimeDetails.push(dailyWorkLog);
              } else {
                // IT IS FULL DAY OR MORE
                totalPresent++;
                totalRegularHours += regHrs;
              }
              
              // Always add OT if present
              totalOtHours += otHrs;
            } else if (att.status === 'pakyaw') {
              // Logged as pakyaw, ignore for regular time calculation
            } else if (att.status === 'absent') {
              totalAbsent++;
              absentDates.push(format(parseISO(date), 'MMM dd'));
            }
          } else {
            // Not logged: Treat as absent
            totalAbsent++;
            absentDates.push(format(parseISO(date), 'MMM dd'));
          }
        });

        const hourlyRate = emp.dailySalary / 8;
        const regularPay = totalRegularHours * hourlyRate;
        const otPay = totalOtHours * hourlyRate;
        const totalGrossPay = regularPay + otPay + totalPakyawPay;
        const totalPay = totalGrossPay - cashAdvanceDeduction;

        bulkTotalPay += totalPay;

        payrollsToSave.push({
          employeeId: emp.id,
          startDate,
          endDate,
          totalPresent,
          totalHalfDays,
          totalUndertimeDays,
          totalUndertimeHours,
          undertimeDetails,
          totalAbsent,
          absentDates,
          totalRegularHours,
          totalOtHours,
          regularPay,
          otPay,
          totalPakyawPay,
          pakyawDetails,
          totalGrossPay,
          cashAdvanceDeduction,
          cashAdvanceDetails,
          totalPay,
          uid: user!.uid,
          generatedAt: new Date().toISOString()
        });
      }

      setPreviewData({
        payrollsToSave,
        bulkTotalPay,
        targetEmployees
      });
      setIsPreviewOpen(true);
      
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'attendance');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmAndGeneratePayroll = async () => {
    if (!previewData || !user) return;
    setIsLoading(true);
    try {
      let bulkId = null;

      if (selectedEmployeeId === 'all') {
        const bulkDoc = await addDoc(collection(db, 'bulkPayrolls'), {
          startDate,
          endDate,
          totalCashRequired: previewData.bulkTotalPay,
          employeeCount: previewData.targetEmployees.length,
          generatedAt: new Date().toISOString(),
          userId: user.uid
        });
        bulkId = bulkDoc.id;
      }

      for (const payload of previewData.payrollsToSave) {
        const finalPayload = { ...payload, bulkId };
        const existingQ = query(
          collection(db, 'payrolls'),
          where('employeeId', '==', finalPayload.employeeId),
          where('startDate', '==', startDate),
          where('endDate', '==', endDate)
        );
        const existingSnap = await getDocs(existingQ);
        
        if (existingSnap.empty) {
          await addDoc(collection(db, 'payrolls'), {
            ...finalPayload,
            createdAt: new Date().toISOString()
          });
        } else {
          await updateDoc(doc(db, 'payrolls', existingSnap.docs[0].id), finalPayload);
        }
      }
      setIsPreviewOpen(false);
      setPreviewData(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'payrolls');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePayroll = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'payrolls', id));
      setPayrollData(prev => prev.filter(p => p.id !== id));
      setSelectedPayslip(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'payrolls');
    }
  };

  const displayedPayrolls = (selectedEmployeeId === 'all' 
    ? (selectedBulkId ? payrollData.filter(p => p.bulkId === selectedBulkId) : [])
    : payrollData.filter(p => p.employee.id === selectedEmployeeId)
  ).sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName));

  const totalCashRequired = displayedPayrolls.reduce((sum, p) => sum + p.totalPay, 0);
  const totalEmployeesCount = displayedPayrolls.length;

  const handleDeleteBulk = async (bulkId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'bulkPayrolls', bulkId));
      
      // Correctly delete all associated payrolls from the database
      const q = query(collection(db, 'payrolls'), where('bulkId', '==', bulkId));
      const snapshot = await getDocs(q);
      for (const pDoc of snapshot.docs) {
        await deleteDoc(doc(db, 'payrolls', pDoc.id));
      }
      
      if (selectedBulkId === bulkId) setSelectedBulkId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'bulkPayrolls');
    }
  };

  const currentBulkRuns = viewMode === 'process' ? bulkPayrolls : archivedBulkRuns;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Payroll</h1>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <Button 
            variant={viewMode === 'process' ? 'secondary' : 'ghost'} 
            className="h-8 text-xs rounded-lg"
            onClick={() => { setViewMode('process'); setSelectedBulkId(null); }}
          >Process</Button>
          <Button 
            variant={viewMode === 'archives' ? 'secondary' : 'ghost'} 
            className="h-8 text-xs rounded-lg"
            onClick={() => { setViewMode('archives'); setSelectedBulkId(null); }}
          >Archives</Button>
        </div>
      </div>
      
      {viewMode === 'process' && (
        <div className="bento-card flex-col bg-white dark:bg-slate-800 p-4 mb-4 shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 dark:text-white">Pay Period</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl h-10" />
            </div>
          </div>
          <div className="space-y-1 mb-4">
            <Label className="text-xs text-slate-500">Employee Selection</Label>
            <select 
              value={selectedEmployeeId} 
              onChange={e => {
                setSelectedEmployeeId(e.target.value);
                setSelectedBulkId(null);
              }}
              className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300"
            >
              <option value="all">Bulk Payroll (All Employees)</option>
              {employees
                .filter(e => e.status === 'active' || !e.status)
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                ))}
            </select>
          </div>
          <Button 
            onClick={handlePreviewPayroll} 
            disabled={isLoading}
            className="w-full rounded-xl h-12 bg-blue-600 hover:bg-blue-700 font-bold"
          >
            {isLoading ? 'Generating...' : (selectedEmployeeId === 'all' ? 'Preview Bulk Payroll' : 'Preview Individual')}
          </Button>
        </div>
      )}

      {viewMode === 'archives' && !selectedBulkId && (
        <div className="bento-card flex-col bg-white dark:bg-slate-800 p-4 mb-4 shrink-0 border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 dark:text-white">Archived Records</h2>
          </div>
          <p className="text-xs text-slate-500">View previously processed and paid bulk payrolls.</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {loadingInitial ? (
          <div className="space-y-3">
            <Skeleton count={4} className="h-24 w-full rounded-2xl" />
          </div>
        ) : selectedEmployeeId === 'all' && !selectedBulkId && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-1">
              {viewMode === 'process' ? 'Pending Runs' : 'Paid Runs'}
            </h3>
            {currentBulkRuns.map(bulk => (
              <div 
                key={bulk.id}
                onClick={() => setSelectedBulkId(bulk.id)}
                className="bento-card flex-row items-center justify-between bg-white dark:bg-slate-800 p-4 cursor-pointer hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${viewMode === 'archives' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {viewMode === 'archives' ? (
                        <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded uppercase leading-none">Paid</span>
                      ) : (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase leading-none">Pending</span>
                      )}
                      <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                        {format(parseISO(bulk.generatedAt), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{bulk.employeeCount || 0} Staff</span>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                        <span>₱{(bulk.totalCashRequired || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBulk(bulk.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </div>
            ))}
            {currentBulkRuns.length === 0 && !isLoading && (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                {viewMode === 'process' ? 'No pending bulk payroll runs found for this period.' : 'No archived payroll runs found.'}
              </div>
            )}
          </div>
        )}

        {(selectedEmployeeId !== 'all' || selectedBulkId) && (
          <>
            {selectedBulkId && (
              <div className="flex flex-col gap-3 py-1 mb-4">
                <div className="flex items-center justify-between px-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-blue-600 hover:text-blue-700 p-0"
                    onClick={() => setSelectedBulkId(null)}
                  >
                    ← Back to {viewMode === 'process' ? 'Pending Runs' : 'Archives'}
                  </Button>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-bold text-slate-400">
                      {currentBulkRuns.find(b => b.id === selectedBulkId) && 
                        format(parseISO(currentBulkRuns.find(b => b.id === selectedBulkId).generatedAt), 'MMM dd, yyyy')}
                    </div>
                  </div>
                </div>

                {/* Grand Total Summary Card */}
                <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-500/20">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Total Cash Required</p>
                      <h2 className="text-2xl font-black">₱{totalCashRequired.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                    </div>
                    <div className="flex gap-2">
                      {viewMode === 'process' && (
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-9 gap-1 bg-green-500 hover:bg-green-600 text-white border-0 shadow-md" 
                          onClick={() => handleMarkAsPaid(selectedBulkId)}
                        >
                          <CheckCircle className="w-4 h-4" />
                          Mark as Paid
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-9 gap-1 bg-white/20 hover:bg-white/30 text-white border-0" 
                        onClick={handleBulkExportPDF}
                        disabled={isExporting}
                      >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {isExporting ? 'Exporting...' : 'Bulk PDF'}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-medium opacity-90 border-t border-white/10 pt-2">
                    <span>{totalEmployeesCount} Employees</span>
                    <span className="w-1 h-1 rounded-full bg-white/40"></span>
                    <span>Average ₱{(totalCashRequired / (totalEmployeesCount || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}/person</span>
                  </div>
                </div>
              </div>
            )}
            {displayedPayrolls.map((data, idx) => (
              <div 
                key={idx} 
                onClick={() => setSelectedPayslip(data)}
                className="bento-card flex-col bg-white dark:bg-slate-800 p-4 cursor-pointer hover:border-blue-300 transition-colors"
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold text-[10px] overflow-hidden shrink-0">
                      {data.employee.photoURL ? (
                        <img src={data.employee.photoURL} alt={data.employee.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        data.employee.fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white truncate">{data.employee.fullName}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
                <div className="grid grid-cols-5 gap-2 text-sm">
                  <div>
                    <div className="text-[9px] text-slate-500 uppercase font-semibold text-center">F/HD/UT</div>
                    <div className="font-medium text-[10px] text-center">{data.totalPresent}d / {data.totalHalfDays || 0}d / {data.totalUndertimeDays || 0}d</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500 uppercase font-semibold text-center">Regular</div>
                    <div className="font-medium text-[10px] text-center">₱{data.regularPay.toFixed(0)}</div>
                  </div>
                  <div className="border-x border-slate-100 dark:border-slate-700">
                    <div className="text-[9px] text-green-600 uppercase font-semibold text-center">OT Pay</div>
                    <div className="font-medium text-[10px] text-center text-green-600">₱{data.otPay.toFixed(0)}</div>
                  </div>
                  <div className="border-r border-slate-100 dark:border-slate-700">
                    <div className="text-[9px] text-indigo-600 uppercase font-semibold text-center">Pakyaw</div>
                    <div className="font-medium text-[10px] text-center text-indigo-600">₱{data.totalPakyawPay.toFixed(0)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-blue-600 uppercase font-semibold">Net Pay</div>
                    <div className="font-bold text-[11px] text-blue-600">₱{data.totalPay.toFixed(0)}</div>
                  </div>
                </div>
              </div>
            ))}
            {displayedPayrolls.length === 0 && !isLoading && (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                Select dates and generate payroll to see results.
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!selectedPayslip} onOpenChange={(open) => !open && setSelectedPayslip(null)}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white rounded-2xl">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Payslip Details
            </DialogTitle>
            <div className="flex gap-2">
              {selectedPayslip?.id && (
                <Button size="sm" variant="outline" className="h-8 gap-1 rounded-lg border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleDeletePayroll(selectedPayslip.id)}>
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 gap-1 rounded-lg" 
                onClick={handleExportPDF}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isExporting ? 'Exporting...' : 'Export PDF'}
              </Button>
            </div>
          </div>
          
          {selectedPayslip && (
            <div 
              ref={payslipRef}
              className="p-6 max-h-[70vh] overflow-y-auto print:max-h-none print:p-0 payslip-mockup print:border-none print:shadow-none"
              style={{ backgroundColor: '#ffffff' }}
            >
              <div className="flex justify-between border-b-2 border-slate-800 pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">PAYSLIP</h2>
                  <div className="text-sm text-slate-600 mt-1">
                    {format(parseISO(startDate), 'MMM dd')} - {format(parseISO(endDate), 'MMM dd, yyyy')}
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-lg overflow-hidden shrink-0 border border-slate-200">
                      {selectedPayslip.employee.photoURL ? (
                        <img src={selectedPayslip.employee.photoURL} alt={selectedPayslip.employee.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        selectedPayslip.employee.fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">{selectedPayslip.employee.fullName}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {selectedPayslip.employee.customId ? `${selectedPayslip.employee.customId} • ` : ''}{selectedPayslip.employee.position || 'Staff'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500 mb-1">NET PAY</div>
                  <div className={`text-2xl font-bold ${selectedPayslip.totalPay < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    ₱ {selectedPayslip.totalPay.toFixed(2)}
                  </div>
                  <div className="text-xs font-bold text-slate-800 mt-2">{companyInfo.name}</div>
                  {companyInfo.address && <div className="text-[10px] text-slate-500 mt-0.5">{companyInfo.address}</div>}
                  {companyInfo.contact && <div className="text-[10px] text-slate-500">{companyInfo.contact}</div>}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3 text-sm">EARNINGS</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Basic Pay ({selectedPayslip.totalRegularHours} hrs)</span>
                      <span className="font-medium">₱ {selectedPayslip.regularPay.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Overtime Pay ({selectedPayslip.totalOtHours} hrs)</span>
                      <span className="font-medium text-green-600">₱ {selectedPayslip.otPay.toFixed(2)}</span>
                    </div>
                    {selectedPayslip.totalPakyawPay > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Pakyaw Contracts</span>
                        <span className="font-medium text-indigo-600">₱ {selectedPayslip.totalPakyawPay.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-100 pt-2 mt-2 font-bold">
                      <span className="text-slate-900">Gross Pay</span>
                      <span className="text-slate-900">₱ {selectedPayslip.totalGrossPay.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3 text-sm">DEDUCTIONS</h3>
                  <div className="space-y-2 text-sm">
                    {selectedPayslip.cashAdvanceDeduction > 0 ? (
                      <>
                        <div className="flex justify-between font-medium text-red-600">
                          <span>Total Cash Advance</span>
                          <span>- ₱ {selectedPayslip.cashAdvanceDeduction.toFixed(2)}</span>
                        </div>
                        {selectedPayslip.cashAdvanceDetails && (
                          <ul className="text-[10px] text-slate-500 space-y-1 ml-2 border-l-2 border-red-100 pl-2">
                            {selectedPayslip.cashAdvanceDetails.map((detail: string, i: number) => (
                              <li key={i}>{detail}</li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <div className="flex justify-between text-slate-400 italic">
                        <span>No deductions</span>
                        <span>₱ 0.00</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-100 pt-2 mt-2 font-bold">
                      <span className="text-slate-900">Total Deductions</span>
                      <span className="text-red-600">- ₱ {selectedPayslip.cashAdvanceDeduction.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-200">
                <h3 className="font-bold text-slate-900 mb-3 text-sm">ATTENDANCE SUMMARY</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-4">
                  <div className="bg-slate-50 p-3 rounded-xl text-center">
                    <div className="text-[10px] text-slate-500 mb-1 uppercase font-bold tracking-tight">Present</div>
                    <div className="font-bold text-slate-900">{selectedPayslip.totalPresent} days</div>
                  </div>
                  <div className="bg-indigo-50 p-3 rounded-xl text-center border border-indigo-100">
                    <div className="text-[10px] text-indigo-600 mb-1 uppercase font-bold tracking-tight">Half Day</div>
                    <div className="font-bold text-indigo-700">{selectedPayslip.totalHalfDays || 0} days</div>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-xl text-center border border-amber-100">
                    <div className="text-[10px] text-amber-600 mb-1 uppercase font-bold tracking-tight">Undertime</div>
                    <div className="font-bold text-amber-700">{selectedPayslip.totalUndertimeHours?.toFixed(1) || '0.0'} hrs</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-xl text-center">
                    <div className="text-[10px] text-red-500 mb-1 uppercase font-bold tracking-tight">Absent</div>
                    <div className="font-bold text-red-600">{selectedPayslip.totalAbsent} days</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-xl text-center">
                    <div className="text-[10px] text-green-600 mb-1 uppercase font-bold tracking-tight">Total OT</div>
                    <div className="font-bold text-green-600">{selectedPayslip.totalOtHours.toFixed(1)} hrs</div>
                  </div>
                </div>
                {selectedPayslip.undertimeDetails && selectedPayslip.undertimeDetails.length > 0 && (
                  <div className="text-[11px] text-slate-500 mt-2 bg-amber-50/50 p-2 rounded-lg border border-amber-100/50">
                    <span className="font-bold text-amber-700">Undertime Dates: </span>
                    {selectedPayslip.undertimeDetails.join(', ')}
                  </div>
                )}
                {selectedPayslip.absentDates && selectedPayslip.absentDates.length > 0 && (
                  <div className="text-[11px] text-slate-500 mt-2 bg-red-50/50 p-2 rounded-lg border border-red-100/50">
                    <span className="font-bold text-red-700">Absent Dates: </span>
                    {selectedPayslip.absentDates.join(', ')}
                  </div>
                )}
                {selectedPayslip.pakyawDetails && selectedPayslip.pakyawDetails.length > 0 && (
                  <div className="text-[11px] text-slate-500 mt-2 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/50">
                    <span className="font-bold text-indigo-700">Pakyaw Jobs: </span>
                    <ul className="list-disc pl-4 mt-1">
                      {selectedPayslip.pakyawDetails.map((detail: string, i: number) => (
                        <li key={i}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[700px] bg-white dark:bg-slate-900 border-none rounded-3xl p-0 overflow-hidden shadow-2xl">
          <div className="bg-slate-50 dark:bg-slate-800 p-6 flex flex-col items-center justify-center border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Payroll Preview</h2>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {format(parseISO(startDate), 'MMM dd, yyyy')} - {format(parseISO(endDate), 'MMM dd, yyyy')}
            </div>
            
            <div className="mt-6 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 w-full flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Payout</p>
                <p className="text-3xl font-black text-blue-600">₱{previewData?.bulkTotalPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Employees</p>
                <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{previewData?.targetEmployees.length || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="p-0 max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-400 uppercase bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10 font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3 text-center">Gross Pay</th>
                  <th className="px-6 py-3 text-center text-red-500">Deductions</th>
                  <th className="px-6 py-3 text-right text-blue-500">Net Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {previewData?.payrollsToSave.map((p, idx) => {
                  const emp = previewData.targetEmployees.find(e => e.id === p.employeeId);
                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {emp?.fullName}
                        <div className="text-[10px] text-slate-400 font-normal">
                          {p.totalPresent}d present, {p.totalHalfDays || 0}d half, {p.totalAbsent}d absent
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-slate-700 dark:text-slate-300">
                        ₱{p.totalGrossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-red-600 dark:text-red-400">
                        ₱{p.cashAdvanceDeduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-blue-600 dark:text-blue-400">
                        ₱{p.totalPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
            <Button
              variant="ghost"
              className="px-6 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700"
              onClick={() => setIsPreviewOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="px-8 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold shadow-md shadow-blue-500/20"
              onClick={confirmAndGeneratePayroll}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
              {isLoading ? 'Processing...' : 'Confirm & Run Payroll'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
