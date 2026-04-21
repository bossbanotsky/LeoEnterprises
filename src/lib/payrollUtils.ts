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

    const breakStart = 12.0;
    const breakEnd = 13.0;
    const otCutoff = 16.0;

    const regRangeEnd = Math.min(end, otCutoff);
    let regDuration = Math.max(0, regRangeEnd - start);
    
    // Subtract break overlap
    const overlapStart = Math.max(start, breakStart);
    const overlapEnd = Math.min(regRangeEnd, breakEnd);
    const breakOverlap = Math.max(0, overlapEnd - overlapStart);
    regDuration -= breakOverlap;

    const otRangeStart = Math.max(start, otCutoff);
    const otDuration = Math.max(0, end - otRangeStart);

    regHrs = parseFloat(regDuration.toFixed(2));
    otHrs = parseFloat(otDuration.toFixed(2));
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
