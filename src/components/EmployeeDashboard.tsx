import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, getDoc, doc, arrayUnion, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { Employee, Attendance, Payroll, CashAdvance, Announcement } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isPast, isSunday } from 'date-fns';
import { Calendar, FileText, Wallet, Clock, User, Briefcase, CreditCard, ChevronRight, UserPen, Loader2, Upload, Megaphone, Bell, Lock, X, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { updateDoc, deleteField } from 'firebase/firestore';
import { Interactive } from './ui/Interactive';
import { Skeleton } from './ui/Skeleton';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function EmployeeDashboard() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const { companyInfo } = useCompanyInfo();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [paidBulkIds, setPaidBulkIds] = useState<Set<string>>(new Set());
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  
  const [startDate, setStartDate] = useState(() => localStorage.getItem('payrollStartDate') || format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => localStorage.getItem('payrollEndDate') || format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [loadingPayrolls, setLoadingPayrolls] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const payslipRef = useRef<HTMLDivElement>(null);

  // If Admin lands here, redirect to admin dashboard
  useEffect(() => {
    if (userData?.role === 'admin') {
      navigate('/admin-dashboard', { replace: true });
    }
  }, [userData, navigate]);

  // Profile Edit State
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [profileData, setProfileData] = useState<Partial<Employee>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password State
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const { changePassword } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setProfileData(prev => ({ ...prev, photoURL: dataUrl }));
        setIsUploading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

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
        emergencyContactPhone: employee.emergencyContactPhone || '',
        photoURL: employee.photoURL || ''
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
        emergencyContactPhone: profileData.emergencyContactPhone || deleteField(),
        photoURL: profileData.photoURL || deleteField()
      } as any);

      // Also sync to users collection to notify AuthContext listeners
      const userDocRef = doc(db, 'users', user!.uid);
      await updateDoc(userDocRef, {
        photoURL: profileData.photoURL || deleteField(),
        fullName: employee.fullName // fullName shouldn't change here since it's not in profileData, but we use existing
      } as any);

      setIsProfileEditOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'employees');
    } finally {
      setIsSavingProfile(false);
    }
  };

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
    if (!userData?.employeeId) return;

    // 1. Employee Data (Keep getDoc for one-time fetch)
    const fetchEmp = async () => {
      const empDoc = await getDoc(doc(db, 'employees', userData.employeeId!));
      if (empDoc.exists()) {
        setEmployee({ id: empDoc.id, ...empDoc.data() } as Employee);
        setLoading(false);
      }
    };
    fetchEmp();

    // 2. Attendance within Range (Real-time)
    const qAtt = query(
      collection(db, 'attendance'),
      where('employeeId', '==', userData.employeeId),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const unsubAtt = onSnapshot(qAtt, (snapshot) => {
      const atts: Attendance[] = [];
      snapshot.forEach(docSnap => atts.push({ id: docSnap.id, ...docSnap.data() } as Attendance));
      setAttendances(atts.sort((a, b) => b.date.localeCompare(a.date)));
    });

    // 3. User Payrolls (Real-time)
    const qPayroll = query(
      collection(db, 'payrolls'),
      where('employeeId', '==', userData.employeeId)
    );
    const unsubPayroll = onSnapshot(qPayroll, (snapshot) => {
      const pays: Payroll[] = [];
      snapshot.forEach(docSnap => pays.push({ id: docSnap.id, ...docSnap.data() } as Payroll));
      setPayrolls(pays.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)));
      setLoadingPayrolls(false);
    });

    // 4. Cash Advances (Real-time)
    const qCA = query(
      collection(db, 'cashAdvances'),
      where('employeeId', '==', userData.employeeId)
    );
    const unsubCA = onSnapshot(qCA, (snapshot) => {
      const cas: CashAdvance[] = [];
      snapshot.forEach(docSnap => cas.push({ id: docSnap.id, ...docSnap.data() } as CashAdvance));
      setCashAdvances(cas.sort((a, b) => b.date.localeCompare(a.date)));
    });

    // 5. Announcements (Real-time)
    const qAnn = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubAnn = onSnapshot(qAnn, (snapshot) => {
      const dataAnn: Announcement[] = [];
      snapshot.forEach(docSnap => dataAnn.push({ id: docSnap.id, ...docSnap.data() } as Announcement));
      setAnnouncements(dataAnn);
    });

    return () => {
      unsubAtt();
      unsubPayroll();
      unsubCA();
      unsubAnn();
    };
  }, [userData, startDate, endDate]);

  const handleMarkAsViewed = async (annId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'announcements', annId), {
        viewedBy: arrayUnion(user.uid)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'announcements');
    }
  };

  const activeAnnouncements = useMemo(() => 
    announcements.filter(a => !isPast(parseISO(a.expiresAt))),
  [announcements]);

  const pastAnnouncements = useMemo(() => 
    announcements.filter(a => isPast(parseISO(a.expiresAt))),
  [announcements]);

  const unreadCount = useMemo(() => 
    activeAnnouncements.filter(a => !a.viewedBy.includes(user?.uid || '')).length,
  [activeAnnouncements, user]);

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
      
      payslipRef.current.style.maxHeight = originalStyle;
      
      const imgData = canvas.toDataURL('image/png');
      
      // A4 Landscape
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
      pdf.save(`payslip_${selectedPayslip.employee.fullName.replace(/\s+/g, '_')}_${selectedPayslip.startDate}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

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
    return (
      <div className="h-full flex flex-col space-y-6 pt-4">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // We can filter payrolls based on their individual status rather than checking bulkPayrolls
  const pendingPayrolls = payrolls.filter(p => p.status !== 'paid');
  const archivedPayrolls = payrolls.filter(p => p.status === 'paid');

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none uppercase italic">
             Hello, {userData?.fullName?.split(' ')[0]}
          </h1>
          <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.3em] mt-2 italic opacity-90">
            Portal Access • {companyInfo.name}
          </p>
        </div>
      </div>

      {/* Notice Board Section */}
      {(activeAnnouncements.length > 0 || pastAnnouncements.length > 0) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Megaphone className="w-3.5 h-3.5 text-blue-500" /> Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full animate-bounce border border-blue-500/20">
                <Bell className="w-3 h-3" /> {unreadCount} NEW
              </span>
            )}
          </div>
          <div className="space-y-3">
            {activeAnnouncements.map(ann => {
              const hasViewed = ann.viewedBy.includes(user?.uid || '');
              return (
                <div key={ann.id} className={`bento-card flex-col p-5 relative overflow-hidden transition-all border border-white/10 ${
                  !hasViewed ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'bg-transparent shadow-xl'
                }`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    ann.priority === 'high' ? 'bg-red-500 shadow-[2px_0_10px_rgba(239,68,68,0.3)]' : ann.priority === 'medium' ? 'bg-blue-500 shadow-[2px_0_10px_rgba(59,130,246,0.3)]' : 'bg-slate-600'
                  }`}></div>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-white leading-tight uppercase italic text-sm tracking-tight">{ann.title}</h4>
                        {!hasViewed && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse"></span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed font-medium">
                        {ann.message}
                      </p>
                      <div className="flex items-center gap-3 mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span className="text-cyan-400">By {ann.authorName}</span>
                        <span>•</span>
                        <span>{format(parseISO(ann.createdAt), 'MMM d, h:mm a')}</span>
                      </div>
                    </div>
                    {!hasViewed && (
                      <Button 
                        size="sm" 
                        variant="default" 
                        onClick={() => handleMarkAsViewed(ann.id)}
                        className="rounded-xl h-8 text-[10px] uppercase font-bold tracking-wider bg-blue-600 hover:bg-blue-700"
                      >
                        OK, Saw It
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Past Announcements Link/Accordion could go here if needed, 
                but for now we show all active ones. Past ones move to History. */}
            {pastAnnouncements.length > 0 && (
              <div className="pt-2">
                 <details className="group">
                   <summary className="text-[10px] font-bold text-slate-300 uppercase tracking-widest cursor-pointer hover:text-slate-200 transition-colors list-none flex items-center gap-2 px-1">
                     <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                     Past Notices ({pastAnnouncements.length})
                   </summary>
                   <div className="space-y-2 mt-3 pl-1 opacity-60">
                     {pastAnnouncements.map(ann => (
                       <div key={ann.id} className="bg-slate-100/50 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                         <h5 className="font-bold text-slate-800 dark:text-slate-200 text-xs">{ann.title}</h5>
                         <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{ann.message}</p>
                       </div>
                     ))}
                   </div>
                 </details>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Header Profile */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 transition duration-1000"></div>
        <div className="relative bento-card flex-col bg-slate-900/40 p-6 overflow-hidden border border-white/10 shadow-xl">
          <div className="flex items-center gap-5 relative z-10">
            <Button
              variant="outline"
              size="icon"
              className="absolute top-0 right-0 h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-none shadow-sm"
              onClick={handleOpenProfileEdit}
            >
              <UserPen className="h-4 w-4 text-slate-500" />
            </Button>
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold text-3xl shadow-lg overflow-hidden">
              {employee.photoURL ? (
                <img 
                  src={employee.photoURL} 
                  alt={employee.fullName} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                employee.fullName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <h1 className="text-2xl font-black text-white truncate">{employee.fullName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="px-2 py-0.5 bg-blue-500/10 text-cyan-400 text-[10px] font-black uppercase tracking-wider rounded-md border border-blue-500/20">
                  {employee.position}
                </span>
                <span className="text-xs text-white/60 font-medium tracking-tight">ID: {employee.customId || employee.id.slice(0, 8)}</span>
                {employee.sex && (
                  <span className="text-[10px] text-white/70 font-bold tracking-wider px-2 py-0.5 bg-white/5 rounded border border-white/10 uppercase">{employee.sex}</span>
                )}
                {employee.civilStatus && (
                  <span className="text-[10px] text-white/70 font-bold tracking-wider px-2 py-0.5 bg-white/5 rounded border border-white/10 uppercase">{employee.civilStatus}</span>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10 overflow-hidden">
              <div className="text-[10px] text-slate-300 uppercase font-bold tracking-wider mb-1 truncate">Daily Salary</div>
              <div className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none truncate">₱{employee.dailySalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/10 overflow-hidden">
              <div className="text-[10px] text-slate-300 uppercase font-bold tracking-wider mb-1 truncate">Hourly Rate</div>
              <div className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none truncate">₱{employee.hourlyRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Section */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
          <h3 className="text-xs font-bold text-slate-300 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" /> Attendance
          </h3>
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <Input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="h-8 text-[10px] flex-1 sm:w-28 rounded-lg bg-white/5 border-white/10"
            />
            <span className="text-white/40 text-[10px] uppercase font-bold">to</span>
            <Input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="h-8 text-[10px] flex-1 sm:w-28 rounded-lg bg-white/5 border-white/10"
            />
          </div>
        </div>
        <div className="bento-card flex-col bg-slate-900/40 p-0 overflow-hidden border border-white/10 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">In</th>
                  <th className="px-4 py-3 text-center">Out</th>
                  <th className="px-4 py-3 text-right">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {dateRange.map(date => {
                  const att = attendances.find(a => a.date === date) || {
                    id: date,
                    date: date,
                    status: 'absent',
                    regularHours: 0,
                    otHours: 0,
                    timeIn: '',
                    timeOut: ''
                  } as Attendance;

                  const dateObj = parseISO(date);
                  const displayStatus = att.status;
                  const displayHours = att.regularHours || 0;

                  return (
                    <tr key={date}>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">{format(dateObj, 'EEE, MMM dd')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          displayStatus === 'present' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          displayStatus === 'absent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          displayStatus === 'ut' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          displayStatus === 'hd' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-[10px] font-mono text-white">
                        {att.timeIn || '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-[10px] font-mono text-white">
                        {att.timeOut || '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 font-medium font-mono text-xs">
                        {displayHours}h{(att.otHours || 0) > 0 && <span className="text-emerald-500 ml-1">+{att.otHours}h</span>}
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
          {loadingPayrolls ? (
            <Skeleton count={2} className="h-32 w-full rounded-2xl" />
          ) : (
            <>
              {pendingPayrolls.map(pay => (
                <Interactive key={pay.id} className="bento-card flex-row  bg-slate-900/40 p-4 border border-white/10 shadow-xl relative overflow-hidden">
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
                </Interactive>
              ))}
              {pendingPayrolls.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-sm">No recent unpaid payslips</div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Payslip History section */}
      {archivedPayrolls.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5" /> Payslip History (Paid)
            </h3>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 gap-1.5 rounded-lg border-white/10 text-white hover:bg-white/10 font-bold text-[9px] uppercase tracking-widest bg-white/5"
              onClick={async () => {
                if (archivedPayrolls.length === 0) return;
                setIsExporting(true);
                try {
                  const pdf = new jsPDF({
                    orientation: "landscape",
                    unit: "mm",
                    format: "a5"
                  });
                  
                  const pdfWidth = pdf.internal.pageSize.getWidth();
                  const pdfHeight = pdf.internal.pageSize.getHeight();
                  
                  for (let i = 0; i < archivedPayrolls.length; i++) {
                    const pay = archivedPayrolls[i];
                    setSelectedPayslip({ ...pay, employee });
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
                  pdf.save(`Payslip_History_${employee?.fullName.replace(/\s+/g, '_')}.pdf`);
                } catch (error) {
                  console.error('Error exporting bulk payslips:', error);
                } finally {
                  setIsExporting(false);
                }
              }}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3 rotate-180" />}
              Export All Paid
            </Button>
          </div>
          <div className="space-y-3">
            {archivedPayrolls.map(pay => (
              <div key={pay.id} className="bento-card flex-row items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-4 border-slate-200 dark:border-slate-700 shadow-sm opacity-90 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-green-100 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">Paid</div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 text-cyan-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-black text-white text-sm uppercase tracking-tight">
                      {format(parseISO(pay.startDate), 'MMM dd')} - {format(parseISO(pay.endDate), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">Paid on {format(parseISO(pay.generatedAt), 'MMM dd')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-white">₱{pay.totalPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <Button variant="ghost" size="sm" className="mt-2 h-7 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white/80 border border-white/10" onClick={() => setSelectedPayslip({ ...pay, employee })}>
                    View Slip
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
                <div key={ca.id} className="bento-card flex-row  bg-slate-900/40 p-4 border border-white/10 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/20">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-black text-white text-sm">₱{ca.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{format(parseISO(ca.date), 'MMM dd, yyyy')} {ca.notes && `• ${ca.notes}`}</div>
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
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-white rounded-3xl w-[95vw] max-w-2xl mx-auto border-none shadow-2xl">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 backdrop-blur-sm sticky top-0 z-10">
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-black uppercase italic tracking-tight text-lg">
              <FileText className="w-5 h-5 text-blue-600" />
              Payslip Details
            </DialogTitle>
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
          
          {selectedPayslip && (
            <div 
              ref={payslipRef}
              className="p-8 max-h-[80vh] overflow-y-auto payslip-mockup bg-white" 
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
                  <span className="text-xs font-black text-slate-900 font-mono">₱ {(selectedPayslip.employee?.dailySalary || 0).toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 mb-1 uppercase tracking-widest">Hourly Rate</span>
                  <span className="text-xs font-black text-slate-900 font-mono">₱ {((selectedPayslip.employee?.dailySalary || 0) / 8).toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 mb-1 uppercase tracking-widest">OT Hourly</span>
                  <span className="text-xs font-black text-emerald-600 font-mono">₱ {((selectedPayslip.employee?.dailySalary || 0) / 8).toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                        
                        {(selectedPayslip.totalPresent || 0) > 0 && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-600 flex items-center gap-1.5">
                              <div className="w-1 h-1 bg-emerald-400 rounded-full" />
                              {selectedPayslip.totalPresent} Full Days (8.0h)
                            </span>
                            <span className="text-slate-400 font-mono">
                              ₱ {(selectedPayslip.totalPresent * (selectedPayslip.employee?.dailySalary || 0)).toFixed(2)}
                            </span>
                          </div>
                        )}

                        {(selectedPayslip.totalHalfDays || 0) > 0 && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-600 flex items-center gap-1.5">
                              <div className="w-1 h-1 bg-indigo-400 rounded-full" />
                              {selectedPayslip.totalHalfDays} Half Days (5.0h)
                            </span>
                            <span className="text-slate-400 font-mono">
                              ₱ {((selectedPayslip.totalHalfDays * 5 / 8) * (selectedPayslip.employee?.dailySalary || 0)).toFixed(2)}
                            </span>
                          </div>
                        )}

                        {(selectedPayslip.totalUndertimeHours || 0) > 0 && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-600 flex items-center gap-1.5">
                              <div className="w-1 h-1 bg-amber-400 rounded-full" />
                              {selectedPayslip.totalUndertimeHours.toFixed(1)} Undertime Hours
                            </span>
                            <span className="text-slate-400 font-mono">
                              ₱ {((selectedPayslip.totalUndertimeHours / 8) * (selectedPayslip.employee?.dailySalary || 0)).toFixed(2)}
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
                              {selectedPayslip.totalOtHours.toFixed(1)} Hrs @ ₱{((selectedPayslip.employee?.dailySalary || 0) / 8).toFixed(2)}/hr
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
                <div className="mt-8 pt-6 border-t-2 border-slate-100 font-sans px-1">
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

              <div className="mt-8 pt-6 border-t font-sans">
                  {selectedPayslip.pakyawDetails && selectedPayslip.pakyawDetails.length > 0 && (
                    <div className="text-[10px] text-slate-500 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50">
                      <span className="font-black text-indigo-700 uppercase tracking-widest block mb-2">Projects & Pakyaw</span>
                      <ul className="space-y-1.5 list-none">
                        {selectedPayslip.pakyawDetails.map((detail: string, i: number) => (
                          <li key={i} className="flex gap-2 items-start">
                            <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
                            <span className="font-medium text-slate-600">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-col justify-end">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Signature</div>
                      <div className="w-32 h-[1px] bg-slate-300"></div>
                    </div>
                  </div>
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
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Profile Picture</h4>
              <div className="flex items-center gap-4">
                <div 
                  className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer hover:border-blue-400 transition-colors group relative"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {profileData.photoURL ? (
                    <img src={profileData.photoURL} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-8 h-8 text-slate-300" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  {isUploading && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Image Source</Label>
                  <div className="flex flex-col gap-2">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl h-9 text-xs gap-2 border-slate-200 dark:border-slate-700"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Photo
                    </Button>
                    <div className="relative">
                      <Input 
                        placeholder="Or paste image URL..."
                        value={profileData.photoURL?.startsWith('data:') ? 'Image Uploaded' : (profileData.photoURL || '')} 
                        onChange={e => setProfileData(prev => ({ ...prev, photoURL: e.target.value }))}
                        className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-[10px] h-8 truncate"
                        disabled={profileData.photoURL?.startsWith('data:')}
                      />
                      {profileData.photoURL?.startsWith('data:') && (
                        <button 
                          onClick={() => setProfileData(prev => ({ ...prev, photoURL: '' }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500 hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

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
                <Label className="text-xs font-black text-white/70 uppercase tracking-widest">SSS Number</Label>
                <Input 
                  placeholder="XX-XXXXXXX-X"
                  value={profileData.sssNumber || ''} 
                  onChange={e => setProfileData(prev => ({ ...prev, sssNumber: e.target.value }))}
                  className="rounded-xl border-white/10 bg-white/5 focus:bg-white/10 text-white"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs font-black text-white/70 uppercase tracking-widest">PhilHealth Number</Label>
                <Input 
                  placeholder="XX-XXXXXXXXX-X"
                  value={profileData.philhealthNumber || ''} 
                  onChange={e => setProfileData(prev => ({ ...prev, philhealthNumber: e.target.value }))}
                  className="rounded-xl border-white/10 bg-white/5 focus:bg-white/10 text-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-black text-white/70 uppercase tracking-widest">Pag-IBIG/HDMF Number</Label>
                <Input 
                  placeholder="XXXX-XXXX-XXXX"
                  value={profileData.pagibigNumber || ''} 
                  onChange={e => setProfileData(prev => ({ ...prev, pagibigNumber: e.target.value }))}
                  className="rounded-xl border-white/10 bg-white/5 focus:bg-white/10 text-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-black text-white/70 uppercase tracking-widest">TIN</Label>
                <Input 
                  placeholder="XXX-XXX-XXX-000"
                  value={profileData.tinNumber || ''} 
                  onChange={e => setProfileData(prev => ({ ...prev, tinNumber: e.target.value }))}
                  className="rounded-xl border-white/10 bg-white/5 focus:bg-white/10 text-white"
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

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Security</h4>
              <Button 
                variant="outline" 
                className="w-full rounded-xl border-slate-200 dark:border-slate-700 h-11 justify-start gap-3"
                onClick={() => {
                  setPasswordSuccess(false);
                  setPasswordError(null);
                  setNewPassword('');
                  setConfirmPassword('');
                  setShowPasswordDialog(true);
                }}
              >
                <Lock className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold">Set / Change Login Password</span>
              </Button>
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

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-white dark:bg-slate-900 border-0 shadow-2xl rounded-2xl">
          <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2">
              <Lock className="w-4 h-4" /> Security Settings
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setShowPasswordDialog(false)} className="text-white hover:bg-white/10">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-6 space-y-4">
            {passwordSuccess ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 font-bold">✓</div>
                <div>
                  <h4 className="font-bold">Password Updated</h4>
                  <p className="text-xs text-slate-500 mt-1">You can now login with your email and password.</p>
                </div>
                <Button onClick={() => setShowPasswordDialog(false)} className="w-full rounded-xl">Close</Button>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-[11px] text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                  Setting a password allows you to access this portal using your email ({user?.email}) even without Google.
                </div>
                
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[11px] font-bold">
                    {passwordError}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">New Password</Label>
                  <Input 
                    type="password" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Confirm New Password</Label>
                  <Input 
                    type="password" 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Match new password"
                    className="rounded-xl"
                  />
                </div>
                <Button 
                  className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold mt-2"
                  disabled={isChangingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                  onClick={async () => {
                    try {
                      setIsChangingPassword(true);
                      setPasswordError(null);
                      await changePassword(newPassword);
                      setPasswordSuccess(true);
                    } catch (e: any) {
                      if (e.code === 'auth/requires-recent-login') {
                        setPasswordError('Security: Please sign out and sign back in with Google before changing your password.');
                      } else {
                        setPasswordError(e.message);
                      }
                    } finally {
                      setIsChangingPassword(false);
                    }
                  }}
                >
                  {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update My Password'}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
