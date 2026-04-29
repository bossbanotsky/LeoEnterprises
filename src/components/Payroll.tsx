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
      
      const canvas = await html2canvas(payslipRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: payslipRef.current.scrollWidth + 10,
        onclone: (clonedDoc) => {
          const payslip = clonedDoc.querySelector('.payslip-mockup');
          if (payslip) {
            (payslip as HTMLElement).style.width = 'auto';
            (payslip as HTMLElement).style.maxWidth = 'none';
            (payslip as HTMLElement).style.maxHeight = 'none';
            (payslip as HTMLElement).style.overflow = 'visible';
            (payslip as HTMLElement).style.height = 'auto';
            (payslip as HTMLElement).style.color = '#000000';
            (payslip as HTMLElement).style.backgroundColor = '#ffffff';
            (payslip as HTMLElement).style.padding = '12px';
            
            const allElements = payslip.querySelectorAll('*');
            allElements.forEach(el => {
              const htmlEl = el as HTMLElement;
              const style = window.getComputedStyle(htmlEl);
              
              const fixColor = (prop: string, defaultVal: string) => {
                const val = htmlEl.style.getPropertyValue(prop) || style.getPropertyValue(prop);
                if (val.includes('oklch') || val.includes('oklab')) {
                  htmlEl.style.setProperty(prop, defaultVal, 'important');
                }
              };

              fixColor('color', '#000000');
              if (style.backgroundColor !== 'transparent' && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                if (!style.backgroundColor.includes('rgba')) {
                   fixColor('background-color', '#f8fafc');
                }
              }
              fixColor('border-color', '#e2e8f0');
            });
          }
        }
      });
      
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min((pdfWidth - 20) / imgWidth, (pdfHeight - 20) / imgHeight);
      
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;
      
      const marginX = (pdfWidth - finalWidth) / 2;
      const marginY = 10;
      
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
      // Temporarily remove max-height and overflow to capture full content
      
      const canvas = await html2canvas(payslipRef.current, {
        scale: 3, // High quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: payslipRef.current.scrollWidth + 10,
        onclone: (clonedDoc) => {
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach(el => {
            const htmlEl = el as HTMLElement;
            const style = window.getComputedStyle(htmlEl);
            const isUnsupported = (val: string) => val.includes('oklch') || val.includes('oklab');
            
            if (isUnsupported(style.color)) htmlEl.style.setProperty('color', '#000000', 'important');
            if (isUnsupported(style.backgroundColor) && style.backgroundColor !== 'transparent' && !style.backgroundColor.includes('rgba(0, 0, 0, 0)')) {
              htmlEl.style.setProperty('background-color', '#ffffff', 'important');
            }
            if (isUnsupported(style.borderColor)) htmlEl.style.setProperty('border-color', '#dddddd', 'important');
            if (isUnsupported(style.boxShadow)) htmlEl.style.setProperty('box-shadow', 'none', 'important');
            if (isUnsupported(style.fill)) htmlEl.style.setProperty('fill', '#000000', 'important');
            if (isUnsupported(style.stroke)) htmlEl.style.setProperty('stroke', '#000000', 'important');
          });

          const payslip = clonedDoc.querySelector('.payslip-mockup');
          if (payslip) {
            (payslip as HTMLElement).style.width = 'auto';
            (payslip as HTMLElement).style.maxWidth = 'none';
            (payslip as HTMLElement).style.maxHeight = 'none';
            (payslip as HTMLElement).style.overflow = 'visible';
            (payslip as HTMLElement).style.height = 'auto';
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // Create PDF - A4 size
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min((pdfWidth - 20) / imgWidth, (pdfHeight - 20) / imgHeight);
      
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;
      
      const marginX = (pdfWidth - finalWidth) / 2;
      const marginY = 10; // Start near top
      
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
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      for (let i = 0; i < displayedPayrolls.length; i++) {
        const payslip = displayedPayrolls[i];
        setSelectedPayslip(payslip);
        
        // Wait for React to render
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (payslipRef.current) {
          
          const canvas = await html2canvas(payslipRef.current, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => {
              const allElements = clonedDoc.querySelectorAll('*');
              allElements.forEach(el => {
                const htmlEl = el as HTMLElement;
                const style = window.getComputedStyle(htmlEl);
                const isUnsupported = (val: string) => val.includes('oklch') || val.includes('oklab');
                
                if (isUnsupported(style.color)) htmlEl.style.setProperty('color', '#000000', 'important');
                if (isUnsupported(style.backgroundColor) && style.backgroundColor !== 'transparent' && !style.backgroundColor.includes('rgba(0, 0, 0, 0)')) {
                  htmlEl.style.setProperty('background-color', '#ffffff', 'important');
                }
                if (isUnsupported(style.borderColor)) htmlEl.style.setProperty('border-color', '#dddddd', 'important');
                if (isUnsupported(style.boxShadow)) htmlEl.style.setProperty('box-shadow', 'none', 'important');
                if (isUnsupported(style.fill)) htmlEl.style.setProperty('fill', '#000000', 'important');
                if (isUnsupported(style.stroke)) htmlEl.style.setProperty('stroke', '#000000', 'important');
              });
              
              const payslip = clonedDoc.querySelector('.payslip-mockup');
              if (payslip) {
                (payslip as HTMLElement).style.width = 'auto'; // Standard A4 width reference
                (payslip as HTMLElement).style.maxWidth = 'none';
                (payslip as HTMLElement).style.maxHeight = 'none';
                (payslip as HTMLElement).style.overflow = 'visible';
                (payslip as HTMLElement).style.height = 'auto';
                (payslip as HTMLElement).style.padding = '20px';
              }
            }
          });
          
          const imgData = canvas.toDataURL('image/png');
          const imgRatio = canvas.height / canvas.width;
          
          const finalWidth = pdfWidth - 20;
          const finalHeight = finalWidth * imgRatio;
          
          const marginX = 10;
          const marginY = 10;
          
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', marginX, marginY, finalWidth, Math.min(finalHeight, pdfHeight - 20));
        }
      }
      
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
      const uniqueDocs = Array.from(new Map(snapshot.docs.map(doc => [doc.id, doc])).values());
      const allBulk: any[] = [];
      uniqueDocs.forEach(docSnap => {
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
      const allPj = pakyawJobs.filter(pj => {
        const startedInRange = pj.startDate >= startDate && pj.startDate <= endDate;
        const completedAtDate = pj.completedAt ? pj.completedAt.split('T')[0] : null;
        const completedInRange = completedAtDate && completedAtDate >= startDate && completedAtDate <= endDate;
        return startedInRange || completedInRange;
      });

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
          const jobName = pj.containerNumber ? `[${pj.containerNumber}] ${pj.description}` : pj.description;
          if (pj.status === 'completed') {
            totalPakyawPay += splitAmount;
            pakyawDetails.push(`${jobName}: ₱${splitAmount.toFixed(2)}`);
          } else {
            pakyawDetails.push(`${jobName}: PENDING (Not Finished)`);
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
                        className="h-12 sm:h-10 gap-3 bg-white/10 hover:bg-white/20 text-white border border-white/10 font-bold uppercase tracking-widest text-[10px] backdrop-blur-md px-6 shadow-xl" 
                        onClick={handleBulkExportPDF}
                        disabled={isExporting}
                      >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        <span className="truncate">{isExporting ? 'Exporting...' : 'Bulk PDF Export'}</span>
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
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white rounded-2xl w-[95vw] max-w-lg mx-auto border-none shadow-2xl">
          <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 backdrop-blur-sm sticky top-0 z-10 font-sans">
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-black uppercase italic tracking-tight text-sm">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Payslip
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
              className="p-3 max-h-[85vh] overflow-y-auto payslip-mockup bg-white font-sans text-[10px]" 
              style={{ backgroundColor: '#ffffff' }}
            >
              <div className="flex justify-between border-b border-slate-900 pb-2 mb-2">
                <div>
                  <div className="inline-flex items-center gap-1 px-1 py-0.5 bg-blue-600 text-white text-[7px] font-black uppercase tracking-[0.1em] rounded mb-1">
                    Official
                  </div>
                  <h2 className="text-xl font-black text-slate-900 leading-none italic uppercase">PAYSLIP</h2>
                  <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">
                    Pay Period: <span className="text-slate-900">{format(parseISO(selectedPayslip.startDate), 'MM/dd')} - {format(parseISO(selectedPayslip.endDate), 'MM/dd/yy')}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-lg overflow-hidden shrink-0 border border-slate-200">
                      {selectedPayslip.employee.photoURL ? (
                        <img src={selectedPayslip.employee.photoURL} alt={selectedPayslip.employee.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        selectedPayslip.employee.fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none italic">{selectedPayslip.employee.fullName}</div>
                      <div className="text-[8px] font-bold text-blue-600 mt-0.5 uppercase tracking-wider flex items-center gap-1">
                        {selectedPayslip.employee.customId && <span>#{selectedPayslip.employee.customId}</span>}
                        <span>{selectedPayslip.employee.position || 'Staff'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col justify-between items-end">
                  <div className="text-right">
                    <div className="text-[8px] font-black text-slate-400 mb-0.5 uppercase tracking-widest">Net Pay</div>
                    <div className={`text-2xl font-black italic tracking-tighter leading-none ${selectedPayslip.totalPay < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      ₱{selectedPayslip.totalPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-right mt-auto">
                    <div className="text-[9px] font-black text-slate-900 uppercase italic leading-none">{companyInfo.name}</div>
                    {companyInfo.address && <div className="text-[7px] text-slate-400 mt-0.5 font-medium max-w-[100px] leading-tight ml-auto truncate">{companyInfo.address}</div>}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-1 mb-2 p-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-[6px] font-black text-slate-400 uppercase">Daily</span>
                  <span className="text-[9px] font-black text-slate-900">₱{(selectedPayslip.employee.dailySalary || 0).toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[6px] font-black text-slate-400 uppercase">Hourly</span>
                  <span className="text-[9px] font-black text-slate-900">₱{((selectedPayslip.employee.dailySalary || 0) / 8).toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[6px] font-black text-slate-400 uppercase">OT Hr</span>
                  <span className="text-[9px] font-black text-emerald-600">₱{((selectedPayslip.employee.dailySalary || 0) / 8).toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-sans">
                <div className="space-y-2">
                  <div>
                    <h3 className="text-[9px] font-black text-slate-900 border-b border-slate-100 pb-1 mb-1.5 uppercase flex justify-between">
                      Earnings <span>₱</span>
                    </h3>
                    <div className="space-y-1.5 text-[10px]">
                      <div className="space-y-0.5 border-b border-slate-50 pb-1 mb-1">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-bold text-[8px] uppercase">Regular</span>
                          <span className="font-black text-slate-900">₱{selectedPayslip.regularPay.toFixed(2)}</span>
                        </div>
                        
                        {selectedPayslip.totalPresent > 0 && (
                          <div className="flex justify-between items-center text-[8px]">
                            <span className="text-slate-400">• {selectedPayslip.totalPresent} Days</span>
                          </div>
                        )}

                        {selectedPayslip.totalHalfDays > 0 && (
                          <div className="flex justify-between items-center text-[8px]">
                            <span className="text-slate-400">• {selectedPayslip.totalHalfDays} Half</span>
                          </div>
                        )}
                      </div>

                      {selectedPayslip.totalOtHours > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-green-600 font-bold text-[8px] uppercase">OT ({selectedPayslip.totalOtHours}h)</span>
                          <span className="font-black text-green-600">{selectedPayslip.otPay.toFixed(2)}</span>
                        </div>
                      )}

                      {selectedPayslip.totalPakyawPay > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-indigo-600 font-bold text-[8px] uppercase">Pakyaw</span>
                          <span className="font-black text-indigo-600">{selectedPayslip.totalPakyawPay.toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center border-t border-slate-100 pt-1">
                        <span className="text-slate-900 font-black uppercase text-[9px]">Gross</span>
                        <span className="text-slate-900 font-black text-[11px] font-mono italic">{selectedPayslip.totalGrossPay.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <h3 className="text-[9px] font-black text-red-600 border-b border-slate-100 pb-1 mb-1.5 uppercase flex justify-between">
                      Deductions <span>₱</span>
                    </h3>
                    <div className="space-y-1.5 text-[10px]">
                      {selectedPayslip.cashAdvanceDeduction > 0 ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-red-600 font-bold text-[8px] uppercase">Cash Adv.</span>
                            <span className="font-black text-red-600">-{selectedPayslip.cashAdvanceDeduction.toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="p-2 border border-dashed border-slate-100 rounded-md text-center">
                          <span className="text-[7px] text-slate-300 uppercase font-black">None</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t border-slate-100 pt-1 mt-auto">
                         <span className="text-red-600 font-black uppercase text-[9px]">Total Ded</span>
                         <span className="text-red-600 font-black text-[11px] font-mono italic">-{selectedPayslip.cashAdvanceDeduction.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Compact Attendance Logs */}
              {selectedPayslip.dailyAttendanceLog && (
                <div className="mt-3 pt-2 border-t border-slate-100 font-sans">
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1">
                    {selectedPayslip.dailyAttendanceLog.map((log: any, i: number) => (
                      <div key={i} className={`py-1 rounded border flex flex-col items-center justify-center text-center ${
                        log.status === 'present' ? 'bg-emerald-50/30 border-emerald-100/50' :
                        log.status === 'absent' ? 'bg-rose-50/30 border-rose-100/50' :
                        log.status === 'halfday' ? 'bg-indigo-50/30 border-indigo-100/50' :
                        log.status === 'undertime' ? 'bg-amber-50/30 border-amber-100/50' :
                        'bg-slate-50/30 border-slate-100/50'
                      }`}>
                        <div className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">
                          {format(parseISO(log.date), 'MM/dd')}
                        </div>
                        <div className={`text-[7px] font-black uppercase ${
                          log.status === 'present' ? 'text-emerald-600' :
                          log.status === 'absent' ? 'text-rose-600' :
                          'text-slate-400'
                        }`}>
                          {log.status.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-end">
                <div className="text-[8px] text-slate-400">
                  ID: {selectedPayslip.id.substring(0, 8)}
                </div>
                <div className="flex flex-col items-end">
                  <div className="w-20 h-px bg-slate-300 mb-1"></div>
                  <div className="text-[7px] font-black text-slate-400 uppercase">Received By</div>
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
