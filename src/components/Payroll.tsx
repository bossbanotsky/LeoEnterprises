import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { Employee, Attendance, CashAdvance, PakyawJob } from '../types';
import { format, parseISO, eachDayOfInterval, isWithinInterval, isSunday } from "date-fns";
import { calculateAttendanceHours } from "../lib/payrollUtils";
import { Calendar, ChevronRight, FileText, Download, Trash2, Loader2, Users, CreditCard, CheckCircle, Search, Upload, Printer } from 'lucide-react';
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
  const { employees, pakyawJobs, cashAdvances, loading: dataLoading } = useData();
  const [startDate, setStartDate] = useState(() => localStorage.getItem('payrollStartDate') || format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(() => localStorage.getItem('payrollEndDate') || format(new Date(), 'yyyy-MM-15'));

  const loadingInitial = dataLoading;
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [bulkPayrolls, setBulkPayrolls] = useState<any[]>([]);
  const [selectedBulkId, setSelectedBulkId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('payrollStartDate', startDate);
    window.dispatchEvent(new Event('payrollDateChange'));
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem('payrollEndDate', endDate);
    window.dispatchEvent(new Event('payrollDateChange'));
  }, [endDate]);

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
        /*
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
        */
      }));

      setSelectedBulkId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'bulkPayrolls');
    }
  };

  const handleBulkExport = async () => {
    if (payrollData.length === 0) return;
    setIsExporting(true);
    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a5"
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      for (let i = 0; i < payrollData.length; i++) {
        const pr = payrollData[i];
        
        // Temporarily select to render in dialog ref
        setSelectedPayslip({ ...pr });
        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 300));

        if (payslipRef.current) {
          const originalStyle = payslipRef.current.style.maxHeight;
          payslipRef.current.style.maxHeight = 'none';
          
          const canvas = await html2canvas(payslipRef.current, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => {
              clonedDoc.querySelectorAll('style').forEach(tag => tag.remove());
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
          
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', marginX, marginY, finalWidth, finalHeight);
        }
      }
      
      setSelectedPayslip(null);
      pdf.save(`Bulk_Payroll_${startDate}_to_${endDate}.pdf`);
    } catch (error) {
      console.error('Error exporting bulk PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = async () => {
    if (!payslipRef.current || !selectedPayslip) return;
    
    setIsExporting(true);
    try {
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
          clonedDoc.querySelectorAll('style').forEach(tag => tag.remove());
          const payslip = clonedDoc.querySelector('.payslip-mockup');
          if (payslip) {
            (payslip as HTMLElement).style.color = '#0f172a';
            (payslip as HTMLElement).style.backgroundColor = '#ffffff';
            
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
      
      payslipRef.current.style.maxHeight = originalStyle;
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth() / 2;
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
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
      
      pdf.addImage(imgData, 'PNG', marginX, marginY, finalWidth, finalHeight);
      pdf.autoPrint();
      window.open(pdf.output('bloburl'), '_blank');
      
    } catch (error) {
      console.error('Error printing PDF:', error);
    } finally {
      setIsExporting(false);
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
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        // Set width explicitly to prevent layout changes during cloning
        width: payslipRef.current.offsetWidth,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('style').forEach(tag => tag.remove());
          const payslip = clonedDoc.querySelector('.payslip-mockup');
          if (payslip) {
            (payslip as HTMLElement).style.width = `${payslipRef.current!.offsetWidth}px`;
            (payslip as HTMLElement).style.color = '#0f172a';
            (payslip as HTMLElement).style.backgroundColor = '#ffffff';
            
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
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      // A4 Landscape, splitting horizontally for two payslips per page
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth() / 2;
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
              clonedDoc.querySelectorAll('style').forEach(tag => tag.remove());
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

  // Real-time listener for Bulk Payrolls (Both Pending and Archived)
  useEffect(() => {
    if (!user) return;

    const bulkQ = query(
      collection(db, "bulkPayrolls"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(bulkQ, (snapshot) => {
      const allBulk: any[] = [];
      snapshot.forEach(docSnap => {
        allBulk.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Split into pending and archived
      const pending = allBulk.filter(b => b.status !== 'paid')
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
      const archived = allBulk.filter(b => b.status === 'paid')
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));

      setBulkPayrolls(pending);
      setArchivedBulkRuns(archived);
    }, (error) => {
      if (!error?.message?.toLowerCase().includes('quota')) {
        handleFirestoreError(error, OperationType.GET, 'bulkPayrolls_live');
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch individual payrolls when a Bulk ID is selected or a single employee is selected
  useEffect(() => {
    if (!user || employees.length === 0) return;
    
    let q;
    if (selectedBulkId) {
      // If a bulk batch is selected, fetch everything for that batch regardless of date filters
      q = query(collection(db, 'payrolls'), where('bulkId', '==', selectedBulkId));
    } else if (selectedEmployeeId !== 'all') {
      // If a specific employee is chosen, fetch their records for the filtered dates
      q = query(
        collection(db, 'payrolls'),
        where('employeeId', '==', selectedEmployeeId),
        where('startDate', '==', startDate),
        where('endDate', '==', endDate)
      );
    } else {
      // Default: Fetch all for current dates (used for calculations/summaries)
      q = query(
        collection(db, 'payrolls'),
        where('startDate', '==', startDate),
        where('endDate', '==', endDate)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const emp = employees.find(e => e.id === data.employeeId);
        // If employee is not active, only show if in archive mode
        if (emp && ((emp.status === 'active' || !emp.status) || viewMode === 'archives')) {
          fetched.push({ id: docSnap.id, employee: emp, ...data });
        }
      });
      setPayrollData(fetched);
    }, (error) => {
      if (!error?.message?.toLowerCase().includes('quota')) {
        handleFirestoreError(error, OperationType.GET, 'payrolls_live');
      }
    });

    return () => unsubscribe();
  }, [user, employees, selectedBulkId, selectedEmployeeId, startDate, endDate, viewMode]);

  const handlePreviewPayroll = async () => {
    if (!startDate || !endDate || employees.length === 0) return;
    setIsLoading(true);
    try {
      const targetEmployees = (selectedEmployeeId === 'all' 
        ? employees.filter(e => (e.status === 'active' || !e.status) && (!e.position || !e.position.toLowerCase().includes("ceo")) && (e.role || '').toLowerCase() !== "ceo") 
        : employees.filter(e => e.id === selectedEmployeeId && (e.status === 'active' || !e.status)));

      const q = query(
        collection(db, 'attendance'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const snapshot = await getDocs(q);
      const allAtts: Attendance[] = [];
      snapshot.forEach(doc => allAtts.push({ id: doc.id, ...doc.data() } as Attendance));

      const allCa = cashAdvances.filter(ca => ca.date >= startDate && ca.date <= endDate);
      const allPj = pakyawJobs.filter(pj => pj.startDate >= startDate && pj.startDate <= endDate);

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
        let dailyAttendanceLog: { date: string, status: string, regHrs: number, otHrs: number, isWorkDay: boolean }[] = [];

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
            
            let statusLabel: string = att.status;
            if (att.status === 'present' || att.status === 'ut' || att.status === 'hd') {
              if (att.status === 'hd' || (att.timeIn === '07:00' && att.timeOut === '12:00')) {
                totalHalfDays++;
                totalRegularHours += regHrs;
                statusLabel = 'halfday';
              } else if (regHrs < 8) { 
                totalUndertimeDays++;
                totalUndertimeHours += regHrs;
                totalRegularHours += regHrs;
                undertimeDetails.push(dailyWorkLog);
                statusLabel = 'undertime';
              } else {
                totalPresent++;
                totalRegularHours += regHrs;
                statusLabel = 'present';
              }
              totalOtHours += otHrs;
            } else if (att.status === 'pakyaw') {
              statusLabel = 'pakyaw';
            } else if (att.status === 'absent') {
              totalAbsent++;
              absentDates.push(format(parseISO(date), 'MMM dd'));
            }

            dailyAttendanceLog.push({ 
              date, 
              status: statusLabel, 
              regHrs, 
              otHrs,
              isWorkDay: true 
            });
          } else {
            // No attendance record for this date
            totalAbsent++;
            absentDates.push(format(parseISO(date), 'MMM dd'));
            dailyAttendanceLog.push({ 
              date, 
              status: 'absent', 
              regHrs: 0, 
              otHrs: 0,
              isWorkDay: false 
            });
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
          dailyAttendanceLog, // NEW FIELD
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
            status: 'pending',
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
    if (!user || !bulkId) return;
    try {
      setIsLoading(true);
      await deleteDoc(doc(db, 'bulkPayrolls', bulkId));
      
      // Delete all associated payrolls
      const q = query(collection(db, 'payrolls'), where('bulkId', '==', bulkId));
      const snapshot = await getDocs(q);
      
      const deletePromises = snapshot.docs.map(pDoc => deleteDoc(doc(db, 'payrolls', pDoc.id)));
      await Promise.all(deletePromises);
      
      if (selectedBulkId === bulkId) setSelectedBulkId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'bulkPayrolls');
    } finally {
      setIsLoading(false);
    }
  };

  const currentBulkRuns = viewMode === 'process' ? bulkPayrolls : archivedBulkRuns;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase italic shrink-0">Payroll</h1>
        <div className="flex bg-transparent p-1 rounded-xl border border-white/10">
          <Button 
            variant={viewMode === 'process' ? 'secondary' : 'ghost'} 
            className={`h-8 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'process' ? 'bg-white text-blue-600' : 'text-slate-400 hover:text-white'}`}
            onClick={() => { setViewMode('process'); setSelectedBulkId(null); }}
          >Process</Button>
          <Button 
            variant={viewMode === 'archives' ? 'secondary' : 'ghost'} 
            className={`h-8 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'archives' ? 'bg-white text-blue-600' : 'text-slate-400 hover:text-white'}`}
            onClick={() => { setViewMode('archives'); setSelectedBulkId(null); }}
          >Archives</Button>
        </div>
      </div>
      
      {viewMode === 'process' && (
        <div className="bento-card flex-col bg-slate-900/40 p-6 border border-white/10 mb-4 shrink-0 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-white uppercase tracking-tight">Pay Period</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="space-y-1">
              <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl h-10 border-white/10 bg-slate-950/50 text-white font-bold" />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl h-10 border-white/10 bg-slate-950/50 text-white font-bold" />
            </div>
          </div>
          <div className="space-y-1 mb-4">
            <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Employee Selection</Label>
            <select 
              value={selectedEmployeeId} 
              onChange={e => {
                setSelectedEmployeeId(e.target.value);
                setSelectedBulkId(null);
              }}
              className="flex h-10 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-white font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all"
            >
              <option value="all">Bulk Payroll (All Employees)</option>
              {employees
                .filter(e => e.status === 'active' || !e.status)
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .map(emp => (
                  <option key={emp.id} value={emp.id} className="bg-slate-950">{emp.fullName}</option>
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
                  className="bento-card flex-row items-center justify-between bg-white/5 p-4 border border-white/10 cursor-pointer shadow-xl relative overflow-hidden group hover:bg-white/10 transition-all duration-300"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -mr-12 -mt-12 transition-all group-hover:bg-blue-500/10"></div>
                  <div className="flex items-center gap-3 relative z-10">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-110 ${viewMode === 'archives' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {viewMode === 'archives' ? (
                          <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded uppercase tracking-widest border border-emerald-500/30">Paid</span>
                        ) : (
                          <span className="text-[9px] font-black text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded uppercase tracking-widest border border-blue-500/30">Pending</span>
                        )}
                        <span className="font-black text-white text-sm uppercase tracking-tight italic">
                          {format(parseISO(bulk.generatedAt), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-white/50 uppercase tracking-widest leading-none mt-1">
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{bulk.employeeCount || 0} Staff</span>
                        </div>
                        <div className="flex items-center gap-1 text-cyan-400 font-black italic">
                          <span>₱{(bulk.totalCashRequired || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 relative z-10">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 p-0 text-white/40 hover:text-red-400 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBulk(bulk.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <ChevronRight className="w-5 h-5 text-white/20" />
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
                <div className="bg-gradient-to-br from-blue-600/40 to-cyan-600/40 backdrop-blur-xl rounded-2xl p-6 text-white shadow-2xl border border-white/10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                      <p className="stat-label mb-1">Total Cash Required</p>
                      <h2 className="stat-value text-3xl">₱{totalCashRequired.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                    </div>
                  <div className="flex flex-col sm:flex-row gap-3 relative z-10 w-full sm:w-auto">
                    <div className="grid grid-cols-2 sm:flex gap-3 w-full">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-12 sm:h-10 gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 font-black uppercase tracking-widest text-[10px] backdrop-blur-md flex-1 sm:flex-none shadow-lg" 
                        onClick={handleBulkExport}
                        disabled={isExporting}
                      >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 rotate-180" />}
                        <span className="truncate">Bulk PDF</span>
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-12 sm:h-10 gap-2 bg-red-500 hover:bg-red-600 text-white border-0 shadow-lg font-black uppercase tracking-widest text-[10px] flex-1 sm:flex-none" 
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this entire payroll batch? All associated payslips will be permanently removed.')) {
                            handleDeleteBulk(selectedBulkId);
                          }
                        }}
                        disabled={isExporting}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="truncate">Delete Batch</span>
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:flex gap-3 w-full">
                      {viewMode === 'process' && (
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-12 sm:h-10 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-lg font-black uppercase tracking-widest text-[10px] flex-1 sm:flex-none" 
                          onClick={() => handleMarkAsPaid(selectedBulkId)}
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span className="truncate">Mark as Paid</span>
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-12 sm:h-10 gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 font-black uppercase tracking-widest text-[10px] backdrop-blur-md flex-1 sm:flex-none shadow-lg" 
                        onClick={handleBulkExportPDF}
                        disabled={isExporting}
                      >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        <span className="truncate">{isExporting ? 'Exporting...' : 'Bulk PDF'}</span>
                      </Button>
                    </div>
                  </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/50 border-t border-white/10 pt-4 relative z-10">
                    <span>{totalEmployeesCount} Employees</span>
                    <span className="w-1 h-1 rounded-full bg-white/20"></span>
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
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold text-[10px] overflow-hidden shrink-0">
                      {data.employee.photoURL ? (
                        <img src={data.employee.photoURL} alt={data.employee.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        data.employee.fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white truncate text-sm">{data.employee.fullName}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete payroll for ${data.employee.fullName}?`)) {
                          handleDeletePayroll(data.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
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
        <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden bg-white rounded-3xl w-[95vw] max-w-4xl mx-auto border-none shadow-2xl">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 backdrop-blur-sm sticky top-0 z-10 font-sans">
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-black uppercase italic tracking-tight text-lg">
              <FileText className="w-5 h-5 text-blue-600" />
              Payslip Details
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 gap-1.5 rounded-xl border-slate-200 text-slate-600 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-all font-bold text-[10px] uppercase tracking-widest"
                onClick={handlePrint}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                {isExporting ? 'Printing...' : 'Print'}
              </Button>
              {selectedPayslip?.id && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50 font-bold text-[10px] uppercase tracking-widest"
                  onClick={() => handleDeletePayroll(selectedPayslip.id)}
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 gap-1.5 rounded-xl border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all font-bold text-[10px] uppercase tracking-widest"
                onClick={handleExportPDF}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 rotate-180" />}
                {isExporting ? 'Exporting...' : 'Export PDF'}
              </Button>
            </div>
          </div>
          
          {selectedPayslip && (
            <div 
              ref={payslipRef}
              className="p-2 max-h-[85vh] overflow-y-auto payslip-mockup bg-white font-sans text-xs" 
              style={{ backgroundColor: '#ffffff' }}
            >
              <div className="flex justify-between border-b-2 border-slate-900 pb-6 mb-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded mb-3">
                    Corporate Slip
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 leading-none italic uppercase">PAYSLIP</h2>
                  <div className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
                    Pay Period: <span className="text-slate-900">{format(parseISO(selectedPayslip.startDate), 'MMM dd')} - {format(parseISO(selectedPayslip.endDate), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-6">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-2xl overflow-hidden shrink-0 border border-slate-200 shadow-sm">
                      {selectedPayslip.employee.photoURL ? (
                        <img src={selectedPayslip.employee.photoURL} alt={selectedPayslip.employee.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        selectedPayslip.employee.fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none italic">{selectedPayslip.employee.fullName}</div>
                      <div className="text-[10px] font-bold text-blue-600 mt-1 uppercase tracking-widest flex items-center gap-2">
                        {selectedPayslip.employee.customId && <span>ID: {selectedPayslip.employee.customId}</span>}
                        {selectedPayslip.employee.customId && <span className="w-1 h-1 bg-slate-300 rounded-full"></span>}
                        <span>{selectedPayslip.employee.position || 'Staff'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col justify-between items-end">
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-[0.2em]">Net Payout</div>
                    <div className={`text-4xl font-black italic tracking-tighter leading-none ${selectedPayslip.totalPay < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      ₱ {selectedPayslip.totalPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-right mt-auto">
                    <div className="text-xs font-black text-slate-900 uppercase italic leading-none">{companyInfo.name}</div>
                    {companyInfo.address && <div className="text-[9px] text-slate-400 mt-1 font-medium max-w-[150px] leading-tight">{companyInfo.address}</div>}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 mb-6 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 mb-1 uppercase tracking-widest">Daily Rate</span>
                  <span className="text-xs font-black text-slate-900 font-mono">₱ {(selectedPayslip.employee.dailySalary || 0).toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 mb-1 uppercase tracking-widest">Hourly Rate</span>
                  <span className="text-xs font-black text-slate-900 font-mono">₱ {((selectedPayslip.employee.dailySalary || 0) / 8).toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 mb-1 uppercase tracking-widest">OT Hourly</span>
                  <span className="text-xs font-black text-emerald-600 font-mono">₱ {((selectedPayslip.employee.dailySalary || 0) / 8).toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[11px] font-black text-slate-900 border-b-2 border-slate-100 pb-2 mb-4 uppercase tracking-[0.2em] flex items-center justify-between">
                      Earnings <span>Amount</span>
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="space-y-1.5 border-b border-slate-50 pb-3 mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wide">Basic Pay Breakdown</span>
                          <span className="font-black text-slate-900">₱ {selectedPayslip.regularPay.toFixed(2)}</span>
                        </div>
                        
                        {selectedPayslip.totalPresent > 0 && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-600 flex items-center gap-1.5">
                              <div className="w-1 h-1 bg-emerald-400 rounded-full" />
                              {selectedPayslip.totalPresent} Full Days (8.0h)
                            </span>
                            <span className="text-slate-400 font-mono">
                              ₱ {(selectedPayslip.totalPresent * (selectedPayslip.employee.dailySalary || 0)).toFixed(2)}
                            </span>
                          </div>
                        )}

                        {selectedPayslip.totalHalfDays > 0 && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-600 flex items-center gap-1.5">
                              <div className="w-1 h-1 bg-indigo-400 rounded-full" />
                              {selectedPayslip.totalHalfDays} Half Days (5.0h)
                            </span>
                            <span className="text-slate-400 font-mono">
                              ₱ {((selectedPayslip.totalHalfDays * 5 / 8) * (selectedPayslip.employee.dailySalary || 0)).toFixed(2)}
                            </span>
                          </div>
                        )}

                        {selectedPayslip.totalUndertimeHours > 0 && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-600 flex items-center gap-1.5">
                              <div className="w-1 h-1 bg-amber-400 rounded-full" />
                              {selectedPayslip.totalUndertimeHours.toFixed(1)} Undertime Hours
                            </span>
                            <span className="text-slate-400 font-mono">
                              ₱ {((selectedPayslip.totalUndertimeHours / 8) * (selectedPayslip.employee.dailySalary || 0)).toFixed(2)}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center pt-1 border-t border-slate-50 mt-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase italic">Total Volume</span>
                          <span className="text-[10px] font-black text-slate-900 underline decoration-slate-200">
                            {selectedPayslip.totalRegularHours.toFixed(2)} Total Hours
                          </span>
                        </div>
                      </div>

                      {selectedPayslip.totalOtHours > 0 && (
                        <div className="flex justify-between items-center group">
                          <div className="flex flex-col">
                            <span className="text-green-600 font-bold text-[10px] uppercase tracking-wide">Overtime</span>
                            <span className="text-slate-900 font-medium">
                              {selectedPayslip.totalOtHours.toFixed(1)} Hrs @ ₱{(selectedPayslip.employee.dailySalary / 8).toFixed(2)}/hr
                            </span>
                          </div>
                          <span className="font-black text-green-600">₱ {selectedPayslip.otPay.toFixed(2)}</span>
                        </div>
                      )}

                      {selectedPayslip.totalPakyawPay > 0 && (
                        <div className="flex justify-between items-center group">
                          <div className="flex flex-col">
                            <span className="text-indigo-600 font-bold text-[10px] uppercase tracking-wide">Contracts</span>
                            <span className="text-slate-900 font-medium">Pakyaw Projects</span>
                          </div>
                          <span className="font-black text-indigo-600">₱ {selectedPayslip.totalPakyawPay.toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-3">
                        <span className="text-slate-900 font-black uppercase italic text-xs tracking-wider">Gross Total</span>
                        <span className="text-slate-900 font-black text-lg font-mono tracking-tighter italic">₱ {selectedPayslip.totalGrossPay.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[11px] font-black text-red-600 border-b-2 border-slate-100 pb-2 mb-4 uppercase tracking-[0.2em] flex items-center justify-between">
                      Deductions <span>Amount</span>
                    </h3>
                    <div className="space-y-4 text-sm">
                      {selectedPayslip.cashAdvanceDeduction > 0 ? (
                        <>
                          <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="text-red-600 font-bold text-[10px] uppercase tracking-wide">Cash Advance</span>
                              <span className="text-slate-900 font-medium">Principal & Loans</span>
                            </div>
                            <span className="font-black text-red-600">- ₱ {selectedPayslip.cashAdvanceDeduction.toFixed(2)}</span>
                          </div>
                          {selectedPayslip.cashAdvanceDetails && (
                            <div className="bg-red-50/50 p-3 rounded-xl border border-red-100/50">
                              <ul className="text-[10px] text-red-700/70 space-y-1.5 font-bold">
                                {selectedPayslip.cashAdvanceDetails.map((detail: string, i: number) => (
                                  <li key={i} className="flex gap-2">
                                    <span className="text-red-400 shrink-0">•</span>
                                    <span>{detail}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-center p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No Active Deductions</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-3">
                         <span className="text-red-600 font-black uppercase italic text-xs tracking-wider">Total Ded.</span>
                         <span className="text-red-600 font-black text-lg font-mono tracking-tighter italic">- ₱ {selectedPayslip.cashAdvanceDeduction.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Daily Attendance Logs */}
              {selectedPayslip.dailyAttendanceLog && (
                <div className="mt-8 pt-6 border-t-2 border-slate-100 font-sans">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Daily Detailed Log</h3>
                    <div className="text-[8px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded">Transparency Audit</div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {selectedPayslip.dailyAttendanceLog.map((log: any, i: number) => (
                      <div key={i} className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                        log.status === 'present' ? 'bg-emerald-50 border-emerald-100' :
                        log.status === 'absent' ? 'bg-rose-50 border-rose-100' :
                        log.status === 'halfday' ? 'bg-indigo-50 border-indigo-100' :
                        log.status === 'undertime' ? 'bg-amber-50 border-amber-100' :
                        log.status === 'pakyaw' ? 'bg-violet-50 border-violet-100' :
                        'bg-slate-50 border-slate-100'
                      }`}>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                          {format(parseISO(log.date), 'EEE, MMM dd')}
                        </div>
                        <div className={`text-[10px] font-black uppercase italic ${
                          log.status === 'present' ? 'text-emerald-600' :
                          log.status === 'absent' ? 'text-rose-600' :
                          log.status === 'halfday' ? 'text-indigo-600' :
                          log.status === 'undertime' ? 'text-amber-600' :
                          log.status === 'pakyaw' ? 'text-violet-600' :
                          'text-slate-400'
                        }`}>
                          {log.status === 'halfday' ? 'Half-Day' : 
                           log.status}
                        </div>
                        <div className="flex gap-1 mt-1 justify-center">
                          {log.status !== 'absent' && log.status !== 'pakyaw' && (
                            <div className="text-[8px] font-bold text-slate-500 bg-slate-200/50 px-1 py-0.5 rounded">
                              {log.regHrs}h
                            </div>
                          )}
                          {log.otHrs > 0 && (
                            <div className="text-[8px] font-bold text-emerald-700 bg-emerald-200/50 px-1 py-0.5 rounded">
                              +{log.otHrs}h OT
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              
              <div className="mt-8 pt-6 border-t-2 border-slate-100 font-sans">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedPayslip.pakyawDetails && selectedPayslip.pakyawDetails.length > 0 && (
                    <div className="text-[10px] text-slate-500 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50 font-sans">
                      <span className="font-black text-indigo-700 uppercase tracking-widest block mb-2">Projects & Pakyaw</span>
                      <ul className="space-y-1.5 list-none">
                        {selectedPayslip.pakyawDetails.map((detail: string, i: number) => (
                          <li key={i} className="flex gap-2 items-start font-sans">
                            <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
                            <span className="font-medium text-slate-600">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-col justify-end font-sans">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Signature</div>
                      <div className="w-32 h-[1px] bg-slate-300"></div>
                    </div>
                  </div>
                </div>
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
