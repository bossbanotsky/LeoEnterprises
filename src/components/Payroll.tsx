import React, { useState, useEffect, useRef } from 'react';
import { recordTransaction, deleteTransactionsByReference } from '../services/financeService';
import { collection, onSnapshot, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDocs as getDocsFirebase, collection as col, arrayUnion, getDoc, orderBy, limit, deleteField } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, addAuditLog } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { 
  Employee, 
  Attendance, 
  CashAdvance, 
  PakyawJob, 
  Payroll as PayrollRecord, 
  PayrollPakyawDetail,
  Adjustment
} from '../types';
import { format, parseISO, eachDayOfInterval, isWithinInterval, isSunday } from "date-fns";
import { calculateAttendanceHours } from "../lib/payrollUtils";
import { 
  Calendar, 
  ChevronRight, 
  FileText, 
  Download, 
  Trash2, 
  Loader2, 
  Users, 
  CreditCard, 
  CheckCircle, 
  Search, 
  Upload, 
  Printer, 
  ExternalLink,
  Plus,
  History,
  AlertCircle,
  ArrowRight,
  CheckSquare,
  Edit,
  RefreshCw
} from 'lucide-react';
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
  const { showToast } = useToast();
  const { employees, pakyawJobs, cashAdvances, loading: dataLoading } = useData();
  const [startDate, setStartDate] = useState(() => localStorage.getItem('payrollStartDate') || format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(() => localStorage.getItem('payrollEndDate') || format(new Date(), 'yyyy-MM-15'));

  const loadingInitial = dataLoading;
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [bulkPayrolls, setBulkPayrolls] = useState<any[]>([]);
  const [selectedBulkId, setSelectedBulkId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedAdjustmentEmployee, setSelectedAdjustmentEmployee] = useState<string>('');
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<Adjustment['type']>('bonus');
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>('');
  const [adjustmentDescription, setAdjustmentDescription] = useState('');
  const [pendingAdjustments, setPendingAdjustments] = useState<Adjustment[]>([]);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'payroll' | 'bulk' | 'adjustment'; name?: string } | null>(null);
  const [viewMode, setViewMode] = useState<'process' | 'archives' | 'carryover'>('process');
  const [archivedBulkRuns, setArchivedBulkRuns] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem('payrollStartDate', startDate);
    window.dispatchEvent(new Event('payrollDateChange'));
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem('payrollEndDate', endDate);
    window.dispatchEvent(new Event('payrollDateChange'));
  }, [endDate]);

  const [selectedCarryOverEmployee, setSelectedCarryOverEmployee] = useState<Employee | null>(null);
  const [carryOverHistory, setCarryOverHistory] = useState<any[]>([]);

  const handleViewCarryOverDetail = async (emp: Employee) => {
    setSelectedCarryOverEmployee(emp);
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'payrolls'),
        where('employeeId', '==', emp.id),
        orderBy('generatedAt', 'desc')
      );
      const snap = await getDocs(q);
      const history = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((p: any) => p.carryOverToNext !== 0 || p.carryOverFromPrevious !== 0);
      setCarryOverHistory(history);
    } catch (error) {
      console.error("Error fetching carry-over history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // NEW PREVIEW STATE
  const [previewData, setPreviewData] = useState<{
    payrollsToSave: any[],
    bulkTotalPay: number,
    targetEmployees: Employee[]
  } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // States for inline preview editing & overrides
  const [editingPreviewIdx, setEditingPreviewIdx] = useState<number | null>(null);
  const [editRegularPay, setEditRegularPay] = useState<string>('');
  const [editOtPay, setEditOtPay] = useState<string>('');
  const [editPakyawPay, setEditPakyawPay] = useState<string>('');
  const [editAdjustments, setEditAdjustments] = useState<string>('');
  const [editCashAdvanceDeduction, setEditCashAdvanceDeduction] = useState<string>('');
  const [editCarryOverFromPrevious, setEditCarryOverFromPrevious] = useState<string>('');

  // States for saved payroll overrides
  const [isEditingSavedPayslip, setIsEditingSavedPayslip] = useState(false);
  const [savedRegPay, setSavedRegPay] = useState<string>('');
  const [savedOtPay, setSavedOtPay] = useState<string>('');
  const [savedPakyawPay, setSavedPakyawPay] = useState<string>('');
  const [savedAdjustments, setSavedAdjustments] = useState<string>('');
  const [savedCashAdvanceDeduction, setSavedCashAdvanceDeduction] = useState<string>('');
  const [savedCarryOverFromPrevious, setSavedCarryOverFromPrevious] = useState<string>('');

  // Keep track of synchronized payslip IDs in a session to avoid multiple/infinite triggers
  const syncedPayslipsRef = useRef<Set<string>>(new Set());

  // Print layout options to fit 2 items on a single A4 page to minimize print costs
  const [fitTwoPerA4, setFitTwoPerA4] = useState(false);
  const [dupSingleOnA4, setDupSingleOnA4] = useState(false);

  const handleSavePreviewOverride = (idx: number) => {
    if (!previewData) return;
    const newPayrolls = [...previewData.payrollsToSave];
    const item = { ...newPayrolls[idx] };

    const reg = parseFloat(editRegularPay) || 0;
    const ot = parseFloat(editOtPay) || 0;
    const pakyaw = parseFloat(editPakyawPay) || 0;
    const adj = parseFloat(editAdjustments) || 0;
    const ca = parseFloat(editCashAdvanceDeduction) || 0;
    const cop = parseFloat(editCarryOverFromPrevious) || 0;

    const totalEarnings = reg + ot + pakyaw + adj;
    const totalGrossPay = totalEarnings - cop;
    const totalPay = totalGrossPay - ca;

    item.regularPay = reg;
    item.otPay = ot;
    item.totalPakyawPay = pakyaw;
    item.totalAdjustments = adj;
    item.cashAdvanceDeduction = ca;
    item.carryOverFromPrevious = cop;
    item.totalEarnings = totalEarnings;
    item.totalGrossPay = totalGrossPay;
    item.totalPay = totalPay;
    item.isManualOverride = true; // Mark as customized

    newPayrolls[idx] = item;

    // Recalculate bulk total
    const newBulkTotal = newPayrolls.reduce((sum, p) => sum + (p.status === 'carried_over' ? 0 : p.totalPay), 0);

    setPreviewData({
      ...previewData,
      payrollsToSave: newPayrolls,
      bulkTotalPay: newBulkTotal
    });
    setEditingPreviewIdx(null);
  };

  const handleSyncPayslip = async (payslipId: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Fetch current payslip from database
      const payslipSnap = await getDoc(doc(db, 'payrolls', payslipId));
      if (!payslipSnap.exists()) {
        showToast('Payslip not found', 'error');
        return;
      }
      const savedPayslip = { id: payslipSnap.id, ...payslipSnap.data() } as any;
      const { employeeId, startDate, endDate } = savedPayslip;
      
      const emp = employees.find(e => e.id === employeeId);
      if (!emp) {
        showToast('Employee not found', 'error');
        return;
      }

      // 2. REVERT original cash advance deductions of this payslip in Firestore before recalculation
      if (savedPayslip.cashAdvanceIds) {
        for (const caId of savedPayslip.cashAdvanceIds) {
          const caRef = doc(db, 'cashAdvances', caId);
          const caSnap = await getDoc(caRef);
          if (caSnap.exists()) {
            const caData = caSnap.data();
            const targetD = (caData.deductions || []).find((d: any) => d.payrollId === payslipId);
            if (targetD) {
              await updateDoc(caRef, {
                remainingBalance: (caData.remainingBalance || 0) + targetD.amount,
                deductions: (caData.deductions || []).filter((d: any) => d.payrollId !== payslipId)
              });
            }
          }
        }
      }

      // Also revert status of adjustments linked to this payslip back to 'pending'
      const adjQ = query(collection(db, 'adjustments'), where('payrollId', '==', payslipId));
      const adjSnap = await getDocs(adjQ);
      for (const adjDoc of adjSnap.docs) {
        await updateDoc(adjDoc.ref, {
          status: 'pending',
          payrollId: deleteField()
        });
      }

      // 3. FETCH latest live data directly from Firestore
      // Attendance
      const attQ = query(
        collection(db, 'attendance'),
        where('employeeId', '==', employeeId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const attSnap = await getDocs(attQ);
      const empAtts: Attendance[] = [];
      attSnap.forEach(docSnap => empAtts.push({ id: docSnap.id, ...docSnap.data() } as Attendance));

      // Outstanding Cash Advances
      const caQ = query(
        collection(db, 'cashAdvances'),
        where('employeeId', '==', employeeId),
        where('remainingBalance', '>', 0)
      );
      const caSnap = await getDocs(caQ);
      const empCa: any[] = [];
      caSnap.forEach(docSnap => empCa.push({ id: docSnap.id, ...docSnap.data() }));
      empCa.sort((a, b) => a.date.localeCompare(b.date));

      // Pakyaw Jobs
      const pjQ = query(
        collection(db, 'pakyawJobs'),
        where('employeeIds', 'array-contains', employeeId)
      );
      const pjSnap = await getDocs(pjQ);
      const allPjw: any[] = [];
      pjSnap.forEach(docSnap => {
        const pj = { id: docSnap.id, ...docSnap.data() } as any;
        const startedInRange = pj.startDate >= startDate && pj.startDate <= endDate;
        const completedAtDate = pj.completedAt ? pj.completedAt.split('T')[0] : null;
        const completedInRange = completedAtDate && completedAtDate >= startDate && completedAtDate <= endDate;
        if (startedInRange || completedInRange) {
          allPjw.push(pj);
        }
      });

      // Pending/Restored Adjustments
      const freshAdjQ = query(
        collection(db, 'adjustments'),
        where('employeeId', '==', employeeId),
        where('status', '==', 'pending')
      );
      const freshAdjSnap = await getDocs(freshAdjQ);
      const empAdjustments: any[] = [];
      freshAdjSnap.forEach(docSnap => empAdjustments.push({ id: docSnap.id, ...docSnap.data() }));

      // 4. RUN ALL CALCULATIONS
      const dateRange = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate)
      }).map(d => format(d, 'yyyy-MM-dd'));

      let totalPresent = 0;
      let totalHalfDays = 0;
      let totalUndertimeDays = 0;
      let totalUndertimeHours = 0;
      let undertimeDetails: string[] = [];
      let totalAbsent = 0;
      let absentDates: string[] = [];
      let totalRegularHours = 0;
      let totalOtHours = 0;
      let otDetails: string[] = [];
      let cashAdvanceDeduction = 0;
      let cashAdvanceDetails: string[] = [];
      let appliedCashAdvanceIds: string[] = [];
      let totalPakyawPay = 0;
      let presentEarnings = 0;
      let hdEarnings = 0;
      let utEarnings = 0;
      let pakyawDetails: string[] = [];
      let pakyawItems: PayrollPakyawDetail[] = [];
      let dailyAttendanceLog: { date: string, status: string, regHrs: number, otHrs: number, isWorkDay: boolean }[] = [];

      const totalAdjustmentsAmount = empAdjustments.reduce((sum, a) => {
        if (a.type === 'deduction') return sum - a.amount;
        return sum + a.amount;
      }, 0);

      empCa.forEach(ca => {
        cashAdvanceDeduction += (ca.remainingBalance || 0);
        appliedCashAdvanceIds.push(ca.id);
        cashAdvanceDetails.push(`CA ${format(parseISO(ca.date), 'MMMM dd, yyyy')}: ₱${(ca.remainingBalance || 0).toFixed(2)}`);
      });

      allPjw.forEach(pj => {
        const splitAmount = pj.totalPrice / Math.max(1, pj.employeeIds.length);
        const jobName = pj.containerNumber ? `[${pj.containerNumber}] ${pj.description}` : pj.description;
        
        const pakyawItem: PayrollPakyawDetail = {
          jobId: pj.id,
          description: jobName,
          amount: splitAmount,
          status: pj.status,
          isPaid: false
        };
        pakyawItems.push(pakyawItem);

        if (pj.status === 'completed') {
          totalPakyawPay += splitAmount;
          pakyawDetails.push(`${jobName}: ₱${(splitAmount || 0).toFixed(2)}`);
        } else {
          pakyawDetails.push(`${jobName}: PENDING (Not Finished)`);
        }
      });

      let regularPay = 0;
      let otPay = 0;

      dateRange.forEach(date => {
        const dayAtts = empAtts.filter(a => a.date === date);
        
        if (dayAtts.length > 0) {
          let dayRegHrs = 0;
          let dayOtHrs = 0;
          let dayRegularPay = 0;
          let dayOtPay = 0;
          let statuses = new Set<string>();

          dayAtts.forEach(att => {
            const { regHrs, otHrs } = calculateAttendanceHours(att);
            dayRegHrs += regHrs;
            dayOtHrs += otHrs;

            const effectiveHourlyRate = att.hourlyRate || (emp.dailySalary / 8);
            dayRegularPay += regHrs * effectiveHourlyRate;
            dayOtPay += otHrs * effectiveHourlyRate;
            
            statuses.add(att.status);
          });

          regularPay += dayRegularPay;
          otPay += dayOtPay;
          totalRegularHours += dayRegHrs;
          totalOtHours += dayOtHrs;

          let statusLabel: string = statuses.has('hd') ? 'halfday' : (dayRegHrs < 8 && !statuses.has('pakyaw') ? 'undertime' : 'present');
          if (statuses.has('pakyaw')) statusLabel = 'pakyaw';
          if (statuses.has('absent') && dayRegHrs === 0) statusLabel = 'absent';

          if (statusLabel === 'halfday') {
            totalHalfDays++;
            hdEarnings += dayRegularPay;
          } else if (statusLabel === 'undertime' && dayRegHrs < 8) {
             totalUndertimeDays++;
             utEarnings += dayRegularPay;
             const deficit = 8 - dayRegHrs;
             totalUndertimeHours += deficit;
             undertimeDetails.push(`${format(parseISO(date), 'MMMM dd, yyyy')}: ${dayRegHrs}h (Deficit: -${(deficit || 0).toFixed(1)}h)`);
          } else if (statusLabel === 'present') {
             totalPresent++;
             presentEarnings += dayRegularPay;
          } else if (statusLabel === 'absent') {
             totalAbsent++;
             absentDates.push(format(parseISO(date), 'MMMM dd, yyyy'));
          }

          if (dayOtHrs > 0) {
            otDetails.push(`${format(parseISO(date), 'MMMM dd, yyyy')}: ${(dayOtHrs || 0).toFixed(1)}h OT`);
          }

          dailyAttendanceLog.push({ 
            date, 
            status: statusLabel, 
            regHrs: dayRegHrs, 
            otHrs: dayOtHrs,
            isWorkDay: true 
          });
        } else {
          totalAbsent++;
          absentDates.push(format(parseISO(date), 'MMMM dd, yyyy'));
          dailyAttendanceLog.push({ 
            date, 
            status: 'absent', 
            regHrs: 0, 
            otHrs: 0,
            isWorkDay: false 
          });
        }
      });

      const totalEarnings = regularPay + otPay + totalPakyawPay + totalAdjustmentsAmount;
      const empRef = doc(db, 'employees', employeeId);
      const empSnap = await getDoc(empRef);
      const carryOverFromPrevious = empSnap.exists() ? (empSnap.data().carryOverBalance || 0) : (emp.carryOverBalance || 0);

      const totalGrossPay = totalEarnings - carryOverFromPrevious;
      const totalPay = totalGrossPay - cashAdvanceDeduction;

      // 5. UPDATE FIRESTORE PAYROLL DOCUMENT
      const updatedPayload = {
        totalPresent,
        totalHalfDays,
        totalUndertimeDays,
        totalUndertimeHours,
        undertimeDetails,
        totalAbsent,
        absentDates,
        totalRegularHours,
        totalOtHours,
        otDetails,
        regularPay,
        otPay,
        presentEarnings,
        hdEarnings,
        utEarnings,
        totalPakyawPay,
        pakyawDetails,
        pakyawItems,
        adjustments: empAdjustments,
        totalAdjustments: totalAdjustmentsAmount,
        dailyAttendanceLog, 
        totalEarnings,
        totalGrossPay,
        cashAdvanceDeduction,
        cashAdvanceDetails,
        cashAdvanceIds: appliedCashAdvanceIds,
        carryOverFromPrevious,
        totalPay,
        isManualOverride: false, // reset override markers when synchronized
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'payrolls', payslipId), updatedPayload);

      // Re-apply Adjustments to status='applied'
      if (empAdjustments.length > 0) {
        for (const adj of empAdjustments) {
          await updateDoc(doc(db, 'adjustments', adj.id), {
            status: 'applied',
            payrollId: payslipId
          });
        }
      }

      // Re-apply Cash Advance deductions
      if (appliedCashAdvanceIds.length > 0) {
        for (const caId of appliedCashAdvanceIds) {
          const caRef = doc(db, 'cashAdvances', caId);
          const caSnap = await getDoc(caRef);
          if (caSnap.exists()) {
            const caData = caSnap.data();
            const deductionAmount = caData.remainingBalance;
            await updateDoc(caRef, {
              remainingBalance: 0,
              deductions: arrayUnion({
                payrollId: payslipId,
                amount: deductionAmount,
                period: `${startDate} to ${endDate}`,
                date: new Date().toISOString()
              })
            });
          }
        }
      }

      // Update employee's carryOverBalance
      if (empSnap.exists()) {
        const empData = empSnap.data();
        const currentBal = empData.carryOverBalance || 0;
        
        let oldCarryOverToNext = savedPayslip.carryOverToNext || 0;
        let oldCarryOverFromPrevious = savedPayslip.carryOverFromPrevious || 0;

        const netOldAdjustment = oldCarryOverToNext - oldCarryOverFromPrevious;
        
        let finalCarryOverToNext = 0;
        if (totalPay < 0) {
          const deficit = Math.abs(totalPay);
          const existingCaQ = query(collection(db, 'cashAdvances'), where('originPayrollId', '==', payslipId), limit(1));
          const existingCaSnap = await getDocs(existingCaQ);

          if (existingCaSnap.empty) {
            const newCaRef = await addDoc(collection(db, 'cashAdvances'), {
              employeeId,
              date: new Date().toISOString().split('T')[0],
              amount: deficit,
              remainingBalance: deficit,
              deductions: [],
              notes: `Auto-CA from Deficit (Period: ${startDate} to ${endDate})`,
              originPayrollId: payslipId, 
              createdAt: new Date().toISOString(),
              uid: user.uid
            });

            // Transaction
            const accSnap = await getDocs(query(collection(db, 'accounts'), where('type', '==', 'cash')));
            const accountId = accSnap.empty ? 'cash-account-id' : accSnap.docs[0].id;
            await recordTransaction(
              accountId,
              'expense',
              deficit,
              'Cash Advance',
              `Auto-CA for ${emp.fullName} (Deficit - Synced)`,
              newCaRef.id,
              user.uid
            );
          } else {
            const caId = existingCaSnap.docs[0].id;
            const caData = existingCaSnap.docs[0].data();
            if (caData.amount !== deficit) {
              await updateDoc(doc(db, 'cashAdvances', caId), {
                amount: deficit,
                remainingBalance: deficit - (caData.amount - caData.remainingBalance),
                notes: `Auto-CA Updated (Period: ${startDate} to ${endDate})`
              });
            }
          }
        } else {
          const existingCaQ = query(collection(db, 'cashAdvances'), where('originPayrollId', '==', payslipId));
          const existingCaSnap = await getDocs(existingCaQ);
          for (const caDoc of existingCaSnap.docs) {
            await deleteTransactionsByReference(caDoc.id);
            await deleteDoc(doc(db, 'cashAdvances', caDoc.id));
          }
        }

        const netNewAdjustment = finalCarryOverToNext - carryOverFromPrevious;
        const newBalance = currentBal - netOldAdjustment + netNewAdjustment;
        
        await updateDoc(empRef, { carryOverBalance: newBalance });
      }

      // Re-trigger local selection update
      const freshSnap = await getDoc(doc(db, 'payrolls', payslipId));
      if (freshSnap.exists()) {
        const liveRecord = { id: freshSnap.id, employee: emp, ...freshSnap.data() };
        setSelectedPayslip(liveRecord);
        setPayrollData(prev => prev.map(p => p.id === payslipId ? liveRecord : p));
      }

      showToast('Payslip synced successfully', 'success');
    } catch (error) {
      console.error('Error syncing payslip:', error);
      showToast('Failed to sync payslip', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSavedPayslipOverride = async () => {
    if (!selectedPayslip?.id) return;
    setIsLoading(true);
    try {
      const reg = parseFloat(savedRegPay) || 0;
      const ot = parseFloat(savedOtPay) || 0;
      const pakyaw = parseFloat(savedPakyawPay) || 0;
      const adj = parseFloat(savedAdjustments) || 0;
      const ca = parseFloat(savedCashAdvanceDeduction) || 0;
      const cop = parseFloat(savedCarryOverFromPrevious) || 0;

      const totalEarnings = reg + ot + pakyaw + adj;
      const totalGrossPay = totalEarnings - cop;
      const totalPay = totalGrossPay - ca;

      const updatedFields = {
        regularPay: reg,
        otPay: ot,
        totalPakyawPay: pakyaw,
        totalAdjustments: adj,
        cashAdvanceDeduction: ca,
        carryOverFromPrevious: cop,
        totalEarnings,
        totalGrossPay,
        totalPay,
        isManualOverride: true,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'payrolls', selectedPayslip.id), updatedFields);
      
      // Update local state and the list of payroll data
      setSelectedPayslip({
        ...selectedPayslip,
        ...updatedFields
      });

      setPayrollData(prev => prev.map(p => p.id === selectedPayslip.id ? { ...p, ...updatedFields } : p));

      showToast('Payroll record updated successfully', 'success');
      setIsEditingSavedPayslip(false);
    } catch (error) {
      console.error('Error updating saved payroll:', error);
      showToast('Failed to update payroll', 'error');
    } finally {
      setIsLoading(false);
    }
  };

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
      
      // Only remove overflow constraints from the root element or containers that have overflow-y scrollable properties
      if (htmlEl === payslipEl || htmlEl.classList.contains('payslip-mockup')) {
        htmlEl.style.overflow = 'visible';
        htmlEl.style.height = 'auto';
        htmlEl.style.maxHeight = 'none';
      } else {
        const overflowY = style.overflowY;
        const maxHeight = style.maxHeight;
        if (overflowY === 'auto' || overflowY === 'scroll' || (maxHeight && maxHeight !== 'none')) {
          htmlEl.style.overflow = 'visible';
          htmlEl.style.maxHeight = 'none';
          // Do not touch height to preserve fixed aspect ratios of descendants like avatars
        }
      }
    });
  };

  useEffect(() => {
    const q = query(
      collection(db, 'adjustments'),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Adjustment));
      setPendingAdjustments(ads);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveAdjustment = async () => {
    if (!selectedAdjustmentEmployee || !adjustmentAmount || !adjustmentDescription) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const adjustmentData: Omit<Adjustment, 'id'> = {
        employeeId: selectedAdjustmentEmployee,
        type: adjustmentType,
        amount: parseFloat(adjustmentAmount),
        description: adjustmentDescription,
        status: 'pending',
        date: format(new Date(), 'yyyy-MM-dd'),
        createdAt: new Date().toISOString(),
        uid: user?.uid || ''
      };

      await addDoc(collection(db, 'adjustments'), adjustmentData);
      showToast('Adjustment saved for next payroll', 'success');
      setIsAdjustmentDialogOpen(false);
      setAdjustmentAmount('');
      setAdjustmentDescription('');
    } catch (error) {
      console.error('Error saving adjustment:', error);
      showToast('Failed to save adjustment', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAdjustment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'adjustments', id));
      showToast('Adjustment deleted', 'success');
      setItemToDelete(null);
    } catch (error) {
      console.error('Error deleting adjustment:', error);
      showToast('Failed to delete adjustment', 'error');
    }
  };

  const handleMarkAsPaid = async (bulkId: string) => {
    try {
      // Find bulk payroll data to get the date range
      const bulkDoc = await getDoc(doc(db, 'bulkPayrolls', bulkId));
      const bulkData = bulkDoc.data();
      const startDateStr = bulkData?.startDate;
      const endDateStr = bulkData?.endDate;

      // Find accounts for splitting/routing
      const allAccSnap = await getDocsFirebase(collection(db, 'accounts'));
      const allAccounts = allAccSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const junkshopAcc = allAccounts.find(a => a.name.toLowerCase().replace(/\s+/g, '').includes('junkshop'));
      const containerAcc = allAccounts.find(a => a.name.toLowerCase().replace(/\s+/g, '').includes('container'));
      const defaultAcc = allAccounts.find(a => a.isDefault) || allAccounts.find(a => a.type === 'cash') || allAccounts[0];

      const paidAt = new Date().toISOString();
      await updateDoc(doc(db, 'bulkPayrolls', bulkId), {
        status: 'paid',
        paidAt
      });
      
      // Mark Daily Proofs for deletion if they fall within this range
      if (startDateStr && endDateStr) {
        const proofsQ = query(
          collection(db, 'dailyProofs'),
          where('date', '>=', startDateStr),
          where('date', '<=', endDateStr)
        );
        const proofsSnap = await getDocs(proofsQ);
        const proofUpdates = proofsSnap.docs.map(async (pDoc) => {
          await updateDoc(pDoc.ref, { payrollPaidAt: paidAt });
        });
        await Promise.all(proofUpdates);
      }

      const payrollsQ = query(collection(db, 'payrolls'), where('bulkId', '==', bulkId));
      const payrollsSnap = await getDocs(payrollsQ);
      
      await Promise.all(payrollsSnap.docs.map(async (payrollDoc) => {
        try {
          const pData = payrollDoc.data();
          if (pData.status === 'paid') return; // Skip if already paid

          const employee = employees.find(e => e.id === pData.employeeId);
          const position = (employee?.position || '').toLowerCase();
          const role = (employee?.role || '').toLowerCase();

          await updateDoc(doc(db, 'payrolls', payrollDoc.id), { status: 'paid' });

          // Handle Cash Advance Balance Updates
          if (pData.cashAdvanceDeduction > 0 && pData.cashAdvanceIds) {
            let deductionPool = pData.totalGrossPay; // Available to pay off debt
            for (const caId of pData.cashAdvanceIds) {
              if (deductionPool <= 0) break;
              
              const caRef = doc(db, 'cashAdvances', caId);
              const caSnap = await import('firebase/firestore').then(f => f.getDoc(caRef));
              if (caSnap.exists()) {
                const caData = caSnap.data();
                const amountToDeduct = Math.min(deductionPool, caData.remainingBalance);
                deductionPool -= amountToDeduct;
                
                await updateDoc(caRef, {
                  remainingBalance: caData.remainingBalance - amountToDeduct,
                  deductions: [
                    ...(caData.deductions || []),
                    {
                      payrollId: payrollDoc.id,
                      amount: amountToDeduct,
                      date: new Date().toISOString()
                    }
                  ]
                });
              }
            }
          }

          if (pData.totalPay > 0 && pData.status !== 'carried_over') {
            // Logic for Account Selection:
            // 1. Labor -> Junkshop
            // 2. Skilled -> Container
            // 3. Admin/CEO -> Split 50/50
            
            const isLabor = position.includes('labor');
            const isSkilled = position.includes('skilled');
            const isAdmin = position.includes('admin') || role === 'admin' || role === 'ceo';

            if (isAdmin && junkshopAcc && containerAcc) {
              const halfPay = pData.totalPay / 2;
              // Split between Junkshop and Container
              await recordTransaction(
                junkshopAcc.id,
                'expense',
                halfPay,
                'Payroll',
                `Payroll (50% Admin) for ${employee?.fullName || 'Employee'}`,
                `${payrollDoc.id}-admin-1`,
                user?.uid
              );
              await recordTransaction(
                containerAcc.id,
                'expense',
                halfPay,
                'Payroll',
                `Payroll (50% Admin) for ${employee?.fullName || 'Employee'}`,
                `${payrollDoc.id}-admin-2`,
                user?.uid
              );
            } else {
              let targetAccountId = defaultAcc?.id;
              let descriptionSuffix = "";

              if (isLabor && junkshopAcc) {
                targetAccountId = junkshopAcc.id;
                descriptionSuffix = " (Junkshop)";
              } else if (isSkilled && containerAcc) {
                targetAccountId = containerAcc.id;
                descriptionSuffix = " (Container)";
              } else if (isAdmin) {
                // If one of the accounts is missing, use whatever we have or default
                if (junkshopAcc) targetAccountId = junkshopAcc.id;
                else if (containerAcc) targetAccountId = containerAcc.id;
              }

              await recordTransaction(
                targetAccountId,
                'expense',
                pData.totalPay,
                'Payroll',
                `Payroll payment${descriptionSuffix} for ${employee?.fullName || 'Employee'}`,
                payrollDoc.id,
                user?.uid
              );
            }
          }
        } catch (updateError) {
          console.error("Failed to update individual payroll status:", updateError);
        }
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
              const payslipEl = clonedDoc.querySelector('.payslip-mockup');
              if (payslipEl) {
                const htmlPayslip = payslipEl as HTMLElement;
                htmlPayslip.style.width = '800px';
                htmlPayslip.style.maxWidth = 'none';
                htmlPayslip.style.maxHeight = 'none';
                htmlPayslip.style.overflow = 'visible';
                htmlPayslip.style.height = htmlPayslip.scrollHeight + 'px';
                htmlPayslip.style.padding = '40px';

                sanitizeStyles(htmlPayslip);
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

  const addLongImageToPdf = (
    pdf: any,
    imgData: string,
    canvasHeight: number,
    canvasWidth: number,
    pdfWidth: number,
    pdfHeight: number,
    isFirstItem: boolean
  ) => {
    const imgRatio = canvasHeight / canvasWidth;
    const finalWidth = pdfWidth - 20;
    const finalHeight = finalWidth * imgRatio;
    const pageHeight = pdfHeight - 20;
    
    let leftHeight = finalHeight;
    let k = 0;
    
    while (leftHeight > 0) {
      if (!isFirstItem || k > 0) {
        pdf.addPage();
      }
      const yOffset = 10 - (k * pageHeight);
      pdf.addImage(imgData, 'PNG', 10, yOffset, finalWidth, finalHeight);
      leftHeight -= pageHeight;
      k++;
    }
  };

  const handlePrint = async () => {
    if (!payslipRef.current || !selectedPayslip) return;
    
    setIsExporting(true);
    try {
      // Ensure element is visible and stable
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(payslipRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const payslip = clonedDoc.querySelector('.payslip-mockup');
          if (payslip) {
            const htmlPayslip = payslip as HTMLElement;
            htmlPayslip.style.width = '800px';
            htmlPayslip.style.maxWidth = 'none';
            htmlPayslip.style.maxHeight = 'none';
            htmlPayslip.style.overflow = 'visible';
            htmlPayslip.style.height = htmlPayslip.scrollHeight + 'px';
            htmlPayslip.style.color = '#000000';
            htmlPayslip.style.backgroundColor = '#ffffff';
            htmlPayslip.style.padding = '40px';
            
            sanitizeStyles(htmlPayslip);
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
      
      if (dupSingleOnA4) {
        const imgRatio = canvas.height / canvas.width;
        const maxHalfHeight = (pdfHeight - 30) / 2; // ~133.5mm
        const finalWidth = Math.min(pdfWidth - 20, maxHalfHeight / imgRatio);
        const finalHeight = finalWidth * imgRatio;
        const marginX = (pdfWidth - finalWidth) / 2;
        
        // Copy 1 (Top Half)
        const marginY1 = 10 + (maxHalfHeight - finalHeight) / 2;
        pdf.addImage(imgData, 'PNG', marginX, marginY1, finalWidth, finalHeight);
        
        // cutting line
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.15);
        pdf.line(10, 148.5, pdfWidth - 10, 148.5);
        
        // Copy 2 (Bottom Half)
        const marginY2 = 152 + (maxHalfHeight - finalHeight) / 2;
        pdf.addImage(imgData, 'PNG', marginX, marginY2, finalWidth, finalHeight);
      } else {
        addLongImageToPdf(pdf, imgData, canvas.height, canvas.width, pdfWidth, pdfHeight, true);
      }
      
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
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(payslipRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const payslip = clonedDoc.querySelector('.payslip-mockup');
          if (payslip) {
            const htmlPayslip = payslip as HTMLElement;
            htmlPayslip.style.width = '800px';
            htmlPayslip.style.maxWidth = 'none';
            htmlPayslip.style.maxHeight = 'none';
            htmlPayslip.style.overflow = 'visible';
            htmlPayslip.style.height = htmlPayslip.scrollHeight + 'px';
            htmlPayslip.style.padding = '40px';

            sanitizeStyles(htmlPayslip);
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      if (dupSingleOnA4) {
        const imgRatio = canvas.height / canvas.width;
        const maxHalfHeight = (pdfHeight - 30) / 2; // ~133.5mm
        const finalWidth = Math.min(pdfWidth - 20, maxHalfHeight / imgRatio);
        const finalHeight = finalWidth * imgRatio;
        const marginX = (pdfWidth - finalWidth) / 2;
        
        // Copy 1 (Top Half)
        const marginY1 = 10 + (maxHalfHeight - finalHeight) / 2;
        pdf.addImage(imgData, 'PNG', marginX, marginY1, finalWidth, finalHeight);
        
        // cutting line
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.15);
        pdf.line(10, 148.5, pdfWidth - 10, 148.5);
        
        // Copy 2 (Bottom Half)
        const marginY2 = 152 + (maxHalfHeight - finalHeight) / 2;
        pdf.addImage(imgData, 'PNG', marginX, marginY2, finalWidth, finalHeight);
      } else {
        addLongImageToPdf(pdf, imgData, canvas.height, canvas.width, pdfWidth, pdfHeight, true);
      }
      
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
        
        // Wait for React to render AND transition to finish
        await new Promise(resolve => setTimeout(resolve, i === 0 ? 300 : 800));
        
        if (payslipRef.current) {
          const canvas = await html2canvas(payslipRef.current, {
            scale: 2,
            useCORS: true,
            logging: true,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => {
              const payslipEl = clonedDoc.querySelector('.payslip-mockup');
              if (payslipEl) {
                const htmlPayslip = payslipEl as HTMLElement;
                htmlPayslip.style.width = '800px';
                htmlPayslip.style.maxWidth = 'none';
                htmlPayslip.style.maxHeight = 'none';
                htmlPayslip.style.overflow = 'visible';
                htmlPayslip.style.height = htmlPayslip.scrollHeight + 'px';
                htmlPayslip.style.padding = '40px';

                sanitizeStyles(htmlPayslip);
              }
            }
          });
          
          if (canvas.width === 0 || canvas.height === 0) {
            console.error("Canvas is empty for payslip index", i);
            continue;
          }
          
          const imgData = canvas.toDataURL('image/png');
          
          if (fitTwoPerA4) {
            const isTop = (i % 2 === 0);
            if (i > 0 && isTop) {
              pdf.addPage();
            }
            const yOffset = isTop ? 10 : 152;
            const maxHalfHeight = (pdfHeight - 30) / 2; // ~133.5mm
            const imgRatio = canvas.height / canvas.width;
            const finalWidth = Math.min(pdfWidth - 20, maxHalfHeight / imgRatio);
            const finalHeight = finalWidth * imgRatio;
            const marginX = (pdfWidth - finalWidth) / 2;
            const marginY = yOffset + (maxHalfHeight - finalHeight) / 2;
            
            pdf.addImage(imgData, 'PNG', marginX, marginY, finalWidth, finalHeight);
            
            if (isTop && i < displayedPayrolls.length - 1) {
              pdf.setDrawColor(220, 220, 220);
              pdf.setLineWidth(0.15);
              pdf.line(10, 148.5, pdfWidth - 10, 148.5);
            }
          } else {
            addLongImageToPdf(pdf, imgData, canvas.height, canvas.width, pdfWidth, pdfHeight, i === 0);
          }
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

  // Keep selected payslip in sync with live data
  useEffect(() => {
    if (selectedPayslip) {
      const live = payrollData.find(p => p.id === selectedPayslip.id);
      if (live) {
        setSelectedPayslip(live);
      }
    }
  }, [payrollData]);

  // Reset the list of synced IDs when selection filters change
  useEffect(() => {
    syncedPayslipsRef.current.clear();
  }, [startDate, endDate, selectedBulkId, selectedEmployeeId, viewMode]);

  // Automatically trigger sync behind the scenes when a payslip is opened/selected to be viewed
  useEffect(() => {
    if (selectedPayslip?.id && !selectedPayslip.isManualOverride && !isLoading) {
      const pId = selectedPayslip.id;
      if (!syncedPayslipsRef.current.has(pId)) {
        syncedPayslipsRef.current.add(pId);
        handleSyncPayslip(pId);
      }
    }
  }, [selectedPayslip?.id]);

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
        const empCa = cashAdvances
          .filter(ca => ca.employeeId === emp.id && ca.remainingBalance > 0)
          .sort((a, b) => a.date.localeCompare(b.date)); // Oldest first
        
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
        let otDetails: string[] = [];
        let cashAdvanceDeduction = 0;
        let cashAdvanceDetails: string[] = [];
        let appliedCashAdvanceIds: string[] = [];
        let totalPakyawPay = 0;
        let presentEarnings = 0;
        let hdEarnings = 0;
        let utEarnings = 0;
        let pakyawDetails: string[] = [];
        let pakyawItems: PayrollPakyawDetail[] = [];
        let dailyAttendanceLog: { date: string, status: string, regHrs: number, otHrs: number, isWorkDay: boolean }[] = [];

        // Adjustments logic
        const empAdjustments = pendingAdjustments.filter(a => a.employeeId === emp.id);
        const totalAdjustmentsAmount = empAdjustments.reduce((sum, a) => {
          if (a.type === 'deduction') return sum - a.amount;
          return sum + a.amount;
        }, 0);

        // Calculate Gross first to know how much we can deduct if we want to cap at 0
        // But the user wants to see "negative", so we deduct ALL outstanding found?
        // Actually, usually we only deduct from advances that are "due".
        // For simplicity, let's deduct all outstanding advances found.
        
        empCa.forEach(ca => {
          cashAdvanceDeduction += (ca.remainingBalance || 0);
          appliedCashAdvanceIds.push(ca.id);
          cashAdvanceDetails.push(`CA ${format(parseISO(ca.date), 'MMM dd')}: ₱${(ca.remainingBalance || 0).toFixed(2)}`);
        });
        
        empPjw.forEach(pj => {
          const splitAmount = pj.totalPrice / Math.max(1, pj.employeeIds.length);
          const jobName = pj.containerNumber ? `[${pj.containerNumber}] ${pj.description}` : pj.description;
          
          const pakyawItem: PayrollPakyawDetail = {
            jobId: pj.id,
            description: jobName,
            amount: splitAmount,
            status: pj.status,
            isPaid: false
          };
          pakyawItems.push(pakyawItem);

          if (pj.status === 'completed') {
            totalPakyawPay += splitAmount;
            pakyawDetails.push(`${jobName}: ₱${(splitAmount || 0).toFixed(2)}`);
          } else {
            pakyawDetails.push(`${jobName}: PENDING (Not Finished)`);
          }
        });

        let regularPay = 0;
        let otPay = 0;

        dateRange.forEach(date => {
          const dayAtts = empAtts.filter(a => a.date === date);
          
          if (dayAtts.length > 0) {
            let dayRegHrs = 0;
            let dayOtHrs = 0;
            let dayRegularPay = 0;
            let dayOtPay = 0;
            let statuses = new Set<string>();

            dayAtts.forEach(att => {
              const { regHrs, otHrs } = calculateAttendanceHours(att);
              dayRegHrs += regHrs;
              dayOtHrs += otHrs;

              // IMPORTANT: Use historical rate from snapshot if it exists, otherwise fall back to current
              const effectiveHourlyRate = att.hourlyRate || (emp.dailySalary / 8);
              dayRegularPay += regHrs * effectiveHourlyRate;
              dayOtPay += otHrs * effectiveHourlyRate;
              
              statuses.add(att.status);
            });

            regularPay += dayRegularPay;
            otPay += dayOtPay;
            totalRegularHours += dayRegHrs;
            totalOtHours += dayOtHrs;

            let statusLabel: string = statuses.has('hd') ? 'halfday' : (dayRegHrs < 8 && !statuses.has('pakyaw') ? 'undertime' : 'present');
            if (statuses.has('pakyaw')) statusLabel = 'pakyaw';
            if (statuses.has('absent') && dayRegHrs === 0) statusLabel = 'absent';

            if (statusLabel === 'halfday') {
              totalHalfDays++;
              hdEarnings += dayRegularPay;
            } else if (statusLabel === 'undertime' && dayRegHrs < 8) {
               totalUndertimeDays++;
               utEarnings += dayRegularPay;
               const deficit = 8 - dayRegHrs;
               totalUndertimeHours += deficit;
               undertimeDetails.push(`${format(parseISO(date), 'MMM dd')}: ${dayRegHrs}h (Deficit: -${(deficit || 0).toFixed(1)}h)`);
            } else if (statusLabel === 'present') {
               totalPresent++;
               presentEarnings += dayRegularPay;
            } else if (statusLabel === 'absent') {
               totalAbsent++;
               absentDates.push(format(parseISO(date), 'MMM dd'));
            }

            if (dayOtHrs > 0) {
              otDetails.push(`${format(parseISO(date), 'MMM dd')}: ${(dayOtHrs || 0).toFixed(1)}h OT`);
            }

            dailyAttendanceLog.push({ 
              date, 
              status: statusLabel, 
              regHrs: dayRegHrs, 
              otHrs: dayOtHrs,
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

        // Pakyaw logic... (already handles completed status)
        totalPakyawPay = pakyawItems.reduce((sum, item) => sum + (item.status === 'completed' ? (item.amount || 0) : 0), 0);
        
        const totalEarnings = regularPay + otPay + totalPakyawPay + totalAdjustmentsAmount;
        const carryOverFromPrevious = emp.carryOverBalance || 0;
        
        // Total before CA is Earnings - Previous Debt
        const totalGrossPay = totalEarnings - carryOverFromPrevious;
        
        // Final net is Gross - Current CA
        const totalPay = totalGrossPay - cashAdvanceDeduction;

        bulkTotalPay += totalPay;

        payrollsToSave.push({
          employeeId: emp.id,
          employeeName: emp.fullName, // Added for easier search/display
          startDate,
          endDate,
          baseRate: emp.dailySalary,
          totalPresent,
          totalHalfDays,
          totalUndertimeDays,
          totalUndertimeHours,
          undertimeDetails,
          totalAbsent,
          absentDates,
          totalRegularHours,
          totalOtHours,
          otDetails,
          regularPay,
          otPay,
          presentEarnings,
          hdEarnings,
          utEarnings,
          totalPakyawPay,
          pakyawDetails,
          pakyawItems,
          adjustments: empAdjustments,
          totalAdjustments: totalAdjustmentsAmount,
          dailyAttendanceLog, 
          totalEarnings,
          totalGrossPay,
          cashAdvanceDeduction,
          cashAdvanceDetails,
          cashAdvanceIds: appliedCashAdvanceIds,
          carryOverFromPrevious,
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

  const toggleCarryOver = (idx: number) => {
    if (!previewData) return;
    const newPayrolls = [...previewData.payrollsToSave];
    const item = newPayrolls[idx];
    
    if (item.status === 'carried_over') {
      item.status = 'pending';
      item.carryOverToNext = 0;
    } else {
      item.status = 'carried_over';
      item.carryOverToNext = item.totalPay;
    }
    
    // Calculate new bulk total
    const newBulkTotal = newPayrolls.reduce((sum, p) => sum + (p.status === 'carried_over' ? 0 : p.totalPay), 0);
    
    setPreviewData({
      ...previewData,
      payrollsToSave: newPayrolls,
      bulkTotalPay: newBulkTotal
    });
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
        const empRef = doc(db, 'employees', finalPayload.employeeId);
        const empSnap = await import('firebase/firestore').then(f => f.getDoc(empRef));
        
        let oldCarryOverToNext = 0;
        let oldCarryOverFromPrevious = 0;
        let payrollId = '';

        if (!existingSnap.empty) {
          const oldDoc = existingSnap.docs[0];
          payrollId = oldDoc.id;
          const oldData = oldDoc.data();
          oldCarryOverToNext = oldData.carryOverToNext || 0;
          oldCarryOverFromPrevious = oldData.carryOverFromPrevious || 0;

          // REVERT OLD CASH ADVANCE DEDUCTIONS before saving new ones
          if (oldData.cashAdvanceIds) {
            for (const caId of oldData.cashAdvanceIds) {
              const caRef = doc(db, 'cashAdvances', caId);
              const caSnap = await getDoc(caRef);
              if (caSnap.exists()) {
                const caData = caSnap.data();
                const targetD = (caData.deductions || []).find((d: any) => d.payrollId === payrollId);
                if (targetD) {
                  await updateDoc(caRef, {
                    remainingBalance: (caData.remainingBalance || 0) + targetD.amount,
                    deductions: (caData.deductions || []).filter((d: any) => d.payrollId !== payrollId)
                  });
                }
              }
            }
          }

          // REVERT OLD ADJUSTMENTS SET TO PENDING before saving new ones
          const oldAdjQ = query(collection(db, 'adjustments'), where('payrollId', '==', payrollId));
          const oldAdjSnap = await getDocs(oldAdjQ);
          for (const oldAdjDoc of oldAdjSnap.docs) {
            await updateDoc(oldAdjDoc.ref, {
              status: 'pending',
              payrollId: deleteField()
            });
          }

          // Update existing payroll record
          await updateDoc(doc(db, 'payrolls', payrollId), finalPayload);
        } else {
          const payrollDoc = await addDoc(collection(db, 'payrolls'), {
            ...finalPayload,
            status: finalPayload.status || 'pending',
            createdAt: new Date().toISOString()
          });
          payrollId = payrollDoc.id;
        }

        // APPLY NEW ADJUSTMENTS (Both new and updated/regenerated payrolls)
        if (finalPayload.adjustments && finalPayload.adjustments.length > 0) {
          for (const adj of finalPayload.adjustments) {
            await updateDoc(doc(db, 'adjustments', adj.id), {
              status: 'applied',
              payrollId: payrollId
            });
          }
        }
        
        // APPLY NEW CASH ADVANCES DEDUCTIONS (Both new and updated/regenerated payrolls)
        if (finalPayload.cashAdvanceIds && finalPayload.cashAdvanceIds.length > 0) {
          for (const caId of finalPayload.cashAdvanceIds) {
            const caRef = doc(db, 'cashAdvances', caId);
            const caSnap = await getDoc(caRef);
            if (caSnap.exists()) {
              const caData = caSnap.data();
              const deductionAmount = caData.remainingBalance;
              await updateDoc(caRef, {
                remainingBalance: 0,
                deductions: arrayUnion({
                  payrollId: payrollId,
                  amount: deductionAmount,
                  period: `${startDate} to ${endDate}`,
                  date: new Date().toISOString()
                })
              });
            }
          }
        }

        // HANDLE NEGATIVE PAY -> AUTO CA (Now we have payrollId)
        if (finalPayload.totalPay < 0) {
          // Check for existing Auto-CA for this payroll to avoid duplicates
          const existingCaQ = query(collection(db, 'cashAdvances'), where('originPayrollId', '==', payrollId), limit(1));
          const existingCaSnap = await getDocs(existingCaQ);

          const deficit = Math.abs(finalPayload.totalPay);

          if (existingCaSnap.empty) {
            const newCaRef = await addDoc(collection(db, 'cashAdvances'), {
              employeeId: finalPayload.employeeId,
              date: new Date().toISOString().split('T')[0],
              amount: deficit,
              remainingBalance: deficit,
              deductions: [],
              notes: `Auto-CA from Deficit (Period: ${startDate} to ${endDate})`,
              originPayrollId: payrollId, 
              createdAt: new Date().toISOString(),
              uid: user.uid
            });

            // Record Finance Transaction for Auto-CA
            const accSnap = await getDocs(query(collection(db, 'accounts'), where('type', '==', 'cash')));
            const accountId = accSnap.empty ? 'cash-account-id' : accSnap.docs[0].id;
            await recordTransaction(
              accountId,
              'expense',
              deficit,
              'Cash Advance',
              `Auto-CA for ${employees.find(e => e.id === finalPayload.employeeId)?.fullName || 'Employee'} (Deficit)`,
              newCaRef.id,
              user.uid
            );

            await addAuditLog('Auto Cash Advance', 'Cash Advance', `Created auto CA of ₱${deficit} for ${finalPayload.employeeId} due to negative payroll.`);
          } else {
            // Update existing Auto-CA amount if it changed
            const caId = existingCaSnap.docs[0].id;
            const caData = existingCaSnap.docs[0].data();
            if (caData.amount !== deficit) {
              await updateDoc(doc(db, 'cashAdvances', caId), {
                amount: deficit,
                remainingBalance: deficit - (caData.amount - caData.remainingBalance), // Adjust balance relative to previous deductions if any
                notes: `Auto-CA Updated (Period: ${startDate} to ${endDate})`
              });
              
              // Update Finance
              await deleteTransactionsByReference(caId);
              const accSnap = await getDocs(query(collection(db, 'accounts'), where('type', '==', 'cash')));
              const accountId = accSnap.empty ? 'cash-account-id' : accSnap.docs[0].id;
              await recordTransaction(
                accountId,
                'expense',
                deficit,
                'Cash Advance',
                `Auto-CA Updated for ${employees.find(e => e.id === finalPayload.employeeId)?.fullName || 'Employee'} (Deficit)`,
                caId,
                user.uid
              );
            }
          }
          
          finalPayload.carryOverToNext = 0; 
          await updateDoc(doc(db, 'payrolls', payrollId), { carryOverToNext: 0 });
        }

        // Update Employee carryOverBalance
        if (empSnap.exists()) {
          const empData = empSnap.data();
          const currentBal = empData.carryOverBalance || 0;
          
          // Logic: 
          // 1. Remove effects of "old" version if we are updating (idempotency)
          // 2. Add effects of "new" version
          // New balance = currentBal - (oldCarryOverToNext - oldCarryOverFromPrevious) + (finalPayload.carryOverToNext - finalPayload.carryOverFromPrevious)
          const netOldAdjustment = oldCarryOverToNext - oldCarryOverFromPrevious;
          const netNewAdjustment = (finalPayload.carryOverToNext || 0) - (finalPayload.carryOverFromPrevious || 0);
          
          const newBalance = currentBal - netOldAdjustment + netNewAdjustment;
          
          await updateDoc(empRef, { carryOverBalance: newBalance });
        }
      }
      await addAuditLog('Generated Payroll', 'Payroll', `Generated payroll for Period: ${startDate} to ${endDate}.`);
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
      let payrollItem = payrollData.find(p => p.id === id);
      
      // If not in local state, fetch from server
      if (!payrollItem) {
        const snap = await getDoc(doc(db, 'payrolls', id));
        if (snap.exists()) {
          payrollItem = { id: snap.id, ...snap.data() };
        }
      }

      const empName = employees.find(e => e.id === payrollItem?.employeeId)?.fullName || id;

      // 1. REVERSE AUTO-CA if exists
      const caQ = query(collection(db, 'cashAdvances'), where('originPayrollId', '==', id));
      const caSnap = await getDocs(caQ);
      for (const caDoc of caSnap.docs) {
        // Delete CA and its finance transactions
        await deleteTransactionsByReference(caDoc.id);
        await deleteDoc(doc(db, 'cashAdvances', caDoc.id));
      }

      // 1.5. REVERSE ADJUSTMENTS
      const adjQ = query(collection(db, 'adjustments'), where('payrollId', '==', id));
      const adjSnap = await getDocs(adjQ);
      for (const adjDoc of adjSnap.docs) {
        await updateDoc(adjDoc.ref, {
          status: 'pending',
          payrollId: deleteField()
        });
      }

      // 2. REVERSE DEDUCTIONS effectively (if any CA were paid off)
      if (payrollItem?.cashAdvanceIds) {
        for (const caId of payrollItem.cashAdvanceIds) {
            const caRef = doc(db, 'cashAdvances', caId);
            const caSnap = await getDoc(caRef);
            if (caSnap.exists()) {
                const caData = caSnap.data();
                const targetD = (caData.deductions || []).find((d: any) => d.payrollId === id);
                if (targetD) {
                    await updateDoc(caRef, {
                        remainingBalance: caData.remainingBalance + targetD.amount,
                        deductions: (caData.deductions || []).filter((d: any) => d.payrollId !== id)
                    });
                }
            }
        }
      }

      // 3. DELETE FINANCE TRANSACTIONS associated with this payroll
      await deleteTransactionsByReference(id);
      // Admin split ones (if any)
      await deleteTransactionsByReference(`${id}-admin-1`);
      await deleteTransactionsByReference(`${id}-admin-2`);

      // 4. REVERSE CARRY-OVER EFFECT on Employee Doc
      if (payrollItem) {
        const empRef = doc(db, 'employees', payrollItem.employeeId);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
          const empData = empSnap.data();
          const currentBal = empData.carryOverBalance || 0;
          const carryOverToNext = payrollItem.carryOverToNext || 0;
          const carryOverFromPrevious = payrollItem.carryOverFromPrevious || 0;
          
          // Reversing: Subtract the "toNext" (debt we moved forward) and add back the "fromPrevious" (debt we assumed)
          // New Balance = currentBal - carryOverToNext + carryOverFromPrevious
          const correctedBal = currentBal - carryOverToNext + carryOverFromPrevious;
          await updateDoc(empRef, { carryOverBalance: correctedBal });
        }
      }

      await deleteDoc(doc(db, 'payrolls', id));
      await addAuditLog('Deleted Payroll Record', 'Payroll', `Deleted payslip for ${empName}.`);
      setPayrollData(prev => prev.filter(p => p.id !== id));
      setSelectedPayslip(null);
      setItemToDelete(null);
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
      setItemToDelete(null);
      
      const bulkRef = doc(db, 'bulkPayrolls', bulkId);
      const bulkSnap = await getDoc(bulkRef);
      if (!bulkSnap.exists()) return;

      const payrollsQ = query(collection(db, 'payrolls'), where('bulkId', '==', bulkId));
      const payrollsSnap = await getDocs(payrollsQ);
      
      // Use the individual deletion logic for each payroll to ensure full sync/traceability
      for (const pDoc of payrollsSnap.docs) {
        await handleDeletePayroll(pDoc.id);
      }

      await deleteDoc(bulkRef);
      if (selectedBulkId === bulkId) setSelectedBulkId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'bulkPayrolls');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkIndividualAsPaid = async (payrollId: string, currentStatus: string) => {
    try {
      // Find accounts
      const allAccSnap = await getDocsFirebase(collection(db, 'accounts'));
      const allAccounts = allAccSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const junkshopAcc = allAccounts.find(a => a.name.toLowerCase().replace(/\s+/g, '').includes('junkshop'));
      const containerAcc = allAccounts.find(a => a.name.toLowerCase().replace(/\s+/g, '').includes('container'));
      const defaultAcc = allAccounts.find(a => a.isDefault) || allAccounts.find(a => a.type === 'cash') || allAccounts[0];

      if (currentStatus === 'paid') {
        const payrollRef = doc(db, 'payrolls', payrollId);
        const payrollSnap = await import('firebase/firestore').then(f => f.getDoc(payrollRef));
        if (!payrollSnap.exists()) return;
        const pData = payrollSnap.data();

        const employee = employees.find(e => e.id === pData.employeeId);
        const position = (employee?.position || '').toLowerCase();
        const role = (employee?.role || '').toLowerCase();

        // Toggle back to pending
        await updateDoc(payrollRef, {
           status: 'pending',
           isAttendancePaid: false,
           pakyawItems: (pData.pakyawItems || []).map((item: any) => ({
             ...item,
             isPaid: false
           }))
        });

        // REVERSE Cash Advance Balance Updates
        if (pData.cashAdvanceDeduction > 0 && pData.cashAdvanceIds) {
          for (const caId of pData.cashAdvanceIds) {
            const caRef = doc(db, 'cashAdvances', caId);
            const caSnap = await import('firebase/firestore').then(f => f.getDoc(caRef));
            if (caSnap.exists()) {
              const caData = caSnap.data();
              // Find the deduction specifically for this payroll
              const deductionsList = caData.deductions || [];
              const targetDeduction = deductionsList.find((d: any) => d.payrollId === payrollId);
              
              if (targetDeduction) {
                const amountToRestore = targetDeduction.amount;
                await updateDoc(caRef, {
                  remainingBalance: caData.remainingBalance + amountToRestore,
                  deductions: deductionsList.filter((d: any) => d.payrollId !== payrollId)
                });
              }
            }
          }
        }

        // REVERSE Transaction
        if (pData.totalPay > 0) {
          await deleteTransactionsByReference(payrollId);
          await deleteTransactionsByReference(`${payrollId}-admin-1`);
          await deleteTransactionsByReference(`${payrollId}-admin-2`);
        }
        return;
      }

      // Mark as Paid
      const payrollRef = doc(db, 'payrolls', payrollId);
      const payrollSnap = await import('firebase/firestore').then(f => f.getDoc(payrollRef));
      if (!payrollSnap.exists()) return;
      
      const pData = payrollSnap.data();
      const employee = employees.find(e => e.id === pData.employeeId);
      const position = (employee?.position || '').toLowerCase();
      const role = (employee?.role || '').toLowerCase();

      await updateDoc(payrollRef, {
        status: 'paid',
        isAttendancePaid: true,
        pakyawItems: (pData.pakyawItems || []).map((item: any) => ({
          ...item,
          isPaid: true
        }))
      });

      // Handle Cash Advance Balance Updates
      if (pData.cashAdvanceDeduction > 0 && pData.cashAdvanceIds) {
        let deductionPool = pData.totalGrossPay;
        for (const caId of pData.cashAdvanceIds) {
          if (deductionPool <= 0) break;
          
          const caRef = doc(db, 'cashAdvances', caId);
          const caSnap = await import('firebase/firestore').then(f => f.getDoc(caRef));
          if (caSnap.exists()) {
            const caData = caSnap.data();
            const amountToDeduct = Math.min(deductionPool, caData.remainingBalance);
            deductionPool -= amountToDeduct;
            
            await updateDoc(caRef, {
              remainingBalance: caData.remainingBalance - amountToDeduct,
              deductions: [
                ...(caData.deductions || []),
                {
                  payrollId: payrollId,
                  amount: amountToDeduct,
                  date: new Date().toISOString()
                }
              ]
            });
          }
        }
      }

      if (pData.totalPay > 0 && pData.status !== 'carried_over') {
        const isLabor = position.includes('labor');
        const isSkilled = position.includes('skilled');
        const isAdmin = position.includes('admin') || role === 'admin' || role === 'ceo';

        if (isAdmin && junkshopAcc && containerAcc) {
          const halfPay = pData.totalPay / 2;
          await recordTransaction(
            junkshopAcc.id,
            'expense',
            halfPay,
            'Payroll',
            `Payroll (50% Admin) for ${employee?.fullName || 'Employee'}`,
            `${payrollId}-admin-1`,
            user?.uid
          );
          await recordTransaction(
            containerAcc.id,
            'expense',
            halfPay,
            'Payroll',
            `Payroll (50% Admin) for ${employee?.fullName || 'Employee'}`,
            `${payrollId}-admin-2`,
            user?.uid
          );
        } else {
          let targetAccountId = defaultAcc?.id;
          let descriptionSuffix = "";

          if (isLabor && junkshopAcc) {
            targetAccountId = junkshopAcc.id;
            descriptionSuffix = " (Junkshop)";
          } else if (isSkilled && containerAcc) {
            targetAccountId = containerAcc.id;
            descriptionSuffix = " (Container)";
          } else if (isAdmin) {
            if (junkshopAcc) targetAccountId = junkshopAcc.id;
            else if (containerAcc) targetAccountId = containerAcc.id;
          }

          await recordTransaction(
            targetAccountId,
            'expense',
            pData.totalPay,
            'Payroll',
            `Payroll payment${descriptionSuffix} for ${employee?.fullName || 'Employee'}`,
            payrollId,
            user?.uid
          );
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'payrolls');
    }
  };

  const handleMarkBulkAsPaid = async (bulkId: string) => {
    try {
      setIsLoading(true);
      const payrollsQ = query(collection(db, 'payrolls'), where('bulkId', '==', bulkId));
      const payrollsSnap = await getDocs(payrollsQ);
      
      for (const pDoc of payrollsSnap.docs) {
        const pData = pDoc.data();
        if (pData.status !== 'paid') {
          await handleMarkIndividualAsPaid(pDoc.id, pData.status);
        }
      }
      
      await updateDoc(doc(db, 'bulkPayrolls', bulkId), { status: 'paid', paidAt: new Date().toISOString() });
      await addAuditLog('Bulk Payroll Paid', 'Payroll', `Marked bulk payroll ${bulkId} as paid.`);
    } catch (error) {
      console.error("Error marking bulk as paid:", error);
      handleFirestoreError(error, OperationType.UPDATE, 'payrolls');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAttendancePaid = async (payroll: any) => {
    try {
      await updateDoc(doc(db, 'payrolls', payroll.id), {
        isAttendancePaid: !payroll.isAttendancePaid
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, 'payrolls');
    }
  };

  const handleTogglePakyawItemPaid = async (payroll: any, index: number) => {
    try {
      const items = [...(payroll.pakyawItems || [])];
      if (items[index]) {
        items[index] = { ...items[index], isPaid: !items[index].isPaid };
        await updateDoc(doc(db, 'payrolls', payroll.id), {
          pakyawItems: items
        });
      }
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, 'payrolls');
    }
  };

  const currentBulkRuns = viewMode === 'process' ? bulkPayrolls : archivedBulkRuns;

  const calculatePaidAmount = (p: PayrollRecord | any) => {
    if (p.status === 'paid') return p.totalPay;
    
    let paidAmount = 0;
    if (p.isAttendancePaid) {
      paidAmount += (p.regularPay + (p.otPay || 0));
    }
    
    p.pakyawItems?.forEach((item: any) => {
      if (item.isPaid) {
        paidAmount += (item.amount || 0);
      }
    });

    return Math.min(paidAmount, p.totalPay > 0 ? p.totalPay : paidAmount);
  };

  const totalGrandTotal = displayedPayrolls.reduce((sum, p) => sum + p.totalPay, 0);
  
  const totalPaidSoFar = displayedPayrolls.reduce((sum, p) => sum + calculatePaidAmount(p), 0);

  const balanceToPay = totalGrandTotal - totalPaidSoFar;

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
          <Button 
            variant={viewMode === 'carryover' ? 'secondary' : 'ghost'} 
            className={`h-8 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'carryover' ? 'bg-white text-blue-600' : 'text-slate-400 hover:text-white'}`}
            onClick={() => { setViewMode('carryover'); setSelectedBulkId(null); }}
          >Carry-Over</Button>
        </div>
      </div>
      
      {viewMode === 'carryover' && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="bento-card flex-col bg-slate-900/40 p-6 border border-white/10 shadow-2xl overflow-hidden mb-4 rounded-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white uppercase tracking-tight leading-none mb-1 italic">Carry-Over Balances</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Active Debts & Forwarded Balances</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {employees
                .filter(emp => (emp.carryOverBalance || 0) !== 0)
                .sort((a, b) => (b.carryOverBalance || 0) - (a.carryOverBalance || 0))
                .map(emp => (
                  <div 
                    key={emp.id} 
                    onClick={() => handleViewCarryOverDetail(emp)}
                    className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl group hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                        {emp.photoURL ? (
                          <img src={emp.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Users className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white uppercase tracking-tight truncate">{emp.fullName}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 truncate">{emp.position || 'Staff'}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 leading-none">Balance</div>
                      <div className={`text-base font-black italic tracking-tighter leading-none ${(emp.carryOverBalance || 0) > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        ₱{(emp.carryOverBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                ))}
              
              {employees.filter(emp => (emp.carryOverBalance || 0) !== 0).length === 0 && (
                <div className="col-span-full text-center py-12 bg-white/5 rounded-3xl border border-dashed border-white/10 text-slate-500 uppercase font-bold text-xs tracking-widest">
                  No active carry-over balances found
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl">
            <p className="text-[10px] text-amber-500/80 font-bold uppercase tracking-widest leading-relaxed">
              * Carry-over balances are automatically adjusted during payroll runs. 
              Positive values represent debt carried forward from previous periods, 
              which will be deducted from their next gross pay. Click an employee to view audit trail.
            </p>
          </div>
        </div>
      )}

      {/* Carry-Over Detail Dialog */}
      <Dialog open={!!selectedCarryOverEmployee} onOpenChange={(open) => !open && setSelectedCarryOverEmployee(null)}>
        <DialogContent className="sm:max-w-[500px] bg-slate-900 border-white/10 text-white rounded-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Carry-Over Detail</div>
                <div className="text-lg font-black uppercase tracking-tight italic">{selectedCarryOverEmployee?.fullName}</div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Current Balance</span>
              <span className="text-2xl font-black italic text-amber-500">₱{(selectedCarryOverEmployee?.carryOverBalance || 0).toLocaleString()}</span>
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Audit Trail (Recent Effects)</h3>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {isLoading ? (
                  <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-600" /></div>
                ) : carryOverHistory.length > 0 ? (
                  carryOverHistory.map((p, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        if (p.bulkId) {
                          setSelectedBulkId(p.bulkId);
                          setViewMode('archives');
                          setSelectedCarryOverEmployee(null);
                        }
                      }}
                      className={`p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all ${p.bulkId ? 'cursor-pointer hover:border-blue-500/30' : ''}`}
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">
                          {format(parseISO(p.generatedAt || p.createdAt), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs font-bold text-white mt-0.5 truncate flex items-center gap-2">
                          {p.carryOverToNext > 0 ? 'Balance Forwarded' : 'Balance Settled'}
                          {p.bulkId && <ExternalLink className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-all" />}
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                           Period: {p.startDate} to {p.endDate}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Impact</div>
                        {p.carryOverToNext !== 0 && typeof p.carryOverToNext === 'number' && (
                          <div className="text-amber-500 font-black italic tracking-tighter text-sm">+₱{(p.carryOverToNext || 0).toLocaleString()}</div>
                        )}
                        {p.carryOverFromPrevious !== 0 && typeof p.carryOverFromPrevious === 'number' && (
                          <div className="text-emerald-500 font-black italic tracking-tighter text-sm">-₱{(p.carryOverFromPrevious || 0).toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest border border-dashed border-white/5 rounded-2xl">
                    No history found for this employee
                  </div>
                )}
              </div>
            </div>
            
            <Button 
              onClick={() => setSelectedCarryOverEmployee(null)}
              className="w-full bg-white/10 hover:bg-white/20 text-white rounded-2xl h-12 font-black uppercase tracking-widest text-[10px]"
            >
              Close Record
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

          <div className="mt-4 pt-4 border-t border-white/10">
            <Button 
              onClick={() => setIsAdjustmentDialogOpen(true)}
              variant="outline"
              className="w-full h-10 gap-2 border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white rounded-xl text-[10px] uppercase font-black tracking-widest"
            >
              <Plus className="w-4 h-4" />
              Add Manual Adjustment
            </Button>
            
            {pendingAdjustments.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Pending Adjustments ({pendingAdjustments.length})</span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {pendingAdjustments.map((adj) => {
                    const emp = employees.find(e => e.id === adj.employeeId);
                    return (
                      <div key={adj.id} className="bg-white/5 border border-white/5 p-2 rounded-lg flex items-center justify-between group">
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-white truncate">{emp?.fullName || 'Unknown'}</div>
                          <div className="text-[8px] text-slate-500 truncate italic">{adj.description}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`text-[10px] font-black italic ${adj.type === 'deduction' ? 'text-red-400' : 'text-emerald-400'}`}>
                            {adj.type === 'deduction' ? '-' : '+'}₱{adj.amount.toLocaleString()}
                          </div>
                          <button 
                            onClick={() => setItemToDelete({ id: adj.id, type: 'adjustment', name: `${emp?.fullName}'s adjustment` })}
                            className="text-white/20 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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
        ) : (selectedEmployeeId === 'all' && !selectedBulkId && viewMode !== 'carryover') && (
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
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
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
                    {viewMode === 'process' && (
                      <Button
                        size="sm"
                        className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] uppercase tracking-widest rounded-lg shadow-lg shadow-emerald-600/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkBulkAsPaid(bulk.id);
                        }}
                        disabled={isLoading}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" /> Mark Paid
                      </Button>
                    )}
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

        {((selectedEmployeeId !== 'all' || selectedBulkId) && viewMode !== 'carryover') && (
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
                <div className="bg-gradient-to-br from-slate-900/40 to-blue-900/40 backdrop-blur-xl rounded-2xl p-6 text-white shadow-2xl border border-white/10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 relative z-10">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Grand Payroll</p>
                      <h2 className="text-2xl font-black italic">₱{(totalGrandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h2>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Paid</p>
                      <h2 className="text-2xl font-black italic text-emerald-400">₱{(totalPaidSoFar || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h2>
                    </div>
                    <div className="bg-blue-600/20 p-3 rounded-xl border border-blue-500/20">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Balance to Pay</p>
                      <h2 className="text-2xl font-black italic text-blue-400">₱{(balanceToPay || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h2>
                    </div>
                  </div>
                  {/* Paper Saving Option Toggle */}
                  <div 
                    className="flex items-center gap-2 mb-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 self-start text-xs font-medium text-slate-200 transition-all cursor-pointer relative z-10 select-none" 
                    onClick={() => setFitTwoPerA4(!fitTwoPerA4)}
                  >
                    <input
                      id="fitTwoPerA4"
                      type="checkbox"
                      checked={fitTwoPerA4}
                      onChange={(e) => setFitTwoPerA4(e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 text-emerald-500 bg-slate-800 border-slate-705 rounded focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="fitTwoPerA4" className="cursor-pointer font-bold uppercase tracking-wider text-[9px] text-emerald-300">
                      Fit 2 Employees per A4 Page (Minimize Print Costs)
                    </label>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 relative z-10 w-full mb-4">
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
                          setItemToDelete({ id: selectedBulkId, type: 'bulk', name: 'entire payroll batch' });
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
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/50 border-t border-white/10 pt-4 relative z-10">
                    <span>{totalEmployeesCount} Employees</span>
                    <span className="w-1 h-1 rounded-full bg-white/20"></span>
                    <span>Average ₱{(totalGrandTotal / (totalEmployeesCount || 1) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}/person</span>
                  </div>
                </div>
              </div>
            )}
            {displayedPayrolls.map((data, idx) => (
              <div 
                key={idx} 
                onClick={() => setSelectedPayslip(data)}
                className={`bento-card flex-col p-4 cursor-pointer hover:border-blue-300 transition-colors ${data.status === 'paid' ? 'bg-emerald-50/5 border-emerald-500/20 shadow-inner' : 'bg-white dark:bg-slate-800'}`}
              >
                <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold text-[10px] overflow-hidden shrink-0">
                      {data.employee.photoURL ? (
                        <img src={data.employee.photoURL} alt={data.employee.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        data.employee.fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-900 dark:text-white truncate text-sm">{data.employee.fullName}</div>
                        {data.totalPay < 0 && (
                          <span className="text-[7px] bg-red-500/10 text-red-500 px-1 py-0.5 rounded uppercase font-black tracking-widest border border-red-500/20 leading-none">Deficit</span>
                        )}
                        {(data.carryOverToNext > 0 || data.carryOverFromPrevious > 0) && (
                          <span className="text-[7px] bg-blue-500/10 text-blue-500 px-1 py-0.5 rounded uppercase font-black tracking-widest border border-blue-500/20 leading-none">Carry-Over</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded-[3px] text-[6px] font-black uppercase tracking-tighter ${data.isAttendancePaid ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {data.isAttendancePaid ? 'Daily Paid' : 'Daily Unpaid'}
                        </div>
                        {data.pakyawItems && data.pakyawItems.length > 0 && (
                          <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded-[3px] text-[6px] font-black uppercase tracking-tighter ${data.pakyawItems.every((i: any) => i.isPaid) ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {data.pakyawItems.every((i: any) => i.isPaid) ? 'Pakyaw Paid' : 'Pakyaw Pending'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className={`h-8 px-2 flex items-center gap-2 rounded-lg transition-all ${data.status === 'paid' ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkIndividualAsPaid(data.id, data.status);
                      }}
                    >
                      <CheckCircle className={`w-4 h-4 ${data.status === 'paid' ? 'fill-emerald-500 text-white' : ''}`} />
                      <span className="text-[10px] font-black uppercase tracking-tighter">Paid</span>
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToDelete({ id: data.id, type: 'payroll', name: data.employee.fullName });
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
                    <div className="font-medium text-[10px] text-center">₱{(data.regularPay || 0).toFixed(0)}</div>
                  </div>
                  <div className="border-x border-slate-100 dark:border-slate-700">
                    <div className="text-[9px] text-green-600 uppercase font-semibold text-center">OT Pay</div>
                    <div className="font-medium text-[10px] text-center text-green-600">₱{(data.otPay || 0).toFixed(0)}</div>
                  </div>
                  <div className="border-r border-slate-100 dark:border-slate-700">
                    <div className="text-[9px] text-indigo-600 uppercase font-semibold text-center">Pakyaw</div>
                    <div className="font-medium text-[10px] text-center text-indigo-600">₱{(data.totalPakyawPay || 0).toFixed(0)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-blue-600 uppercase font-bold tracking-tighter mb-0.5">
                      {calculatePaidAmount(data) >= data.totalPay ? 'Fully Paid' : 'Balance Due'}
                    </div>
                    <div className={`font-black text-[13px] leading-none ${(data.totalPay - calculatePaidAmount(data)) <= 0 ? 'text-emerald-500' : 'text-blue-600'}`}>
                      ₱{(data.totalPay - calculatePaidAmount(data) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                    </div>
                    {calculatePaidAmount(data) > 0 && calculatePaidAmount(data) < data.totalPay && (
                      <div className="text-[7px] text-slate-400 font-bold mt-1">Total ₱{(data.totalPay || 0).toLocaleString()}</div>
                    )}
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

      <Dialog open={!!selectedPayslip} onOpenChange={(open) => { if (!open) { setSelectedPayslip(null); setIsEditingSavedPayslip(false); } }}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white rounded-2xl w-[95vw] max-w-lg mx-auto border-none shadow-2xl">
          <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-slate-50/50 backdrop-blur-sm sticky top-0 z-10 font-sans gap-2.5">
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-black uppercase italic tracking-tight text-sm shrink-0">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Payslip
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 justify-start sm:justify-end max-w-full">
              {!isEditingSavedPayslip && selectedPayslip?.id && (
                <>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 sm:h-8 gap-1 rounded-xl border-slate-205 text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-all font-bold text-[9px] uppercase tracking-wider px-2 sm:px-2.5"
                    onClick={() => handleSyncPayslip(selectedPayslip.id)}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin text-amber-500" /> : <RefreshCw className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500" />}
                    <span className="hidden min-[480px]:inline">Sync Live</span>
                    <span className="min-[480px]:hidden">Sync</span>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 sm:h-8 gap-1 rounded-xl border-slate-205 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-all font-bold text-[9px] uppercase tracking-wider px-2 sm:px-2.5"
                    onClick={() => {
                      setIsEditingSavedPayslip(true);
                      setSavedRegPay((selectedPayslip.regularPay || 0).toString());
                      setSavedOtPay((selectedPayslip.otPay || 0).toString());
                      setSavedPakyawPay((selectedPayslip.totalPakyawPay || 0).toString());
                      setSavedAdjustments((selectedPayslip.totalAdjustments || 0).toString());
                      setSavedCashAdvanceDeduction((selectedPayslip.cashAdvanceDeduction || 0).toString());
                      setSavedCarryOverFromPrevious((selectedPayslip.carryOverFromPrevious || 0).toString());
                    }}
                  >
                    <Edit className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-500" />
                    <span className="hidden min-[480px]:inline">Override</span>
                    <span className="min-[480px]:hidden">Edit</span>
                  </Button>
                </>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 sm:h-8 gap-1 rounded-xl border-slate-205 text-slate-600 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-all font-bold text-[9px] uppercase tracking-wider px-2 sm:px-2.5"
                onClick={handlePrint}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin" /> : <Printer className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                <span className="hidden min-[480px]:inline">Print</span>
                <span className="min-[480px]:hidden">Print</span>
              </Button>
              {selectedPayslip?.id && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 sm:h-8 gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 font-bold text-[9px] uppercase tracking-wider px-2"
                  onClick={() => handleDeletePayroll(selectedPayslip.id)}
                >
                  <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span className="hidden min-[480px]:inline">Delete</span>
                  <span className="min-[480px]:hidden">Del</span>
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 sm:h-8 gap-1 rounded-xl border-slate-205 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all font-bold text-[9px] uppercase tracking-wider px-2 sm:px-2.5"
                onClick={handleExportPDF}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin" /> : <Upload className="w-2.5 h-2.5 sm:w-3 sm:h-3 rotate-180" />}
                <span className="hidden min-[480px]:inline">Export</span>
                <span className="min-[480px]:hidden">PDF</span>
              </Button>
            </div>
          </div>
          
          {selectedPayslip && (
            isEditingSavedPayslip ? (
              <div className="p-6 space-y-4 font-sans bg-white text-slate-900 max-h-[85vh] overflow-y-auto">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-black uppercase text-blue-600 leading-none">Manual Override Payslip</h3>
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">Directly modify computed numbers for {selectedPayslip.employeeName || selectedPayslip.employee?.fullName}.</p>
                </div>
                
                <div className="space-y-3.5 pt-2">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Regular Pay (₱)</Label>
                      <Input 
                        type="number"
                        value={savedRegPay}
                        onChange={(e) => setSavedRegPay(e.target.value)}
                        className="h-10 text-xs font-bold text-slate-950 border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Overtime Pay (₱)</Label>
                      <Input 
                        type="number"
                        value={savedOtPay}
                        onChange={(e) => setSavedOtPay(e.target.value)}
                        className="h-10 text-xs font-bold text-slate-950 border-slate-200 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pakyaw Paid (₱)</Label>
                      <Input 
                        type="number"
                        value={savedPakyawPay}
                        onChange={(e) => setSavedPakyawPay(e.target.value)}
                        className="h-10 text-xs font-bold text-slate-950 border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Bonus/Adjustment (₱)</Label>
                      <Input 
                        type="number"
                        value={savedAdjustments}
                        onChange={(e) => setSavedAdjustments(e.target.value)}
                        className="h-10 text-xs font-bold text-slate-950 border-slate-200 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">CA Deduction (₱)</Label>
                      <Input 
                        type="number"
                        value={savedCashAdvanceDeduction}
                        onChange={(e) => setSavedCashAdvanceDeduction(e.target.value)}
                        className="h-10 text-xs font-bold text-slate-950 border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Debt Carry-Over (₱)</Label>
                      <Input 
                        type="number"
                        value={savedCarryOverFromPrevious}
                        onChange={(e) => setSavedCarryOverFromPrevious(e.target.value)}
                        className="h-10 text-xs font-bold text-slate-950 border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-6 justify-end border-t border-slate-100">
                  <Button 
                    variant="ghost" 
                    className="rounded-xl font-bold text-xs"
                    onClick={() => setIsEditingSavedPayslip(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="px-6 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs text-white"
                    onClick={handleSaveSavedPayslipOverride}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Save Override
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between font-sans text-[10px] shrink-0">
                  <span className="font-black text-slate-500 uppercase tracking-widest text-[8px]">Layout Options:</span>
                  <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setDupSingleOnA4(!dupSingleOnA4)}>
                    <input
                      type="checkbox"
                      id="dupSingleOnA4"
                      checked={dupSingleOnA4}
                      onChange={(e) => setDupSingleOnA4(e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-3.5 h-3.5 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="dupSingleOnA4" className="text-slate-650 font-bold cursor-pointer select-none">
                      Duplicate copy onto 1 A4 page (Saves Paper)
                    </label>
                  </div>
                </div>
                <div 
                  ref={payslipRef}
                  className="p-3 max-h-[90vh] overflow-y-auto payslip-mockup bg-white font-sans text-[10px]" 
                  style={{ backgroundColor: '#ffffff' }}
                >
              <div className="flex justify-between border-b border-slate-900 pb-2 mb-2">
                <div>
                  <div className="inline-flex items-center gap-1 px-1 py-0.5 bg-blue-600 text-white text-[7px] font-black uppercase tracking-[0.1em] rounded mb-1">
                    Official
                  </div>
                  <h2 className="text-xl font-black text-slate-900 leading-none italic uppercase">PAYSLIP</h2>
                  <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">
                    Pay Period: <span className="text-slate-900">{format(parseISO(selectedPayslip.startDate), 'MMMM dd, yyyy')} - {format(parseISO(selectedPayslip.endDate), 'MMMM dd, yyyy')}</span>
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
                    <div className="text-[8px] font-black text-slate-400 mb-0.5 uppercase tracking-widest flex items-center justify-end gap-1">
                      {calculatePaidAmount(selectedPayslip) >= selectedPayslip.totalPay ? (
                        <>
                          <CheckCircle className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500/20" />
                          <span className="text-emerald-500">Fully Paid</span>
                        </>
                      ) : (
                        <span>Balance Due</span>
                      )}
                    </div>
                    <div className={`text-2xl font-black italic tracking-tighter leading-none ${(selectedPayslip.totalPay - (selectedPayslip.carryOverToNext || 0) - calculatePaidAmount(selectedPayslip)) <= 0 ? 'text-emerald-500' : (selectedPayslip.totalPay - (selectedPayslip.carryOverToNext || 0) < 0 ? 'text-red-600' : 'text-blue-600')}`}>
                      ₱{(selectedPayslip.totalPay - (selectedPayslip.carryOverToNext || 0) - calculatePaidAmount(selectedPayslip) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    {calculatePaidAmount(selectedPayslip) > 0 && calculatePaidAmount(selectedPayslip) < selectedPayslip.totalPay && (
                      <div className="text-[8px] font-black text-slate-400 mt-1 uppercase tracking-tight">
                        Payroll Total: ₱{(selectedPayslip.totalPay || 0).toLocaleString()}
                      </div>
                    )}
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

              <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3 font-sans">
                <div className="space-y-2">
                  <div>
                    <h3 className="text-[9px] font-black text-slate-900 border-b border-slate-900 pb-1 mb-2 uppercase flex justify-between items-center group">
                      Earnings Breakdown
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleMarkIndividualAsPaid(selectedPayslip.id, selectedPayslip.status)}
                        className="h-5 px-2 text-[7px] font-black uppercase tracking-widest bg-slate-100 hover:bg-emerald-500 hover:text-white border border-slate-200 transition-all rounded-md opacity-0 group-hover:opacity-100"
                      >
                        {selectedPayslip.status === 'paid' ? 'Paid' : 'Set Paid'}
                      </Button>
                    </h3>
                    
                    <div className="space-y-1">
                      {/* Detailed Breakdown Header */}
                      <div className="flex justify-between text-[7px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1">
                        <span>Classification / Rate Math</span>
                        <span>Total (₱)</span>
                      </div>

                      {/* Regular Days Row */}
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-1.5">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleToggleAttendancePaid(selectedPayslip)}
                                className={`h-5 w-5 p-0 rounded-md shrink-0 transition-all ${selectedPayslip.isAttendancePaid ? 'bg-emerald-500 text-white' : 'bg-white text-slate-300 border border-slate-200'}`}
                              >
                                <CheckCircle className="w-3 h-3" />
                              </Button>
                              <span className="text-slate-900 font-black text-[8px] uppercase">Attendance Pay</span>
                           </div>
                           <span className="font-black text-slate-900">₱{(selectedPayslip.regularPay || 0).toFixed(2)}</span>
                        </div>
                        
                        <div className="space-y-1.5 pl-6 pt-1 border-t border-slate-200/50">
                           {selectedPayslip.totalPresent > 0 && (
                             <div className="flex justify-between items-center">
                               <div className="flex flex-col">
                                 <span className="text-[7px] font-bold text-slate-600 uppercase">Present</span>
                                 <span className="text-[6px] text-slate-400">{selectedPayslip.totalPresent}d × ₱{(selectedPayslip.baseRate || 0).toFixed(0)}</span>
                               </div>
                               <span className="text-[7px] font-bold text-slate-900">₱{(selectedPayslip.presentEarnings || 0).toFixed(2)}</span>
                             </div>
                           )}
                           {selectedPayslip.totalHalfDays > 0 && (
                             <div className="flex justify-between items-center">
                               <div className="flex flex-col">
                                 <span className="text-[7px] font-bold text-indigo-600 uppercase">Half-Day</span>
                                 <span className="text-[6px] text-slate-400">{selectedPayslip.totalHalfDays}d × ₱{((selectedPayslip.baseRate || 0) / 2).toFixed(0)}</span>
                               </div>
                               <span className="text-[7px] font-bold text-slate-900">₱{(selectedPayslip.hdEarnings || 0).toFixed(2)}</span>
                             </div>
                           )}
                           {selectedPayslip.totalUndertimeDays > 0 && (
                             <div className="flex justify-between items-center">
                               <div className="flex flex-col">
                                 <span className="text-[7px] font-bold text-amber-600 uppercase">Undertime</span>
                                 <span className="text-[6px] text-slate-400">
                                   {((selectedPayslip.totalUndertimeDays * 8) - selectedPayslip.totalUndertimeHours).toFixed(1)}h worked × ₱{((selectedPayslip.baseRate || 0) / 8).toFixed(2)}
                                 </span>
                               </div>
                               <span className="text-[7px] font-bold text-slate-900">₱{(selectedPayslip.utEarnings || 0).toFixed(2)}</span>
                             </div>
                           )}
                           {selectedPayslip.totalAbsent > 0 && (
                             <div className="flex justify-between items-center">
                               <div className="flex flex-col">
                                 <span className="text-[7px] font-bold text-rose-500 uppercase">Absent</span>
                                 <span className="text-[6px] text-slate-400">{selectedPayslip.totalAbsent}d × ₱0</span>
                               </div>
                               <span className="text-[7px] font-bold text-slate-900">₱0.00</span>
                             </div>
                           )}

                           <div className="pt-1 mt-1 border-t border-slate-200/50 flex justify-between items-center">
                             <span className="text-[7px] font-black text-slate-500 uppercase">Attendance Subtotal</span>
                             <span className="text-[8px] font-black text-slate-900">₱{(selectedPayslip.regularPay || 0).toFixed(2)}</span>
                           </div>
                        </div>
                      </div>

                      {/* Overtime Row */}
                      {selectedPayslip.totalOtHours > 0 && (
                        <div className="flex justify-between items-center bg-emerald-50/30 p-2 rounded-lg border border-emerald-100/50">
                          <div className="flex flex-col">
                            <span className="text-emerald-900 font-bold uppercase text-[8px]">Overtime Pay</span>
                            <span className="text-[6px] text-emerald-500 font-medium">{selectedPayslip.totalOtHours.toFixed(1)} hrs × ₱{((selectedPayslip.baseRate || 0) / 8).toFixed(2)}/hr</span>
                          </div>
                          <span className="font-black text-emerald-900">{(selectedPayslip.otPay || 0).toFixed(2)}</span>
                        </div>
                      )}

                      {/* Pakyaw Row */}
                      {selectedPayslip.totalPakyawPay > 0 && (
                        <div className="flex justify-between items-center bg-violet-50/30 p-2 rounded-lg border border-violet-100/50">
                          <div className="flex flex-col">
                            <span className="text-violet-900 font-bold uppercase text-[8px]">Pakyaw Earnings</span>
                            <span className="text-[6px] text-violet-400 font-medium">Sum of completed job shares</span>
                          </div>
                          <span className="font-black text-violet-900">₱{(selectedPayslip.totalPakyawPay || 0).toFixed(2)}</span>
                        </div>
                      )}

                      {/* Manual Adjustments Row */}
                      {selectedPayslip.totalAdjustments !== 0 && (
                        <div className="flex justify-between items-center bg-blue-50/30 p-2 rounded-lg border border-blue-100/50">
                          <div className="flex flex-col">
                            <span className="text-blue-900 font-bold uppercase text-[8px]">Manual Adjustments</span>
                            <div className="space-y-0.5">
                              {selectedPayslip.adjustments?.map((adj: any, i: number) => (
                                <div key={i} className="text-[6px] text-blue-500 font-medium flex items-center gap-1">
                                  <span className="opacity-50">●</span>
                                  <span>{adj.description}: {adj.type === 'deduction' ? '-' : '+'}₱{adj.amount.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <span className={`font-black ${selectedPayslip.totalAdjustments > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {selectedPayslip.totalAdjustments > 0 ? '+' : ''}₱{(selectedPayslip.totalAdjustments || 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                      {selectedPayslip.carryOverFromPrevious > 0 && (
                        <div className="flex justify-between items-center bg-amber-50 p-1.5 rounded-lg border border-amber-100">
                           <span className="text-amber-700 font-black text-[7px] uppercase tracking-wider">Debt Carry-over (Prev)</span>
                           <span className="font-black text-amber-700">₱{(selectedPayslip.carryOverFromPrevious || 0).toFixed(2)}</span>
                        </div>
                      )}

                      {(selectedPayslip.totalPakyawPay > 0 || (selectedPayslip.pakyawItems && selectedPayslip.pakyawItems.length > 0) || (selectedPayslip.pakyawDetails && selectedPayslip.pakyawDetails.length > 0)) && (
                        <div className="space-y-2 mt-2 pt-2 border-t border-slate-50">
                          <div className="flex justify-between items-center">
                            <h3 className="text-indigo-600 font-black text-[8px] uppercase tracking-wider">Pakyaw Jobs Breakdown</h3>
                            <span className="font-black text-indigo-600">₱{(selectedPayslip.totalPakyawPay || 0).toFixed(2)}</span>
                          </div>

                          {selectedPayslip.pakyawItems && selectedPayslip.pakyawItems.length > 0 ? (
                            <div className="space-y-1.5">
                              {selectedPayslip.pakyawItems.map((item: any, dIdx: number) => (
                                <div key={dIdx} className={`flex justify-between items-center p-2 rounded-xl border transition-all ${item.isPaid ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 shadow-sm'}`}>
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleTogglePakyawItemPaid(selectedPayslip, dIdx)}
                                      className={`h-7 w-7 p-0 rounded-lg flex items-center justify-center transition-all shrink-0 shadow-sm ${item.isPaid ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-slate-50 text-slate-300 border border-slate-200 hover:border-indigo-500 hover:text-indigo-600'}`}
                                    >
                                      <CheckCircle className={`w-4 h-4 ${item.isPaid ? 'fill-indigo-600 text-white' : ''}`} />
                                    </Button>
                                    <div className="flex flex-col min-w-0">
                                      <span className={`text-[8px] font-black leading-none truncate uppercase ${item.status === 'completed' ? 'text-indigo-950' : 'text-slate-400'}`}>
                                        {item.description}
                                      </span>
                                      <span className={`text-[6px] font-black uppercase tracking-tighter mt-0.5 ${item.isPaid ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        {item.isPaid ? 'Payment Received' : 'Payment Pending'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className={`text-[9px] font-black ${item.status === 'completed' ? 'text-indigo-600' : 'text-slate-400'}`}>
                                      ₱{(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            selectedPayslip.pakyawDetails && selectedPayslip.pakyawDetails.length > 0 && (
                              <div className="pl-2 border-l-2 border-indigo-100 space-y-1">
                                {selectedPayslip.pakyawDetails.map((detail: string, dIdx: number) => (
                                  <div key={dIdx} className="text-[7px] text-indigo-400 font-bold leading-tight flex items-start gap-1.5">
                                    <span className="text-indigo-200 mt-0.5">●</span>
                                    {detail}
                                  </div>
                                ))}
                                <div className="bg-slate-50 p-1.5 rounded-md text-[6px] text-slate-400 font-medium italic mt-1">
                                  Note: Legacy record. Individual marking not available for old payrolls.
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center border-t-2 border-slate-900 pt-1.5 mt-1.5">
                        <span className="text-slate-900 font-black uppercase text-[9px] italic">Gross Earnings Total</span>
                        <span className="text-slate-900 font-black text-[11px] italic">₱{(selectedPayslip.totalEarnings || selectedPayslip.totalGrossPay || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                    <h3 className="text-[9px] font-black text-slate-400 pb-1 mb-1.5 uppercase border-b border-slate-200">
                      Summary
                    </h3>
                    <div className="space-y-1.5 font-mono">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500 font-bold uppercase">Earnings</span>
                        <span className="font-bold text-slate-700">₱{(selectedPayslip.totalEarnings || selectedPayslip.totalGrossPay || 0).toFixed(2)}</span>
                      </div>

                      {selectedPayslip.totalAdjustments !== 0 && (
                        <div className="flex justify-between items-center text-[10px]">
                          <span className={`font-bold uppercase ${selectedPayslip.totalAdjustments > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {selectedPayslip.totalAdjustments > 0 ? 'Bonus/Adj' : 'Manual Ded'}
                          </span>
                          <span className={`font-bold ${selectedPayslip.totalAdjustments > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {selectedPayslip.totalAdjustments > 0 ? '+' : ''}₱{(selectedPayslip.totalAdjustments || 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                      
                      {selectedPayslip.carryOverFromPrevious > 0 && (
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-amber-600 font-bold uppercase">Prev Debt</span>
                          <span className="font-bold text-amber-600">-₱{(selectedPayslip.carryOverFromPrevious || 0).toFixed(2)}</span>
                        </div>
                      )}

                      {selectedPayslip.cashAdvanceDeduction > 0 && (
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-red-500 font-bold uppercase">Cash Adv</span>
                          <span className="font-bold text-red-500">-₱{(selectedPayslip.cashAdvanceDeduction || 0).toFixed(2)}</span>
                        </div>
                      )}

                      {selectedPayslip.isAttendancePaid && (
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-emerald-600 font-bold uppercase">Daily Paid</span>
                          <span className="font-bold text-emerald-600">-₱{((selectedPayslip.regularPay || 0) + (selectedPayslip.otPay || 0)).toFixed(2)}</span>
                        </div>
                      )}

                      {selectedPayslip.pakyawItems?.some((i: any) => i.isPaid) && (
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-indigo-600 font-bold uppercase">Paid Pakyaw</span>
                          <span className="font-bold text-indigo-600">-₱{selectedPayslip.pakyawItems.filter((i: any) => i.isPaid).reduce((sum: number, i: any) => sum + (i.amount || 0), 0).toFixed(0)}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center border-t-2 border-dashed border-slate-200 pt-2 mt-1">
                        <span className="text-slate-900 font-black uppercase text-[12px] tracking-tight italic">Net Take Home</span>
                        <span className="text-slate-900 font-black text-[15px] italic">
                          ₱{Math.max(0, (Number(selectedPayslip.totalEarnings || selectedPayslip.totalGrossPay || 0)) - 
                    (selectedPayslip.carryOverFromPrevious || 0) - 
                    (selectedPayslip.cashAdvanceDeduction || 0) - 
                    (selectedPayslip.isAttendancePaid ? (Number(selectedPayslip.regularPay || 0) + (selectedPayslip.otPay || 0)) : 0) -
                    (selectedPayslip.pakyawItems?.filter((i: any) => i.isPaid).reduce((sum: number, i: any) => sum + (i.amount || 0), 0) || 0)
                  ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              
              {/* Compact Attendance Logs */}
              {selectedPayslip.dailyAttendanceLog && (
                <div className="mt-3 pt-2 border-t border-slate-100 font-sans">
                  <div className="grid grid-cols-4 min-[400px]:grid-cols-5 min-[500px]:grid-cols-6 md:grid-cols-8 gap-1">
                    {selectedPayslip.dailyAttendanceLog.map((log: any, i: number) => (
                      <div key={i} className={`py-1 rounded border flex flex-col items-center justify-center text-center ${
                        log.status === 'present' ? 'bg-emerald-50/30 border-emerald-100/50' :
                        log.status === 'absent' ? 'bg-rose-50/30 border-rose-100/50' :
                        log.status === 'halfday' ? 'bg-indigo-50/30 border-indigo-100/50' :
                        log.status === 'undertime' ? 'bg-amber-50/30 border-amber-100/50' :
                        'bg-slate-50/30 border-slate-100/50'
                      }`}>
                        <div className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">
                          {format(parseISO(log.date), 'MM/dd/yyyy')}
                        </div>
                        <div className={`text-[7px] font-black uppercase ${
                          log.status === 'present' ? 'text-emerald-600' :
                          log.status === 'absent' ? 'text-rose-600' :
                          'text-slate-400'
                        }`}>
                          {log.status === 'pakyaw' ? 'PK' : log.status.charAt(0).toUpperCase()}
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
            </>
          )
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
                <p className="text-3xl font-black text-blue-600">₱{(previewData?.bulkTotalPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Employees</p>
                <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{previewData?.targetEmployees.length || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="p-0 max-h-[50vh] overflow-y-auto overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-400 uppercase bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10 font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3 text-center">Gross Pay</th>
                  <th className="px-6 py-3 text-center text-red-500">Deductions</th>
                  <th className="px-6 py-3 text-right text-blue-500">Net Pay</th>
                  <th className="px-6 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {previewData?.payrollsToSave.map((p, idx) => {
                  const emp = previewData.targetEmployees.find(e => e.id === p.employeeId);
                  const isCarriedOver = p.status === 'carried_over';
                  return editingPreviewIdx === idx ? (
                    <tr key={idx} className="bg-blue-50/20 dark:bg-blue-900/10">
                      <td colSpan={5} className="px-6 py-6 font-sans">
                        <div className="font-black text-xs text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 flex justify-between items-center">
                          <span>Manual Pay Override: {emp?.fullName}</span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 lowercase italic font-normal">Recalculates instantly</span>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 mb-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-450 dark:text-slate-400">Regular Pay (₱)</label>
                            <Input 
                              type="number"
                              value={editRegularPay}
                              onChange={(e) => setEditRegularPay(e.target.value)}
                              className="h-8 max-h-8 text-xs font-bold bg-white dark:bg-slate-950 border-slate-205 text-slate-950 dark:text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-450 dark:text-slate-400">Overtime Pay (₱)</label>
                            <Input 
                              type="number"
                              value={editOtPay}
                              onChange={(e) => setEditOtPay(e.target.value)}
                              className="h-8 max-h-8 text-xs font-bold bg-white dark:bg-slate-950 border-slate-205 text-slate-950 dark:text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-450 dark:text-slate-400">Pakyaw Paid (₱)</label>
                            <Input 
                              type="number"
                              value={editPakyawPay}
                              onChange={(e) => setEditPakyawPay(e.target.value)}
                              className="h-8 max-h-8 text-xs font-bold bg-white dark:bg-slate-950 border-slate-205 text-slate-950 dark:text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-450 dark:text-slate-400">Adjustment/Bonus (₱)</label>
                            <Input 
                              type="number"
                              value={editAdjustments}
                              onChange={(e) => setEditAdjustments(e.target.value)}
                              className="h-8 max-h-8 text-xs font-bold bg-white dark:bg-slate-950 border-slate-205 text-slate-950 dark:text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-450 dark:text-slate-400">CA Deduction (₱)</label>
                            <Input 
                              type="number"
                              value={editCashAdvanceDeduction}
                              onChange={(e) => setEditCashAdvanceDeduction(e.target.value)}
                              className="h-8 max-h-8 text-xs font-bold bg-white dark:bg-slate-950 border-slate-205 text-slate-950 dark:text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-450 dark:text-slate-400">Debt Carry-Over (₱)</label>
                            <Input 
                              type="number"
                              value={editCarryOverFromPrevious}
                              onChange={(e) => setEditCarryOverFromPrevious(e.target.value)}
                              className="h-8 max-h-8 text-xs font-bold bg-white dark:bg-slate-950 border-slate-205 text-slate-950 dark:text-white"
                            />
                          </div>
                        </div>
                        
                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="ghost" 
                            className="h-7 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-[10px] px-3 py-1 rounded-lg"
                            onClick={() => setEditingPreviewIdx(null)}
                          >
                            Cancel
                          </Button>
                          <Button 
                            className="h-7 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-4 py-1 rounded-lg"
                            onClick={() => handleSavePreviewOverride(idx)}
                          >
                            Apply Override
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={idx} className={`transition-colors ${isCarriedOver ? 'bg-amber-50/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5 font-bold">
                          {emp?.fullName}
                          {p.isManualOverride && (
                            <span className="text-[8px] bg-blue-600 text-white rounded px-1 font-black uppercase tracking-widest scale-90">Custom</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {p.carryOverFromPrevious > 0 && <div className="text-emerald-500 font-bold">+₱{(p.carryOverFromPrevious || 0).toLocaleString()} Carry-over from previous</div>}
                          {!p.isManualOverride ? (
                            <span>{p.totalPresent}d present, {p.totalHalfDays || 0}d half, {p.totalAbsent}d absent</span>
                          ) : (
                            <span className="text-blue-500 font-bold">Manual override values active</span>
                          )}
                          {p.pakyawDetails && p.pakyawDetails.length > 0 && (
                            <div className="mt-1 text-indigo-400/80 font-medium">
                                Pakyaw: {p.pakyawDetails.join(', ')}
                            </div>
                          )}
                          {p.adjustments && p.adjustments.length > 0 && (
                            <div className="mt-1 text-blue-500 font-bold">
                                Adjustments: {p.adjustments.map((a: any) => `${a.description} (${a.type === 'deduction' ? '-' : '+'}₱${a.amount})`).join(', ')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-slate-700 dark:text-slate-300">
                        ₱{(p.totalGrossPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-red-600 dark:text-red-400">
                        ₱{(p.cashAdvanceDeduction || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`font-black ${isCarriedOver ? 'text-amber-500 line-through opacity-50' : 'text-blue-600 dark:text-blue-400'}`}>
                          ₱{(p.totalPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        {isCarriedOver && (
                          <div className="text-[10px] font-bold text-amber-600">CARRIED OVER</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center uppercase">
                        <div className="flex flex-col items-center gap-1.5 justify-center">
                          <button
                            onClick={() => toggleCarryOver(idx)}
                            className={`text-[9px] font-black px-2 py-0.5 rounded-full border transition-all w-24 text-center ${
                              isCarriedOver 
                                ? 'bg-amber-500 text-white border-amber-500' 
                                : 'text-slate-400 border-slate-200 dark:border-slate-800 hover:border-amber-400 hover:text-amber-500'
                            }`}
                          >
                            {isCarriedOver ? 'Undo' : 'Carry Over'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingPreviewIdx(idx);
                              setEditRegularPay((p.regularPay || 0).toString());
                              setEditOtPay((p.otPay || 0).toString());
                              setEditPakyawPay((p.totalPakyawPay || 0).toString());
                              setEditAdjustments((p.totalAdjustments || 0).toString());
                              setEditCashAdvanceDeduction((p.cashAdvanceDeduction || 0).toString());
                              setEditCarryOverFromPrevious((p.carryOverFromPrevious || 0).toString());
                            }}
                            className="text-[9px] font-black px-2 py-0.5 rounded-full border text-slate-450 border-slate-200 dark:border-slate-850 hover:border-blue-400 hover:text-blue-500 transition-all w-24 text-center"
                          >
                            Override
                          </button>
                        </div>
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

      {/* Adjustment Dialog */}
      <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-slate-900 border-white/10 text-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 italic uppercase font-black text-blue-400">
              <Plus className="w-5 h-5" />
              Add Manual Adjustment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target Staff</Label>
              <select 
                value={selectedAdjustmentEmployee}
                onChange={(e) => setSelectedAdjustmentEmployee(e.target.value)}
                className="w-full h-10 rounded-xl border border-white/10 bg-slate-950 p-2 text-sm text-white font-bold"
              >
                <option value="">Select Employee</option>
                {employees.sort((a,b) => a.fullName.localeCompare(b.fullName)).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Type</Label>
                <select 
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-white/10 bg-slate-950 p-2 text-sm text-white font-bold"
                >
                  <option value="bonus">Bonus</option>
                  <option value="missed_ot">Missed OT</option>
                  <option value="missed_day">Missed Day</option>
                  <option value="missed_half_day">Missed HD</option>
                  <option value="deduction">Deduction</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Amount (₱)</Label>
                <Input 
                  type="number" 
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  className="h-10 rounded-xl bg-slate-950 border-white/10 text-white font-black"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description / Note</Label>
              <Input 
                value={adjustmentDescription}
                onChange={(e) => setAdjustmentDescription(e.target.value)}
                className="h-10 rounded-xl bg-slate-950 border-white/10 text-white font-bold"
                placeholder="e.g. Forgot to add overtime last week"
              />
            </div>
            <div className="pt-4 flex gap-2">
              <Button 
                variant="ghost" 
                className="flex-1 rounded-xl text-white/50"
                onClick={() => setIsAdjustmentDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold"
                onClick={handleSaveAdjustment}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Confirmation Modal for Deletions */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Confirm Deletion</h2>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              {itemToDelete.type === 'bulk' 
                ? 'Are you sure you want to delete this entire payroll batch? All associated payslips will be permanently removed. This action cannot be undone.'
                : itemToDelete.type === 'adjustment'
                  ? 'Are you sure you want to delete this manual adjustment? This action cannot be undone.'
                  : `Are you sure you want to delete the payroll record for ${itemToDelete.name}? This action will permanently remove the record.`
              }
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (itemToDelete.type === 'bulk') handleDeleteBulk(itemToDelete.id);
                  else if (itemToDelete.type === 'adjustment') handleDeleteAdjustment(itemToDelete.id);
                  else handleDeletePayroll(itemToDelete.id);
                }}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-600/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
