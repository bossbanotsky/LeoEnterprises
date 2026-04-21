export interface Employee {
  id: string;
  customId?: string;
  fullName: string;
  position: string;
  status: 'active' | 'inactive';
  dailySalary: number;
  hourlyRate: number;
  email?: string;
  loginPassword?: string;
  createdAt: string;
  uid: string;
  
  // Personal & Government Details (Optional)
  birthday?: string;
  sex?: 'Male' | 'Female' | 'Other' | '';
  civilStatus?: 'Single' | 'Married' | 'Widowed' | 'Divorced' | 'Separated' | '';
  religion?: string;
  sssNumber?: string;
  philhealthNumber?: string;
  pagibigNumber?: string;
  tinNumber?: string;

  // Emergency Contact
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;

  // Profile Picture
  photoURL?: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  timeIn: string;
  timeOut: string;
  status: 'present' | 'absent' | 'pakyaw' | 'ut' | 'hd';
  regularHours: number;
  otHours: number;
  pakyawJobId?: string; // Add this
  createdAt: string;
  userId: string;
}

export interface CashAdvance {
  id: string;
  employeeId: string;
  date: string;
  amount: number;
  notes?: string;
  createdAt: string;
  uid: string;
}

export interface PakyawJob {
  id: string;
  description: string;
  startDate: string;
  status: 'pending' | 'completed';
  totalPrice: number;
  employeeIds: string[];
  createdAt: string;
  uid: string;
}

export interface Payroll {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  totalPresent: number; // Represents Full Days (8 hours)
  totalHalfDays: number; // Days marked as HD (7am-12pm)
  totalUndertimeDays: number; // Days with < 8 hours (excluding HD)
  totalUndertimeHours: number; // Total hours lacking from 8-hour shift
  undertimeDetails: string[]; // List of dates and hours e.g. ["2024-03-20 (2.0 hrs)"]
  totalAbsent: number;
  absentDates: string[];
  totalRegularHours: number;
  totalOtHours: number;
  regularPay: number;
  otPay: number;
  totalPakyawPay: number;
  pakyawDetails: string[];
  totalGrossPay: number;
  cashAdvanceDeduction: number;
  cashAdvanceDetails?: string[];
  totalPay: number;
  bulkId: string | null;
  status?: 'paid';
  uid: string;
  generatedAt: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  postedBy: string; // Admin UID
  authorName: string; // For display
  createdAt: string;
  expiresAt: string;
  viewedBy: string[]; // Array of employee UIDs
  priority: 'low' | 'medium' | 'high';
}

export interface Chat {
  id: string;
  participants: string[]; // Array of UIDs
  type: 'group' | 'direct';
  name?: string; // Optional for group chat
  photoURL?: string; // Optional logo for group chat
  lastMessage?: string;
  lastMessageAt?: string;
  lastSenderId?: string;
  unreadCounts?: { [userId: string]: number };
  updatedAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: 'text' | 'image' | 'file';
  chatType: 'group' | 'direct';
  participants: string[];
  readBy?: { [userId: string]: string }; // Map of userId to read timestamp
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: 'admin' | 'employee';
  employeeId?: string; // Link to Employee document for employees
  photoURL?: string;
  createdAt: string;
}
