import React, { useState, useEffect, useMemo, useRef } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
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
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { useCompanyInfo } from "../hooks/useCompanyInfo";
import { Interactive } from "./ui/Interactive";
import { Skeleton } from "./ui/Skeleton";
import html2canvas from "html2canvas";

export default function CEODashboard() {
  const { user } = useAuth();
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

  useEffect(() => {
    if (!user) return;

    const unsubscribeEmps = onSnapshot(
      collection(db, "employees"),
      (snapshot) => {
        const emps: Employee[] = [];
        snapshot.forEach((doc) =>
          emps.push({ id: doc.id, ...doc.data() } as Employee),
        );
        setEmployees(
          emps.sort((a, b) =>
            (a.fullName || "").localeCompare(b.fullName || ""),
          ),
        );
        setLoading(false);
      },
    );

    const unsubscribeAtts = onSnapshot(
      collection(db, "attendance"),
      (snapshot) => {
        const atts: Attendance[] = [];
        snapshot.forEach((doc) =>
          atts.push({ id: doc.id, ...doc.data() } as Attendance),
        );
        setAttendances(atts);
      },
    );

    const unsubscribePayrolls = onSnapshot(
      collection(db, "payrolls"),
      (snapshot) => {
        const p: Payroll[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Only show officially paid/active completed payrolls to the CEO
          if (data.status === "paid") {
            p.push({ id: doc.id, ...data } as Payroll);
          }
        });
        setPayrolls(
          p.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
      },
    );

    const unsubscribePakyaw = onSnapshot(
      collection(db, "pakyawJobs"),
      (snapshot) => {
        const pj: PakyawJob[] = [];
        snapshot.forEach((doc) =>
          pj.push({ id: doc.id, ...doc.data() } as PakyawJob),
        );
        setPakyawJobs(pj);
      },
    );

    const unsubscribeCA = onSnapshot(
      collection(db, "cashAdvances"),
      (snapshot) => {
        const ca: CashAdvance[] = [];
        snapshot.forEach((doc) =>
          ca.push({ id: doc.id, ...doc.data() } as CashAdvance),
        );
        setCashAdvances(ca);
      },
    );

    return () => {
      unsubscribeEmps();
      unsubscribeAtts();
      unsubscribePayrolls();
      unsubscribePakyaw();
      unsubscribeCA();
    };
  }, [user]);

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

        if (isPresent || isHD || isUT) {
          if (isPresent) presentDays++;
          else if (isHD) hdDays++;
          else if (isUT) utDays++;
          
          regularHoursCount += regHrs;
        } else if (att.status === "absent") {
          absentDays++;
        } else if (att.status === "pakyaw") {
          pakyawDays++;
        }
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
        hourlyRate,
      };
    });

    return { employeeProjections, grandTotal };
  }, [employees, attendances, pakyawJobs, cashAdvances, startDate, endDate]);

  const handleExportPDF = async () => {
    if (!selectedPayslip || !payslipRef.current) return;
    setIsExporting(true);
    try {
      const { jsPDF } = await import("jspdf");

      const originalStyle = payslipRef.current.style.maxHeight;
      payslipRef.current.style.maxHeight = "none";

      const canvas = await html2canvas(payslipRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      payslipRef.current.style.maxHeight = originalStyle;

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a5",
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

      const marginX = (pdfWidth - finalWidth) / 2;
      const marginY = (pdfHeight - finalHeight) / 2;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
            CEO Executive Dashboard
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Financial overview and personnel tracking
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bento-card flex-col bg-white dark:bg-slate-800 p-6 border-blue-100 dark:border-blue-900/30">
          <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 mb-2">
            <Users className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">
              Total Workforce
            </span>
          </div>
          <div className="text-4xl font-black">
            {loading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              employees.filter((e) => e.role !== "ceo" && e.role !== "admin")
                .length
            )}
          </div>
        </div>

        <div className="bento-card flex-col bg-slate-900 dark:bg-slate-950 p-6 border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px] -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-all duration-700"></div>
          <div className="flex items-center gap-3 text-emerald-400 mb-2 relative z-10">
            <PhilippinePeso className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-500">
              Upcoming Payroll Projection
            </span>
          </div>
          <div className="text-4xl font-black text-slate-900 dark:text-white relative z-10">
            {loading ? (
              <Skeleton className="h-10 w-48" />
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
        <div className="bento-card flex-col space-y-4">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" /> Projection Filter
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                localStorage.setItem("payrollStartDate", e.target.value);
                window.dispatchEvent(new Event("payrollDateChange"));
              }}
              className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 dark:border-slate-800 dark:bg-slate-950 text-slate-800 dark:text-white"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                localStorage.setItem("payrollEndDate", e.target.value);
                window.dispatchEvent(new Event("payrollDateChange"));
              }}
              className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 dark:border-slate-800 dark:bg-slate-950 text-slate-800 dark:text-white"
            />
          </div>

          <div className="pt-4 space-y-3 max-h-[400px] overflow-y-auto no-scrollbar">
            {loading ? (
              <Skeleton count={5} className="h-16 w-full rounded-xl" />
            ) : (
              projection.employeeProjections.map((emp) => (
                <div
                  key={emp.id}
                  className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-between border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-blue-300 transition-colors"
                  onClick={() => setSelectedEmployeeProj(emp)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 overflow-hidden flex items-center justify-center font-bold text-blue-600 text-xs shadow-sm">
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
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        {emp.fullName}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest">
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
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" /> Past Payrolls
            </h3>
            {payrolls.length > 0 && (
              <div className="text-right">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Grand Total Paid
                </div>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  ₱{" "}
                  {payrolls
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
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* View Payslip Dialog */}
      <Dialog
        open={!!selectedPayslip}
        onOpenChange={(open) => !open && setSelectedPayslip(null)}
      >
        <DialogContent className="sm:max-w-[700px] bg-slate-50 p-0 overflow-hidden border-none rounded-2xl shadow-2xl">
          <div className="bg-white px-6 py-4 border-b flex justify-between items-center rounded-t-2xl sticky top-0 z-10 shadow-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-800">
                <FileText className="w-5 h-5 text-blue-600" />
                Payslip Details
              </DialogTitle>
            </DialogHeader>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 rounded-lg"
                onClick={handleExportPDF}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isExporting ? "Exporting..." : "Export"}
              </Button>
            </div>
          </div>

          {selectedPayslip && selectedPayslip.employee && (
            <div
              ref={payslipRef}
              className="p-6 max-h-[60vh] overflow-y-auto"
              style={{ backgroundColor: "#ffffff" }}
            >
              <div className="flex justify-between border-b-2 border-slate-800 pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">PAYSLIP</h2>
                  <div className="text-sm text-slate-600 mt-1">
                    {format(parseISO(selectedPayslip.startDate), "MMM dd")} -{" "}
                    {format(parseISO(selectedPayslip.endDate), "MMM dd, yyyy")}
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center font-bold overflow-hidden border">
                      {selectedPayslip.employee.photoURL ? (
                        <img
                          src={selectedPayslip.employee.photoURL}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        selectedPayslip.employee.fullName.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="text-xl font-black text-slate-900 uppercase tracking-tight">
                        {selectedPayslip.employee.fullName}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {selectedPayslip.employee.position || "Staff"}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500 mb-1">NET PAY</div>
                  <div
                    className={`text-2xl font-bold ${selectedPayslip.totalPay < 0 ? "text-red-600" : "text-blue-600"}`}
                  >
                    ₱ {selectedPayslip.totalPay.toFixed(2)}
                  </div>
                  <div className="text-xs font-bold text-slate-800 mt-2">
                    {companyInfo.name}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold text-slate-900 border-b pb-2 mb-3 text-sm">
                    EARNINGS
                  </h3>
                  <div className="space-y-2 text-sm text-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-600">
                        Basic Pay ({selectedPayslip.totalRegularHours} hrs)
                      </span>
                      <span className="font-medium">
                        ₱ {selectedPayslip.regularPay.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">
                        Overtime Pay ({selectedPayslip.totalOtHours} hrs)
                      </span>
                      <span className="font-medium text-green-600">
                        ₱ {selectedPayslip.otPay.toFixed(2)}
                      </span>
                    </div>
                    {selectedPayslip.totalPakyawPay > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Pakyaw Contracts</span>
                        <span className="font-medium text-indigo-600">
                          ₱ {selectedPayslip.totalPakyawPay.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2 mt-2 font-bold">
                      <span>Gross Pay</span>
                      <span>₱ {selectedPayslip.totalGrossPay.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 border-b pb-2 mb-3 text-sm">
                    DEDUCTIONS
                  </h3>
                  <div className="space-y-2 text-sm text-slate-800">
                    <div className="flex justify-between text-red-600">
                      <span>Cash Advance</span>
                      <span>
                        - ₱ {selectedPayslip.cashAdvanceDeduction.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2 font-bold">
                      <span>Total Deductions</span>
                      <span className="text-red-600">
                        - ₱ {selectedPayslip.cashAdvanceDeduction.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
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
