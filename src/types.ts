export interface Employee {
  id: string;
  customId?: string;
  fullName: string;
  position: string;
  status: 'active' | 'inactive';
  dailySalary: number;
  hourlyRate: number;
  createdAt: string;
  uid: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  timeIn: string;
  timeOut: string;
  status: 'present' | 'absent' | 'pakyaw' | 'ut';
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
  totalUndertimeDays: number; // Days with < 8 hours
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
  totalPay: number;
  bulkId: string | null;
  uid: string;
  generatedAt: string;
  createdAt: string;
}
