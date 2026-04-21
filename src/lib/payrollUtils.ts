import { differenceInMinutes, parse, format, parseISO, eachDayOfInterval, isWithinInterval } from 'date-fns';

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  status: 'present' | 'absent' | 'hd' | 'ut' | 'pakyaw';
  timeIn?: string;
  timeOut?: string;
  regularHours?: number;
  otHours?: number;
  jobName?: string;
  pakyawJobId?: string;
}

export function calculateAttendanceHours(att: Attendance) {
  let regHrs = 0;
  let otHrs = 0;

  if (att.timeIn && att.timeOut && (att.status === 'present' || att.status === 'ut' || att.status === 'hd')) {
    const [inH, inM] = att.timeIn.split(':').map(Number);
    const [outH, outM] = att.timeOut.split(':').map(Number);
    const start = inH + inM / 60;
    let end = outH + outM / 60;
    if (end < start) end += 24;

    const SHIFT_START = 7.0;
    const SHIFT_END = 16.0;
    const BREAK_START = 12.0;
    const BREAK_END = 13.0;

    // 1. Early OT (Before 7am)
    const earlyOt = Math.max(0, Math.min(end, SHIFT_START) - start);
    
    // 2. Late OT (After 4pm)
    const lateOt = Math.max(0, end - Math.max(start, SHIFT_END));

    // 3. Regular Range
    const regRangeStart = Math.max(start, SHIFT_START);
    const regRangeEnd = Math.min(end, SHIFT_END);
    
    let regDuration = Math.max(0, regRangeEnd - regRangeStart);

    // Subtract break overlap from regular hours
    const overlapStart = Math.max(regRangeStart, BREAK_START);
    const overlapEnd = Math.min(regRangeEnd, BREAK_END);
    const breakOverlap = Math.max(0, overlapEnd - overlapStart);
    regDuration -= breakOverlap;

    regHrs = parseFloat(regDuration.toFixed(2));
    otHrs = parseFloat((earlyOt + lateOt).toFixed(2));
  } else {
    // Fallback for missing times or other statuses
    if (att.regularHours !== undefined) {
      regHrs = att.regularHours;
    } else if (att.status === 'present') {
      regHrs = 8;
    } else if (att.status === 'ut') {
      regHrs = 5; 
    } else if (att.status === 'hd') {
      regHrs = 4;
    } else {
      regHrs = 0;
    }
    otHrs = att.otHours || 0;
  }

  return { regHrs, otHrs };
}
