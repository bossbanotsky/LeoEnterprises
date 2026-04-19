import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { Employee, Attendance, Payroll, CashAdvance } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Calendar, FileText, Wallet, Clock, User, Briefcase, CreditCard, ChevronRight, UserPen, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { updateDoc, deleteField } from 'firebase/firestore';

export default function EmployeeDashboard() {
  const { userData } = useAuth();
  const { companyInfo } = useCompanyInfo();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [paidBulkIds, setPaidBulkIds] = useState<Set<string>>(new Set());
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([]);
  
  const [startDate, setStartDate] = useState(() => localStorage.getItem('attendanceStartDate') || format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => localStorage.getItem('attendanceEndDate') || format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);

  // Profile Edit State
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileData, setProfileData] = useState<Partial<Employee>>({});

  // Open profile edit modal and pre-fill data
  const handleOpenProfileEdit = () => {
    if (employee) {
      setProfileData({
        birthday: employee.birthday || '',
        sex: employee.sex || '',
        civilStatus: employee.civilStatus || '',
        religion: employee.religion || '',
        sssNumber: employee.sssNumber || '',
        philhealthNumber: employee.philhealthNumber || '',
        pagibigNumber: employee.pagibigNumber || '',
        tinNumber: employee.tinNumber || '',
        emergencyContactName: employee.emergencyContactName || '',
        emergencyContactRelation: employee.emergencyContactRelation || '',
        emergencyContactPhone: employee.emergencyContactPhone || ''
      });
      setIsProfileEditOpen(true);
    }
  };

  const handleSaveProfile = async () => {
    if (!employee || !userData?.employeeId) return;
    setIsSavingProfile(true);
    try {
      await updateDoc(doc(db, 'employees', employee.id), {
        birthday: profileData.birthday || deleteField(),
        sex: profileData.sex || deleteField(),
        civilStatus: profileData.civilStatus || deleteField(),
        religion: profileData.religion || deleteField(),
        sssNumber: profileData.sssNumber || deleteField(),
        philhealthNumber: profileData.philhealthNumber || deleteField(),
        pagibigNumber: profileData.pagibigNumber || deleteField(),
        tinNumber: profileData.tinNumber || deleteField(),
        emergencyContactName: profileData.emergencyContactName || deleteField(),
        emergencyContactRelation: profileData.emergencyContactRelation || deleteField(),
        emergencyContactPhone: profileData.emergencyContactPhone || deleteField()
      } as any);
      setIsProfileEditOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'employees');
    } finally {
      setIsSavingProfile(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('attendanceStartDate', startDate);
    localStorage.setItem('attendanceEndDate', endDate);
  }, [startDate, endDate]);

  useEffect(() => {
    if (!userData?.employeeId) return;

    const fetchEmployee = async () => {
      try {
        const empDoc = await getDoc(doc(db, 'employees', userData.employeeId!));
        if (empDoc.exists()) {
          setEmployee({ id: empDoc.id, ...empDoc.data() } as Employee);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'employees');
      }
    };

    fetchEmployee();

    const qAtt = query(
      collection(db, 'attendance'),
      where('employeeId', '==', userData.employeeId),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const unsubAtt = onSnapshot(qAtt, (snapshot) => {
      const atts: Attendance[] = [];
      snapshot.forEach(doc => atts.push({ id: doc.id, ...doc.data() } as Attendance));
      setAttendances(atts.sort((a, b) => b.date.localeCompare(a.date)));
    });

    const qPayroll = query(
      collection(db, 'payrolls'),
      where('employeeId', '==', userData.employeeId)
    );
    const unsubPayroll = onSnapshot(qPayroll, (snapshot) => {
      const pays: Payroll[] = [];
      snapshot.forEach(doc => pays.push({ id: doc.id, ...doc.data() } as Payroll));
      setPayrolls(pays.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)));
    });

    const qCA = query(
      collection(db, 'cashAdvances'),
      where('employeeId', '==', userData.employeeId)
    );
    const unsubCA = onSnapshot(qCA, (snapshot) => {
      const cas: CashAdvance[] = [];
      snapshot.forEach(doc => cas.push({ id: doc.id, ...doc.data() } as CashAdvance));
      setCashAdvances(cas.sort((a, b) => b.date.localeCompare(a.date)));
    });

    setLoading(false);
    return () => {
      unsubAtt();
      unsubPayroll();
      unsubCA();
    };
  }, [userData, startDate, endDate]);

  const dateRange = useMemo(() => {
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      if (start > end) return [];
      return eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd')).sort((a, b) => b.localeCompare(a));
    } catch {
      return [];
    }
  }, [startDate, endDate]);

  if (loading || !employee) {
    return <div className="h-full flex items-center justify-center">Loading portal...</div>;
  }

  // We can filter payrolls based on their individual status rather than checking bulkPayrolls
  const pendingPayrolls = payrolls.filter(p => p.status !== 'paid');
  const archivedPayrolls = payrolls.filter(p => p.status === 'paid');

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header Profile */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 transition duration-1000"></div>
        <div className="relative bento-card flex-col bg-white dark:bg-slate-800 p-6 overflow-hidden border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-5 relative">
            <Button
              variant="outline"
              size="icon"
              className="absolute top-0 right-0 h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-none shadow-sm"
              onClick={handleOpenProfileEdit}
            >
              <UserPen className="h-4 w-4 text-slate-500" />
            </Button>
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold text-3xl shadow-lg">
              {employee.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">{employee.fullName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider rounded-md">
                  {employee.position}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">ID: {employee.customId || employee.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Daily Salary</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">₱{employee.dailySalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Hourly Rate</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">₱{employee.hourlyRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" /> Attendance
          </h3>
          <div className="flex gap-2 items-center">
            <Input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="h-7 text-[10px] w-28 rounded-lg bg-white dark:bg-slate-800"
            />
            <span className="text-slate-400 text-xs">to</span>
            <Input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="h-7 text-[10px] w-28 rounded-lg bg-white dark:bg-slate-800"
            />
          </div>
        </div>
        <div className="bento-card flex-col bg-white dark:bg-slate-800 p-0 overflow-hidden border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {dateRange.map(date => {
                  const att = attendances.find(a => a.date === date) || {
                    id: date,
                    date: date,
                    status: 'absent',
                    regularHours: 0,
                    otHours: 0
                  } as Attendance;

                  return (
                    <tr key={date}>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{format(parseISO(date), 'MMM dd, yyyy')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          att.status === 'present' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          att.status === 'absent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          att.status === 'ut' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {att.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {att.regularHours || 0}h {(att.otHours || 0) > 0 && `(+${att.otHours}h OT)`}
                      </td>
                    </tr>
                  );
                })}
                {dateRange.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-slate-400">Invalid date range selected</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Payslips Section */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" /> Recent Payslips
        </h3>
        <div className="space-y-3">
          {pendingPayrolls.map(pay => (
            <div key={pay.id} className="bento-card flex-row items-center justify-between bg-white dark:bg-slate-800 p-4 border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-yellow-100 text-yellow-700 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">Unpaid</div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                    {format(parseISO(pay.startDate), 'MMM dd')} - {format(parseISO(pay.endDate), 'MMM dd, yyyy')}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Generated on {format(parseISO(pay.generatedAt), 'MMM dd, h:mm a')}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black text-blue-600 dark:text-blue-400">₱{pay.totalPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <Button variant="outline" size="sm" className="mt-2 h-7 text-xs bg-transparent dark:border-slate-700 dark:text-slate-300" onClick={() => setSelectedPayslip({ ...pay, employee })}>
                  View Full
                </Button>
              </div>
            </div>
          ))}
          {pendingPayrolls.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-sm">No recent unpaid payslips</div>
          )}
        </div>
      </section>

      {/* Payslip History section */}
      {archivedPayrolls.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5" /> Payslip History (Paid)
          </h3>
          <div className="space-y-3">
            {archivedPayrolls.map(pay => (
              <div key={pay.id} className="bento-card flex-row items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-4 border-slate-200 dark:border-slate-700 shadow-sm opacity-90 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-green-100 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">Paid</div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                      {format(parseISO(pay.startDate), 'MMM dd')} - {format(parseISO(pay.endDate), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Paid on {format(parseISO(pay.generatedAt), 'MMM dd')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-300">₱{pay.totalPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <Button variant="outline" size="sm" className="mt-2 h-7 text-xs bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300" onClick={() => setSelectedPayslip({ ...pay, employee })}>
                    View Past
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cash Advances */}
      <section className="space-y-3 pb-8">
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5" /> Outstanding Debts
        </h3>
        <div className="space-y-3">
          {cashAdvances.map(ca => (
            <div key={ca.id} className="bento-card flex-row items-center justify-between bg-white dark:bg-slate-800 p-4 border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white text-sm">₱{ca.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <div className="text-[10px] text-slate-500">{format(parseISO(ca.date), 'MMM dd, yyyy')} {ca.notes && `• ${ca.notes}`}</div>
                </div>
              </div>
            </div>
          ))}
          {cashAdvances.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-sm">No cash advance records</div>
          )}
        </div>
      </section>

      {/* Payslip Dialog */}
      <Dialog open={!!selectedPayslip} onOpenChange={(open) => !open && setSelectedPayslip(null)}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white rounded-2xl w-[95vw] max-w-md mx-auto">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <FileText className="w-5 h-5 text-blue-600" />
              Payslip Details
            </DialogTitle>
          </div>
          
          {selectedPayslip && (
            <div className="p-6 max-h-[70vh] overflow-y-auto" style={{ backgroundColor: '#ffffff' }}>
              <div className="flex justify-between border-b-2 border-slate-800 pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">PAYSLIP</h2>
                  <div className="text-sm text-slate-600 mt-1">
                    {format(parseISO(selectedPayslip.startDate), 'MMM dd')} - {format(parseISO(selectedPayslip.endDate), 'MMM dd, yyyy')}
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2 uppercase tracking-tight">{selectedPayslip.employee.fullName}</div>
                  <div className="text-xs text-slate-500">
                    {selectedPayslip.employee.customId ? `${selectedPayslip.employee.customId} • ` : ''}{selectedPayslip.employee.position || 'Staff'}
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
                      <span className="font-medium text-slate-900">₱ {selectedPayslip.regularPay.toFixed(2)}</span>
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                  <div className="bg-slate-50 p-3 rounded-xl text-center">
                    <div className="text-[10px] text-slate-500 mb-1 uppercase font-bold tracking-tight">Present</div>
                    <div className="font-bold text-slate-900">{selectedPayslip.totalPresent} days</div>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-xl text-center border border-amber-100">
                    <div className="text-[10px] text-amber-600 mb-1 uppercase font-bold tracking-tight">Undertime</div>
                    <div className="font-bold text-amber-700">{selectedPayslip.totalUndertimeHours?.toFixed(1) || '0.0'} hrs</div>
                    <div className="text-[10px] text-amber-500">total worked</div>
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

      {/* Profile Edit Dialog */}
      <Dialog open={isProfileEditOpen} onOpenChange={setIsProfileEditOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-white dark:bg-slate-900 border-0 shadow-2xl rounded-2xl">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <UserPen className="w-5 h-5" />
                Personal Information
              </DialogTitle>
            </DialogHeader>
            <p className="text-blue-100 text-xs mt-1 opacity-90">
              This information is optional but highly recommended to keep your record complete.
            </p>
          </div>
          <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Birthday</Label>
                <Input 
                  type="date" 
                  value={profileData.birthday || ''} 
                  onChange={e => setProfileData(prev => ({ ...prev, birthday: e.target.value }))}
                  className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sex</Label>
                <select 
                  value={profileData.sex || ''} 
                  onChange={e => setProfileData(prev => ({ ...prev, sex: e.target.value as any }))}
                  className="flex h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" disabled>Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Civil Status</Label>
                <select 
                  value={profileData.civilStatus || ''} 
                  onChange={e => setProfileData(prev => ({ ...prev, civilStatus: e.target.value as any }))}
                  className="flex h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" disabled>Select</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                  <option value="Divorced">Divorced</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Religion</Label>
                <Input 
                  placeholder="e.g. Catholic"
                  value={profileData.religion || ''} 
                  onChange={e => setProfileData(prev => ({ ...prev, religion: e.target.value }))}
                  className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Government IDs</h4>
              
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">SSS Number</Label>
                <Input 
                  placeholder="XX-XXXXXXX-X"
                  value={profileData.sssNumber || ''} 
                  onChange={e => setProfileData(prev => ({ ...prev, sssNumber: e.target.value }))}
                  className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">PhilHealth Number</Label>
                <Input 
                  placeholder="XX-XXXXXXXXX-X"
                  value={profileData.philhealthNumber || ''} 
                  onChange={e => setProfileData(prev => ({ ...prev, philhealthNumber: e.target.value }))}
                  className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pag-IBIG/HDMF Number</Label>
                <Input 
                  placeholder="XXXX-XXXX-XXXX"
                  value={profileData.pagibigNumber || ''} 
                  onChange={e => setProfileData(prev => ({ ...prev, pagibigNumber: e.target.value }))}
                  className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">TIN</Label>
                <Input 
                  placeholder="XXX-XXX-XXX-000"
                  value={profileData.tinNumber || ''} 
                  onChange={e => setProfileData(prev => ({ ...prev, tinNumber: e.target.value }))}
                  className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">In Case of Emergency</h4>
              
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Name</Label>
                <Input 
                  placeholder="Full Name"
                  value={profileData.emergencyContactName || ''} 
                  onChange={e => setProfileData(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                  className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Relation</Label>
                  <Input 
                    placeholder="e.g. Spouse"
                    value={profileData.emergencyContactRelation || ''} 
                    onChange={e => setProfileData(prev => ({ ...prev, emergencyContactRelation: e.target.value }))}
                    className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Phone</Label>
                  <Input 
                    placeholder="0917XXXXXXX"
                    value={profileData.emergencyContactPhone || ''} 
                    onChange={e => setProfileData(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                    className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsProfileEditOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="rounded-xl bg-blue-600 hover:bg-blue-700 min-w-24">
              {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Profile'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
