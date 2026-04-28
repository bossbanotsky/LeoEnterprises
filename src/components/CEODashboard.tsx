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
  isSunday,
  getDay,
} from "date-fns";
import { calculateAttendanceHours } from "../lib/payrollUtils";
import {
  Users,
  PhilippinePeso,
  Calendar,
  FileText,
  Download,
  Loader2,
  Upload,
  Trash2,
  Printer,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { useCompanyInfo } from "../hooks/useCompanyInfo";
import { Interactive } from "./ui/Interactive";
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
  const [pakyawJobs, setPakyawJobs] = useState<PakyawJob[]>([]);
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState(() => {
    const saved = localStorage.getItem("payrollStartDate");
    return saved || format(startOfMonth(new Date()), "yyyy-MM-dd");
  });
  const [endDate, setEndDate] = useState(() => {
    const saved = localStorage.getItem("payrollEndDate");
    return saved || format(endOfMonth(new Date()), "yyyy-MM-dd");
  });

  // Track admin dates if they get updated somewhere in localStorage
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
      snapshot.forEach(doc => payrollRes.push({ id: doc.id, ...doc.data() } as Payroll));
      setPayrolls(payrollRes);
      setLoading(false);
    }, (error) => {
      if (!error?.message?.toLowerCase().includes('quota')) console.error("CEO Payroll Error:", error);
    });

    return () => {
      unsubAttCount();
      unsubPayroll();
    };
  }, [user, startDate, endDate, contextEmployees, contextPakyawJobs, contextCashAdvances, dataLoading]);

  // Calculate upcoming payroll projections
  const projection = useMemo(() => {
    let grandTotal = 0;

    // Only calculate projections for currently active employees (exclude CEO and Admin profiles)
    const activeEmployees = employees.filter(
      (emp) =>
        (emp.status === "active" || !emp.status) &&
        emp.role !== "ceo" &&
        emp.role !== "admin",
    );
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    const employeeProjections = activeEmployees.map((emp) => {
      const empAttendances = attendances.filter((a) => {
        if (a.employeeId !== emp.id) return false;
        try {
          const date = parseISO(a.date);
          return isWithinInterval(date, { start, end });
        } catch {
          return false;
        }
      });

      const attendedDates = new Set(empAttendances.map((a) => a.date));
      // Full Monday to Sunday now (removed filter)
      const workingDays = eachDayOfInterval({ start, end });

      // Implicitly find missing days (Default Absent)
      const implicitAbsents: Attendance[] = [];
      workingDays.forEach((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        if (!attendedDates.has(dateStr)) {
          implicitAbsents.push({
            id: `implicit-${emp.id}-${dateStr}`,
            employeeId: emp.id,
            date: dateStr,
            status: "absent",
            timeIn: "",
            timeOut: "",
            regularHours: 0,
            otHours: 0,
            userId: "system",
            createdAt: new Date().toISOString(),
            uid: "system",
          } as Attendance);
        }
      });

      // Combine real records with detected system absents and enrich with job names
      const combinedAttendances = [...empAttendances, ...implicitAbsents].map(
        (att) => {
          if (att.status === "pakyaw" && att.pakyawJobId) {
            const job = pakyawJobs.find((j) => j.id === att.pakyawJobId);
            return { ...att, jobName: job?.description };
          }
          return att;
        },
      );

      let presentDays = 0;
      let hdDays = 0;
      let otHours = 0;
      let otDays = 0;
      let utDays = 0;
      let absentDays = 0;
      let pakyawDays = 0;
      let regularHoursCount = 0;
      let dailyAttendanceLog: { date: string, status: string, regHrs: number, otHrs: number, isWorkDay: boolean }[] = [];

      combinedAttendances.forEach((att) => {
        const { regHrs, otHrs: calculatedOtHrs } = calculateAttendanceHours(att);
        
        if (calculatedOtHrs > 0) {
          otHours += calculatedOtHrs;
          otDays++;
        }

        const isHD =
          att.status === "hd" ||
          (att.timeIn === "07:00" && att.timeOut === "12:00");
        const isUT =
          (att.status === "ut" ||
            (att.status === "present" &&
              regHrs < 8 &&
              regHrs > 0)) &&
          !isHD;
        const isPresent = att.status === "present" && !isUT && !isHD;

        let statusLabel: string = att.status;
        if (isPresent || isHD || isUT) {
          if (isPresent) {
            presentDays++;
            statusLabel = 'present';
          }
          else if (isHD) {
            hdDays++;
            statusLabel = 'halfday';
          }
          else if (isUT) {
            utDays++;
            statusLabel = 'undertime';
          }
          
          regularHoursCount += regHrs;
        } else if (att.status === "absent") {
          absentDays++;
        } else if (att.status === "pakyaw") {
          pakyawDays++;
        }

        dailyAttendanceLog.push({
          date: att.date,
          status: statusLabel,
          regHrs,
          otHrs: calculatedOtHrs,
          isWorkDay: att.userId !== 'system'
        });
      });

      // Pakyaw Pay Calculation (Sync with Payroll.tsx - only completed jobs)
      const empPakyawJobs = pakyawJobs.filter(
        (pj) =>
          pj.employeeIds.includes(emp.id) &&
          pj.status === "completed" &&
          isWithinInterval(parseISO(pj.startDate), { start, end }),
      );
      const pakyawPay = empPakyawJobs.reduce(
        (sum, pj) => sum + pj.totalPrice / Math.max(1, pj.employeeIds.length),
        0,
      );

      const hourlyRate = (emp.dailySalary || 0) / 8;
      const regularPay = regularHoursCount * hourlyRate;
      const otPayAmount = otHours * hourlyRate;

      // Cash Advance for period
      const empCAs = cashAdvances.filter(
        (ca) =>
          ca.employeeId === emp.id &&
          isWithinInterval(parseISO(ca.date), { start, end }),
      );
      const totalCA = empCAs.reduce((sum, ca) => sum + ca.amount, 0);

      const totalToBePaid = regularPay + otPayAmount + pakyawPay - totalCA;

      grandTotal += totalToBePaid;

      return {
        ...emp,
        presentDays,
        hdDays,
        utDays,
        absentDays,
        pakyawDays,
        otHours,
        otDays,
        pakyawPay,
        totalCA,
        totalToBePaid,
        attendances: combinedAttendances,
        dailyAttendanceLog, // ADDED
        hourlyRate,
      };
    });

    return { employeeProjections, grandTotal };
  }, [employees, attendances, pakyawJobs, cashAdvances, startDate, endDate]);

  const handleExportPDF = async () => {
    if (!selectedPayslip || !payslipRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(payslipRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: payslipRef.current.scrollWidth + 10,
        onclone: (clonedDoc) => {
          const payslip = clonedDoc.querySelector('.payslip-mockup');
          if (payslip) {
            (payslip as HTMLElement).style.width = 'auto';
            (payslip as HTMLElement).style.maxWidth = 'none';
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

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
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

      pdf.addImage(imgData, "PNG", marginX, marginY, finalWidth, finalHeight);
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
      
      const canvas = await html2canvas(payslipRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: payslipRef.current.offsetWidth,
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
      
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
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
      
      pdf.addImage(imgData, "PNG", marginX, marginY, finalWidth, finalHeight);
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
        
        // Mock payload for selectedPayslip to trigger render
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
          totalRegularHours: emp.presentDays * 8 + emp.hdDays * 4 + emp.utDays * 4, // Simple approximation for view
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
        await new Promise(resolve => setTimeout(resolve, 500));

        if (payslipRef.current) {
          
          const canvas = await html2canvas(payslipRef.current, {
            scale: 2,
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
                (payslip as HTMLElement).style.padding = '12px';
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
      
      for (let i = 0; i < payrolls.length; i++) {
        const pr = payrolls[i];
        const emp = employees.find(e => e.id === pr.employeeId);
        
        setSelectedPayslip({ ...pr, employee: emp });
        await new Promise(resolve => setTimeout(resolve, 500));

        if (payslipRef.current) {
          
          const canvas = await html2canvas(payslipRef.current, {
            scale: 2,
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
                (payslip as HTMLElement).style.padding = '12px';
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
            Leo Enterprises • Operational Status
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bento-card flex-col bg-slate-900/40 p-6 border border-white/10 shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-500"></div>
          <div className="flex items-center gap-3 text-cyan-400 mb-2 relative z-10">
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">
              Total Workforce
            </span>
          </div>
          <div className="stat-value relative z-10 text-white">
            {loading ? (
              <Skeleton className="h-10 w-20 bg-white/10" />
            ) : (
              employees.filter((e) => e.role !== "ceo" && e.role !== "admin")
                .length
            )}
          </div>
        </div>

        <div className="bento-card flex-col bg-slate-900/40 p-6 border border-white/10 relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px] -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-all duration-700"></div>
          <div className="flex items-center gap-3 text-emerald-400 mb-2 relative z-10">
            <PhilippinePeso className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 italic">
              Upcoming Payroll Projection
            </span>
          </div>
          <div className="stat-value relative z-10 text-emerald-400">
            {loading ? (
              <Skeleton className="h-10 w-48 bg-white/10" />
            ) : (
              <>
                ₱{" "}
                {projection.grandTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projection Filters & List */}
        <div className="bento-card flex-col bg-slate-900/40 border border-white/10 shadow-xl overflow-visible">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-black uppercase tracking-[0.2em] text-xs text-white flex items-center gap-2 italic">
              <Calendar className="w-4 h-4 text-slate-400" /> Projection Filter
            </h3>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 gap-1.5 rounded-lg border-white/10 text-white hover:bg-white/10 font-bold text-[9px] uppercase tracking-widest bg-white/5"
              onClick={handleBulkExportProjection}
              disabled={isExporting || projection.employeeProjections.length === 0}
            >
              {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3 rotate-180" />}
              Bulk PDF
            </Button>
          </div>
          <div className="flex items-center gap-2 relative z-20">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                localStorage.setItem("payrollStartDate", e.target.value);
                window.dispatchEvent(new Event("payrollDateChange"));
              }}
              className="flex h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 text-white font-bold"
            />
            <span className="text-white/60 font-black uppercase text-[10px] tracking-widest leading-none">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                localStorage.setItem("payrollEndDate", e.target.value);
                window.dispatchEvent(new Event("payrollDateChange"));
              }}
              className="flex h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 text-white font-bold"
            />
          </div>

          <div className="pt-4 space-y-3 max-h-[400px] overflow-y-auto no-scrollbar">
            {loading ? (
              <Skeleton count={5} className="h-16 w-full rounded-xl" />
            ) : (
              projection.employeeProjections.map((emp) => (
                <div
                  key={emp.id}
                  className="p-3 bg-white/5 rounded-xl flex items-center justify-between border border-white/10 cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={() => setSelectedEmployeeProj(emp)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 overflow-hidden flex items-center justify-center font-black text-cyan-400 text-xs shadow-sm border border-blue-500/30">
                      {emp.photoURL ? (
                        <img
                          src={emp.photoURL}
                          alt={emp.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        emp.fullName.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="font-black text-white text-sm uppercase tracking-tight italic leading-none">
                        {emp.fullName}
                      </div>
                      <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-none mt-1.5">
                        {emp.position || "Staff"} • ₱{emp.dailySalary?.toLocaleString() || 0}/day
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      ₱{" "}
                      {emp.totalToBePaid.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      {emp.presentDays + emp.utDays + emp.hdDays * 0.5} Days
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Generated Payroll Archve (Read Only) */}
        <div className="bento-card flex-col">
          <div className="flex justify-between items-center mb-4">
            <div className="flex flex-col gap-1">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" /> Past Payrolls
              </h3>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 gap-1.5 rounded-lg border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 font-bold text-[9px] uppercase tracking-widest bg-slate-50 self-start"
                onClick={handleBulkExportHistory}
                disabled={isExporting || payrolls.length === 0}
              >
                {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3 rotate-180" />}
                Bulk Export
              </Button>
            </div>
            {payrolls.length > 0 && (
              <div className="text-right">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Grand Total Paid
                </div>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  ₱{" "}
                  {payrolls
                    .filter(pr => pr.status === 'paid')
                    .reduce((sum, pr) => sum + (pr.totalPay || 0), 0)
                    .toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto no-scrollbar pr-2">
            {payrolls.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                No generated payrolls found.
              </div>
            ) : (
              payrolls.map((pr) => {
                const emp = employees.find((e) => e.id === pr.employeeId);
                return (
                  <div
                    key={pr.id}
                    className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-blue-300 transition-colors cursor-pointer"
                    onClick={() => setSelectedPayslip({ ...pr, employee: emp })}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {emp?.fullName || "Unknown Employee"}
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest">
                          {format(parseISO(pr.startDate), "MMM dd")} -{" "}
                          {format(parseISO(pr.endDate), "MMM dd, yyyy")}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div className="text-right">
                          <div className="font-black text-emerald-600 dark:text-emerald-400 text-base">
                            ₱{" "}
                            {pr.totalPay.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">
                            {pr.status === "paid" ? "Paid" : "Pending"}
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 w-7 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete payroll for ${emp?.fullName}?`)) {
                              handleDeletePayroll(pr.id!);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={!!selectedPayslip}
        onOpenChange={(open) => !open && setSelectedPayslip(null)}
      >
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

          {selectedPayslip && selectedPayslip.employee && (
            <div
              ref={payslipRef}
              className="p-3 max-h-[85vh] overflow-y-auto payslip-mockup bg-white font-sans text-[10px]" 
              style={{ backgroundColor: "#ffffff" }}
            >
              <div className="flex justify-between border-b border-slate-900 pb-2 mb-2">
                <div>
                  <div className="inline-flex items-center gap-1 px-1 py-0.5 bg-blue-600 text-white text-[7px] font-black uppercase tracking-[0.1em] rounded mb-1">
                    Official
                  </div>
                  <h2 className="text-xl font-black text-slate-900 leading-none italic uppercase">PAYSLIP</h2>
                  <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">
                    Pay Period: <span className="text-slate-900">{format(parseISO(selectedPayslip.startDate), "MM/dd")} - {format(parseISO(selectedPayslip.endDate), "MM/dd/yy")}</span>
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
                    <div className={`text-2xl font-black italic tracking-tighter leading-none ${selectedPayslip.totalPay < 0 ? "text-red-600" : "text-blue-600"}`}>
                      ₱{selectedPayslip.totalPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-right mt-auto">
                    <div className="text-[9px] font-black text-slate-900 uppercase italic leading-none">{companyInfo.name}</div>
                    {companyInfo.address && <div className="text-[7px] text-slate-400 mt-0.5 font-medium max-w-[100px] leading-tight ml-auto truncate">{companyInfo.address}</div>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-sans">
                <div className="space-y-2">
                  <div>
                    <h3 className="text-[9px] font-black text-slate-900 border-b border-slate-100 pb-1 mb-1.5 uppercase flex justify-between">
                      Earnings <span>₱</span>
                    </h3>
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold text-[8px] uppercase">Regular</span>
                        <span className="font-black text-slate-900">₱{selectedPayslip.regularPay.toFixed(2)}</span>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Employee Projection Details Dialog */}
      <Dialog
        open={!!selectedEmployeeProj}
        onOpenChange={(open) => !open && setSelectedEmployeeProj(null)}
      >
        <DialogContent className="sm:max-w-[500px] border-slate-200">
          <DialogHeader>
            <DialogTitle>Projection Breakdown</DialogTitle>
          </DialogHeader>

          {selectedEmployeeProj && (
            <div className="space-y-4 pt-2 relative">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center font-bold text-blue-600 overflow-hidden shadow-sm">
                  {selectedEmployeeProj.photoURL ? (
                    <img
                      src={selectedEmployeeProj.photoURL}
                      alt={selectedEmployeeProj.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    selectedEmployeeProj.fullName.charAt(0)
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">
                    {selectedEmployeeProj.fullName}
                  </h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest">
                    {selectedEmployeeProj.position || "Staff"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">
                      Present
                    </span>
                    <span className="font-bold text-slate-900">
                      {selectedEmployeeProj.presentDays} days
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">
                      Half Days
                    </span>
                    <span className="font-bold text-slate-900">
                      {selectedEmployeeProj.hdDays} days
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-orange-50 rounded-xl border border-orange-100 text-orange-900">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Undertime</span>
                    <span className="font-bold">
                      {selectedEmployeeProj.utDays} days
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-red-900">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Absent</span>
                    <span className="font-bold">
                      {selectedEmployeeProj.absentDays} days
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-900">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Pakyaw</span>
                    <span className="font-bold">
                      {selectedEmployeeProj.pakyawDays} days
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-blue-900">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Overtime</span>
                    <div className="text-right">
                      <span className="font-bold block">
                        {selectedEmployeeProj.otHours} hours
                      </span>
                      <span className="text-[10px] font-medium opacity-70 italic">
                        {selectedEmployeeProj.otDays} days worked OT
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-emerald-800">
                    Regular Pay
                  </span>
                  <span className="font-bold text-emerald-900">
                    ₱{" "}
                    {(
                      selectedEmployeeProj.totalToBePaid -
                      selectedEmployeeProj.otHours *
                        selectedEmployeeProj.hourlyRate
                    ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-emerald-800">
                    Overtime ({selectedEmployeeProj.otHours}h)
                  </span>
                  <span className="font-bold text-emerald-900">
                    ₱{" "}
                    {(
                      selectedEmployeeProj.otHours *
                      selectedEmployeeProj.hourlyRate
                    ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-emerald-200">
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                    Gross Estimate
                  </span>
                  <span className="text-xl font-black text-emerald-700">
                    ₱{" "}
                    {selectedEmployeeProj.totalToBePaid.toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Daily Attendance Log
                </h4>
                <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {selectedEmployeeProj.attendances &&
                  selectedEmployeeProj.attendances.length > 0 ? (
                    [...selectedEmployeeProj.attendances]
                      .sort((a: any, b: any) => b.date.localeCompare(a.date))
                      .map((att: any) => {
                        const { regHrs, otHrs } = calculateAttendanceHours(att);
                        const isHD =
                          att.status === "hd" ||
                          (att.timeIn === "07:00" && att.timeOut === "12:00");
                        const isUT =
                          (att.status === "ut" ||
                            (att.status === "present" &&
                              regHrs < 8 &&
                              regHrs > 0)) &&
                          !isHD;
                        const isPresent =
                          att.status === "present" && !isUT && !isHD;
                        return (
                          <div
                            key={att.id}
                            className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  isPresent
                                    ? "bg-emerald-500"
                                    : isHD
                                      ? "bg-blue-400"
                                      : isUT
                                        ? "bg-orange-400"
                                        : att.status === "pakyaw"
                                          ? "bg-amber-500"
                                          : "bg-red-500"
                                }`}
                              ></div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {format(parseISO(att.date), "MMM dd, yyyy")}
                                {(isPresent || isHD || isUT) && att.timeIn && (
                                  <span className="block text-[10px] text-slate-400 font-normal">
                                    {att.timeIn} - {att.timeOut || "--:--"}
                                    {otHrs > 0 && (
                                      <span className="text-blue-500 ml-1">
                                        +{otHrs}h OT
                                      </span>
                                    )}
                                  </span>
                                )}
                                {att.status === "pakyaw" && att.jobName && (
                                  <span className="block text-[10px] text-amber-600 font-bold italic">
                                    Project: {att.jobName}
                                  </span>
                                )}
                              </span>
                            </div>
                            <span className="text-xs font-bold uppercase tracking-tighter px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {isHD
                                ? "Half Day"
                                : isUT
                                  ? "Undertime"
                                  : isPresent
                                    ? "Present"
                                    : att.status}
                            </span>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed">
                      No attendance logs for this period
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-400 text-center font-medium italic mt-4">
                Note: This is an ungenerated projection. It does not account for
                specific Cash Advances or individual worker Pakyaw contracts
                until the final payroll is generated by an Admin.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
