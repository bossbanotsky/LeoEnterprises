import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useCompanyInfo } from "../hooks/useCompanyInfo";
import {
  Announcement,
  Employee,
  Attendance,
  PakyawJob,
  CashAdvance,
} from "../types";
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Hammer,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Plus,
  Eye,
  PhilippinePeso,
} from "lucide-react";
import {
  format,
  addDays,
  subDays,
  parseISO,
  isPast,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSunday,
  getDay,
} from "date-fns";
import { calculateAttendanceHours } from "../lib/payrollUtils";
import { Input } from "./ui/input";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Interactive } from "./ui/Interactive";
import { Skeleton } from "./ui/Skeleton";

export default function Dashboard() {
  const { user } = useAuth();
  const { companyInfo } = useCompanyInfo();
  const [selectedDate, setSelectedDate] = useState(
    () =>
      localStorage.getItem("dashSelectedDate") ||
      format(new Date(), "yyyy-MM-dd"),
  );
  const [stats, setStats] = useState({
    totalEmployees: 0,
    present: 0,
    absent: 0,
    ut: 0,
    hd: 0,
    pakyaw: 0,
    ot: 0,
    presentIds: [] as string[],
    absentIds: [] as string[],
    utIds: [] as string[],
    hdIds: [] as string[],
    pakyawIds: [] as string[],
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<{
    category: string | null;
    employeeIds: string[];
  }>({ category: null, employeeIds: [] });
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [pakyawJobs, setPakyawJobs] = useState<PakyawJob[]>([]);
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<
    Announcement[]
  >([]);
  const [loading, setLoading] = useState(true);

  // Projection States
  const [startDate, setStartDate] = useState(
    () =>
      localStorage.getItem("payrollStartDate") ||
      format(startOfMonth(new Date()), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(
    () =>
      localStorage.getItem("payrollEndDate") ||
      format(endOfMonth(new Date()), "yyyy-MM-dd"),
  );
  const [selectedEmployeeProj, setSelectedEmployeeProj] = useState<any | null>(
    null,
  );

  useEffect(() => {
    const handleStorage = () => {
      const savedStart = localStorage.getItem("payrollStartDate");
      const savedEnd = localStorage.getItem("payrollEndDate");
      if (savedStart) setStartDate(savedStart);
      if (savedEnd) setEndDate(savedEnd);
    };
    window.addEventListener("payrollDateChange", handleStorage);
    return () => window.removeEventListener("payrollDateChange", handleStorage);
  }, []);

  useEffect(() => {
    localStorage.setItem("dashSelectedDate", selectedDate);
  }, [selectedDate]);

  const handlePrevDate = () => {
    setSelectedDate((prev) => format(subDays(parseISO(prev), 1), "yyyy-MM-dd"));
  };

  const handleNextDate = () => {
    setSelectedDate((prev) => format(addDays(parseISO(prev), 1), "yyyy-MM-dd"));
  };

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const { getDocs, collection, query, where, orderBy, limit } = await import('firebase/firestore');
        
        // 1. Employees (Single Fetch)
        const empsSnapshot = await getDocs(collection(db, "employees"));
        const emps: Employee[] = [];
        const activeEmpIds = new Set<string>();
        empsSnapshot.forEach((doc) => {
          const data = doc.data();
          emps.push({ id: doc.id, ...data } as Employee);
          if (
            (data.status === "active" || !data.status) &&
            data.role !== "ceo" &&
            data.role !== "admin"
          ) {
            activeEmpIds.add(doc.id);
          }
        });
        setEmployees(emps);
        setStats((prev) => ({ ...prev, totalEmployees: activeEmpIds.size }));

        // 2. Attendance for current dashboard date
        const attDayQ = query(
          collection(db, "attendance"),
          where("date", "==", selectedDate),
        );
        const attDaySnapshot = await getDocs(attDayQ);
        
        const presentIds: string[] = [];
        const utIds: string[] = [];
        const hdIds: string[] = [];
        const pakyawIds: string[] = [];
        const absentIds: string[] = [];
        let ot = 0;
        const loggedIds = new Set<string>();

        attDaySnapshot.forEach((doc) => {
          const data = doc.data();
          if (activeEmpIds.has(data.employeeId)) {
            loggedIds.add(data.employeeId);
            const isHD = data.status === "hd" || (data.timeIn === "07:00" && data.timeOut === "12:00");
            const isUT = (data.status === "ut" || (data.status === "present" && data.regularHours !== undefined && data.regularHours < 8 && data.regularHours > 0)) && !isHD;
            const isPresent = data.status === "present" && !isUT && !isHD;

            if (isPresent) presentIds.push(data.employeeId);
            else if (isUT) utIds.push(data.employeeId);
            else if (isHD) hdIds.push(data.employeeId);
            else if (data.status === "pakyaw") pakyawIds.push(data.employeeId);
            else if (data.status === "absent") absentIds.push(data.employeeId);
            if (data.otHours && data.otHours > 0) ot += data.otHours;
          }
        });

        Array.from(activeEmpIds).forEach(id => {
          if (!loggedIds.has(id)) absentIds.push(id);
        });

        setStats((prev) => ({
          ...prev,
          present: presentIds.length,
          ut: utIds.length,
          hd: hdIds.length,
          pakyaw: pakyawIds.length,
          ot,
          absent: absentIds.length,
          presentIds, utIds, hdIds, pakyawIds, absentIds,
        }));

        // 3. Attendance for Projection Range (Optimization: Fetch only needed range)
        const attRangeQ = query(
          collection(db, "attendance"),
          where("date", ">=", startDate),
          where("date", "<=", endDate)
        );
        const attRangeSnapshot = await getDocs(attRangeQ);
        const allAtts: Attendance[] = [];
        attRangeSnapshot.forEach((doc) => allAtts.push({ id: doc.id, ...doc.data() } as Attendance));
        setAttendances(allAtts);

        // 4. Pakyaw Jobs
        const pjSnapshot = await getDocs(collection(db, "pakyawJobs"));
        const pj: PakyawJob[] = [];
        pjSnapshot.forEach((doc) => pj.push({ id: doc.id, ...doc.data() } as PakyawJob));
        setPakyawJobs(pj);

        // 5. Cash Advances
        const caSnapshot = await getDocs(collection(db, "cashAdvances"));
        const ca: CashAdvance[] = [];
        caSnapshot.forEach((doc) => ca.push({ id: doc.id, ...doc.data() } as CashAdvance));
        setCashAdvances(ca);

        // 6. Announcements
        const qAnn = query(
          collection(db, "announcements"),
          orderBy("createdAt", "desc"),
          limit(3),
        );
        const annSnapshot = await getDocs(qAnn);
        const dataAnn: Announcement[] = [];
        annSnapshot.forEach((doc) => dataAnn.push({ id: doc.id, ...doc.data() } as Announcement));
        setRecentAnnouncements(dataAnn);
        
        setLoading(false);
      } catch (error: any) {
        if (!error?.message?.toLowerCase().includes('quota')) {
          handleFirestoreError(error, OperationType.GET, "dashboard_fetch");
        }
        setLoading(false);
      }
    };

    fetchData();
  }, [user, selectedDate, startDate, endDate]);

  const projection = useMemo(() => {
    let grandTotal = 0;
    const activeEmployees = employees.filter(
      (emp) =>
        (emp.status === "active" || !emp.status) &&
        (!emp.position || !emp.position.toLowerCase().includes("ceo")) &&
        emp.role !== "ceo" &&
        emp.role !== "admin",
    );
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    const employeeProjections = activeEmployees
      .map((emp) => {
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
        // Full Monday to Sunday
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
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return { employeeProjections, grandTotal };
  }, [employees, attendances, pakyawJobs, cashAdvances, startDate, endDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Overview
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Welcome back to {companyInfo.name}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1 group">
          <button
            onClick={handlePrevDate}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-1 py-1 bg-slate-50 dark:bg-slate-900 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-blue-500 ml-1" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-0 h-7 text-xs font-black bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 w-[110px] p-0"
            />
          </div>

          <button
            onClick={handleNextDate}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bento-card flex-col bg-white dark:bg-slate-800 p-6 border-blue-100 dark:border-blue-900/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 mb-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest">
                Total Employees
              </span>
            </div>
            <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              {loading ? <Skeleton className="h-10 w-24" /> : stats.totalEmployees}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium uppercase tracking-wider">
              Active Personnel
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Interactive className="bento-card flex-col bg-white dark:bg-slate-800 p-5 border-emerald-100 dark:border-emerald-900/30 relative overflow-hidden group hover:border-emerald-300 transition-colors cursor-pointer" onClick={() => setSelectedStatus({category: "Present", employeeIds: stats.presentIds})}>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Present
                </span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {loading ? <Skeleton className="h-9 w-16" /> : stats.present}
              </div>
            </Interactive>

            <Interactive className="bento-card flex-col bg-white dark:bg-slate-800 p-5 border-sky-100 dark:border-sky-900/30 relative overflow-hidden group hover:border-sky-300 transition-colors cursor-pointer" onClick={() => setSelectedStatus({category: "Undertime", employeeIds: stats.utIds})}>
              <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  UT
                </span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {loading ? <Skeleton className="h-9 w-16" /> : stats.ut}
              </div>
            </Interactive>

            <Interactive className="bento-card flex-col bg-white dark:bg-slate-800 p-5 border-indigo-100 dark:border-indigo-900/30 relative overflow-hidden group hover:border-indigo-300 transition-colors cursor-pointer" onClick={() => setSelectedStatus({category: "Half-Day", employeeIds: stats.hdIds})}>
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  HD
                </span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {loading ? <Skeleton className="h-9 w-16" /> : stats.hd}
              </div>
            </Interactive>

            <div className="bento-card flex-col bg-white dark:bg-slate-800 p-5 border-blue-100 dark:border-blue-900/30 relative overflow-hidden group">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  OT Total
                </span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {loading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <>
                    {stats.ot.toFixed(1)}{" "}
                    <span className="text-sm font-bold text-slate-400">h</span>
                  </>
                )}
              </div>
            </div>

            <Interactive className="bento-card flex-col bg-white dark:bg-slate-800 p-5 border-amber-100 dark:border-amber-900/30 relative overflow-hidden group hover:border-amber-300 transition-colors cursor-pointer" onClick={() => setSelectedStatus({category: "Pakyaw", employeeIds: stats.pakyawIds})}>
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                <Hammer className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Pakyaw
                </span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {loading ? <Skeleton className="h-9 w-16" /> : stats.pakyaw}
              </div>
            </Interactive>

            <Interactive className="bento-card flex-col bg-white dark:bg-slate-800 p-5 border-rose-100 dark:border-rose-900/30 relative overflow-hidden group hover:border-rose-300 transition-colors cursor-pointer" onClick={() => setSelectedStatus({category: "Absent", employeeIds: stats.absentIds})}>
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-2">
                <XCircle className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Absent
                </span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {loading ? <Skeleton className="h-9 w-16" /> : stats.absent}
              </div>
            </Interactive>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bento-card flex-col bg-slate-900 dark:bg-slate-950 p-6 border-slate-800 relative overflow-hidden group min-h-[160px] justify-center text-center md:text-left">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px] -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-all duration-700"></div>
              <div className="flex items-center gap-3 text-emerald-400 mb-2 relative z-10 justify-center md:justify-start">
                <PhilippinePeso className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-500">
                  Upcoming Projection
                </span>
              </div>
              <div className="text-4xl font-black text-white relative z-10">
                {loading ? (
                  <Skeleton className="h-10 w-48 bg-slate-800" />
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
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 relative z-10">
                {format(parseISO(startDate), "MMM dd")} -{" "}
                {format(parseISO(endDate), "MMM dd")}
              </div>
            </div>

            <div className="bento-card flex-col bg-white dark:bg-slate-800 p-6 border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Period
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartDate(val);
                    localStorage.setItem("payrollStartDate", val);
                    window.dispatchEvent(new Event("payrollDateChange"));
                  }}
                  className="h-9 text-xs rounded-xl"
                />
                <span className="text-slate-400">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEndDate(val);
                    localStorage.setItem("payrollEndDate", val);
                    window.dispatchEvent(new Event("payrollDateChange"));
                  }}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="bento-card flex-col bg-white dark:bg-slate-800 p-6 border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">
                Personnel Projection Details
              </h3>
              <div className="text-[10px] text-slate-400 font-medium">
                Click name for daily logs
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                <Skeleton count={6} className="h-20 w-full" />
              ) : (
                projection.employeeProjections.map((emp) => (
                  <Interactive
                    key={emp.id}
                    className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-between border border-slate-100 dark:border-slate-800 hover:border-blue-300 transition-colors"
                    onClick={() => setSelectedEmployeeProj(emp)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 overflow-hidden flex items-center justify-center font-bold text-blue-600 text-xs">
                        {emp.photoURL ? (
                          <img
                            src={emp.photoURL}
                            alt=""
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
                        <div className="text-[10px] text-slate-500">
                          {emp.position || "Staff"}
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
                      <div className="text-[9px] text-slate-400">
                        {emp.presentDays + emp.utDays + emp.hdDays * 0.5} Action
                        Days
                      </div>
                    </div>
                  </Interactive>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Announcements Preview */}
        <div className="bento-card flex-col bg-white dark:bg-slate-800 p-6 border-slate-200 dark:border-slate-700 h-full">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">
                Recent Notices
              </h3>
            </div>
            <Link
              to="/admin-dashboard/announcements"
              className="p-1 px-2 bg-blue-50 dark:bg-blue-900/40 text-[9px] font-bold text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors uppercase"
            >
              Manage
            </Link>
          </div>

          <div className="space-y-4">
            {loading ? (
              <Skeleton count={3} className="h-16 w-full mb-3" />
            ) : recentAnnouncements.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center gap-2 opacity-40">
                <Megaphone className="w-8 h-8 text-slate-300" />
                <p className="text-xs font-bold uppercase tracking-widest">
                  No New Notices
                </p>
              </div>
            ) : (
              recentAnnouncements.map((ann, idx) => (
                <div
                  key={ann.id}
                  className={`group flex flex-col gap-1 pb-4 ${idx !== recentAnnouncements.length - 1 ? "border-b border-slate-50 dark:border-slate-800" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {ann.title}
                    </h4>
                    {isPast(parseISO(ann.expiresAt)) && (
                      <span className="text-[8px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase">
                        Archived
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                    {ann.message}
                  </p>
                  <Link
                    to="/admin-dashboard/announcements"
                    className="flex items-center gap-2 mt-1"
                  >
                    <div className="flex items-center gap-1 text-[9px] text-slate-400">
                      <Eye className="w-3 h-3" /> Seen by {ann.viewedBy.length}
                    </div>
                  </Link>
                </div>
              ))
            )}

            <Link to="/admin-dashboard/announcements" className="block">
              <button className="w-full mt-2 h-10 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 text-[10px] font-bold uppercase tracking-widest">
                <Plus className="w-3.5 h-3.5" />
                Post New Notice
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Detail Breakdown Modal */}
      <Dialog
        open={!!selectedEmployeeProj}
        onOpenChange={(open) => !open && setSelectedEmployeeProj(null)}
      >
        <DialogContent className="sm:max-w-[500px] border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle>Projection Breakdown</DialogTitle>
          </DialogHeader>

          {selectedEmployeeProj && (
            <div className="space-y-4 pt-2 relative">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 overflow-hidden shadow-sm">
                  {selectedEmployeeProj.photoURL ? (
                    <img
                      src={selectedEmployeeProj.photoURL}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    selectedEmployeeProj.fullName.charAt(0)
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    {selectedEmployeeProj.fullName}
                  </h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest">
                    {selectedEmployeeProj.position || "Staff"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Present
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedEmployeeProj.presentDays} days
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Half Days
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedEmployeeProj.hdDays} days
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-xl border border-orange-100 dark:border-orange-900/30 text-orange-900 dark:text-orange-400">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Undertime</span>
                    <span className="font-bold">
                      {selectedEmployeeProj.utDays} days
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30 text-red-900 dark:text-red-400">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Absent</span>
                    <span className="font-bold">
                      {selectedEmployeeProj.absentDays} days
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-400">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Pakyaw</span>
                    <span className="font-bold">
                      {selectedEmployeeProj.pakyawDays} days
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30 text-blue-900 dark:text-blue-400">
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

              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
                    Regular Pay Est.
                  </span>
                  <span className="font-bold text-emerald-900 dark:text-emerald-100">
                    ₱{" "}
                    {(
                      selectedEmployeeProj.totalToBePaid -
                      selectedEmployeeProj.otHours *
                        selectedEmployeeProj.hourlyRate
                    ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
                    Overtime ({selectedEmployeeProj.otHours}h)
                  </span>
                  <span className="font-bold text-emerald-900 dark:text-emerald-100">
                    ₱{" "}
                    {(
                      selectedEmployeeProj.otHours *
                      selectedEmployeeProj.hourlyRate
                    ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-900/50">
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                    Calculated Projection
                  </span>
                  <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">
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
                  Attendance Log
                </h4>
                <div className="max-h-[180px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
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
                            className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px]"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isPresent
                                    ? "bg-emerald-500"
                                    : att.status === "hd"
                                      ? "bg-blue-400"
                                      : att.status === "ut"
                                        ? "bg-orange-400"
                                        : att.status === "pakyaw"
                                          ? "bg-amber-500"
                                          : "bg-red-500"
                                }`}
                              ></div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {format(parseISO(att.date), "MMM dd, yyyy")}
                                {(isPresent || isHD || isUT) && att.timeIn && (
                                  <span className="block text-[9px] text-slate-400 font-normal">
                                    {att.timeIn} - {att.timeOut || "--:--"}
                                  </span>
                                )}
                                {att.status === "pakyaw" && att.jobName && (
                                  <span className="block text-[9px] text-amber-600 font-bold italic">
                                    Project: {att.jobName}
                                  </span>
                                )}
                              </span>
                            </div>
                            <span className="font-bold uppercase tracking-tighter opacity-60">
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
                    <div className="text-center py-4 text-xs text-slate-400 border border-dashed rounded-xl">
                      No logs found
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Status Drill-Down Modal */}
      <Dialog
        open={!!selectedStatus.category}
        onOpenChange={(open) => !open && setSelectedStatus({ category: null, employeeIds: [] })}
      >
        <DialogContent className="sm:max-w-[400px] border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle>Employees: {selectedStatus.category}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {selectedStatus.employeeIds.map((id) => {
              const emp = employees.find((e) => e.id === id);
              if (!emp) return null;
              
              const att = attendances.find((a) => a.employeeId === id && a.date === selectedDate);
              const job = att && att.status === 'pakyaw' ? pakyawJobs.find((j) => j.id === att.pakyawJobId) : null;
              
              return (
                <div key={emp.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center gap-3 border border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-slate-500 text-xs shrink-0">
                    {emp.photoURL ? (
                      <img
                        src={emp.photoURL}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      emp.fullName.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {emp.fullName}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {emp.position || "Staff"}
                      </div>
                    </div>
                    {att && (
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        {(att.timeIn || att.timeOut) && (
                          <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            {format(parseISO(`${selectedDate}T${att.timeIn || '00:00'}`), "h:mm a")} - {att.timeOut ? format(parseISO(`${selectedDate}T${att.timeOut}`), "h:mm a") : 'No out'}
                          </div>
                        )}
                        <div className="flex flex-wrap justify-end gap-1">
                          {att.status === 'pakyaw' && job && (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                              {job.description}
                            </span>
                          )}
                          {!!att.otHours && att.otHours > 0 && (
                            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                              +{att.otHours}h OT
                            </span>
                          )}
                          {!!att.regularHours && att.regularHours > 0 && att.regularHours < 8 && selectedStatus.category !== 'Half-Day' && (
                            <span className="text-[9px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/30 px-1.5 py-0.5 rounded">
                              {att.regularHours}h
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {selectedStatus.employeeIds.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-400">
                No employees found in this category.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
