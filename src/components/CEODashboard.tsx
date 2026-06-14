import React, { useState, useEffect, useMemo, useRef } from "react";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import {
  Employee,
  Attendance,
  Payroll,
  PakyawJob,
  CashAdvance,
} from "../types";
import {
  format,
  parseISO,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import { calculateAttendanceHours } from "../lib/payrollUtils";
import {
  Users,
  PhilippinePeso,
  Calendar,
  FileText,
  Loader2,
  Upload,
  Trash2,
  Printer,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { useCompanyInfo } from "../hooks/useCompanyInfo";
import { Skeleton } from "./ui/Skeleton";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function CEODashboard() {
  const { user } = useAuth();
  const { employees: contextEmployees, pakyawJobs: contextPakyawJobs, cashAdvances: contextCashAdvances, loading: dataLoading } = useData();
  const { companyInfo } = useCompanyInfo();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [bulkPayrolls, setBulkPayrolls] = useState<any[]>([]); // Add bulkPayrolls state
  const [pakyawJobs, setPakyawJobs] = useState<PakyawJob[]>([]);
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');

  const [startDate, setStartDate] = useState(() => {
    const saved = localStorage.getItem("payrollStartDate");
    return saved || format(new Date(new Date().setMonth(new Date().getMonth() - 3)), "yyyy-MM-dd");
  });
  const [endDate, setEndDate] = useState(() => {
    const saved = localStorage.getItem("payrollEndDate");
    return saved || format(endOfMonth(new Date()), "yyyy-MM-dd");
  });

  const filteredPayrolls = useMemo(() => {
    return payrolls.filter(pr => {
      const isStatusMatch = statusFilter === 'all' || pr.status === statusFilter;
      const payslipDate = pr.startDate;
      const isDateMatch = payslipDate >= startDate && payslipDate <= endDate;
      return isStatusMatch && isDateMatch;
    });
  }, [payrolls, statusFilter, startDate, endDate]);

  const groupedPayrolls = useMemo(() => {
    const groups: { [key: string]: { paid: Payroll[], pending: Payroll[] } } = {};
    filteredPayrolls.forEach(pr => {
      // Group by startDate OR bulkId if available? The admin view uses bulkId for archives.
      // Let's use the dateKey as a proxy for now, but ensure we only show payrolls belonging to bulk runs as requested.
      const dateKey = pr.startDate; 
      if (!groups[dateKey]) groups[dateKey] = { paid: [], pending: [] };
      if (pr.status === 'paid') {
        groups[dateKey].paid.push(pr);
      } else {
        groups[dateKey].pending.push(pr);
      }
    });
    return Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0]));
  }, [filteredPayrolls]);

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

  const [selectedPayslip, setSelectedPayslip] = useState<
    (Payroll & { employee?: Employee }) | null
  >(null);
  const [selectedEmployeeProj, setSelectedEmployeeProj] = useState<any | null>(
    null,
  );

  const [isExporting, setIsExporting] = useState(false);
  const payslipRef = useRef<HTMLDivElement>(null);

  const sanitizeStyles = (payslipEl: HTMLElement) => {
    const allElements = [payslipEl, ...Array.from(payslipEl.querySelectorAll('*'))];
    allElements.forEach(el => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);
      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        const val = style.getPropertyValue(prop);
        if (val && (val.includes('oklch') || val.includes('oklab'))) {
          htmlEl.style.setProperty(prop, 'unset', 'important');
        }
      }
      htmlEl.style.transition = 'none';
      htmlEl.style.animation = 'none';
      htmlEl.style.transform = 'none';
    });
  };

  const handleDeletePayroll = async (id: string) => {
    if (!user) return;
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'payrolls', id));
      setPayrolls(prev => prev.filter(p => p.id !== id));
      setSelectedPayslip(null);
    } catch (error) {
      console.error('Error deleting payroll:', error);
    }
  };

  useEffect(() => {
    if (!user || dataLoading) return;

    setEmployees(contextEmployees);
    setPakyawJobs(contextPakyawJobs);
    setCashAdvances(contextCashAdvances);

    const qAtt = query(
      collection(db, "attendance"),
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );
    const unsubAttCount = onSnapshot(qAtt, (snapshot) => {
      const atts: Attendance[] = [];
      snapshot.forEach(doc => atts.push({ id: doc.id, ...doc.data() } as Attendance));
      setAttendances(atts);
    }, (error) => {
      if (!error?.message?.toLowerCase().includes('quota')) console.error("CEO Att Error:", error);
    });

    const qPayroll = query(
      collection(db, "payrolls"),
      orderBy("createdAt", "desc")
    );
    const unsubPayroll = onSnapshot(qPayroll, (snapshot) => {
      const payrollRes: Payroll[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const pr = { id: doc.id, ...data } as Payroll;
        console.log('DEBUG payroll snapshot:', pr.id, pr.startDate, pr.status, pr.createdAt);
        payrollRes.push(pr);
      });
      setPayrolls(payrollRes);
      setLoading(false);
    }, (error) => {
      if (!error?.message?.toLowerCase().includes('quota')) console.error("CEO Payroll Error:", error);
    });

    const qBulkPayroll = query(
      collection(db, "bulkPayrolls")
    );
    const unsubBulkPayroll = onSnapshot(qBulkPayroll, (snapshot) => {
      const bulkRes: any[] = [];
      snapshot.forEach(doc => {
        bulkRes.push({ id: doc.id, ...doc.data() });
      });
      setBulkPayrolls(bulkRes);
    }, (error) => {
      if (!error?.message?.toLowerCase().includes('quota')) console.error("CEO Bulk Payroll Error:", error);
    });

    return () => {
      unsubAttCount();
      unsubPayroll();
      unsubBulkPayroll();
    };
  }, [user, startDate, endDate, contextEmployees, contextPakyawJobs, contextCashAdvances, dataLoading]);

  const projection = useMemo(() => {
    let grandTotal = 0;
    const activeEmployees = employees.filter(
      (emp) => (emp.status === "active" || !emp.status) && emp.role !== "ceo" && emp.role !== "admin",
    );
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    const employeeProjections = activeEmployees.map((emp) => {
      const empAttendances = attendances.filter((a) => {
        if (a.employeeId !== emp.id) return false;
        try {
          const date = parseISO(a.date);
          return isWithinInterval(date, { start, end });
        } catch { return false; }
      });

      const attendedDates = new Set(empAttendances.map((a) => a.date));
      const workingDays = eachDayOfInterval({ start, end });

      const implicitAbsents: Attendance[] = [];
      workingDays.forEach((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        if (!attendedDates.has(dateStr)) {
          implicitAbsents.push({
            id: `implicit-${emp.id}-${dateStr}`,
            employeeId: emp.id,
            date: dateStr,
            status: "absent",
            userId: "system",
            createdAt: new Date().toISOString(),
          } as Attendance);
        }
      });

      const combinedAttendances = [...empAttendances, ...implicitAbsents].map(
        (att) => {
          if (att.status === "pakyaw" && att.pakyawJobId) {
            const job = pakyawJobs.find((j) => j.id === att.pakyawJobId);
            return { ...att, jobName: job ? (job.containerNumber ? `[${job.containerNumber}] ` + job.description : job.description) : undefined };
          }
          return att;
        },
      );

      let presentDays = 0, hdDays = 0, otHours = 0, otDays = 0, utDays = 0, absentDays = 0, pakyawDays = 0, regularHoursCount = 0;
      let dailyAttendanceLog: { date: string, status: string, regHrs: number, otHrs: number, isWorkDay: boolean }[] = [];

      combinedAttendances.forEach((att) => {
        const { regHrs, otHrs: calculatedOtHrs } = calculateAttendanceHours(att);
        if (calculatedOtHrs > 0) { otHours += calculatedOtHrs; otDays++; }
        const isHD = att.status === "hd" || (att.timeIn === "07:00" && att.timeOut === "12:00");
        const isUT = (att.status === "ut" || (att.status === "present" && regHrs < 8 && regHrs > 0)) && !isHD;
        const isPresent = att.status === "present" && !isUT && !isHD;
        let statusLabel: string = att.status;
        if (isPresent || isHD || isUT) {
          if (isPresent) { presentDays++; statusLabel = 'present'; }
          else if (isHD) { hdDays++; statusLabel = 'halfday'; }
          else if (isUT) { utDays++; statusLabel = 'undertime'; }
          regularHoursCount += regHrs;
        } else if (att.status === "absent") { absentDays++; }
        else if (att.status === "pakyaw") { pakyawDays++; }
        dailyAttendanceLog.push({ date: att.date, status: statusLabel, regHrs, otHrs: calculatedOtHrs, isWorkDay: att.userId !== 'system' });
      });

      const empPakyawJobs = pakyawJobs.filter(
        (pj) => pj.employeeIds.includes(emp.id) && pj.status === "completed" && isWithinInterval(parseISO(pj.startDate), { start, end }),
      );
      const pakyawPay = empPakyawJobs.reduce((sum, pj) => sum + pj.totalPrice / Math.max(1, pj.employeeIds.length), 0);
      const hourlyRate = (emp.dailySalary || 0) / 8;
      const regularPay = regularHoursCount * hourlyRate;
      const otPayAmount = otHours * hourlyRate;
      const empCAs = cashAdvances.filter((ca) => ca.employeeId === emp.id && isWithinInterval(parseISO(ca.date), { start, end }));
      const totalCA = empCAs.reduce((sum, ca) => sum + ca.amount, 0);
      const totalToBePaid = regularPay + otPayAmount + pakyawPay - totalCA;
      grandTotal += totalToBePaid;

      return { ...emp, presentDays, hdDays, utDays, absentDays, pakyawDays, otHours, otDays, pakyawPay, totalCA, totalToBePaid, attendances: combinedAttendances, dailyAttendanceLog, hourlyRate };
    });
    return { employeeProjections, grandTotal };
  }, [employees, attendances, pakyawJobs, cashAdvances, startDate, endDate]);

  const handleExportPDF = async () => {
    if (!selectedPayslip || !payslipRef.current) return;
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(payslipRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: payslipRef.current.scrollWidth,
        onclone: (clonedDoc) => {
          const payslip = clonedDoc.querySelector('.payslip-mockup');
          if (payslip) {
            const htmlPayslip = payslip as HTMLElement;
            htmlPayslip.style.width = '800px';
            htmlPayslip.style.maxWidth = 'none';
            htmlPayslip.style.maxHeight = 'none';
            htmlPayslip.style.overflow = 'visible';
            htmlPayslip.style.height = 'auto';
            htmlPayslip.style.color = '#000000';
            htmlPayslip.style.backgroundColor = '#ffffff';
            htmlPayslip.style.padding = '40px';
            
            sanitizeStyles(htmlPayslip);
          }
        }
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgRatio = canvas.height / canvas.width;
      const finalWidth = pdfWidth - 20;
      const finalHeight = finalWidth * imgRatio;
      
      pdf.addImage(imgData, "PNG", 10, 10, finalWidth, Math.min(finalHeight, pdfHeight - 20));
      pdf.save(
        `payslip_${selectedPayslip.employee?.fullName.replace(/\s+/g, "_")}_${selectedPayslip.startDate}.pdf`,
      );
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = async () => {
    if (!selectedPayslip || !payslipRef.current) return;
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(payslipRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: payslipRef.current.scrollWidth,
        onclone: (clonedDoc) => {
          const payslip = clonedDoc.querySelector('.payslip-mockup');
          if (payslip) {
            const htmlPayslip = payslip as HTMLElement;
            htmlPayslip.style.width = '800px';
            htmlPayslip.style.maxWidth = 'none';
            htmlPayslip.style.maxHeight = 'none';
            htmlPayslip.style.overflow = 'visible';
            htmlPayslip.style.height = 'auto';
            htmlPayslip.style.color = '#000000';
            htmlPayslip.style.backgroundColor = '#ffffff';
            htmlPayslip.style.padding = '40px';
            
            sanitizeStyles(htmlPayslip);
          }
        }
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgRatio = canvas.height / canvas.width;
      const finalWidth = pdfWidth - 20;
      const finalHeight = finalWidth * imgRatio;
      
      pdf.addImage(imgData, "PNG", 10, 10, finalWidth, Math.min(finalHeight, pdfHeight - 20));
      pdf.autoPrint();
      window.open(pdf.output('bloburl'), '_blank');
    } catch (error) {
      console.error("Error printing PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkExportProjection = async () => {
    if (projection.employeeProjections.length === 0) return;
    setIsExporting(true);
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      for (let i = 0; i < projection.employeeProjections.length; i++) {
        const emp = projection.employeeProjections[i];
        
        const mockPayslip = {
          startDate,
          endDate,
          employee: emp,
          totalPresent: emp.presentDays,
          totalHalfDays: emp.hdDays,
          totalUndertimeDays: emp.utDays,
          totalUndertimeHours: emp.attendances.reduce((acc, att) => {
             const { regHrs } = calculateAttendanceHours(att);
             return acc + (att.status === 'ut' ? regHrs : 0);
          }, 0),
          totalRegularHours: emp.presentDays * 8 + emp.hdDays * 4 + emp.utDays * 4,
          regularPay: (emp.attendances.reduce((sum, att) => {
             const { regHrs } = calculateAttendanceHours(att);
             return sum + (att.status === 'absent' ? 0 : regHrs);
          }, 0)) * emp.hourlyRate,
          totalOtHours: emp.otHours,
          otPay: emp.otHours * emp.hourlyRate,
          totalPakyawPay: emp.pakyawPay,
          totalGrossPay: emp.totalToBePaid + emp.totalCA,
          cashAdvanceDeduction: emp.totalCA,
          totalPay: emp.totalToBePaid,
          status: 'projection',
          dailyAttendanceLog: emp.dailyAttendanceLog
        };

        setSelectedPayslip(mockPayslip as any);
        await new Promise(resolve => setTimeout(resolve, i === 0 ? 300 : 800));

        if (payslipRef.current) {
          const canvas = await html2canvas(payslipRef.current, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: payslipRef.current.scrollWidth + 10,
            onclone: (clonedDoc) => {
              const payslipEl = clonedDoc.querySelector('.payslip-mockup');
              if (payslipEl) {
                const htmlPayslip = payslipEl as HTMLElement;
                htmlPayslip.style.width = '800px';
                htmlPayslip.style.maxWidth = 'none';
                htmlPayslip.style.maxHeight = 'none';
                htmlPayslip.style.overflow = 'visible';
                htmlPayslip.style.height = 'auto';
                htmlPayslip.style.padding = '40px';

                const allElements = [htmlPayslip, ...Array.from(htmlPayslip.querySelectorAll('*'))];
                allElements.forEach(el => {
                  const htmlEl = el as HTMLElement;
                  const style = window.getComputedStyle(htmlEl);
                  const colorProps = [
                    'color', 'background-color', 'border-color', 
                    'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color',
                    'fill', 'stroke', 'box-shadow', 'outline-color', 'text-decoration-color'
                  ];
                  colorProps.forEach(prop => {
                    const val = style.getPropertyValue(prop);
                    if (val && (val.includes('oklch') || val.includes('oklab') || val.includes('var('))) {
                      let fallback = '#000000';
                      if (prop.includes('background')) fallback = '#ffffff';
                      if (prop.includes('border')) fallback = '#e2e8f0';
                      if (prop === 'box-shadow') fallback = 'none';
                      if (prop === 'fill' || prop === 'stroke') fallback = val.includes('indigo') ? '#4f46e5' : (val.includes('emerald') ? '#10b981' : '#000000');
                      htmlEl.style.setProperty(prop, fallback, 'important');
                    }
                  });
                  htmlEl.style.transition = 'none';
                  htmlEl.style.animation = 'none';
                  htmlEl.style.transform = 'none';
                });
              }
            }
          });
          
          const imgData = canvas.toDataURL('image/png');
          const imgRatio = canvas.height / canvas.width;
          const finalWidth = pdfWidth - 20;
          const finalHeight = finalWidth * imgRatio;
          
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 10, 10, finalWidth, Math.min(finalHeight, pdfHeight - 20));
        }
      }
      setSelectedPayslip(null);
      pdf.save(`Bulk_Projection_${format(parseISO(startDate), 'MMM_dd')}_${format(parseISO(endDate), 'MMM_dd_yyyy')}.pdf`);
    } catch (error) {
      console.error('Error exporting bulk projection PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkExportHistory = async () => {
    if (payrolls.length === 0) return;
    setIsExporting(true);
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      for (let i = 0; i < filteredPayrolls.length; i++) {
        const pr = filteredPayrolls[i];
        const emp = employees.find(e => e.id === pr.employeeId);
        
        setSelectedPayslip({ ...pr, employee: emp });
        await new Promise(resolve => setTimeout(resolve, i === 0 ? 300 : 800));

        if (payslipRef.current) {
          const canvas = await html2canvas(payslipRef.current, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => {
              const payslipEl = clonedDoc.querySelector('.payslip-mockup');
              if (payslipEl) {
                const htmlPayslip = payslipEl as HTMLElement;
                htmlPayslip.style.maxWidth = 'none';
                htmlPayslip.style.maxHeight = 'none';
                htmlPayslip.style.overflow = 'visible';
                htmlPayslip.style.padding = '40px';
                sanitizeStyles(htmlPayslip);
              }
            }
          });
          
          const imgData = canvas.toDataURL('image/png');
          const imgRatio = canvas.height / canvas.width;
          const finalWidth = pdfWidth - 20;
          const finalHeight = finalWidth * imgRatio;
          
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 10, 10, finalWidth, Math.min(finalHeight, pdfHeight - 20));
        }
      }
      setSelectedPayslip(null);
      pdf.save(`Bulk_History_Export.pdf`);
    } catch (error) {
      console.error('Error exporting bulk history PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-none flex items-center gap-3">
            <span className="w-2 h-10 bg-cyan-500 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.6)]"></span>
            Executive Dashboard
          </h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 ml-5 italic opacity-80">
            L & P Trading and Services • Operational Status
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bento-card flex-col bg-slate-900/40 p-6 border border-white/10 shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-500"></div>
          <div className="flex items-center gap-3 text-cyan-400 mb-2 relative z-10">
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">Total Workforce</span>
          </div>
          <div className="stat-value relative z-10 text-white">
            {loading ? <Skeleton className="h-10 w-20 bg-white/10" /> : employees.filter((e) => e.role !== "ceo" && e.role !== "admin").length}
          </div>
        </div>
        <div className="bento-card flex-col bg-slate-900/40 p-6 border border-white/10 relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px] -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-all duration-700"></div>
          <div className="flex items-center gap-3 text-emerald-400 mb-2 relative z-10">
            <PhilippinePeso className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 italic">Upcoming Payroll Projection</span>
          </div>
          <div className="stat-value relative z-10 text-emerald-400">
            {loading ? <Skeleton className="h-10 w-48 bg-white/10" /> : <>₱ {projection.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bento-card flex-col bg-slate-900/40 border border-white/10 shadow-xl overflow-visible">
            {/* Projection content ... */}
        </div>
        <div className="bento-card flex-col bg-slate-900/40 border border-white/10 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" /> Payroll History
            </h3>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                  <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); localStorage.setItem("payrollStartDate", e.target.value); }} className="bg-slate-800 text-white text-[10px] p-1 rounded border border-white/10" />
                  <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); localStorage.setItem("payrollEndDate", e.target.value); }} className="bg-slate-800 text-white text-[10px] p-1 rounded border border-white/10" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className={`h-7 gap-1.5 rounded-lg border-white/10 text-white font-bold text-[9px] uppercase tracking-widest ${statusFilter === 'all' ? 'bg-blue-600' : 'bg-white/5'}`} onClick={() => setStatusFilter('all')}>All</Button>
                <Button size="sm" variant="outline" className={`h-7 gap-1.5 rounded-lg border-white/10 text-white font-bold text-[9px] uppercase tracking-widest ${statusFilter === 'paid' ? 'bg-blue-600' : 'bg-white/5'}`} onClick={() => setStatusFilter('paid')}>Paid</Button>
                <Button size="sm" variant="outline" className={`h-7 gap-1.5 rounded-lg border-white/10 text-white font-bold text-[9px] uppercase tracking-widest ${statusFilter === 'pending' ? 'bg-blue-600' : 'bg-white/5'}`} onClick={() => setStatusFilter('pending')}>Pending</Button>
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 rounded-lg border-white/10 text-white font-bold text-[9px] uppercase tracking-widest bg-white/5" onClick={handleBulkExportHistory} disabled={isExporting || filteredPayrolls.length === 0}>
                {isExporting ? <Loader2 className="w-3 h-3 animate-spin"/> : <Upload className="w-3 h-3 rotate-180"/>} Bulk Export
            </Button>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto no-scrollbar pr-2">
            {filteredPayrolls.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">No payrolls found.</div>
            ) : (
              groupedPayrolls.map(([dateKey, payrolls]) => (
                <div key={dateKey} className="space-y-4 bg-slate-900/20 p-4 rounded-xl border border-slate-800">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-950/80 backdrop-blur py-1 z-10 flex items-center gap-2">
                    <Calendar className="w-3 h-3"/>
                    {format(parseISO(dateKey), "MMMM d, yyyy")}
                  </h3>
                  
                  {payrolls.pending.length > 0 && (
                    <div className="space-y-2">
                       <h4 className="text-[9px] font-bold text-amber-500 uppercase">Pending</h4>
                       {payrolls.pending.map((pr) => (
                          <PayrollCard key={pr.id} pr={pr} employees={employees} setSelectedPayslip={setSelectedPayslip} />
                       ))}
                    </div>
                  )}
                  
                  {payrolls.paid.length > 0 && (
                    <div className="space-y-2">
                       <h4 className="text-[9px] font-bold text-emerald-500 uppercase">Paid</h4>
                       {payrolls.paid.map((pr) => (
                          <PayrollCard key={pr.id} pr={pr} employees={employees} setSelectedPayslip={setSelectedPayslip} />
                       ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {/* Add Dialog here */}
      <Dialog open={!!selectedPayslip} onOpenChange={() => setSelectedPayslip(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payslip Details - {selectedPayslip?.employee?.fullName}</DialogTitle>
          </DialogHeader>
          <div ref={payslipRef} className="payslip-mockup bg-white p-6 rounded-lg text-slate-800">
             <div className="border-b pb-4 mb-4">
                <h2 className="text-2xl font-bold uppercase italic">Payslip</h2>
                <p className="text-sm"><strong>Employee:</strong> {selectedPayslip?.employee?.fullName}</p>
                <p className="text-sm"><strong>Period:</strong> {selectedPayslip?.startDate} to {selectedPayslip?.endDate}</p>
             </div>
             
             <div className="space-y-4">
                <div>
                   <h3 className="font-bold border-b pb-1 mb-2">Earnings</h3>
                   <div className="flex justify-between"><span>Regular Pay:</span><span>₱{selectedPayslip?.regularPay.toLocaleString()}</span></div>
                   <div className="flex justify-between"><span>OT Pay:</span><span>₱{(selectedPayslip?.otPay || 0).toLocaleString()}</span></div>
                   <div className="flex justify-between"><span>Pakyaw Pay:</span><span>₱{(selectedPayslip?.totalPakyawPay || 0).toLocaleString()}</span></div>
                </div>
                
                <div>
                   <h3 className="font-bold border-b pb-1 mb-2">Deductions</h3>
                   <div className="flex justify-between"><span>Cash Advance:</span><span>₱{(selectedPayslip?.cashAdvanceDeduction || 0).toLocaleString()}</span></div>
                </div>
                
                <div className="border-t pt-4 font-bold text-lg flex justify-between">
                   <span>Total Pay:</span>
                   <span>₱{selectedPayslip?.totalPay.toLocaleString()}</span>
                </div>
             </div>
             <p className="text-xs text-slate-500 mt-6">Generated at: {selectedPayslip?.generatedAt}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} disabled={isExporting}>Export PDF</Button>
            <Button onClick={handlePrint} disabled={isExporting}>Print</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayrollCard({ pr, employees, setSelectedPayslip }: any) {
  const emp = employees.find((e: any) => e.id === pr.employeeId);
  return (
    <div
      className="p-3 bg-slate-950/30 rounded-lg border border-slate-800 hover:border-slate-600 transition-colors cursor-pointer"
      onClick={() => setSelectedPayslip({ ...pr, employee: emp })}
    >
      <div className="flex justify-between items-center">
        <div>
          <div className="font-bold text-white text-xs">
            {emp?.fullName || "Unknown Employee"}
          </div>
        </div>
        <div className="text-right">
          <div className="font-black text-emerald-400 text-sm">
            ₱ {pr.totalPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}